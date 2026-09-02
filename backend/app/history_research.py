"""Очередь исследования и генератор запросов к нейронке.

Смысл модуля — не грузить в контекст модели всю базу. В запрос уходит только
срез: период, регион, категория и короткий список уже известных событий этого
среза (дата, slug, заголовок). Для одного месяца это два десятка строк вместо
сотен событий, и модель при этом видит, чего не надо повторять.
"""

import calendar
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import (
    HistoryCategory,
    HistoryEvent,
    HistoryEventCategory,
    HistoryResearchBatch,
    User,
)
from app.schemas import (
    HistoryPromptOut,
    HistoryResearchBatchIn,
    HistoryResearchBatchOut,
    HistoryResearchBatchUpdate,
    HistoryResearchPlanIn,
)
from app.security import current_user

router = APIRouter(prefix="/api/admin/history/research", tags=["history-research"])

PROMPT_VERSION = 1

REGION_LABELS = {
    "global": "мировые события",
    "ru": "русскоязычный сегмент",
    "en": "англоязычный сегмент",
    "other": "другие регионы",
}


def category_title(category: HistoryCategory, language: str = "ru") -> str:
    by_language = {item.language: item for item in category.translations}
    chosen = by_language.get(language) or by_language.get("ru") or by_language.get("en")
    return chosen.title if chosen else category.slug


def descendant_ids(db: Session, root_id: int) -> list[int]:
    collected = [root_id]
    frontier = [root_id]
    while frontier:
        children = db.scalars(select(HistoryCategory.id).where(HistoryCategory.parent_id.in_(frontier))).all()
        children = [item for item in children if item not in collected]
        if not children:
            break
        collected.extend(children)
        frontier = children
    return collected


def known_events(db: Session, batch: HistoryResearchBatch) -> list[str]:
    """Дайджест среза: только дата, slug и заголовок — три поля, не больше.
    Всё остальное раздувает запрос и не помогает модели избежать повторов."""
    statement = select(HistoryEvent).options(selectinload(HistoryEvent.translations))
    if batch.period_start:
        statement = statement.where(HistoryEvent.sort_date >= batch.period_start)
    if batch.period_end:
        statement = statement.where(HistoryEvent.sort_date <= batch.period_end)
    if batch.region and batch.region != "all":
        statement = statement.where(HistoryEvent.region == batch.region)
    if batch.category_id:
        statement = statement.where(
            HistoryEvent.id.in_(
                select(HistoryEventCategory.event_id).where(
                    HistoryEventCategory.category_id.in_(descendant_ids(db, batch.category_id))
                )
            )
        )
    events = db.scalars(statement.order_by(HistoryEvent.sort_date)).all()

    lines = []
    for event in events:
        by_language = {item.language: item for item in event.translations}
        translation = by_language.get("en") or by_language.get("ru")
        stamp = event.date_start.isoformat() if event.date_start else "дата неизвестна"
        lines.append(f"{stamp} | {event.slug} | {translation.title if translation else event.slug}")
    return lines


def period_label(batch: HistoryResearchBatch) -> str:
    if not batch.period_start and not batch.period_end:
        return "весь период"
    start = batch.period_start.isoformat() if batch.period_start else "начало"
    end = batch.period_end.isoformat() if batch.period_end else "сегодня"
    return f"с {start} по {end}"


def build_prompt(db: Session, batch: HistoryResearchBatch) -> str:
    category = db.get(HistoryCategory, batch.category_id) if batch.category_id else None
    category_line = category_title(category) if category else "любая тема истории стриминга"
    lines = known_events(db, batch)
    known_block = "\n".join(lines) if lines else "(в базе пока ничего нет за этот срез)"

    return f"""Найди события истории стриминга за период {period_label(batch)}.

Регион: {REGION_LABELS.get(batch.region, batch.region)}
Тема: {category_line}

Уже есть в базе — не повторяй их, но если найдёшь уточнение к одному из них,
верни его с полем "matches_existing" и указанным slug:
{known_block}

Для каждого нового события верни:
1. Дату — настолько точную, насколько её подтверждают источники.
2. Заголовок.
3. Краткое описание в одно-два предложения.
4. Исторический контекст: что происходило вокруг и почему это стало возможным.
5. Что произошло.
6. Последствия.
7. Участников — людей и компании.
8. Платформы.
9. Не менее двух независимых источников со ссылками.
10. Уровень уверенности от 0 до 100.

Требования:
- Не включай события, которые не подтверждаются проверяемыми источниками.
- Если точная дата неизвестна, укажи "date_precision": "month" или "year"
  и не выдумывай день.
- Не более 15 событий в ответе. Если их больше, верни самые значимые:
  пятнадцать полных описаний полезнее сорока огрызков.
- Пиши текст на английском языке, перевод будет отдельным запросом.

Верни результат в формате streamconflicts-history версии 1:

{{
  "format": "streamconflicts-history",
  "version": 1,
  "events": [
    {{
      "external_id": "краткий-идентификатор",
      "slug": "twitch-launch",
      "matches_existing": null,
      "date_start": "2011-06-06",
      "date_precision": "day",
      "region": "{batch.region}",
      "category": "{category.slug if category else ''}",
      "importance": 80,
      "confidence": 90,
      "translations": {{
        "en": {{
          "title": "...",
          "summary": "...",
          "content": "...",
          "historical_context": "...",
          "consequences": "...",
          "translation_status": "reviewed"
        }}
      }},
      "people": [{{"name": "...", "role": "..."}}],
      "sources": [
        {{"url": "https://...", "title": "...", "publisher": "...", "published_at": "2011-06-06", "language": "en"}}
      ],
      "images": [{{"source_url": "https://...", "caption": {{"en": "..."}}}}]
    }}
  ]
}}"""


def batch_out(db: Session, batch: HistoryResearchBatch) -> dict:
    category = db.get(HistoryCategory, batch.category_id) if batch.category_id else None
    return {
        "id": batch.id,
        "period_start": batch.period_start,
        "period_end": batch.period_end,
        "region": batch.region,
        "category_id": batch.category_id,
        "category_title": category_title(category) if category else None,
        "status": batch.status,
        "prompt_version": batch.prompt_version,
        "import_id": batch.import_id,
        "notes": batch.notes,
        "known_count": len(known_events(db, batch)),
        "created_at": batch.created_at,
        "completed_at": batch.completed_at,
    }


@router.get("/batches", response_model=list[HistoryResearchBatchOut])
def list_batches(
    status: str | None = None,
    _user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    statement = select(HistoryResearchBatch)
    if status:
        statement = statement.where(HistoryResearchBatch.status == status)
    batches = db.scalars(
        statement.order_by(HistoryResearchBatch.period_start, HistoryResearchBatch.id)
    ).all()
    return [batch_out(db, batch) for batch in batches]


@router.post("/batches", response_model=HistoryResearchBatchOut, status_code=201)
def create_batch(payload: HistoryResearchBatchIn, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    batch = HistoryResearchBatch(**payload.model_dump(), prompt_version=PROMPT_VERSION)
    db.add(batch)
    db.commit()
    return batch_out(db, batch)


@router.post("/batches/plan", response_model=list[HistoryResearchBatchOut], status_code=201)
def plan_batches(payload: HistoryResearchPlanIn, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    """Разбивает годы на пакеты. Готовые срезы не трогаем: повторно просить
    нейронку об одном и том же — самый простой способ наплодить дубли."""
    if payload.year_to < payload.year_from:
        raise HTTPException(status_code=422, detail="Конечный год меньше начального")
    if payload.year_to - payload.year_from > 40:
        raise HTTPException(status_code=422, detail="Слишком большой диапазон")

    existing = {
        (batch.period_start, batch.period_end, batch.region, batch.category_id)
        for batch in db.scalars(select(HistoryResearchBatch)).all()
    }
    created = []
    category_ids = payload.category_ids or [None]
    for year in range(payload.year_from, payload.year_to + 1):
        if payload.split == "month":
            spans = [
                (date(year, month, 1), date(year, month, calendar.monthrange(year, month)[1]))
                for month in range(1, 13)
            ]
        else:
            spans = [(date(year, 1, 1), date(year, 12, 31))]
        for start, end in spans:
            for category_id in category_ids:
                key = (start, end, payload.region, category_id)
                if key in existing:
                    continue
                batch = HistoryResearchBatch(
                    period_start=start, period_end=end, region=payload.region,
                    category_id=category_id, status="planned", prompt_version=PROMPT_VERSION,
                )
                db.add(batch)
                created.append(batch)
                existing.add(key)
    db.commit()
    return [batch_out(db, batch) for batch in created]


@router.patch("/batches/{batch_id}", response_model=HistoryResearchBatchOut)
def update_batch(batch_id: int, payload: HistoryResearchBatchUpdate, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    batch = db.get(HistoryResearchBatch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(batch, key, value)
    if payload.status == "complete" and batch.completed_at is None:
        batch.completed_at = datetime.now()
    if payload.status and payload.status != "complete":
        batch.completed_at = None
    db.commit()
    return batch_out(db, batch)


@router.delete("/batches/{batch_id}", status_code=204)
def delete_batch(batch_id: int, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    batch = db.get(HistoryResearchBatch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    db.delete(batch)
    db.commit()


@router.get("/batches/{batch_id}/prompt", response_model=HistoryPromptOut)
def batch_prompt(batch_id: int, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    batch = db.get(HistoryResearchBatch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    text = build_prompt(db, batch)
    return {"prompt": text, "known_count": len(known_events(db, batch)), "characters": len(text)}


@router.get("/prompt", response_model=HistoryPromptOut)
def ad_hoc_prompt(
    period_start: date | None = None,
    period_end: date | None = None,
    region: str = "global",
    category_id: int | None = None,
    _user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Запрос без создания пакета: иногда надо просто быстро посмотреть срез."""
    batch = HistoryResearchBatch(
        period_start=period_start, period_end=period_end,
        region=region, category_id=category_id, status="planned",
    )
    text = build_prompt(db, batch)
    return {"prompt": text, "known_count": len(known_events(db, batch)), "characters": len(text)}
