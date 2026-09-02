from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AnalyticsVisitIn(BaseModel):
    visitor_id: str = Field(min_length=8, max_length=64, pattern=r"^[a-zA-Z0-9-]+$")
    path: str = Field(min_length=1, max_length=500)
    referrer: str | None = Field(default=None, max_length=2000)


class SourceIn(BaseModel):
    platform: str
    url: HttpUrl
    title: str
    source_status: str = "primary"
    media_type: str = "link"
    thumbnail_url: str | None = None
    duration_seconds: int | None = None


class SourceOut(SourceIn):
    id: int
    is_available: bool
    model_config = ConfigDict(from_attributes=True)


class EventIn(BaseModel):
    occurred_at: datetime | None = None
    event_type: str
    title: str
    body: str
    is_commentary: bool = False
    position: int = 0
    sources: list[SourceIn] = Field(default_factory=list)


class EventOut(EventIn):
    id: int
    sources: list[SourceOut]
    model_config = ConfigDict(from_attributes=True)


class PersonIn(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    name: str
    initials: str = Field(max_length=8)
    avatar_url: str | None = None
    bio: str | None = Field(default=None, max_length=5000)
    links: dict[str, str] = Field(default_factory=dict)
    profile_status: str = Field(default="active", pattern=r"^(active|hidden)$")
    entity_type: str = Field(default="streamer", pattern=r"^(streamer|media|organization|other)$")


class PersonOut(PersonIn):
    id: int
    model_config = ConfigDict(from_attributes=True)


class PersonUpdate(BaseModel):
    slug: str | None = Field(default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    name: str | None = None
    initials: str | None = Field(default=None, max_length=8)
    avatar_url: str | None = None
    bio: str | None = Field(default=None, max_length=5000)
    links: dict[str, str] | None = None
    profile_status: str | None = Field(default=None, pattern=r"^(active|hidden)$")
    entity_type: str | None = Field(default=None, pattern=r"^(streamer|media|organization|other)$")


class PersonMergeIn(BaseModel):
    target_id: int


class AvatarCheckOut(BaseModel):
    id: int
    slug: str
    name: str
    avatar_url: str
    ok: bool
    detail: str


class ConflictPersonIn(BaseModel):
    person_id: int
    relation: str
    role: str | None = None
    event_ids: list[int] = Field(default_factory=list)


class ConflictPersonOut(BaseModel):
    id: int
    relation: str
    role: str | None
    event_ids: list[int]
    person: PersonOut
    model_config = ConfigDict(from_attributes=True)


class ConflictIn(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    title: str
    summary: str
    cover_image_url: str | None = None
    is_featured: bool = False
    priority_enabled: bool = False
    priority: int = Field(default=0, ge=0, le=1000)
    category: str
    status: str = "draft"
    next_action: str | None = None
    is_published: bool = False


class ConflictCreate(ConflictIn):
    events: list[EventIn] = Field(default_factory=list)
    people: list[ConflictPersonIn] = Field(default_factory=list)


class ConflictUpdate(BaseModel):
    slug: str | None = Field(default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    title: str | None = None
    summary: str | None = None
    cover_image_url: str | None = None
    is_featured: bool | None = None
    priority_enabled: bool | None = None
    priority: int | None = Field(default=None, ge=0, le=1000)
    category: str | None = None
    status: str | None = None
    next_action: str | None = None
    is_published: bool | None = None
    events: list[EventIn] | None = None
    people: list[ConflictPersonIn] | None = None
    change_description: str


class ChangeOut(BaseModel):
    id: int
    description: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ConflictListOut(ConflictIn):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ConflictOut(ConflictListOut):
    events: list[EventOut]
    people: list[ConflictPersonOut]
    changes: list[ChangeOut]


class CorrectionIn(BaseModel):
    statement: str = Field(min_length=10, max_length=5000)
    source_url: HttpUrl
    contact: str | None = Field(default=None, max_length=300)


class CorrectionOut(BaseModel):
    id: int
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CorrectionAdminOut(CorrectionOut):
    conflict_id: int | None
    statement: str
    source_url: str
    contact: str | None


class CorrectionUpdate(BaseModel):
    status: str = Field(pattern=r"^(new|accepted|rejected)$")


class UploadOut(BaseModel):
    url: str
    width: int
    height: int
    content_type: str


class SubmissionIn(BaseModel):
    source_url: HttpUrl
    description: str = Field(min_length=10, max_length=5000)
    contact: str | None = Field(default=None, max_length=300)


class SubmissionOut(BaseModel):
    id: int
    source_url: str
    description: str
    contact: str | None
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SubmissionUpdate(BaseModel):
    status: str = Field(pattern=r"^(new|accepted|rejected)$")


class PageSection(BaseModel):
    number: str
    title: str
    body: str


class SitePageIn(BaseModel):
    title: str
    lead: str
    sections: list[PageSection] = Field(default_factory=list)
    contact_text: str | None = None
    is_published: bool = True


class SitePageOut(SitePageIn):
    id: int
    slug: str
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- История стриминга -------------------------------------------------------


class HistoryCategoryNode(BaseModel):
    id: int
    slug: str
    title: str
    is_platform: bool
    event_count: int
    children: list["HistoryCategoryNode"] = Field(default_factory=list)


class HistoryBreadcrumb(BaseModel):
    slug: str
    title: str


class HistorySourceOut(BaseModel):
    id: int
    url: str
    title: str
    publisher: str | None = None
    published_at: date | None = None
    language: str | None = None
    source_status: str
    is_available: bool
    model_config = ConfigDict(from_attributes=True)


class HistoryImageOut(BaseModel):
    id: int
    file_url: str | None
    source_url: str | None
    author: str | None
    license: str | None
    is_cover: bool
    caption: str | None
    alt_text: str | None


class HistoryPersonRefOut(BaseModel):
    id: int
    slug: str
    name: str
    initials: str
    avatar_url: str | None
    site_lang: str
    relation: str
    role: str | None


class HistoryEventOut(BaseModel):
    id: int
    slug: str
    title: str
    summary: str
    language: str
    # Перевод на язык сайта отсутствует, показан другой язык.
    translation_missing: bool
    date_start: date | None
    date_end: date | None
    date_precision: str
    year: int | None
    region: str
    importance: int
    cover_image_url: str | None
    category_slug: str | None
    category_title: str | None


class HistoryEventListOut(BaseModel):
    total: int
    page: int
    per_page: int
    items: list[HistoryEventOut]


class HistoryEventDetailOut(HistoryEventOut):
    content: str
    historical_context: str
    consequences: str
    available_languages: list[str]
    breadcrumbs: list[HistoryBreadcrumb]
    sources: list[HistorySourceOut]
    images: list[HistoryImageOut]
    people: list[HistoryPersonRefOut]
    related: list[HistoryEventOut]
