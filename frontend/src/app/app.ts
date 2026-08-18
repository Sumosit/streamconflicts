import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ApiService, ConflictDto } from './api.service';
import { PublicHeader } from './public/public-header';
import { PublicFooter } from './public/public-footer';
import { SeoService } from './seo.service';
import { AnalyticsService } from './analytics.service';
import { T, LOCALE, statusLabel } from './i18n';
import { SITE } from '../site-config';


/** Сколько материалов показывать в ленте на главной. */
const HOME_PAGE_SIZE = 10;

interface Conflict {
  id: number;
  slug: string;
  title: string;
  summary: string;
  date: string;
  age: string;
  status: string;
  statusKey: string;
  category: string;
  platforms: string[];
  people: { name: string; initials: string; avatar: string | null; color: string }[];
  events: number;
  sources: number;
  cover: string | null;
  featured?: boolean;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, RouterLink, RouterOutlet, PublicHeader, PublicFooter],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly menuOpen = signal(false);
  protected readonly onConflictPage = signal(false);
  protected readonly submitOpen = signal(false);
  protected readonly submitLoading = signal(false);
  protected readonly submitSent = signal(false);
  protected readonly submitError = signal('');
  protected submission = { source_url: '', description: '', contact: '' };
  protected readonly search = signal('');
  protected readonly t = T;
  protected readonly activeFilter = signal('all');
  protected readonly filters = [
    { key: 'all', label: T.home.filterAll },
    { key: 'developing', label: T.status.developing },
    { key: 'closed', label: T.status.closed },
  ];

  protected readonly conflicts = signal<Conflict[]>([]);

  // На главной показывается только первая страница ленты, поэтому фильтровать
  // её на клиенте нельзя: поиск и фильтры уводят в архив, где есть все материалы.
  protected readonly filteredConflicts = computed(() => this.conflicts());
  protected readonly totalSources = computed(() => this.conflicts().reduce((total, item) => total + item.sources, 0));
  protected readonly featuredConflict = computed(() => this.conflicts().find(item => item.featured) ?? this.conflicts()[0] ?? null);

  constructor(private readonly router: Router, private readonly api: ApiService, private readonly seo:SeoService, private readonly analytics:AnalyticsService) {
    this.onConflictPage.set(this.router.url !== '/');
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.analytics.track(event.urlAfterRedirects);
        const isHome = event.urlAfterRedirects === '/';
        this.onConflictPage.set(!isHome);
        if (isHome) {
          this.setHomeSeo();
          this.loadHomeConflicts();
        }
      });
  }

  private loadHomeConflicts():void {
    if (this.conflicts().length) return;
    this.api.conflictsPage({ page: 1, perPage: HOME_PAGE_SIZE }).subscribe({
      next: (result) => this.conflicts.set(result.items.map((item) => this.mapConflict(item))),
    });
  }

  /** Поиск с главной ведёт в архив: там полная выборка и постраничность. */
  protected submitSearch(): void {
    const query = this.search().trim();
    void this.router.navigate(['/archive'], { queryParams: query ? { q: query } : {} });
  }

  protected applyFilter(key: string): void {
    this.activeFilter.set(key);
    void this.router.navigate(['/archive'], { queryParams: key === 'all' ? {} : { status: key } });
  }

  private setHomeSeo():void { this.seo.set({title:T.home.seoTitle,description:T.home.seoDescription,path:'/',structuredData:{'@context':'https://schema.org','@type':'WebSite',name:SITE.siteName,url:`${SITE.baseUrl}${SITE.path}`,inLanguage:SITE.lang}}); }

  private mapConflict(item: ConflictDto): Conflict {
    const platforms = [...new Set(item.events.flatMap((event) => event.sources.map((source) => source.platform)))];
    return {
      id: item.id, slug: item.slug, title: item.title, summary: item.summary,
      date: new Date(item.updated_at).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }),
      age: T.home.freshness, status: statusLabel(item.status), statusKey: item.status, category: item.category,
      platforms, people: item.people.filter((entry) => entry.relation === 'participant' && entry.person).map((entry) => ({ name: entry.person!.name, initials: entry.person!.initials, avatar:entry.person!.avatar_url||null, color: '#323744' })),
      events: item.events.length, sources: item.events.reduce((total, event) => total + event.sources.length, 0),
      cover: item.cover_image_url || item.events.flatMap(event => event.sources).find(source => source.thumbnail_url)?.thumbnail_url || null,
      featured: item.is_featured,
    };
  }

  protected setSearch(value: string): void {
    this.search.set(value);
  }

  protected openSubmit(): void {
    this.submitSent.set(false);
    this.submitError.set('');
    this.submitOpen.set(true);
    this.menuOpen.set(false);
  }

  protected submitMaterial(): void {
    const sourceUrl = this.submission.source_url.trim();
    if (!/^https?:\/\/\S+$/i.test(sourceUrl)) {
      this.submitError.set(T.submit.errorUrl);
      return;
    }
    if (this.submission.description.trim().length < 10) {
      this.submitError.set(T.submit.errorText);
      return;
    }
    this.submitLoading.set(true);
    this.submitError.set('');
    this.api.submitMaterial(this.submission).subscribe({
      next: () => { this.submitLoading.set(false); this.submitSent.set(true); this.submission = { source_url: '', description: '', contact: '' }; },
      error: (response) => { this.submitLoading.set(false); this.submitError.set(this.formatApiError(response.error?.detail)); },
    });
  }

  private formatApiError(detail: unknown): string {
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      const fields: Record<string, string> = T.submit.fields;
      return detail.map((item) => `${fields[item?.loc?.at(-1)] ?? T.submit.fields.fallback}: ${item?.msg ?? T.submit.fields.invalid}`).join('. ');
    }
    return T.submit.errorGeneric;
  }
}
