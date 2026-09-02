from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ConflictStatus(StrEnum):
    DRAFT = "draft"
    REVIEW = "review"
    DEVELOPING = "developing"
    WAITING = "waiting"
    QUIET = "quiet"
    CLOSED = "closed"
    ARCHIVED = "archived"


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(30), default="editor")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Conflict(Base):
    __tablename__ = "conflicts"
    __table_args__ = (UniqueConstraint("site_lang", "slug"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    site_lang: Mapped[str] = mapped_column(String(2), default="ru", index=True)
    slug: Mapped[str] = mapped_column(String(180), index=True)
    title: Mapped[str] = mapped_column(String(300))
    summary: Mapped[str] = mapped_column(Text)
    cover_image_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    # Ручной приоритет в списках. Работает только при включённом флаге:
    # материалы без него идут ниже, в обычном порядке по дате.
    priority_enabled: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    priority: Mapped[int] = mapped_column(Integer, default=0, index=True)
    category: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(30), default=ConflictStatus.DRAFT)
    next_action: Mapped[str | None] = mapped_column(String(300), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    events: Mapped[list["TimelineEvent"]] = relationship(back_populates="conflict", cascade="all, delete-orphan", order_by="TimelineEvent.position")
    people: Mapped[list["ConflictPerson"]] = relationship(back_populates="conflict", cascade="all, delete-orphan")
    changes: Mapped[list["ChangeLog"]] = relationship(back_populates="conflict", cascade="all, delete-orphan", order_by="ChangeLog.created_at.desc()")


class TimelineEvent(Base):
    __tablename__ = "timeline_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    conflict_id: Mapped[int] = mapped_column(ForeignKey("conflicts.id", ondelete="CASCADE"), index=True)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)
    is_commentary: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    conflict: Mapped[Conflict] = relationship(back_populates="events")
    sources: Mapped[list["Source"]] = relationship(back_populates="event", cascade="all, delete-orphan")


class Source(Base):
    __tablename__ = "sources"
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("timeline_events.id", ondelete="CASCADE"), index=True)
    platform: Mapped[str] = mapped_column(String(50))
    url: Mapped[str] = mapped_column(String(2000))
    title: Mapped[str] = mapped_column(String(300))
    source_status: Mapped[str] = mapped_column(String(40), default="primary")
    media_type: Mapped[str] = mapped_column(String(30), default="link")
    thumbnail_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)

    event: Mapped[TimelineEvent] = relationship(back_populates="sources")


class Person(Base):
    __tablename__ = "people"
    __table_args__ = (UniqueConstraint("site_lang", "slug"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    site_lang: Mapped[str] = mapped_column(String(2), default="ru", index=True)
    slug: Mapped[str] = mapped_column(String(180), index=True)
    name: Mapped[str] = mapped_column(String(180), index=True)
    initials: Mapped[str] = mapped_column(String(8))
    avatar_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    links: Mapped[dict] = mapped_column(JSON, default=dict)
    profile_status: Mapped[str] = mapped_column(String(30), default="active")
    entity_type: Mapped[str] = mapped_column(String(30), default="streamer", index=True)
    # Связывает RU- и EN-карточки одного человека: people языковая
    # (unique по site_lang+slug), а история общая для обоих языков.
    canonical_key: Mapped[str | None] = mapped_column(String(180), nullable=True, index=True)


class ConflictPerson(Base):
    __tablename__ = "conflict_people"
    __table_args__ = (UniqueConstraint("conflict_id", "person_id", "relation"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    conflict_id: Mapped[int] = mapped_column(ForeignKey("conflicts.id", ondelete="CASCADE"))
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id", ondelete="CASCADE"))
    relation: Mapped[str] = mapped_column(String(30))
    role: Mapped[str | None] = mapped_column(String(300), nullable=True)
    event_ids: Mapped[list[int]] = mapped_column(JSON, default=list)

    conflict: Mapped[Conflict] = relationship(back_populates="people")
    person: Mapped[Person] = relationship()


class ChangeLog(Base):
    __tablename__ = "change_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    conflict_id: Mapped[int] = mapped_column(ForeignKey("conflicts.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    description: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    conflict: Mapped[Conflict] = relationship(back_populates="changes")


class CorrectionRequest(Base):
    __tablename__ = "correction_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_lang: Mapped[str] = mapped_column(String(2), default="ru", index=True)
    conflict_id: Mapped[int | None] = mapped_column(ForeignKey("conflicts.id", ondelete="SET NULL"), nullable=True)
    statement: Mapped[str] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(String(2000))
    contact: Mapped[str | None] = mapped_column(String(300), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="new", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class MaterialSubmission(Base):
    __tablename__ = "material_submissions"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_lang: Mapped[str] = mapped_column(String(2), default="ru", index=True)
    source_url: Mapped[str] = mapped_column(String(2000))
    description: Mapped[str] = mapped_column(Text)
    contact: Mapped[str | None] = mapped_column(String(300), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="new", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class SitePage(Base):
    __tablename__ = "site_pages"
    __table_args__ = (UniqueConstraint("site_lang", "slug"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    site_lang: Mapped[str] = mapped_column(String(2), default="ru", index=True)
    slug: Mapped[str] = mapped_column(String(100), index=True)
    title: Mapped[str] = mapped_column(String(300))
    lead: Mapped[str] = mapped_column(Text)
    sections: Mapped[list] = mapped_column(JSON, default=list)
    contact_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class AnalyticsVisitor(Base):
    """Сводка по посетителю. Живёт вечно, в отличие от analytics_visits,
    которые чистятся через 90 дней, — иначе метрики «за всё время» и
    «новый или вернувшийся» посчитать нельзя."""

    __tablename__ = "analytics_visitors"
    visitor_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    site_lang: Mapped[str] = mapped_column(String(2), default="ru", index=True)
    first_seen: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
    last_seen: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
    # Число разных дней с визитами и суммарное число записанных просмотров.
    visit_days: Mapped[int] = mapped_column(Integer, default=1)
    page_views: Mapped[int] = mapped_column(Integer, default=1)


class AnalyticsVisit(Base):
    __tablename__ = "analytics_visits"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_lang: Mapped[str] = mapped_column(String(2), default="ru", index=True)
    visitor_id: Mapped[str] = mapped_column(String(80), index=True)
    ip_address: Mapped[str] = mapped_column(String(64), index=True)
    path: Mapped[str] = mapped_column(String(500), index=True)
    referrer: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)


# --- История стриминга -------------------------------------------------------
# В отличие от конфликтов, событие истории существует в одном экземпляре и не
# привязано к языку сайта: RU и EN живут в history_event_translations. Поэтому
# эти модели намеренно не попадают в языковой фильтр из database.py.


class HistoryStatus(StrEnum):
    DRAFT = "draft"
    REVIEW = "review"
    PUBLISHED = "published"
    REJECTED = "rejected"


class HistoryCategory(Base):
    """Раздел меню истории. Дерево до трёх уровней: Платформы → Twitch → Покупка."""

    __tablename__ = "history_categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("history_categories.id", ondelete="CASCADE"), nullable=True, index=True)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    # Платформы — те же разделы, но их отдельно показывают в фильтрах.
    is_platform: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    icon: Mapped[str | None] = mapped_column(String(80), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    parent: Mapped["HistoryCategory | None"] = relationship(back_populates="children", remote_side="HistoryCategory.id")
    children: Mapped[list["HistoryCategory"]] = relationship(back_populates="parent", cascade="all, delete-orphan", order_by="HistoryCategory.sort_order")
    translations: Mapped[list["HistoryCategoryTranslation"]] = relationship(back_populates="category", cascade="all, delete-orphan")


class HistoryCategoryTranslation(Base):
    __tablename__ = "history_category_translations"
    __table_args__ = (UniqueConstraint("category_id", "language"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("history_categories.id", ondelete="CASCADE"), index=True)
    language: Mapped[str] = mapped_column(String(2), index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    category: Mapped[HistoryCategory] = relationship(back_populates="translations")


class HistoryEvent(Base):
    __tablename__ = "history_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    # Идентификатор из импорта. Ненадёжен (нейронка генерит его заново каждый
    # раз), поэтому вспомогательный: основной дедуп идёт по slug и дате.
    external_id: Mapped[str | None] = mapped_column(String(180), nullable=True, index=True)
    date_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_precision: Mapped[str] = mapped_column(String(20), default="day")
    # Ключ сортировки и год выносим отдельно: без них события с точностью
    # «год» и «неизвестно» некуда девать в общей ленте и в фильтре по декадам.
    sort_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    region: Mapped[str] = mapped_column(String(20), default="global", index=True)
    importance: Mapped[int] = mapped_column(Integer, default=50, index=True)
    confidence: Mapped[int] = mapped_column(Integer, default=100)
    needs_verification: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    status: Mapped[str] = mapped_column(String(30), default=HistoryStatus.DRAFT, index=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    translations: Mapped[list["HistoryEventTranslation"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    categories: Mapped[list["HistoryEventCategory"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    sources: Mapped[list["HistorySource"]] = relationship(back_populates="event", cascade="all, delete-orphan", order_by="HistorySource.sort_order")
    images: Mapped[list["HistoryImage"]] = relationship(back_populates="event", cascade="all, delete-orphan", order_by="HistoryImage.sort_order")
    people: Mapped[list["HistoryEventPerson"]] = relationship(back_populates="event", cascade="all, delete-orphan")


class HistoryEventTranslation(Base):
    __tablename__ = "history_event_translations"
    __table_args__ = (UniqueConstraint("event_id", "language"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("history_events.id", ondelete="CASCADE"), index=True)
    language: Mapped[str] = mapped_column(String(2), index=True)
    title: Mapped[str] = mapped_column(String(300))
    summary: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[str] = mapped_column(Text, default="")
    historical_context: Mapped[str] = mapped_column(Text, default="")
    consequences: Mapped[str] = mapped_column(Text, default="")
    translation_status: Mapped[str] = mapped_column(String(20), default="draft")

    event: Mapped[HistoryEvent] = relationship(back_populates="translations")


class HistoryEventCategory(Base):
    __tablename__ = "history_event_categories"
    __table_args__ = (UniqueConstraint("event_id", "category_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("history_events.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("history_categories.id", ondelete="CASCADE"), index=True)
    # Основной раздел определяет «хлебные крошки» на странице события.
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)

    event: Mapped[HistoryEvent] = relationship(back_populates="categories")
    category: Mapped[HistoryCategory] = relationship()


class HistorySource(Base):
    __tablename__ = "history_sources"
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("history_events.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String(2000))
    title: Mapped[str] = mapped_column(String(300))
    publisher: Mapped[str | None] = mapped_column(String(200), nullable=True)
    published_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    language: Mapped[str | None] = mapped_column(String(5), nullable=True)
    source_status: Mapped[str] = mapped_column(String(40), default="primary")
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    event: Mapped[HistoryEvent] = relationship(back_populates="sources")


class HistoryImage(Base):
    __tablename__ = "history_images"
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("history_events.id", ondelete="CASCADE"), index=True)
    file_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    author: Mapped[str | None] = mapped_column(String(200), nullable=True)
    license: Mapped[str | None] = mapped_column(String(120), nullable=True)
    taken_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_cover: Mapped[bool] = mapped_column(Boolean, default=False)
    # Ссылки на картинки из импорта нейронки почти всегда битые, поэтому они
    # попадают сюда как candidate и не показываются до ручной проверки.
    review_status: Mapped[str] = mapped_column(String(20), default="candidate", index=True)

    event: Mapped[HistoryEvent] = relationship(back_populates="images")
    translations: Mapped[list["HistoryImageTranslation"]] = relationship(back_populates="image", cascade="all, delete-orphan")


class HistoryImageTranslation(Base):
    __tablename__ = "history_image_translations"
    __table_args__ = (UniqueConstraint("image_id", "language"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    image_id: Mapped[int] = mapped_column(ForeignKey("history_images.id", ondelete="CASCADE"), index=True)
    language: Mapped[str] = mapped_column(String(2), index=True)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    alt_text: Mapped[str | None] = mapped_column(String(500), nullable=True)

    image: Mapped[HistoryImage] = relationship(back_populates="translations")


class HistoryEventPerson(Base):
    __tablename__ = "history_event_people"
    __table_args__ = (UniqueConstraint("event_id", "person_id", "relation"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("history_events.id", ondelete="CASCADE"), index=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id", ondelete="CASCADE"), index=True)
    relation: Mapped[str] = mapped_column(String(30), default="participant")
    role: Mapped[str | None] = mapped_column(String(300), nullable=True)

    event: Mapped[HistoryEvent] = relationship(back_populates="people")
    person: Mapped[Person] = relationship()


class HistoryEventRelation(Base):
    __tablename__ = "history_event_relations"
    __table_args__ = (UniqueConstraint("event_id", "related_event_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("history_events.id", ondelete="CASCADE"), index=True)
    related_event_id: Mapped[int] = mapped_column(ForeignKey("history_events.id", ondelete="CASCADE"), index=True)
    relation_type: Mapped[str] = mapped_column(String(30), default="related")


class HistoryImport(Base):
    """Загруженный JSON целиком. Сырьё храним, чтобы при смене схемы или ошибке
    разбора переимпортировать, не гоняя исследование заново."""

    __tablename__ = "history_imports"
    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str | None] = mapped_column(String(300), nullable=True)
    mode: Mapped[str] = mapped_column(String(30), default="preview")
    status: Mapped[str] = mapped_column(String(20), default="preview")
    raw_json: Mapped[str] = mapped_column(Text)
    stats: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class HistoryResearchBatch(Base):
    """Единица исследования: период + регион + категория. Нужна, чтобы видеть,
    какие срезы уже обработаны, и не просить нейронку об одном и том же."""

    __tablename__ = "history_research_batches"
    id: Mapped[int] = mapped_column(primary_key=True)
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    region: Mapped[str] = mapped_column(String(20), default="global", index=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("history_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="planned", index=True)
    prompt_version: Mapped[int] = mapped_column(Integer, default=1)
    import_id: Mapped[int | None] = mapped_column(ForeignKey("history_imports.id", ondelete="SET NULL"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
