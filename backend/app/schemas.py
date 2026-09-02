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
    # Общий ключ RU- и EN-карточки одного человека: справочник языковой,
    # а история — нет, и связывать события надо с обеими.
    canonical_key: str | None = Field(default=None, max_length=180, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class PersonOut(PersonIn):
    id: int
    site_lang: str = "ru"
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
    canonical_key: str | None = Field(default=None, max_length=180)


class PersonMergeIn(BaseModel):
    target_id: int


class PersonTwinCandidate(BaseModel):
    """Пара карточек одного человека в разных языках справочника."""

    reason: str
    suggested_key: str
    people: list[PersonOut]


class PersonLinkIn(BaseModel):
    person_ids: list[int] = Field(min_length=1)
    # null снимает связь: ошибочно связанные карточки надо уметь развязать,
    # а PATCH людей игнорирует null (exclude_none).
    canonical_key: str | None = Field(default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=180)


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


# --- Редактор истории --------------------------------------------------------


class HistoryTranslationIn(BaseModel):
    title: str = Field(max_length=300)
    summary: str = ""
    content: str = ""
    historical_context: str = ""
    consequences: str = ""
    translation_status: str = Field(default="draft", pattern=r"^(missing|draft|machine|reviewed)$")


class HistoryTranslationOut(HistoryTranslationIn):
    language: str
    model_config = ConfigDict(from_attributes=True)


class HistorySourceIn(BaseModel):
    url: str = Field(max_length=2000)
    title: str = Field(max_length=300)
    publisher: str | None = Field(default=None, max_length=200)
    published_at: date | None = None
    language: str | None = Field(default=None, max_length=5)
    source_status: str = "primary"
    sort_order: int = 0


class HistoryImageIn(BaseModel):
    file_url: str | None = None
    source_url: str | None = None
    author: str | None = None
    license: str | None = None
    taken_at: date | None = None
    sort_order: int = 0
    is_cover: bool = False
    review_status: str = Field(default="candidate", pattern=r"^(candidate|approved|rejected)$")
    # Подпись на оба языка сразу: {"ru": "...", "en": "..."}
    caption: dict[str, str] = Field(default_factory=dict)
    alt_text: dict[str, str] = Field(default_factory=dict)


class HistoryImageAdminOut(HistoryImageIn):
    id: int


class HistoryEventPersonIn(BaseModel):
    person_id: int
    relation: str = "participant"
    role: str | None = Field(default=None, max_length=300)


class HistoryEventPersonAdminOut(HistoryEventPersonIn):
    id: int
    name: str
    slug: str
    site_lang: str


class HistoryEventWriteIn(BaseModel):
    slug: str | None = Field(default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=180)
    external_id: str | None = Field(default=None, max_length=180)
    date_start: date | None = None
    date_end: date | None = None
    date_precision: str = Field(default="day", pattern=r"^(day|month|year|period|unknown)$")
    region: str = Field(default="global", pattern=r"^(global|ru|en|other)$")
    importance: int = Field(default=50, ge=0, le=100)
    confidence: int = Field(default=100, ge=0, le=100)
    needs_verification: bool = False
    status: str = Field(default="draft", pattern=r"^(draft|review|published|rejected)$")
    is_published: bool = False
    cover_image_url: str | None = None
    category_ids: list[int] | None = None
    primary_category_id: int | None = None
    translations: dict[str, HistoryTranslationIn] | None = None
    sources: list[HistorySourceIn] | None = None
    people: list[HistoryEventPersonIn] | None = None
    related_slugs: list[str] | None = None


class HistoryEventPatchIn(HistoryEventWriteIn):
    date_precision: str | None = Field(default=None, pattern=r"^(day|month|year|period|unknown)$")
    region: str | None = Field(default=None, pattern=r"^(global|ru|en|other)$")
    importance: int | None = Field(default=None, ge=0, le=100)
    confidence: int | None = Field(default=None, ge=0, le=100)
    needs_verification: bool | None = None
    status: str | None = Field(default=None, pattern=r"^(draft|review|published|rejected)$")
    is_published: bool | None = None


class HistoryAdminRowOut(BaseModel):
    id: int
    slug: str
    title: str
    date_start: date | None
    date_precision: str
    year: int | None
    region: str
    status: str
    is_published: bool
    importance: int
    confidence: int
    needs_verification: bool
    ru_status: str | None
    en_status: str | None
    source_count: int
    image_count: int
    people_count: int
    category_title: str | None
    updated_at: datetime


class HistoryAdminListOut(BaseModel):
    total: int
    page: int
    per_page: int
    items: list[HistoryAdminRowOut]


class HistoryAdminDetailOut(BaseModel):
    id: int
    slug: str
    external_id: str | None
    date_start: date | None
    date_end: date | None
    date_precision: str
    year: int | None
    region: str
    importance: int
    confidence: int
    needs_verification: bool
    status: str
    is_published: bool
    cover_image_url: str | None
    category_ids: list[int]
    primary_category_id: int | None
    translations: dict[str, HistoryTranslationOut]
    sources: list[HistorySourceIn]
    images: list[HistoryImageAdminOut]
    people: list[HistoryEventPersonAdminOut]
    related_slugs: list[str]
    updated_at: datetime


class HistoryCategoryAdminOut(BaseModel):
    id: int
    parent_id: int | None
    slug: str
    title: str
    # Полный путь для выпадающих списков: «Платформы / Twitch / Покупка Amazon».
    path: str
    is_platform: bool
    depth: int


# --- Импорт ------------------------------------------------------------------


class HistoryImportIn(BaseModel):
    mode: str = Field(pattern=r"^(validate|create|create_and_update|translations_only|sources_only)$")
    payload: dict
    filename: str | None = Field(default=None, max_length=300)


class HistoryImportEventPlan(BaseModel):
    index: int
    external_id: str | None
    slug: str | None
    title: str
    action: str
    reason: str
    matched_event_id: int | None = None
    matched_slug: str | None = None
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class HistoryImportReportOut(BaseModel):
    mode: str
    applied: bool
    import_id: int | None
    total: int
    to_create: int
    to_update: int
    to_skip: int
    with_errors: int
    events: list[HistoryImportEventPlan]
    unmatched_people: list[str]
    unknown_categories: list[str]
    created_events: int = 0
    updated_events: int = 0
