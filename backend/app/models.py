from datetime import datetime
from enum import StrEnum

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
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
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
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
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(180), index=True)
    initials: Mapped[str] = mapped_column(String(8))
    avatar_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    links: Mapped[dict] = mapped_column(JSON, default=dict)
    profile_status: Mapped[str] = mapped_column(String(30), default="active")
    entity_type: Mapped[str] = mapped_column(String(30), default="streamer", index=True)


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
    conflict_id: Mapped[int | None] = mapped_column(ForeignKey("conflicts.id", ondelete="SET NULL"), nullable=True)
    statement: Mapped[str] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(String(2000))
    contact: Mapped[str | None] = mapped_column(String(300), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="new", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class MaterialSubmission(Base):
    __tablename__ = "material_submissions"
    id: Mapped[int] = mapped_column(primary_key=True)
    source_url: Mapped[str] = mapped_column(String(2000))
    description: Mapped[str] = mapped_column(Text)
    contact: Mapped[str | None] = mapped_column(String(300), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="new", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class SitePage(Base):
    __tablename__ = "site_pages"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
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
    visitor_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    first_seen: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
    last_seen: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
    # Число разных дней с визитами и суммарное число записанных просмотров.
    visit_days: Mapped[int] = mapped_column(Integer, default=1)
    page_views: Mapped[int] = mapped_column(Integer, default=1)


class AnalyticsVisit(Base):
    __tablename__ = "analytics_visits"
    id: Mapped[int] = mapped_column(primary_key=True)
    visitor_id: Mapped[str] = mapped_column(String(64), index=True)
    ip_address: Mapped[str] = mapped_column(String(64), index=True)
    path: Mapped[str] = mapped_column(String(500), index=True)
    referrer: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
