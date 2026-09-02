import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SITE } from '../site-config';

export interface SourceDto {
  id?: number;
  platform: string;
  url: string;
  title: string;
  source_status: string;
  media_type: string;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
  is_available?: boolean;
}

export interface EventDto {
  id?: number;
  occurred_at: string | null;
  event_type: string;
  title: string;
  body: string;
  is_commentary: boolean;
  position: number;
  sources: SourceDto[];
}

export interface PersonDto {
  id: number;
  slug: string;
  name: string;
  initials: string;
  avatar_url?: string | null;
  bio?: string | null;
  links?: Record<string, string>;
  profile_status?: string;
  entity_type?: 'streamer' | 'media' | 'organization' | 'other';
  site_lang?: string;
  /** Общий ключ RU- и EN-карточки одного человека. */
  canonical_key?: string | null;
}

export interface PersonTwinDto { reason: string; suggested_key: string; people: PersonDto[] }

export interface SitePageDto {
  id: number;
  slug: string;
  title: string;
  lead: string;
  sections: { number: string; title: string; body: string }[];
  contact_text: string | null;
  is_published: boolean;
  updated_at: string;
}

export interface ConflictPersonDto {
  id?: number;
  person_id?: number;
  relation: string;
  role?: string | null;
  event_ids: number[];
  person?: PersonDto;
}

export interface ChangeDto { id: number; description: string; created_at: string }

export interface AnalyticsSummaryDto {
  days: number;
  site_lang: 'ru'|'en'|'all';
  totals: { views:number; visitors:number; unique_ips:number; raw_views:number };
  all_time: { visitors:number; returning_visitors:number; since:string|null };
  audience: { new_visitors:number; returning_visitors:number; returning_rate:number; avg_days:number };
  frequency: { bucket:string; visitors:number }[];
  today: { views:number; visitors:number; new_visitors:number };
  daily: { date:string; views:number; visitors:number; new_visitors:number }[];
  pages: { path:string; views:number; visitors:number }[];
  referrers: { referrer:string; views:number }[];
}

export interface ConflictDto {
  id: number;
  slug: string;
  title: string;
  summary: string;
  cover_image_url?: string | null;
  is_featured?: boolean;
  priority_enabled?: boolean;
  priority?: number;
  category: string;
  status: string;
  next_action?: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  events: EventDto[];
  people: ConflictPersonDto[];
  changes: ChangeDto[];
}

export interface CorrectionDto {
  id: number;
  conflict_id: number | null;
  statement: string;
  source_url: string;
  contact: string | null;
  status: string;
  created_at: string;
}

export interface SubmissionDto {
  id: number;
  source_url: string;
  description: string;
  contact: string | null;
  status: string;
  created_at: string;
}

export interface HistoryCategoryDto {
  id: number;
  slug: string;
  title: string;
  is_platform: boolean;
  event_count: number;
  children: HistoryCategoryDto[];
}

export interface HistoryEventDto {
  id: number;
  slug: string;
  title: string;
  summary: string;
  language: string;
  /** Перевода на язык сайта нет, показан соседний язык. */
  translation_missing: boolean;
  date_start: string | null;
  date_end: string | null;
  date_precision: string;
  year: number | null;
  region: string;
  importance: number;
  cover_image_url: string | null;
  category_slug: string | null;
  category_title: string | null;
}

export interface HistoryEventDetailDto extends HistoryEventDto {
  content: string;
  historical_context: string;
  consequences: string;
  available_languages: string[];
  breadcrumbs: { slug: string; title: string }[];
  sources: { id: number; url: string; title: string; publisher: string | null; published_at: string | null; language: string | null; source_status: string; is_available: boolean }[];
  images: { id: number; file_url: string | null; source_url: string | null; author: string | null; license: string | null; is_cover: boolean; caption: string | null; alt_text: string | null }[];
  people: { id: number; slug: string; name: string; initials: string; avatar_url: string | null; site_lang: string; relation: string; role: string | null }[];
  related: HistoryEventDto[];
}

export interface HistoryEventsPage { items: HistoryEventDto[]; total: number; page: number; per_page: number }

export interface HistoryCategoryAdminDto {
  id: number;
  parent_id: number | null;
  slug: string;
  title: string;
  /** Полный путь «Платформы / Twitch / Покупка Amazon» для выпадающих списков. */
  path: string;
  is_platform: boolean;
  depth: number;
}

export interface HistoryTranslationDraft {
  title: string;
  summary: string;
  content: string;
  historical_context: string;
  consequences: string;
  translation_status: 'missing' | 'draft' | 'machine' | 'reviewed';
}

export interface HistorySourceDraft {
  url: string;
  title: string;
  publisher: string | null;
  published_at: string | null;
  language: string | null;
  source_status: string;
  sort_order: number;
}

export interface HistoryImageAdminDto {
  id: number;
  file_url: string | null;
  source_url: string | null;
  author: string | null;
  license: string | null;
  taken_at: string | null;
  sort_order: number;
  is_cover: boolean;
  review_status: 'candidate' | 'approved' | 'rejected';
  caption: Record<string, string>;
  alt_text: Record<string, string>;
}

export interface HistoryEventPersonDto {
  id?: number;
  person_id: number;
  relation: string;
  role: string | null;
  name?: string;
  slug?: string;
  site_lang?: string;
}

export interface HistoryAdminRowDto {
  id: number;
  slug: string;
  title: string;
  date_start: string | null;
  date_precision: string;
  year: number | null;
  region: string;
  status: string;
  is_published: boolean;
  importance: number;
  confidence: number;
  needs_verification: boolean;
  ru_status: string | null;
  en_status: string | null;
  source_count: number;
  image_count: number;
  people_count: number;
  category_title: string | null;
  updated_at: string;
}

export interface HistoryAdminListDto { total: number; page: number; per_page: number; items: HistoryAdminRowDto[] }

export interface HistoryAdminDetailDto {
  id: number;
  slug: string;
  external_id: string | null;
  date_start: string | null;
  date_end: string | null;
  date_precision: string;
  year: number | null;
  region: string;
  importance: number;
  confidence: number;
  needs_verification: boolean;
  status: string;
  is_published: boolean;
  cover_image_url: string | null;
  category_ids: number[];
  primary_category_id: number | null;
  translations: Record<string, HistoryTranslationDraft & { language: string }>;
  sources: HistorySourceDraft[];
  images: HistoryImageAdminDto[];
  people: HistoryEventPersonDto[];
  related_slugs: string[];
  updated_at: string;
}

export interface HistoryAdminQuery {
  query?: string | null;
  status?: string | null;
  region?: string | null;
  categoryId?: number | null;
  missingTranslation?: 'ru' | 'en' | null;
  withoutSources?: boolean;
  withoutImages?: boolean;
  needsVerification?: boolean;
  page?: number;
  perPage?: number;
}

export type HistoryImportMode = 'validate' | 'create' | 'create_and_update' | 'translations_only' | 'sources_only';

export interface HistoryImportPlanDto {
  index: number;
  external_id: string | null;
  slug: string | null;
  title: string;
  action: 'create' | 'update' | 'skip' | 'error';
  reason: string;
  matched_event_id: number | null;
  matched_slug: string | null;
  errors: string[];
  warnings: string[];
}

export interface HistoryImportReportDto {
  mode: string;
  applied: boolean;
  import_id: number | null;
  total: number;
  to_create: number;
  to_update: number;
  to_skip: number;
  with_errors: number;
  events: HistoryImportPlanDto[];
  unmatched_people: string[];
  unknown_categories: string[];
  created_events: number;
  updated_events: number;
}

export interface HistoryQuery {
  category?: string | null;
  region?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  person?: string | null;
  query?: string | null;
  withImages?: boolean;
  page?: number;
  perPage?: number;
}

export interface ConflictsPage { items: ConflictDto[]; total: number }
export interface AvatarCheckDto { id:number; slug:string; name:string; avatar_url:string; ok:boolean; detail:string }

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  conflicts(query = ''): Observable<ConflictDto[]> {
    return this.http.get<ConflictDto[]>(`${SITE.apiBase}/api/conflicts`, { params: query ? { q: query } : {} });
  }

  /** Страница материалов. Общее число приходит в заголовке X-Total-Count. */
  conflictsPage(options: { page?: number; perPage?: number; query?: string; status?: string } = {}): Observable<ConflictsPage> {
    let params = new HttpParams();
    if (options.page) params = params.set('page', options.page);
    if (options.perPage) params = params.set('per_page', options.perPage);
    if (options.query?.trim()) params = params.set('q', options.query.trim());
    if (options.status && options.status !== 'all') params = params.set('status', options.status);
    return this.http.get<ConflictDto[]>(`${SITE.apiBase}/api/conflicts`, { params, observe: 'response' }).pipe(
      map(response => ({
        items: response.body ?? [],
        total: Number(response.headers.get('X-Total-Count') ?? response.body?.length ?? 0),
      })),
    );
  }

  conflict(slug: string): Observable<ConflictDto> {
    return this.http.get<ConflictDto>(`${SITE.apiBase}/api/conflicts/${slug}`);
  }

  historyAdminCategories(): Observable<HistoryCategoryAdminDto[]> {
    return this.http.get<HistoryCategoryAdminDto[]>(`${SITE.apiBase}/api/admin/history/categories`);
  }

  historyAdminEvents(options: HistoryAdminQuery = {}): Observable<HistoryAdminListDto> {
    let params = new HttpParams();
    if (options.query?.trim()) params = params.set('q', options.query.trim());
    if (options.status) params = params.set('status', options.status);
    if (options.region) params = params.set('region', options.region);
    if (options.categoryId) params = params.set('category_id', options.categoryId);
    if (options.missingTranslation) params = params.set('missing_translation', options.missingTranslation);
    if (options.withoutSources) params = params.set('without_sources', true);
    if (options.withoutImages) params = params.set('without_images', true);
    if (options.needsVerification) params = params.set('needs_verification', true);
    if (options.page) params = params.set('page', options.page);
    if (options.perPage) params = params.set('per_page', options.perPage);
    return this.http.get<HistoryAdminListDto>(`${SITE.apiBase}/api/admin/history/events`, { params });
  }

  historyAdminEvent(id: number): Observable<HistoryAdminDetailDto> {
    return this.http.get<HistoryAdminDetailDto>(`${SITE.apiBase}/api/admin/history/events/${id}`);
  }

  createHistoryEvent(payload: unknown): Observable<HistoryAdminDetailDto> {
    return this.http.post<HistoryAdminDetailDto>(`${SITE.apiBase}/api/admin/history/events`, payload);
  }

  updateHistoryEvent(id: number, payload: unknown): Observable<HistoryAdminDetailDto> {
    return this.http.patch<HistoryAdminDetailDto>(`${SITE.apiBase}/api/admin/history/events/${id}`, payload);
  }

  deleteHistoryEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${SITE.apiBase}/api/admin/history/events/${id}`);
  }

  historyImport(mode: HistoryImportMode, payload: unknown, filename: string | null = null): Observable<HistoryImportReportDto> {
    return this.http.post<HistoryImportReportDto>(`${SITE.apiBase}/api/admin/history/imports`, { mode, payload, filename });
  }

  historyCategories(): Observable<HistoryCategoryDto[]> {
    return this.http.get<HistoryCategoryDto[]>(`${SITE.apiBase}/api/history/categories`);
  }

  historyYears(): Observable<number[]> {
    return this.http.get<number[]>(`${SITE.apiBase}/api/history/years`);
  }

  historyEvents(options: HistoryQuery = {}): Observable<HistoryEventsPage> {
    let params = new HttpParams();
    if (options.category) params = params.set('category', options.category);
    if (options.region && options.region !== 'all') params = params.set('region', options.region);
    if (options.yearFrom) params = params.set('year_from', options.yearFrom);
    if (options.yearTo) params = params.set('year_to', options.yearTo);
    if (options.person) params = params.set('person', options.person);
    if (options.query?.trim()) params = params.set('q', options.query.trim());
    if (options.withImages) params = params.set('with_images', true);
    if (options.page) params = params.set('page', options.page);
    if (options.perPage) params = params.set('per_page', options.perPage);
    return this.http.get<HistoryEventsPage>(`${SITE.apiBase}/api/history/events`, { params });
  }

  historyEvent(slug: string): Observable<HistoryEventDetailDto> {
    return this.http.get<HistoryEventDetailDto>(`${SITE.apiBase}/api/history/events/${slug}`);
  }

  recordVisit(payload: { visitor_id:string; path:string; referrer:string|null }): Observable<void> {
    return this.http.post<void>(`${SITE.apiBase}/api/analytics/visit`, payload);
  }

  analytics(days = 30, siteLang: 'ru'|'en'|'all' = 'all'): Observable<AnalyticsSummaryDto> {
    return this.http.get<AnalyticsSummaryDto>(`${SITE.apiBase}/api/admin/analytics`, { params: { days, site_lang: siteLang } });
  }

  login(email: string, password: string): Observable<{ access_token: string }> {
    const body = new URLSearchParams({ username: email, password });
    return this.http.post<{ access_token: string }>(`${SITE.apiBase}/api/auth/token`, body.toString(), {
      headers: new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    });
  }

  adminConflicts(): Observable<ConflictDto[]> {
    return this.http.get<ConflictDto[]>(`${SITE.apiBase}/api/admin/conflicts`);
  }

  createConflict(payload: unknown): Observable<ConflictDto> {
    return this.http.post<ConflictDto>(`${SITE.apiBase}/api/admin/conflicts`, payload);
  }

  updateConflict(id: number, payload: unknown): Observable<ConflictDto> {
    return this.http.patch<ConflictDto>(`${SITE.apiBase}/api/admin/conflicts/${id}`, payload);
  }

  deleteConflict(id: number): Observable<void> {
    return this.http.delete<void>(`${SITE.apiBase}/api/admin/conflicts/${id}`);
  }

  people(): Observable<PersonDto[]> {
    return this.http.get<PersonDto[]>(`${SITE.apiBase}/api/admin/people`);
  }

  /** Поиск по справочнику; all=true обходит языковой фильтр — история общая. */
  searchPeople(query = '', all = false): Observable<PersonDto[]> {
    let params = new HttpParams();
    if (query.trim()) params = params.set('q', query.trim());
    if (all) params = params.set('all_languages', true);
    return this.http.get<PersonDto[]>(`${SITE.apiBase}/api/admin/people/search`, { params });
  }

  personTwins(): Observable<PersonTwinDto[]> {
    return this.http.get<PersonTwinDto[]>(`${SITE.apiBase}/api/admin/people/twins`);
  }

  linkPeople(personIds: number[], canonicalKey: string | null): Observable<PersonDto[]> {
    return this.http.post<PersonDto[]>(`${SITE.apiBase}/api/admin/people/link`, { person_ids: personIds, canonical_key: canonicalKey });
  }

  createPerson(payload: unknown): Observable<PersonDto> {
    return this.http.post<PersonDto>(`${SITE.apiBase}/api/admin/people`, payload);
  }

  updatePerson(id: number, payload: unknown): Observable<PersonDto> {
    return this.http.patch<PersonDto>(`${SITE.apiBase}/api/admin/people/${id}`, payload);
  }

  /** Переносит связи и поля на целевую запись, исходную удаляет. */
  mergePerson(personId: number, targetId: number): Observable<PersonDto> {
    return this.http.post<PersonDto>(`${SITE.apiBase}/api/admin/people/${personId}/merge`, { target_id: targetId });
  }

  checkAvatars(): Observable<AvatarCheckDto[]> {
    return this.http.get<AvatarCheckDto[]>(`${SITE.apiBase}/api/admin/people/avatars`);
  }

  cleanupAvatars(): Observable<{ checked: number; cleared: number; slugs: string[] }> {
    return this.http.post<{ checked: number; cleared: number; slugs: string[] }>(`${SITE.apiBase}/api/admin/people/avatars/cleanup`, {});
  }

  uploadImage(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('image', file);
    return this.http.post<{ url: string }>(`${SITE.apiBase}/api/admin/uploads/images`, form);
  }

  corrections(): Observable<CorrectionDto[]> {
    return this.http.get<CorrectionDto[]>(`${SITE.apiBase}/api/admin/corrections`);
  }

  updateCorrection(id: number, status: string): Observable<CorrectionDto> {
    return this.http.patch<CorrectionDto>(`${SITE.apiBase}/api/admin/corrections/${id}`, { status });
  }

  submitCorrection(slug: string, payload: unknown): Observable<unknown> {
    return this.http.post(`${SITE.apiBase}/api/conflicts/${slug}/corrections`, payload);
  }

  submitMaterial(payload: unknown): Observable<SubmissionDto> {
    return this.http.post<SubmissionDto>(`${SITE.apiBase}/api/submissions`, payload);
  }

  submissions(): Observable<SubmissionDto[]> {
    return this.http.get<SubmissionDto[]>(`${SITE.apiBase}/api/admin/submissions`);
  }

  updateSubmission(id: number, status: string): Observable<SubmissionDto> {
    return this.http.patch<SubmissionDto>(`${SITE.apiBase}/api/admin/submissions/${id}`, { status });
  }

  page(slug: string): Observable<SitePageDto> {
    return this.http.get<SitePageDto>(`${SITE.apiBase}/api/pages/${slug}`);
  }

  adminPage(slug: string): Observable<SitePageDto> {
    return this.http.get<SitePageDto>(`${SITE.apiBase}/api/admin/pages/${slug}`);
  }

  updatePage(slug: string, payload: unknown): Observable<SitePageDto> {
    return this.http.put<SitePageDto>(`${SITE.apiBase}/api/admin/pages/${slug}`, payload);
  }
}
