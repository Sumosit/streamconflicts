"""Публичное API истории стриминга.

Событие хранится в одном экземпляре, тексты — в history_event_translations.
Язык ответа берём из заголовка сайта (current_site_lang), но если перевода нет,
отдаём другой язык и помечаем это флагом: пустая страница хуже, чем страница
на английском с подписью «перевод пока отсутствует».
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import current_site_lang, get_db
from app.models import (
    HistoryCategory,
    HistoryEvent,
    HistoryEventCategory,
    HistoryEventPerson,
    HistoryEventRelation,
    HistoryEventTranslation,
    HistoryImage,
    HistoryStatus,
    Person,
)
from app.schemas import (
    HistoryCategoryNode,
    HistoryEventDetailOut,
    HistoryEventListOut,
    HistoryImageOut,
    HistoryPersonRefOut,
    HistorySourceOut,
)

router = APIRouter(prefix="/api/history", tags=["history"])

MAX_PER_PAGE = 60


def request_language() -> str:
    language = current_site_lang.get()
    return language if language in {"ru", "en"} else "ru"


def pick_translation(event: HistoryEvent, language: str) -> tuple[HistoryEventTranslation | None, bool]:
    """Возвращает перевод и признак «показан не тот язык, который просили»."""
    by_language = {item.language: item for item in event.translations}
    if language in by_language:
        return by_language[language], False
    fallback = "en" if language == "ru" else "ru"
    if fallback in by_language:
        return by_language[fallback], True
    return (event.translations[0], True) if event.translations else (None, False)


def category_title(category: HistoryCategory, language: str) -> str:
    by_language = {item.language: item for item in category.translations}
    chosen = by_language.get(language) or by_language.get("en") or by_language.get("ru")
    return chosen.title if chosen else category.slug


def published_events():
    return select(HistoryEvent).where(
        HistoryEvent.is_published.is_(True),
        HistoryEvent.status == HistoryStatus.PUBLISHED,
    )


def descendant_ids(db: Session, root: HistoryCategory) -> list[int]:
    """Раздел показывает и свои события, и события всех вложенных разделов:
    открыв «Платформы», читатель ждёт увидеть в том числе события Twitch."""
    collected = [root.id]
    frontier = [root.id]
    while frontier:
        children = db.scalars(select(HistoryCategory.id).where(HistoryCategory.parent_id.in_(frontier))).all()
        children = [item for item in children if item not in collected]
        if not children:
            break
        collected.extend(children)
        frontier = children
    return collected


@router.get("/categories", response_model=list[HistoryCategoryNode])
def history_categories(db: Session = Depends(get_db)) -> list[HistoryCategoryNode]:
    language = request_language()
    categories = db.scalars(
        select(HistoryCategory)
        .where(HistoryCategory.is_published.is_(True))
        .options(selectinload(HistoryCategory.translations))
        .order_by(HistoryCategory.sort_order, HistoryCategory.id)
    ).all()

    counts = dict(
        db.execute(
            select(HistoryEventCategory.category_id, func.count(HistoryEventCategory.event_id))
            .join(HistoryEvent, HistoryEvent.id == HistoryEventCategory.event_id)
            .where(HistoryEvent.is_published.is_(True), HistoryEvent.status == HistoryStatus.PUBLISHED)
            .group_by(HistoryEventCategory.category_id)
        ).all()
    )

    nodes: dict[int, HistoryCategoryNode] = {}
    for category in categories:
        nodes[category.id] = HistoryCategoryNode(
            id=category.id,
            slug=category.slug,
            title=category_title(category, language),
            is_platform=category.is_platform,
            event_count=counts.get(category.id, 0),
            children=[],
        )

    roots: list[HistoryCategoryNode] = []
    for category in categories:
        node = nodes[category.id]
        parent = nodes.get(category.parent_id) if category.parent_id else None
        if parent:
            parent.children.append(node)
        else:
            roots.append(node)

    # Счётчик раздела включает вложенные: список справа тоже показывает их.
    def roll_up(node: HistoryCategoryNode) -> int:
        node.event_count += sum(roll_up(child) for child in node.children)
        return node.event_count

    for node in roots:
        roll_up(node)
    return roots


@router.get("/events", response_model=HistoryEventListOut)
def history_events(
    category: str | None = None,
    region: str | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    person: str | None = None,
    q: str | None = None,
    with_images: bool = False,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=MAX_PER_PAGE),
    db: Session = Depends(get_db),
) -> HistoryEventListOut:
    language = request_language()
    statement = published_events()

    if category:
        root = db.scalar(select(HistoryCategory).where(HistoryCategory.slug == category))
        if not root:
            raise HTTPException(status_code=404, detail="Category not found")
        statement = statement.where(
            HistoryEvent.id.in_(
                select(HistoryEventCategory.event_id).where(
                    HistoryEventCategory.category_id.in_(descendant_ids(db, root))
                )
            )
        )
    if region and region != "all":
        statement = statement.where(HistoryEvent.region == region)
    if year_from is not None:
        statement = statement.where(HistoryEvent.year >= year_from)
    if year_to is not None:
        statement = statement.where(HistoryEvent.year <= year_to)
    if person:
        # people языковая, поэтому ищем по slug в обоих языках сразу.
        person_ids = select(Person.id).where(Person.slug == person)  # оба языка сразу
        statement = statement.where(
            HistoryEvent.id.in_(
                select(HistoryEventPerson.event_id).where(HistoryEventPerson.person_id.in_(person_ids))
            )
        )
    if with_images:
        statement = statement.where(
            HistoryEvent.id.in_(
                select(HistoryImage.event_id).where(HistoryImage.review_status == "approved")
            )
        )
    if q:
        pattern = f"%{q.strip()}%"
        statement = statement.where(
            HistoryEvent.id.in_(
                select(HistoryEventTranslation.event_id).where(
                    or_(
                        HistoryEventTranslation.title.ilike(pattern),
                        HistoryEventTranslation.summary.ilike(pattern),
                    )
                )
            )
        )

    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    rows = db.scalars(
        statement.execution_options(include_all_languages=True).options(
            selectinload(HistoryEvent.translations),
            selectinload(HistoryEvent.categories).selectinload(HistoryEventCategory.category).selectinload(HistoryCategory.translations),
        )
        # Событиям без даты не место в начале ленты, поэтому они уходят вниз.
        .order_by(HistoryEvent.sort_date.is_(None), HistoryEvent.sort_date, HistoryEvent.importance.desc(), HistoryEvent.id)
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).all()

    return HistoryEventListOut(
        total=total,
        page=page,
        per_page=per_page,
        items=[list_item(event, language, db) for event in rows],
    )


def list_item(event: HistoryEvent, language: str, db: Session) -> dict:
    translation, is_fallback = pick_translation(event, language)
    primary = next((link for link in event.categories if link.is_primary), None) or (event.categories[0] if event.categories else None)
    return {
        "id": event.id,
        "slug": event.slug,
        "title": translation.title if translation else event.slug,
        "summary": translation.summary if translation else "",
        "language": translation.language if translation else language,
        "translation_missing": is_fallback,
        "date_start": event.date_start,
        "date_end": event.date_end,
        "date_precision": event.date_precision,
        "year": event.year,
        "region": event.region,
        "importance": event.importance,
        "cover_image_url": event.cover_image_url,
        "category_slug": primary.category.slug if primary else None,
        "category_title": category_title(primary.category, language) if primary else None,
    }


@router.get("/events/{slug}", response_model=HistoryEventDetailOut)
def history_event(slug: str, db: Session = Depends(get_db)) -> HistoryEventDetailOut:
    language = request_language()
    event = db.scalar(
        published_events()
        .execution_options(include_all_languages=True)
        .where(HistoryEvent.slug == slug)
        .options(
            selectinload(HistoryEvent.translations),
            selectinload(HistoryEvent.sources),
            selectinload(HistoryEvent.images).selectinload(HistoryImage.translations),
            selectinload(HistoryEvent.people).selectinload(HistoryEventPerson.person),
            selectinload(HistoryEvent.categories).selectinload(HistoryEventCategory.category).selectinload(HistoryCategory.translations),
        )
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    translation, is_fallback = pick_translation(event, language)
    related_ids = db.scalars(
        select(HistoryEventRelation.related_event_id).where(HistoryEventRelation.event_id == event.id)
    ).all()
    related = db.scalars(
        published_events()
        .where(HistoryEvent.id.in_(related_ids))
        .options(selectinload(HistoryEvent.translations), selectinload(HistoryEvent.categories).selectinload(HistoryEventCategory.category).selectinload(HistoryCategory.translations))
        .order_by(HistoryEvent.sort_date)
    ).all() if related_ids else []

    breadcrumbs = []
    primary = next((link for link in event.categories if link.is_primary), None) or (event.categories[0] if event.categories else None)
    if primary:
        chain: list[HistoryCategory] = []
        node: HistoryCategory | None = primary.category
        while node is not None:
            chain.append(node)
            node = node.parent
        breadcrumbs = [{"slug": item.slug, "title": category_title(item, language)} for item in reversed(chain)]

    return HistoryEventDetailOut(
        **list_item(event, language, db),
        content=translation.content if translation else "",
        historical_context=translation.historical_context if translation else "",
        consequences=translation.consequences if translation else "",
        available_languages=sorted(item.language for item in event.translations),
        breadcrumbs=breadcrumbs,
        sources=[HistorySourceOut.model_validate(item) for item in event.sources],
        images=[image_out(item, language) for item in event.images if item.review_status == "approved"],
        people=[person_out(item) for item in event.people],
        related=[list_item(item, language, db) for item in related],
    )


def image_out(image: HistoryImage, language: str) -> HistoryImageOut:
    by_language = {item.language: item for item in image.translations}
    chosen = by_language.get(language) or next(iter(by_language.values()), None)
    return HistoryImageOut(
        id=image.id,
        file_url=image.file_url,
        source_url=image.source_url,
        author=image.author,
        license=image.license,
        is_cover=image.is_cover,
        caption=chosen.caption if chosen else None,
        alt_text=chosen.alt_text if chosen else None,
    )


def person_out(link: HistoryEventPerson) -> HistoryPersonRefOut:
    return HistoryPersonRefOut(
        id=link.person.id,
        slug=link.person.slug,
        name=link.person.name,
        initials=link.person.initials,
        avatar_url=link.person.avatar_url,
        site_lang=link.person.site_lang,
        relation=link.relation,
        role=link.role,
    )


@router.get("/years", response_model=list[int])
def history_years(db: Session = Depends(get_db)) -> list[int]:
    """Годы, за которые есть опубликованные события, — для фильтра по периодам."""
    rows = db.scalars(
        select(HistoryEvent.year)
        .where(HistoryEvent.is_published.is_(True), HistoryEvent.status == HistoryStatus.PUBLISHED, HistoryEvent.year.is_not(None))
        .distinct()
        .order_by(HistoryEvent.year)
    ).all()
    return [int(year) for year in rows]
