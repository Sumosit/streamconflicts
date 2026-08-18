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

export interface ConflictsPage { items: ConflictDto[]; total: number }

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

  recordVisit(payload: { visitor_id:string; path:string; referrer:string|null }): Observable<void> {
    return this.http.post<void>(`${SITE.apiBase}/api/analytics/visit`, payload);
  }

  analytics(days = 30): Observable<AnalyticsSummaryDto> {
    return this.http.get<AnalyticsSummaryDto>(`${SITE.apiBase}/api/admin/analytics`, { params: { days } });
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
