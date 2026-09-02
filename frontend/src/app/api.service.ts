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
}

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
