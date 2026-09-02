"""Редактор истории: CRUD событий и импорт исследовательского JSON.

Импорт устроен в два шага. Сначала предпросмотр: разбираем файл, решаем по
каждому событию, что с ним делать, и показываем это редактору. Только потом
применяем. Ничего не публикуем — всё приходит черновиком, потому что решение
о публикации принимает человек, а не исследовательская выдача.
"""

import json
import re
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import (
    HistoryCategory,
    HistoryCategoryTranslation,
    HistoryEvent,
    HistoryEventCategory,
    HistoryEventPerson,
    HistoryEventRelation,
    HistoryEventTranslation,
    HistoryImage,
    HistoryImageTranslation,
    HistoryImport,
    HistorySource,
    HistoryStatus,
    Person,
    User,
)
from app.schemas import (
    HistoryAdminDetailOut,
    HistoryCategoryIn,
    HistoryCategoryOrderIn,
    HistoryCategoryUpdate,
    HistoryAdminListOut,
    HistoryAdminRowOut,
    HistoryCategoryAdminOut,
    HistoryEventPatchIn,
    HistoryEventWriteIn,
    HistoryImportIn,
    HistoryImportEventPlan,
    HistoryImportReportOut,
)
from app.security import current_user

router = APIRouter(prefix="/api/admin/history", tags=["history-admin"])

LANGUAGES = ("ru", "en")

TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
    "з": "z", "и": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "c",
    "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e",
    "ю": "yu", "я": "ya",
}


def title_for_slug(translations: dict) -> str:
    """Для slug берём английский заголовок: адрес всё равно латиницей, и
    /history/twitch-partner-program читается лучше транслита с русского."""
    for language in ("en", "ru"):
        block = translations.get(language) or {}
        title = block.get("title") if isinstance(block, dict) else getattr(block, "title", "")
        if title:
            return title
    return ""


def slugify(value: str) -> str:
    lowered = (value or "").strip().lower()
    converted = "".join(TRANSLIT.get(char, char) for char in lowered)
    cleaned = re.sub(r"[^a-z0-9]+", "-", converted).strip("-")
    return cleaned[:180] or "event"


def unique_slug(db: Session, base: str, exclude_id: int | None = None) -> str:
    candidate = base
    suffix = 2
    while True:
        statement = select(HistoryEvent.id).where(HistoryEvent.slug == candidate)
        if exclude_id:
            statement = statement.where(HistoryEvent.id != exclude_id)
        if not db.scalar(statement):
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1


def derive_dates(event: HistoryEvent) -> None:
    """sort_date и year считаем сами: если доверить их файлу, нейронка их выдумает."""
    event.sort_date = event.date_start
    event.year = event.date_start.year if event.date_start else None


def people_any_language(db: Session):
    return db.scalars(select(Person).execution_options(include_all_languages=True)).all()


def category_title(category: HistoryCategory, language: str = "ru") -> str:
    by_language = {item.language: item for item in category.translations}
    chosen = by_language.get(language) or by_language.get("ru") or by_language.get("en")
    return chosen.title if chosen else category.slug


def event_query():
    return select(HistoryEvent).options(
        selectinload(HistoryEvent.translations),
        selectinload(HistoryEvent.sources),
        selectinload(HistoryEvent.images).selectinload(HistoryImage.translations),
        selectinload(HistoryEvent.people).selectinload(HistoryEventPerson.person),
        selectinload(HistoryEvent.categories).selectinload(HistoryEventCategory.category).selectinload(HistoryCategory.translations),
    ).execution_options(include_all_languages=True)


def get_event_or_404(db: Session, event_id: int) -> HistoryEvent:
    event = db.scalar(event_query().where(HistoryEvent.id == event_id))
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


# --- Разделы -----------------------------------------------------------------


def category_rows(db: Session) -> list[dict]:
    categories = db.scalars(
        select(HistoryCategory)
        .options(selectinload(HistoryCategory.translations))
        .order_by(HistoryCategory.sort_order, HistoryCategory.id)
    ).all()
    by_id = {item.id: item for item in categories}

    events = dict(
        db.execute(
            select(HistoryEventCategory.category_id, func.count(HistoryEventCategory.event_id))
            .group_by(HistoryEventCategory.category_id)
        ).all()
    )
    children: dict[int, int] = {}
    for category in categories:
        if category.parent_id:
            children[category.parent_id] = children.get(category.parent_id, 0) + 1

    def path_of(category: HistoryCategory) -> tuple[str, int]:
        parts = []
        node: HistoryCategory | None = category
        seen = set()
        while node is not None and node.id not in seen:
            seen.add(node.id)
            parts.append(category_title(node))
            node = by_id.get(node.parent_id) if node.parent_id else None
        return " / ".join(reversed(parts)), len(parts) - 1

    # Порядок обхода дерева, а не алфавит: список в редакторе должен читаться
    # так же, как меню на сайте, иначе кнопки «Выше» и «Ниже» ничего не меняют.
    children_of: dict[int | None, list[HistoryCategory]] = {}
    for category in categories:
        children_of.setdefault(category.parent_id, []).append(category)
    for group in children_of.values():
        group.sort(key=lambda item: (item.sort_order, item.id))

    ordered: list[HistoryCategory] = []

    def walk(parent_id: int | None) -> None:
        for category in children_of.get(parent_id, []):
            ordered.append(category)
            walk(category.id)

    walk(None)
    # Раздел с потерянным родителем иначе выпал бы из списка совсем.
    ordered.extend(category for category in categories if category not in ordered)

    rows = []
    for category in ordered:
        path, depth = path_of(category)
        rows.append({
            "id": category.id,
            "parent_id": category.parent_id,
            "slug": category.slug,
            "title": category_title(category),
            "path": path,
            "is_platform": category.is_platform,
            "depth": depth,
            "sort_order": category.sort_order,
            "is_published": category.is_published,
            "titles": {item.language: item.title for item in category.translations},
            "event_count": events.get(category.id, 0),
            "child_count": children.get(category.id, 0),
        })
    return rows


@router.get("/categories", response_model=list[HistoryCategoryAdminOut])
def admin_categories(_user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    """Плоский список с полным путём: в выпадающем списке карточки дерево неудобно."""
    return category_rows(db)


def apply_titles(db: Session, category: HistoryCategory, titles: dict) -> None:
    existing = {item.language: item for item in category.translations}
    for language, title in titles.items():
        if language not in LANGUAGES:
            raise HTTPException(status_code=422, detail=f"Unsupported language: {language}")
        text = (title or "").strip()
        target = existing.get(language)
        if not text:
            if target is not None:
                category.translations.remove(target)
            continue
        if target is None:
            category.translations.append(HistoryCategoryTranslation(language=language, title=text))
        else:
            target.title = text


def unique_category_slug(db: Session, base: str, exclude_id: int | None = None) -> str:
    candidate = base
    suffix = 2
    while True:
        statement = select(HistoryCategory.id).where(HistoryCategory.slug == candidate)
        if exclude_id:
            statement = statement.where(HistoryCategory.id != exclude_id)
        if not db.scalar(statement):
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1


def assert_no_cycle(db: Session, category_id: int, parent_id: int | None) -> None:
    """Раздел нельзя вложить в собственного потомка: дерево перестало бы
    иметь корень, а обход пути зациклился бы."""
    node_id = parent_id
    seen = set()
    while node_id and node_id not in seen:
        if node_id == category_id:
            raise HTTPException(status_code=422, detail="Раздел нельзя вложить в самого себя")
        seen.add(node_id)
        node_id = db.scalar(select(HistoryCategory.parent_id).where(HistoryCategory.id == node_id))


@router.post("/categories", response_model=HistoryCategoryAdminOut, status_code=201)
def create_category(payload: HistoryCategoryIn, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    title = payload.titles.get("en") or payload.titles.get("ru") or ""
    if not title.strip():
        raise HTTPException(status_code=422, detail="Нужен хотя бы один заголовок")
    if payload.parent_id and not db.get(HistoryCategory, payload.parent_id):
        raise HTTPException(status_code=422, detail="Родительский раздел не найден")
    category = HistoryCategory(
        slug=unique_category_slug(db, slugify(payload.slug or title)),
        parent_id=payload.parent_id,
        sort_order=payload.sort_order,
        is_platform=payload.is_platform,
        is_published=payload.is_published,
    )
    db.add(category)
    db.flush()
    apply_titles(db, category, payload.titles)
    db.commit()
    return next(row for row in category_rows(db) if row["id"] == category.id)


@router.patch("/categories/{category_id}", response_model=HistoryCategoryAdminOut)
def update_category(category_id: int, payload: HistoryCategoryUpdate, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    category = db.get(HistoryCategory, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    # detach отличает «вынести в корень» от «родителя не меняем»: null в
    # payload означал бы и то и другое.
    if payload.detach:
        category.parent_id = None
    elif payload.parent_id is not None:
        if not db.get(HistoryCategory, payload.parent_id):
            raise HTTPException(status_code=422, detail="Родительский раздел не найден")
        assert_no_cycle(db, category_id, payload.parent_id)
        category.parent_id = payload.parent_id
    if payload.slug:
        category.slug = unique_category_slug(db, payload.slug, category_id)
    if payload.sort_order is not None:
        category.sort_order = payload.sort_order
    if payload.is_platform is not None:
        category.is_platform = payload.is_platform
    if payload.is_published is not None:
        category.is_published = payload.is_published
    if payload.titles is not None:
        apply_titles(db, category, payload.titles)
    db.commit()
    return next(row for row in category_rows(db) if row["id"] == category_id)


@router.post("/categories/order", response_model=list[HistoryCategoryAdminOut])
def reorder_categories(payload: HistoryCategoryOrderIn, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    for position, category_id in enumerate(payload.ids):
        category = db.get(HistoryCategory, category_id)
        if category:
            category.sort_order = position
    db.commit()
    return category_rows(db)


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(category_id: int, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    category = db.get(HistoryCategory, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    if db.scalar(select(func.count()).select_from(HistoryCategory).where(HistoryCategory.parent_id == category_id)):
        raise HTTPException(status_code=409, detail="Сначала удалите или перенесите вложенные разделы")
    if db.scalar(select(func.count()).select_from(HistoryEventCategory).where(HistoryEventCategory.category_id == category_id)):
        raise HTTPException(status_code=409, detail="К разделу привязаны события, сначала перенесите их")
    db.delete(category)
    db.commit()


# --- Список и карточка -------------------------------------------------------


@router.get("/events", response_model=HistoryAdminListOut)
def admin_events(
    q: str | None = None,
    status: str | None = None,
    region: str | None = None,
    category_id: int | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    missing_translation: str | None = Query(default=None, pattern=r"^(ru|en)$"),
    without_sources: bool = False,
    without_images: bool = False,
    needs_verification: bool = False,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=30, ge=1, le=200),
    _user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> HistoryAdminListOut:
    statement = select(HistoryEvent)
    if q and q.strip():
        pattern = f"%{q.strip().lower()}%"
        statement = statement.where(
            or_(
                HistoryEvent.slug.ilike(pattern),
                HistoryEvent.id.in_(
                    select(HistoryEventTranslation.event_id).where(
                        func.py_lower(HistoryEventTranslation.title).like(pattern)
                    )
                ),
            )
        )
    if status:
        statement = statement.where(HistoryEvent.status == status)
    if region:
        statement = statement.where(HistoryEvent.region == region)
    if year_from is not None:
        statement = statement.where(HistoryEvent.year >= year_from)
    if year_to is not None:
        statement = statement.where(HistoryEvent.year <= year_to)
    if needs_verification:
        statement = statement.where(HistoryEvent.needs_verification.is_(True))
    if category_id:
        statement = statement.where(
            HistoryEvent.id.in_(select(HistoryEventCategory.event_id).where(HistoryEventCategory.category_id == category_id))
        )
    if missing_translation:
        statement = statement.where(
            HistoryEvent.id.not_in(
                select(HistoryEventTranslation.event_id).where(HistoryEventTranslation.language == missing_translation)
            )
        )
    if without_sources:
        statement = statement.where(HistoryEvent.id.not_in(select(HistorySource.event_id)))
    if without_images:
        statement = statement.where(HistoryEvent.id.not_in(select(HistoryImage.event_id)))

    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    events = db.scalars(
        statement.options(
            selectinload(HistoryEvent.translations),
            selectinload(HistoryEvent.sources),
            selectinload(HistoryEvent.images),
            selectinload(HistoryEvent.people),
            selectinload(HistoryEvent.categories).selectinload(HistoryEventCategory.category).selectinload(HistoryCategory.translations),
        )
        .order_by(HistoryEvent.sort_date.is_(None), HistoryEvent.sort_date.desc(), HistoryEvent.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).all()

    return HistoryAdminListOut(
        total=total, page=page, per_page=per_page,
        items=[row_out(event) for event in events],
    )


def row_out(event: HistoryEvent) -> HistoryAdminRowOut:
    by_language = {item.language: item for item in event.translations}
    title = (by_language.get("ru") or by_language.get("en"))
    primary = next((link for link in event.categories if link.is_primary), None) or (event.categories[0] if event.categories else None)
    return HistoryAdminRowOut(
        id=event.id,
        slug=event.slug,
        title=title.title if title else event.slug,
        date_start=event.date_start,
        date_precision=event.date_precision,
        year=event.year,
        region=event.region,
        status=event.status,
        is_published=event.is_published,
        importance=event.importance,
        confidence=event.confidence,
        needs_verification=event.needs_verification,
        ru_status=by_language["ru"].translation_status if "ru" in by_language else None,
        en_status=by_language["en"].translation_status if "en" in by_language else None,
        source_count=len(event.sources),
        image_count=len(event.images),
        people_count=len(event.people),
        category_title=category_title(primary.category) if primary else None,
        updated_at=event.updated_at,
    )


@router.get("/events/{event_id}", response_model=HistoryAdminDetailOut)
def admin_event(event_id: int, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return detail_out(db, get_event_or_404(db, event_id))


def detail_out(db: Session, event: HistoryEvent) -> dict:
    primary = next((link for link in event.categories if link.is_primary), None)
    related = db.scalars(
        select(HistoryEvent.slug)
        .where(HistoryEvent.id.in_(
            select(HistoryEventRelation.related_event_id).where(HistoryEventRelation.event_id == event.id)
        ))
    ).all()
    images = []
    for image in event.images:
        captions = {item.language: item.caption or "" for item in image.translations}
        alts = {item.language: item.alt_text or "" for item in image.translations}
        images.append({
            "id": image.id, "file_url": image.file_url, "source_url": image.source_url,
            "author": image.author, "license": image.license, "taken_at": image.taken_at,
            "sort_order": image.sort_order, "is_cover": image.is_cover,
            "review_status": image.review_status, "caption": captions, "alt_text": alts,
        })
    return {
        "id": event.id,
        "slug": event.slug,
        "external_id": event.external_id,
        "date_start": event.date_start,
        "date_end": event.date_end,
        "date_precision": event.date_precision,
        "year": event.year,
        "region": event.region,
        "importance": event.importance,
        "confidence": event.confidence,
        "needs_verification": event.needs_verification,
        "status": event.status,
        "is_published": event.is_published,
        "cover_image_url": event.cover_image_url,
        "category_ids": [link.category_id for link in event.categories],
        "primary_category_id": primary.category_id if primary else None,
        "translations": {
            item.language: {
                "language": item.language, "title": item.title, "summary": item.summary,
                "content": item.content, "historical_context": item.historical_context,
                "consequences": item.consequences, "translation_status": item.translation_status,
            }
            for item in event.translations
        },
        "sources": [
            {
                "url": item.url, "title": item.title, "publisher": item.publisher,
                "published_at": item.published_at, "language": item.language,
                "source_status": item.source_status, "sort_order": item.sort_order,
            }
            for item in event.sources
        ],
        "images": images,
        "people": [
            {
                "id": link.id, "person_id": link.person_id, "relation": link.relation, "role": link.role,
                "name": link.person.name, "slug": link.person.slug, "site_lang": link.person.site_lang,
            }
            for link in event.people
        ],
        "related_slugs": list(related),
        "updated_at": event.updated_at,
    }


def apply_write(db: Session, event: HistoryEvent, payload: HistoryEventWriteIn | HistoryEventPatchIn, *, partial: bool) -> None:
    scalars = payload.model_dump(
        exclude={"category_ids", "primary_category_id", "translations", "sources", "people", "related_slugs", "slug"},
        exclude_none=partial,
    )
    for key, value in scalars.items():
        setattr(event, key, value)
    if payload.slug:
        event.slug = unique_slug(db, slugify(payload.slug), event.id)
    derive_dates(event)

    if payload.translations is not None:
        existing = {item.language: item for item in event.translations}
        for language, translation in payload.translations.items():
            if language not in LANGUAGES:
                raise HTTPException(status_code=422, detail=f"Unsupported language: {language}")
            target = existing.get(language)
            if target is None:
                target = HistoryEventTranslation(event_id=event.id, language=language, title="")
                event.translations.append(target)
            for field, value in translation.model_dump().items():
                setattr(target, field, value)
        # Пустой перевод убираем целиком: «есть, но без заголовка» ломает списки.
        for language, target in list(existing.items()):
            if language in payload.translations and not payload.translations[language].title.strip():
                event.translations.remove(target)

    if payload.sources is not None:
        event.sources.clear()
        db.flush()
        for order, source in enumerate(payload.sources):
            data = source.model_dump()
            data["sort_order"] = data.get("sort_order") or order
            event.sources.append(HistorySource(**data))

    if payload.people is not None:
        event.people.clear()
        db.flush()
        known = {person.id for person in people_any_language(db)}
        for link in payload.people:
            if link.person_id not in known:
                raise HTTPException(status_code=422, detail=f"Person {link.person_id} not found")
            event.people.append(HistoryEventPerson(**link.model_dump()))

    if payload.category_ids is not None:
        event.categories.clear()
        db.flush()
        for category_id in dict.fromkeys(payload.category_ids):
            if not db.get(HistoryCategory, category_id):
                raise HTTPException(status_code=422, detail=f"Category {category_id} not found")
            event.categories.append(HistoryEventCategory(
                category_id=category_id,
                is_primary=category_id == payload.primary_category_id,
            ))
        if payload.primary_category_id is None and event.categories:
            event.categories[0].is_primary = True

    if payload.related_slugs is not None:
        db.flush()
        db.query(HistoryEventRelation).filter(HistoryEventRelation.event_id == event.id).delete()
        for slug in dict.fromkeys(payload.related_slugs):
            target = db.scalar(select(HistoryEvent).where(HistoryEvent.slug == slug))
            if target and target.id != event.id:
                db.add(HistoryEventRelation(event_id=event.id, related_event_id=target.id))


@router.post("/events", response_model=HistoryAdminDetailOut, status_code=201)
def create_event(payload: HistoryEventWriteIn, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    title = title_for_slug({key: value for key, value in (payload.translations or {}).items()})
    event = HistoryEvent(slug=unique_slug(db, slugify(payload.slug or title)))
    db.add(event)
    db.flush()
    apply_write(db, event, payload, partial=False)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Event slug already exists")
    return detail_out(db, get_event_or_404(db, event.id))


@router.patch("/events/{event_id}", response_model=HistoryAdminDetailOut)
def update_event(event_id: int, payload: HistoryEventPatchIn, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    event = get_event_or_404(db, event_id)
    apply_write(db, event, payload, partial=True)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Event slug already exists")
    return detail_out(db, get_event_or_404(db, event_id))


@router.delete("/events/{event_id}", status_code=204)
def delete_event(event_id: int, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    event = get_event_or_404(db, event_id)
    if event.is_published:
        raise HTTPException(status_code=409, detail="Сначала снимите событие с публикации")
    db.delete(event)
    db.commit()


# --- Импорт ------------------------------------------------------------------


def parse_date(value: Any) -> date | None:
    if not value:
        return None
    text = str(value).strip()
    for pattern, builder in (
        (r"^(\d{4})-(\d{2})-(\d{2})$", lambda m: date(int(m[1]), int(m[2]), int(m[3]))),
        (r"^(\d{4})-(\d{2})$", lambda m: date(int(m[1]), int(m[2]), 1)),
        (r"^(\d{4})$", lambda m: date(int(m[1]), 1, 1)),
    ):
        match = re.match(pattern, text)
        if match:
            try:
                return builder(match)
            except ValueError:
                return None
    return None


def match_person(spec: Any, people: list[Person]) -> Person | None:
    """Ищем человека, но никогда не создаём: нейронка пишет одно имя тремя
    способами, и автосоздание превратило бы справочник в свалку."""
    if isinstance(spec, str):
        spec = {"name": spec}
    if not isinstance(spec, dict):
        return None
    key = (spec.get("canonical_key") or "").strip().lower()
    slug = (spec.get("slug") or "").strip().lower()
    name = (spec.get("name") or "").strip().lower()
    links = {str(value).rstrip("/").rsplit("/", 1)[-1].lower().lstrip("@") for value in (spec.get("links") or {}).values() if value}

    for person in people:
        if key and (person.canonical_key or "").lower() == key:
            return person
    for person in people:
        if slug and person.slug.lower() == slug:
            return person
    for person in people:
        if name and person.name.strip().lower() == name:
            return person
    for person in people:
        own = {str(value).rstrip("/").rsplit("/", 1)[-1].lower().lstrip("@") for value in (person.links or {}).values() if value}
        if links & own:
            return person
    return None


def normalized_title(value: str) -> str:
    lowered = (value or "").lower()
    converted = "".join(TRANSLIT.get(char, char) for char in lowered)
    return re.sub(r"[^a-z0-9]", "", converted)


def match_event(db: Session, spec: dict) -> tuple[HistoryEvent | None, str]:
    """Порядок важен: сначала то, что модель сама признала совпадением,
    потом точные ключи, и только затем нечёткое сравнение."""
    hinted = (spec.get("matches_existing") or "").strip()
    if hinted:
        found = db.scalar(select(HistoryEvent).where(HistoryEvent.slug == hinted))
        if found:
            return found, "модель указала совпадение"
    slug = (spec.get("slug") or "").strip()
    if slug:
        found = db.scalar(select(HistoryEvent).where(HistoryEvent.slug == slug))
        if found:
            return found, "совпадает slug"
    external = (spec.get("external_id") or "").strip()
    if external:
        found = db.scalar(select(HistoryEvent).where(HistoryEvent.external_id == external))
        if found:
            return found, "совпадает external_id"

    start = parse_date(spec.get("date_start"))
    title = ""
    for language in LANGUAGES:
        title = title or ((spec.get("translations") or {}).get(language) or {}).get("title", "")
    if start and title:
        candidates = db.scalars(
            event_query().where(HistoryEvent.year == start.year)
        ).all()
        needle = normalized_title(title)
        for candidate in candidates:
            for translation in candidate.translations:
                other = normalized_title(translation.title)
                if not other or not needle:
                    continue
                if needle == other or needle in other or other in needle:
                    return candidate, "тот же год и похожее название"
    return None, ""


def plan_import(db: Session, payload: dict, mode: str) -> tuple[list[dict], list[str], list[str]]:
    events = payload.get("events")
    if not isinstance(events, list):
        raise HTTPException(status_code=422, detail="В файле нет массива events")

    people = people_any_language(db)
    categories = {item.slug: item for item in db.scalars(select(HistoryCategory)).all()}
    unmatched_people: set[str] = set()
    unknown_categories: set[str] = set()
    plans: list[dict] = []

    for index, spec in enumerate(events):
        errors: list[str] = []
        warnings: list[str] = []
        if not isinstance(spec, dict):
            plans.append({"index": index, "external_id": None, "slug": None, "title": f"Запись {index + 1}",
                          "action": "error", "reason": "ожидается объект", "errors": ["ожидается объект"], "warnings": []})
            continue

        translations = spec.get("translations") or {}
        title = ""
        for language in LANGUAGES:
            block = translations.get(language) or {}
            title = title or (block.get("title") or "")
        if not title:
            errors.append("ни одного заголовка")

        for language in translations:
            if language not in LANGUAGES:
                warnings.append(f"язык {language} пропущен")

        sources = [item for item in (spec.get("sources") or []) if isinstance(item, dict) and item.get("url")]
        if not sources:
            errors.append("нет источников")
        elif len(sources) < 2:
            warnings.append("меньше двух источников — потребуется проверка")

        if not parse_date(spec.get("date_start")) and spec.get("date_precision") != "unknown":
            warnings.append("дата не разобрана")

        for slug in spec.get("categories") or ([spec["category"]] if spec.get("category") else []):
            slug = str(slug).strip()
            if slug and slug not in categories:
                unknown_categories.add(slug)
                warnings.append(f"раздел «{slug}» не найден")

        for person_spec in spec.get("people") or []:
            if match_person(person_spec, people) is None:
                label = person_spec.get("name") if isinstance(person_spec, dict) else str(person_spec)
                if label:
                    unmatched_people.add(str(label))
                    warnings.append(f"участник «{label}» не найден в справочнике")

        existing, reason = match_event(db, spec)
        if errors:
            action, decision = "error", "; ".join(errors)
        elif existing and mode in {"create_and_update", "translations_only", "sources_only"}:
            action, decision = "update", reason
        elif existing:
            action, decision = "skip", f"{reason} — режим не обновляет существующие"
        elif mode in {"translations_only", "sources_only"}:
            action, decision = "skip", "события нет в базе, а режим только дополняет"
        else:
            action, decision = "create", "новое событие"

        plans.append({
            "index": index,
            "external_id": spec.get("external_id"),
            "slug": spec.get("slug"),
            "title": title or f"Запись {index + 1}",
            "action": action,
            "reason": decision,
            "matched_event_id": existing.id if existing else None,
            "matched_slug": existing.slug if existing else None,
            "errors": errors,
            "warnings": warnings,
        })
    return plans, sorted(unmatched_people), sorted(unknown_categories)


def write_event(db: Session, spec: dict, existing: HistoryEvent | None, mode: str) -> HistoryEvent:
    people = people_any_language(db)
    categories = {item.slug: item for item in db.scalars(select(HistoryCategory)).all()}
    translations = spec.get("translations") or {}
    title = title_for_slug(translations)

    event = existing
    if event is None:
        event = HistoryEvent(slug=unique_slug(db, slugify(spec.get("slug") or title)))
        db.add(event)
        db.flush()

    only_translations = mode == "translations_only"
    only_sources = mode == "sources_only"

    if not only_translations and not only_sources:
        event.external_id = spec.get("external_id") or event.external_id
        event.date_start = parse_date(spec.get("date_start"))
        event.date_end = parse_date(spec.get("date_end"))
        precision = str(spec.get("date_precision") or "day")
        event.date_precision = precision if precision in {"day", "month", "year", "period", "unknown"} else "day"
        region = str(spec.get("region") or "global")
        event.region = region if region in {"global", "ru", "en", "other"} else "other"
        try:
            event.importance = max(0, min(100, int(spec.get("importance", 50))))
        except (TypeError, ValueError):
            event.importance = 50
        try:
            event.confidence = max(0, min(100, int(spec.get("confidence", 100))))
        except (TypeError, ValueError):
            event.confidence = 100
        # Статус из файла игнорируем: публикует человек, а не исследование.
        event.status = HistoryStatus.DRAFT
        event.is_published = False
        derive_dates(event)

    if not only_sources:
        existing_translations = {item.language: item for item in event.translations}
        for language in LANGUAGES:
            block = translations.get(language)
            if not isinstance(block, dict) or not (block.get("title") or "").strip():
                continue
            target = existing_translations.get(language)
            if target is None:
                target = HistoryEventTranslation(event_id=event.id, language=language, title="")
                event.translations.append(target)
            target.title = str(block.get("title") or "")[:300]
            target.summary = str(block.get("summary") or "")
            target.content = str(block.get("content") or "")
            target.historical_context = str(block.get("historical_context") or "")
            target.consequences = str(block.get("consequences") or "")
            status = str(block.get("translation_status") or "draft")
            target.translation_status = status if status in {"missing", "draft", "machine", "reviewed"} else "draft"

    if not only_translations:
        known_urls = {item.url for item in event.sources}
        order = len(event.sources)
        for item in spec.get("sources") or []:
            if not isinstance(item, dict) or not item.get("url") or item["url"] in known_urls:
                continue
            event.sources.append(HistorySource(
                url=str(item["url"])[:2000],
                title=str(item.get("title") or item["url"])[:300],
                publisher=(str(item["publisher"])[:200] if item.get("publisher") else None),
                published_at=parse_date(item.get("published_at")),
                language=(str(item["language"])[:5] if item.get("language") else None),
                sort_order=order,
            ))
            known_urls.add(item["url"])
            order += 1

    if not only_translations and not only_sources:
        slugs = spec.get("categories") or ([spec["category"]] if spec.get("category") else [])
        wanted = [categories[str(slug).strip()] for slug in slugs if str(slug).strip() in categories]
        if wanted:
            event.categories.clear()
            db.flush()
            for position, category in enumerate(wanted):
                event.categories.append(HistoryEventCategory(category_id=category.id, is_primary=position == 0))

        linked = {link.person_id for link in event.people}
        for person_spec in spec.get("people") or []:
            person = match_person(person_spec, people)
            if person and person.id not in linked:
                role = person_spec.get("role") if isinstance(person_spec, dict) else None
                event.people.append(HistoryEventPerson(
                    person_id=person.id, relation="participant",
                    role=(str(role)[:300] if role else None),
                ))
                linked.add(person.id)

        # Картинки только кандидатами: ссылки из исследования почти всегда битые.
        known_images = {item.source_url for item in event.images if item.source_url}
        for item in spec.get("images") or []:
            if not isinstance(item, dict):
                continue
            url = item.get("source_url") or item.get("url")
            if not url or url in known_images:
                continue
            image = HistoryImage(
                source_url=str(url)[:2000],
                author=(str(item["author"])[:200] if item.get("author") else None),
                license=(str(item["license"])[:120] if item.get("license") else None),
                is_cover=bool(item.get("is_cover")),
                review_status="candidate",
                sort_order=len(event.images),
            )
            caption = item.get("caption")
            captions = caption if isinstance(caption, dict) else ({"ru": caption} if caption else {})
            for language, text in captions.items():
                if language in LANGUAGES and text:
                    image.translations.append(HistoryImageTranslation(language=language, caption=str(text)))
            event.images.append(image)
            known_images.add(url)

        event.needs_verification = len(event.sources) < 2 or event.confidence < 70

    return event


@router.post("/imports", response_model=HistoryImportReportOut)
def import_history(payload: HistoryImportIn, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> HistoryImportReportOut:
    document = payload.payload
    if document.get("format") not in (None, "streamconflicts-history"):
        raise HTTPException(status_code=422, detail="Неизвестный формат файла")

    plans, unmatched_people, unknown_categories = plan_import(db, document, payload.mode)
    counts = {"create": 0, "update": 0, "skip": 0, "error": 0}
    for plan in plans:
        counts[plan["action"]] += 1

    applied = payload.mode != "validate"
    created = updated = 0
    import_id = None

    if applied:
        # Сырой файл сохраняем целиком: при смене схемы или ошибке разбора
        # переимпортируем, не гоняя исследование заново.
        record = HistoryImport(
            filename=payload.filename,
            mode=payload.mode,
            status="applied",
            raw_json=json.dumps(document, ensure_ascii=False),
            stats=counts,
        )
        db.add(record)
        db.flush()
        import_id = record.id

        events = document.get("events") or []
        for plan in plans:
            if plan["action"] not in {"create", "update"}:
                continue
            spec = events[plan["index"]]
            existing = db.get(HistoryEvent, plan["matched_event_id"]) if plan["matched_event_id"] else None
            write_event(db, spec, existing, payload.mode)
            if plan["action"] == "create":
                created += 1
            else:
                updated += 1
        record.stats = {**counts, "created": created, "updated": updated}
        db.commit()

    return HistoryImportReportOut(
        mode=payload.mode,
        applied=applied,
        import_id=import_id,
        total=len(plans),
        to_create=counts["create"],
        to_update=counts["update"],
        to_skip=counts["skip"],
        with_errors=counts["error"],
        events=[HistoryImportEventPlan(**plan) for plan in plans],
        unmatched_people=unmatched_people,
        unknown_categories=unknown_categories,
        created_events=created,
        updated_events=updated,
    )
