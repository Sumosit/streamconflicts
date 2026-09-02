from contextlib import asynccontextmanager
from io import BytesIO
from datetime import datetime, timedelta, timezone
from pathlib import Path
from email.utils import format_datetime
from urllib.parse import urlparse
from xml.sax.saxutils import escape
from urllib.error import URLError
from urllib.request import Request as UrlRequest, urlopen
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response
from PIL import Image, UnidentifiedImageError
from sqlalchemy import case, delete, distinct, func, or_, select, update as sql_update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.database import SessionLocal, current_site_lang, get_db
from app.models import AnalyticsVisit, AnalyticsVisitor, ChangeLog, Conflict, ConflictPerson, CorrectionRequest, HistoryEvent, HistoryEventPerson, HistoryStatus, MaterialSubmission, Person, SitePage, Source, TimelineEvent, User
from app.schemas import (
    ConflictCreate,
    ConflictListOut,
    ConflictOut,
    ConflictUpdate,
    AnalyticsVisitIn,
    CorrectionIn,
    CorrectionAdminOut,
    CorrectionOut,
    CorrectionUpdate,
    AvatarCheckOut,
    PersonIn,
    PersonLinkIn,
    PersonMergeIn,
    PersonOut,
    PersonTwinCandidate,
    PersonUpdate,
    Token,
    UploadOut,
    SubmissionIn,
    SubmissionOut,
    SubmissionUpdate,
    SitePageIn,
    SitePageOut,
)
from app.history_admin import router as history_admin_router
from app.history_images import router as history_images_router
from app.history_research import router as history_research_router
from app.history_api import router as history_router
from app.security import create_token, current_user, seed_admin, verify_password

settings = get_settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)
(settings.upload_dir / "ru").mkdir(parents=True, exist_ok=True)
(settings.upload_dir / "en").mkdir(parents=True, exist_ok=True)
(settings.upload_dir / "history").mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    with SessionLocal() as db:
        seed_admin(db)
    yield


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def select_site_language(request: Request, call_next):
    requested = request.headers.get("x-site-lang", settings.site_lang).lower()
    language = requested if requested in {"ru", "en"} else settings.site_lang
    token = current_site_lang.set(language)
    try:
        return await call_next(request)
    finally:
        current_site_lang.reset(token)


app.include_router(history_router)
app.include_router(history_admin_router)
app.include_router(history_images_router)
app.include_router(history_research_router)


app.mount("/uploads/history", StaticFiles(directory=settings.upload_dir / "history"), name="uploads-history")
app.mount("/uploads", StaticFiles(directory=settings.upload_dir / "ru"), name="uploads-ru")
app.mount("/en/uploads", StaticFiles(directory=settings.upload_dir / "en"), name="uploads-en")


def conflict_query():
    return select(Conflict).options(
        selectinload(Conflict.events).selectinload(TimelineEvent.sources),
        selectinload(Conflict.people).selectinload(ConflictPerson.person),
        selectinload(Conflict.changes),
    )


def get_conflict_or_404(db: Session, conflict_id: int) -> Conflict:
    item = db.scalar(conflict_query().where(Conflict.id == conflict_id))
    if not item:
        raise HTTPException(status_code=404, detail="Conflict not found")
    return item


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.app_env, "language": current_site_lang.get()}


BOT_MARKERS = ("bot", "crawler", "spider", "slurp", "preview", "facebookexternalhit", "telegrambot", "whatsapp")


@app.post("/api/analytics/visit", status_code=204, include_in_schema=False)
def record_visit(payload: AnalyticsVisitIn, request: Request, db: Session = Depends(get_db)) -> Response:
    user_agent = request.headers.get("user-agent", "")[:1000]
    path = payload.path.split("?", 1)[0]
    if path.startswith("/editor") or not user_agent or any(marker in user_agent.lower() for marker in BOT_MARKERS):
        return Response(status_code=204)
    forwarded = request.headers.get("x-forwarded-for", "")
    ip_address = (forwarded.split(",", 1)[0].strip() if forwarded else request.client.host if request.client else "unknown")[:64]
    day_start = datetime.combine(datetime.utcnow().date(), datetime.min.time())
    language = current_site_lang.get()
    visitor_id = f"{language}:{payload.visitor_id}"
    already_recorded = db.scalar(select(AnalyticsVisit.id).where(
        AnalyticsVisit.visitor_id == visitor_id,
        AnalyticsVisit.path == path[:500],
        AnalyticsVisit.created_at >= day_start,
    ).limit(1))
    if already_recorded:
        return Response(status_code=204)
    referrer = (payload.referrer or "")[:2000] or None
    if referrer:
        referrer_host = (urlparse(referrer).hostname or "").lower()
        if referrer_host in {"streamconflicts.com", "www.streamconflicts.com", "dev.streamconflicts.com"}:
            referrer = None
    db.add(AnalyticsVisit(
        visitor_id=visitor_id,
        ip_address=ip_address,
        path=path[:500],
        referrer=referrer,
        user_agent=user_agent,
    ))
    now = datetime.utcnow()
    visitor = db.get(AnalyticsVisitor, visitor_id)
    if visitor is None:
        db.add(AnalyticsVisitor(visitor_id=visitor_id, first_seen=now, last_seen=now, visit_days=1, page_views=1))
    else:
        if visitor.last_seen < day_start:
            visitor.visit_days += 1
        visitor.last_seen = now
        visitor.page_views += 1
    db.execute(delete(AnalyticsVisit).where(AnalyticsVisit.created_at < datetime.utcnow() - timedelta(days=90)))
    db.commit()
    return Response(status_code=204)


@app.get("/api/admin/analytics")
def analytics_summary(
    days: int = Query(default=30, ge=1, le=90),
    site_lang: str = Query(default="all", pattern="^(ru|en|all)$"),
    _user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    language_token = current_site_lang.set(site_lang)
    try:
        return build_analytics_summary(days, site_lang, db)
    finally:
        current_site_lang.reset(language_token)


def build_analytics_summary(days: int, site_lang: str, db: Session) -> dict:
    today = datetime.utcnow().date()
    since = datetime.combine(today - timedelta(days=days - 1), datetime.min.time())
    today_start = datetime.combine(today, datetime.min.time())
    unique_page_view = AnalyticsVisit.visitor_id + "\x1f" + AnalyticsVisit.path
    visits, visitors, unique_ips = db.execute(select(
        func.count(distinct(unique_page_view)),
        func.count(distinct(AnalyticsVisit.visitor_id)),
        func.count(distinct(AnalyticsVisit.ip_address)),
    ).where(AnalyticsVisit.created_at >= since)).one()
    today_visits, today_visitors = db.execute(select(
        func.count(distinct(unique_page_view)),
        func.count(distinct(AnalyticsVisit.visitor_id)),
    ).where(AnalyticsVisit.created_at >= today_start)).one()
    daily_rows = db.execute(select(
        func.date(AnalyticsVisit.created_at).label("day"),
        func.count(distinct(unique_page_view)).label("views"),
        func.count(distinct(AnalyticsVisit.visitor_id)).label("visitors"),
    ).where(AnalyticsVisit.created_at >= since).group_by(func.date(AnalyticsVisit.created_at)).order_by(func.date(AnalyticsVisit.created_at))).all()
    page_rows = db.execute(select(
        AnalyticsVisit.path,
        func.count().label("views"),
        func.count(distinct(AnalyticsVisit.visitor_id)).label("visitors"),
    ).where(AnalyticsVisit.created_at >= since).group_by(AnalyticsVisit.path).order_by(func.count(distinct(AnalyticsVisit.visitor_id)).desc()).limit(15)).all()
    new_by_day = dict(db.execute(select(
        func.date(AnalyticsVisitor.first_seen),
        func.count(),
    ).where(AnalyticsVisitor.first_seen >= since).group_by(func.date(AnalyticsVisitor.first_seen))).all())
    # Аудитория за период: кто пришёл впервые, а кто вернулся.
    active_visitors = select(distinct(AnalyticsVisit.visitor_id)).where(AnalyticsVisit.created_at >= since).scalar_subquery()
    new_visitors = db.scalar(select(func.count()).select_from(AnalyticsVisitor).where(
        AnalyticsVisitor.first_seen >= since, AnalyticsVisitor.visitor_id.in_(active_visitors))) or 0
    returning_visitors = db.scalar(select(func.count()).select_from(AnalyticsVisitor).where(
        AnalyticsVisitor.first_seen < since, AnalyticsVisitor.visitor_id.in_(active_visitors))) or 0
    today_new = db.scalar(select(func.count()).select_from(AnalyticsVisitor).where(AnalyticsVisitor.first_seen >= today_start)) or 0
    # Сколько разных дней заходил каждый посетитель внутри периода.
    days_per_visitor = select(
        AnalyticsVisit.visitor_id.label("visitor"),
        func.count(distinct(func.date(AnalyticsVisit.created_at))).label("days"),
    ).where(AnalyticsVisit.created_at >= since).group_by(AnalyticsVisit.visitor_id).subquery()
    frequency_rows = db.execute(select(days_per_visitor.c.days, func.count()).group_by(days_per_visitor.c.days)).all()
    raw_views = db.scalar(select(func.count()).select_from(AnalyticsVisit).where(AnalyticsVisit.created_at >= since)) or 0
    all_time_visitors = db.scalar(select(func.count()).select_from(AnalyticsVisitor)) or 0
    all_time_since = db.scalar(select(func.min(AnalyticsVisitor.first_seen)))
    loyal_visitors = db.scalar(select(func.count()).select_from(AnalyticsVisitor).where(AnalyticsVisitor.visit_days > 1)) or 0
    referrer_rows = db.execute(select(
        AnalyticsVisit.referrer,
        func.count(distinct(AnalyticsVisit.visitor_id)).label("views"),
    ).where(AnalyticsVisit.created_at >= since, AnalyticsVisit.referrer.is_not(None), AnalyticsVisit.referrer != "").group_by(AnalyticsVisit.referrer).order_by(func.count(distinct(AnalyticsVisit.visitor_id)).desc()).limit(10)).all()
    buckets = [("1 день", 1, 1), ("2-3 дня", 2, 3), ("4-7 дней", 4, 7), ("8+ дней", 8, 10**6)]
    frequency = [
        {"bucket": label, "visitors": sum(count for day_count, count in frequency_rows if low <= day_count <= high)}
        for label, low, high in buckets
    ]
    active_period_visitors = new_visitors + returning_visitors
    return {
        "days": days,
        "site_lang": site_lang,
        "totals": {"views": visits, "visitors": visitors, "unique_ips": unique_ips, "raw_views": raw_views},
        "all_time": {
            "visitors": all_time_visitors,
            "returning_visitors": loyal_visitors,
            "since": all_time_since.date().isoformat() if all_time_since else None,
        },
        "audience": {
            "new_visitors": new_visitors,
            "returning_visitors": returning_visitors,
            "returning_rate": round(returning_visitors / active_period_visitors * 100) if active_period_visitors else 0,
            "avg_days": round(sum(day_count * count for day_count, count in frequency_rows) / active_period_visitors, 1) if active_period_visitors else 0,
        },
        "frequency": frequency,
        "today": {"views": today_visits, "visitors": today_visitors, "new_visitors": today_new},
        "daily": [{"date": day, "views": views, "visitors": day_visitors, "new_visitors": new_by_day.get(day, 0)} for day, views, day_visitors in daily_rows],
        "pages": [{"path": path, "views": views, "visitors": page_visitors} for path, views, page_visitors in page_rows],
        "referrers": [{"referrer": referrer, "views": views} for referrer, views in referrer_rows],
    }


@app.get("/api/seo/robots", include_in_schema=False)
def robots() -> Response:
    if settings.app_env != "production":
        return Response("User-agent: *\nDisallow: /\n", media_type="text/plain")
    language = current_site_lang.get()
    path = settings.path_for_language(language)
    lines = ["User-agent: *", f"Disallow: {path}/editor"]
    lines += ["Disallow: /api/admin", "Disallow: /api/auth", f"Sitemap: {settings.root_for_language(language)}/sitemap.xml"]
    if language == "ru":
        lines += ["Disallow: /en/editor", f"Sitemap: {settings.root_for_language('en')}/sitemap.xml"]
    return Response("\n".join(lines) + "\n", media_type="text/plain")


@app.get("/api/seo/sitemap", include_in_schema=False)
def sitemap(db: Session = Depends(get_db)) -> Response:
    base = settings.root_for_language(current_site_lang.get())
    conflicts = db.scalars(select(Conflict).where(Conflict.is_published.is_(True)).order_by(Conflict.updated_at.desc())).all()
    people = db.scalars(
        select(Person).join(ConflictPerson).join(Conflict).where(
            Conflict.is_published.is_(True),
            Person.profile_status == "active",
            Person.entity_type == "streamer",
        ).distinct().order_by(Person.slug)
    ).all()
    urls = [
        f"<url><loc>{base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>",
        f"<url><loc>{base}/archive</loc><changefreq>daily</changefreq><priority>0.9</priority></url>",
        f"<url><loc>{base}/people</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>",
        f"<url><loc>{base}/history</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>",
    ]
    history = db.scalars(
        select(HistoryEvent).where(
            HistoryEvent.is_published.is_(True),
            HistoryEvent.status == HistoryStatus.PUBLISHED,
        ).order_by(HistoryEvent.updated_at.desc())
    ).all()
    # Служебные страницы попадают в карту, только если опубликованы.
    static_pages = db.scalars(select(SitePage).where(SitePage.is_published.is_(True))).all()
    urls.extend(
        f"<url><loc>{base}/{page.slug}</loc><lastmod>{page.updated_at.date().isoformat()}</lastmod><changefreq>monthly</changefreq><priority>0.4</priority></url>"
        for page in static_pages
        if page.slug in {"about", "rules"}
    )
    urls.extend(
        f"<url><loc>{base}/conflicts/{item.slug}</loc><lastmod>{item.updated_at.date().isoformat()}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>"
        for item in conflicts
    )
    urls.extend(
        f"<url><loc>{base}/people/{item.slug}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>"
        for item in people
    )
    urls.extend(
        f"<url><loc>{base}/history/{item.slug}</loc><lastmod>{item.updated_at.date().isoformat()}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>"
        for item in history
    )
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "".join(urls) + "</urlset>"
    return Response(xml, media_type="application/xml")


@app.get("/api/seo/rss", include_in_schema=False)
def rss(db: Session = Depends(get_db)) -> Response:
    """Лента последних материалов: читалки, агрегаторы и боты автопостинга."""
    language = current_site_lang.get()
    base = settings.root_for_language(language)
    conflicts = db.scalars(
        select(Conflict).where(Conflict.is_published.is_(True)).order_by(Conflict.updated_at.desc()).limit(30)
    ).all()
    items = []
    for item in conflicts:
        link = f"{base}/conflicts/{item.slug}"
        published = item.published_at or item.created_at
        items.append(
            "<item>"
            f"<title>{escape(item.title)}</title>"
            f"<link>{escape(link)}</link>"
            f"<guid isPermaLink=\"true\">{escape(link)}</guid>"
            f"<description>{escape(item.summary)}</description>"
            f"<category>{escape(item.category)}</category>"
            f"<pubDate>{format_datetime(published.replace(tzinfo=timezone.utc))}</pubDate>"
            "</item>"
        )
    updated = conflicts[0].updated_at if conflicts else datetime.utcnow()
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>'
        f"<title>{escape(settings.name_for_language(language))}</title>"
        f"<link>{escape(base)}</link>"
        f"<description>{escape(settings.description_for_language(language))}</description>"
        f"<language>{escape(language)}</language>"
        f"<lastBuildDate>{format_datetime(updated.replace(tzinfo=timezone.utc))}</lastBuildDate>"
        f'<atom:link href="{escape(base)}/rss.xml" rel="self" type="application/rss+xml"/>'
        + "".join(items)
        + "</channel></rss>"
    )
    return Response(xml, media_type="application/rss+xml")


@app.post("/api/auth/token", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> Token:
    user = db.scalar(select(User).where(User.email == form.username.lower()))
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    return Token(access_token=create_token(user))


# Материалы моложе этого срока считаются актуальными и сортируются по дате
# изменения; более старые — по дате последнего события в хронологии.
RECENT_MATERIAL_DAYS = 60


def conflict_ordering():
    """Три группы: приоритетные, свежие по изменению, остальные по последнему событию."""
    cutoff = datetime.utcnow() - timedelta(days=RECENT_MATERIAL_DAYS)
    last_event_at = (
        select(func.max(TimelineEvent.occurred_at))
        .where(TimelineEvent.conflict_id == Conflict.id)
        .correlate(Conflict)
        .scalar_subquery()
    )
    group_rank = case(
        (Conflict.priority_enabled, 0),
        (Conflict.created_at >= cutoff, 1),
        else_=2,
    )
    # Позиция значима только внутри приоритетной группы, у остальных всегда 0.
    effective_priority = case((Conflict.priority_enabled, Conflict.priority), else_=0)
    sort_date = case(
        (Conflict.created_at >= cutoff, Conflict.updated_at),
        else_=func.coalesce(last_event_at, Conflict.created_at),
    )
    return group_rank.asc(), effective_priority.asc(), sort_date.desc()


def conflict_filters(statement, q: str | None, conflict_status: str | None):
    if q:
        pattern = f"%{q.strip()}%"
        mentioned = (
            select(ConflictPerson.id)
            .join(Person, ConflictPerson.person_id == Person.id)
            .where(ConflictPerson.conflict_id == Conflict.id, Person.name.ilike(pattern))
            .correlate(Conflict)
            .exists()
        )
        statement = statement.where(
            or_(
                Conflict.title.ilike(pattern),
                Conflict.summary.ilike(pattern),
                Conflict.category.ilike(pattern),
                mentioned,
            )
        )
    if conflict_status:
        statement = statement.where(Conflict.status == conflict_status)
    return statement


@app.get("/api/conflicts", response_model=list[ConflictOut])
def public_conflicts(
    response: Response,
    q: str | None = None,
    conflict_status: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=0, ge=0, le=50),
    db: Session = Depends(get_db),
) -> list[Conflict]:
    statement = conflict_filters(
        conflict_query().where(Conflict.is_published.is_(True)), q, conflict_status
    ).order_by(*conflict_ordering())
    total = db.scalar(
        conflict_filters(
            select(func.count()).select_from(Conflict).where(Conflict.is_published.is_(True)),
            q,
            conflict_status,
        )
    ) or 0
    # per_page = 0 означает «без постраничности»: так запрашивают связанные
    # материалы и страницы профилей.
    if per_page:
        statement = statement.limit(per_page).offset((page - 1) * per_page)
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"
    return list(db.scalars(statement))


@app.get("/api/conflicts/{slug}", response_model=ConflictOut)
def public_conflict(slug: str, db: Session = Depends(get_db)) -> Conflict:
    item = db.scalar(conflict_query().where(Conflict.slug == slug, Conflict.is_published.is_(True)))
    if not item:
        raise HTTPException(status_code=404, detail="Conflict not found")
    return item


@app.get("/api/admin/conflicts", response_model=list[ConflictOut])
def admin_conflicts(_user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[Conflict]:
    return list(db.scalars(conflict_query().order_by(Conflict.updated_at.desc())))


@app.get("/api/admin/people", response_model=list[PersonOut])
def admin_people(_user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[Person]:
    return list(db.scalars(select(Person).order_by(Person.name)))


@app.post("/api/admin/conflicts", response_model=ConflictOut, status_code=201)
def create_conflict(payload: ConflictCreate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Conflict:
    item = Conflict(**payload.model_dump(exclude={"events", "people"}))
    if item.is_featured:
        db.execute(sql_update(Conflict).where(Conflict.site_lang == current_site_lang.get()).values(is_featured=False))
    if item.is_published:
        item.published_at = datetime.now(timezone.utc)
    for event_data in payload.events:
        event = TimelineEvent(**event_data.model_dump(exclude={"sources"}))
        event.sources = [Source(**source.model_dump(mode="json")) for source in event_data.sources]
        item.events.append(event)
    for person_data in payload.people:
        if not db.get(Person, person_data.person_id):
            raise HTTPException(status_code=422, detail=f"Person {person_data.person_id} not found")
        item.people.append(ConflictPerson(**person_data.model_dump()))
    item.changes.append(ChangeLog(user_id=user.id, description="Материал создан"))
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Slug already exists")
    return get_conflict_or_404(db, item.id)


@app.patch("/api/admin/conflicts/{conflict_id}", response_model=ConflictOut)
def update_conflict(conflict_id: int, payload: ConflictUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Conflict:
    item = get_conflict_or_404(db, conflict_id)
    values = payload.model_dump(exclude={"change_description", "events", "people"}, exclude_none=True)
    for key, value in values.items():
        setattr(item, key, value)
    if payload.is_published is True and item.published_at is None:
        item.published_at = datetime.now(timezone.utc)
    if payload.is_published is False:
        item.published_at = None
    if payload.is_featured is True:
        db.execute(sql_update(Conflict).where(
            Conflict.id != conflict_id,
            Conflict.site_lang == current_site_lang.get(),
        ).values(is_featured=False))
    if payload.events is not None:
        item.events.clear()
        db.flush()
        for event_data in payload.events:
            event = TimelineEvent(**event_data.model_dump(exclude={"sources"}))
            event.sources = [Source(**source.model_dump(mode="json")) for source in event_data.sources]
            item.events.append(event)
    if payload.people is not None:
        item.people.clear()
        db.flush()
        for person_data in payload.people:
            if not db.get(Person, person_data.person_id):
                raise HTTPException(status_code=422, detail=f"Person {person_data.person_id} not found")
            item.people.append(ConflictPerson(**person_data.model_dump()))
    item.changes.append(ChangeLog(user_id=user.id, description=payload.change_description))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Slug or person relation already exists")
    return get_conflict_or_404(db, conflict_id)


@app.delete("/api/admin/conflicts/{conflict_id}", status_code=204)
def delete_conflict(conflict_id: int, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    item = get_conflict_or_404(db, conflict_id)
    if item.is_published:
        raise HTTPException(
            status_code=409,
            detail="Сначала снимите материал с публикации и сохраните изменения",
        )
    db.delete(item)
    db.commit()


def all_language_people(db: Session):
    """Справочник целиком, поверх языкового фильтра из database.py."""
    return db.scalars(
        select(Person).execution_options(include_all_languages=True).order_by(Person.name)
    ).all()


def get_person_any_language(db: Session, person_id: int) -> Person | None:
    """Запись справочника независимо от языка сайта.

    db.get и обычный select отфильтровала бы языковая политика из database.py,
    из-за чего карточка другого языка отдавала бы 404 — а справочник в редакторе
    показывает оба языка сразу.
    """
    return db.scalar(
        select(Person).execution_options(include_all_languages=True).where(Person.id == person_id)
    )


def profile_handles(person: Person) -> set[str]:
    """Ники из ссылок на профили: совпадение по ним надёжнее совпадения по имени."""
    handles = set()
    for value in (person.links or {}).values():
        if not value:
            continue
        tail = value.rstrip("/").rsplit("/", 1)[-1].lower().lstrip("@")
        if tail and "." not in tail:
            handles.add(tail)
    return handles


@app.get("/api/admin/people/search", response_model=list[PersonOut])
def search_people(
    q: str | None = None,
    all_languages: bool = False,
    _user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[Person]:
    """Поиск по справочнику. История связывается с людьми обоих языков,
    поэтому ей нужен режим, который обходит языковой фильтр."""
    people = all_language_people(db) if all_languages else list(db.scalars(select(Person).order_by(Person.name)))
    if q and q.strip():
        needle = q.strip().lower()
        people = [item for item in people if needle in item.name.lower() or needle in item.slug.lower()]
    return people[:60]


@app.get("/api/admin/people/twins", response_model=list[PersonTwinCandidate])
def person_twins(_user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    """Кандидаты на связывание: RU- и EN-карточки одного человека.

    Ищем только между языками — дубли внутри одного языка это другая задача,
    их сливают, а не связывают ключом.
    """
    people = [item for item in all_language_people(db) if not item.canonical_key]
    groups: dict[tuple[str, str], list[Person]] = {}
    for person in people:
        keys = {("slug", person.slug.lower()), ("name", person.name.strip().lower())}
        keys.update(("handle", handle) for handle in profile_handles(person))
        for key in keys:
            groups.setdefault(key, []).append(person)

    seen: set[tuple[int, ...]] = set()
    candidates: list[dict] = []
    labels = {"slug": "совпадает slug", "name": "совпадает имя", "handle": "совпадает ссылка на профиль"}
    # Порядок разбора фиксируем: иначе одна и та же пара показывалась бы то
    # по slug, то по ссылке — в зависимости от порядка обхода словаря.
    priority = {"slug": 0, "handle": 1, "name": 2}
    for (kind, value), members in sorted(groups.items(), key=lambda item: priority[item[0][0]]):
        if len({item.site_lang for item in members}) < 2:
            continue
        identity = tuple(sorted(item.id for item in members))
        if identity in seen:
            continue
        seen.add(identity)
        # Ключ предлагаем от английской карточки: он латиницей и стабильнее.
        english = next((item for item in members if item.site_lang == "en"), members[0])
        candidates.append({
            "reason": labels[kind],
            "suggested_key": english.slug if kind != "handle" else value,
            "people": sorted(members, key=lambda item: item.site_lang),
        })
    candidates.sort(key=lambda item: item["people"][0].name.lower())
    return candidates


@app.post("/api/admin/people/link", response_model=list[PersonOut])
def link_people(payload: PersonLinkIn, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[Person]:
    """Проставляет общий canonical_key выбранным карточкам."""
    people = list(db.scalars(
        select(Person).execution_options(include_all_languages=True).where(Person.id.in_(payload.person_ids))
    ))
    if len(people) != len(set(payload.person_ids)):
        raise HTTPException(status_code=404, detail="Person not found")
    for person in people:
        person.canonical_key = payload.canonical_key
    db.commit()
    return people


@app.post("/api/admin/people", response_model=PersonOut, status_code=201)
def create_person(payload: PersonIn, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> Person:
    person = Person(**payload.model_dump())
    db.add(person)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Person slug already exists")
    db.refresh(person)
    return person


def avatar_status(url: str) -> tuple[bool, str]:
    """Проверяет, отдаётся ли по ссылке картинка. Телеграмные превью живут недолго."""
    try:
        request = UrlRequest(url, headers={"User-Agent": "Mozilla/5.0 (compatible; StreamArchiveBot)"})
        with urlopen(request, timeout=8) as response:
            content_type = response.headers.get("Content-Type", "")
            if response.status == 200 and content_type.startswith("image"):
                return True, content_type
            return False, f"{response.status} {content_type or 'без типа'}"
    except URLError as error:
        return False, str(getattr(error, "reason", error))[:120]
    except Exception as error:  # noqa: BLE001 — любая сетевая ошибка означает битую ссылку
        return False, str(error)[:120]


@app.get("/api/admin/people/avatars", response_model=list[AvatarCheckOut])
def check_avatars(_user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    people = [item for item in all_language_people(db) if item.avatar_url]
    report = []
    for person in people:
        ok, detail = avatar_status(person.avatar_url or "")
        report.append({
            "id": person.id,
            "slug": person.slug,
            "name": person.name,
            "avatar_url": person.avatar_url or "",
            "ok": ok,
            "detail": detail,
        })
    return report


@app.post("/api/admin/people/avatars/cleanup")
def cleanup_avatars(_user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Очищает ссылки на аватарки, которые больше не отдают картинку."""
    people = [item for item in all_language_people(db) if item.avatar_url]
    cleared = []
    for person in people:
        ok, _ = avatar_status(person.avatar_url or "")
        if not ok:
            person.avatar_url = None
            cleared.append(person.slug)
    db.commit()
    return {"checked": len(people), "cleared": len(cleared), "slugs": cleared}


@app.post("/api/admin/people/{person_id}/merge", response_model=PersonOut)
def merge_person(person_id: int, payload: PersonMergeIn, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> Person:
    """Переносит связи и заполненные поля на целевую запись, исходную удаляет."""
    source = get_person_any_language(db, person_id)
    target = get_person_any_language(db, payload.target_id)
    if not source or not target:
        raise HTTPException(status_code=404, detail="Person not found")
    if source.id == target.id:
        raise HTTPException(status_code=422, detail="Нельзя объединить запись с самой собой")
    if source.site_lang != target.site_lang:
        # Связи материалов уехали бы на чужой языковой сайт, а публичная
        # страница человека там его не покажет — получились бы битые ссылки.
        raise HTTPException(
            status_code=422,
            detail="Записи разных языков объединять нельзя. Свяжите их общим ключом в разделе «Один человек в двух языках».",
        )
    for link in db.scalars(select(ConflictPerson).where(ConflictPerson.person_id == source.id)).all():
        twin = db.scalar(select(ConflictPerson).where(
            ConflictPerson.conflict_id == link.conflict_id,
            ConflictPerson.person_id == target.id,
            ConflictPerson.relation == link.relation,
        ))
        if twin:
            # Обе записи участвуют в одном материале с одной ролью: сливаем события.
            twin.event_ids = sorted({*(twin.event_ids or []), *(link.event_ids or [])})
            twin.role = twin.role or link.role
            db.delete(link)
        else:
            link.person_id = target.id
    # Связи истории переносим тем же порядком. Без этого исходную запись удалит
    # каскад по history_event_people.person_id, и событие молча останется без
    # участника — заметить это в редакторе конфликтов невозможно.
    for history_link in db.scalars(select(HistoryEventPerson).where(HistoryEventPerson.person_id == source.id)).all():
        twin = db.scalar(select(HistoryEventPerson).where(
            HistoryEventPerson.event_id == history_link.event_id,
            HistoryEventPerson.person_id == target.id,
            HistoryEventPerson.relation == history_link.relation,
        ))
        if twin:
            twin.role = twin.role or history_link.role
            db.delete(history_link)
        else:
            history_link.person_id = target.id
    target.avatar_url = target.avatar_url or source.avatar_url
    target.canonical_key = target.canonical_key or source.canonical_key
    target.bio = target.bio or source.bio
    target.links = {key: value for key, value in {**(source.links or {}), **(target.links or {})}.items() if value}
    db.delete(source)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Не удалось объединить записи")
    db.refresh(target)
    return target


@app.patch("/api/admin/people/{person_id}", response_model=PersonOut)
def update_person(person_id: int, payload: PersonUpdate, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> Person:
    person = get_person_any_language(db, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    data = payload.model_dump(exclude_none=True)
    # Остальные поля очищаются через свои формы, а ключ связи снимается
    # только здесь, поэтому null для него разбираем отдельно от exclude_none.
    if "canonical_key" in payload.model_fields_set:
        data["canonical_key"] = payload.canonical_key
    for key, value in data.items():
        setattr(person, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Person slug already exists")
    db.refresh(person)
    return person


@app.get("/api/pages/{slug}", response_model=SitePageOut)
def public_page(slug: str, db: Session = Depends(get_db)) -> SitePage:
    page = db.scalar(select(SitePage).where(SitePage.slug == slug, SitePage.is_published.is_(True)))
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


@app.get("/api/admin/pages/{slug}", response_model=SitePageOut)
def admin_page(slug: str, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> SitePage:
    page = db.scalar(select(SitePage).where(SitePage.slug == slug))
    if not page:
        page = SitePage(slug=slug, title="", lead="", sections=[], contact_text=None, is_published=False)
        db.add(page)
        db.commit()
        db.refresh(page)
    return page


@app.put("/api/admin/pages/{slug}", response_model=SitePageOut)
def update_page(slug: str, payload: SitePageIn, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> SitePage:
    page = db.scalar(select(SitePage).where(SitePage.slug == slug))
    if not page:
        page = SitePage(slug=slug)
        db.add(page)
    for key, value in payload.model_dump(mode="json").items():
        setattr(page, key, value)
    db.commit()
    db.refresh(page)
    return page


@app.post("/api/conflicts/{slug}/corrections", response_model=CorrectionOut, status_code=201)
def create_correction(slug: str, payload: CorrectionIn, db: Session = Depends(get_db)) -> CorrectionRequest:
    conflict = db.scalar(select(Conflict).where(Conflict.slug == slug, Conflict.is_published.is_(True)))
    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found")
    item = CorrectionRequest(conflict_id=conflict.id, **payload.model_dump(mode="json"))
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.get("/api/admin/corrections", response_model=list[CorrectionAdminOut])
def admin_corrections(_user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[CorrectionRequest]:
    return list(db.scalars(select(CorrectionRequest).order_by(CorrectionRequest.created_at.desc())))


@app.patch("/api/admin/corrections/{correction_id}", response_model=CorrectionAdminOut)
def update_correction(
    correction_id: int,
    payload: CorrectionUpdate,
    _user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> CorrectionRequest:
    item = db.get(CorrectionRequest, correction_id)
    if not item:
        raise HTTPException(status_code=404, detail="Correction request not found")
    item.status = payload.status
    db.commit()
    db.refresh(item)
    return item


@app.post("/api/submissions", response_model=SubmissionOut, status_code=201)
def create_submission(payload: SubmissionIn, db: Session = Depends(get_db)) -> MaterialSubmission:
    item = MaterialSubmission(**payload.model_dump(mode="json"))
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.get("/api/admin/submissions", response_model=list[SubmissionOut])
def admin_submissions(_user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[MaterialSubmission]:
    return list(db.scalars(select(MaterialSubmission).order_by(MaterialSubmission.created_at.desc())))


@app.patch("/api/admin/submissions/{submission_id}", response_model=SubmissionOut)
def update_submission(
    submission_id: int,
    payload: SubmissionUpdate,
    _user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> MaterialSubmission:
    item = db.get(MaterialSubmission, submission_id)
    if not item:
        raise HTTPException(status_code=404, detail="Material submission not found")
    item.status = payload.status
    db.commit()
    db.refresh(item)
    return item


@app.post("/api/admin/uploads/images", response_model=UploadOut, status_code=201)
async def upload_image(
    image: UploadFile = File(...),
    _user: User = Depends(current_user),
) -> UploadOut:
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if image.content_type not in allowed:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG and WebP images are accepted")
    content = await image.read(settings.max_image_size_mb * 1024 * 1024 + 1)
    if len(content) > settings.max_image_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image is too large")
    try:
        source = Image.open(BytesIO(content))
        source.verify()
        source = Image.open(BytesIO(content)).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=422, detail="Invalid image")
    source.thumbnail((2400, 2400))
    filename = f"{uuid4().hex}.webp"
    language = current_site_lang.get()
    destination = Path(settings.upload_dir) / language / filename
    source.save(destination, "WEBP", quality=86, method=6)
    return UploadOut(
        url=f"{settings.site_base_url.rstrip('/')}{'/en' if language == 'en' else ''}/uploads/{filename}",
        width=source.width,
        height=source.height,
        content_type="image/webp",
    )
