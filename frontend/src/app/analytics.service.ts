import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { SITE } from '../site-config';

const VISITOR_KEY = 'streamconflicts_visitor_id';
// sessionStorage общий для домена, а путь у языковых версий совпадает ('/archive'),
// поэтому в ключ добавляется префикс версии — иначе визит на вторую версию теряется.
const TRACKED_PREFIX = `streamconflicts_tracked${SITE.path}:`;

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly api = inject(ApiService);
  private lastPath = '';
  private lastTrackedAt = 0;

  track(path: string): void {
    if (typeof window === 'undefined' || path.startsWith('/editor')) return;
    const cleanPath = path.split(/[?#]/, 1)[0] || '/';
    const now = Date.now();
    if (cleanPath === this.lastPath && now - this.lastTrackedAt < 1500) return;
    this.lastPath = cleanPath;
    this.lastTrackedAt = now;
    let visitorId = localStorage.getItem(VISITOR_KEY);
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, visitorId);
    }
    const trackedKey = `${TRACKED_PREFIX}${new Date().toISOString().slice(0, 10)}:${cleanPath}`;
    if (sessionStorage.getItem(trackedKey)) return;
    sessionStorage.setItem(trackedKey, '1');
    this.api.recordVisit({ visitor_id: visitorId, path: cleanPath, referrer: document.referrer || null }).subscribe({ error: () => undefined });
  }
}
