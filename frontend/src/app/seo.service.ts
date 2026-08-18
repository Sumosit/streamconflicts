import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE } from '../site-config';

export interface SeoData {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: 'website' | 'article' | 'profile';
  noindex?: boolean;
  structuredData?: Record<string, unknown>;
  /** Цепочка разделов для разметки BreadcrumbList: путь считается от корня сайта. */
  breadcrumbs?: { name: string; path: string }[];
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly base = `${SITE.baseUrl}${SITE.path}`;

  set(data: SeoData): void {
    const url = `${this.base}${data.path === '/' ? '' : data.path}`;
    this.document.documentElement.lang = SITE.lang;
    this.title.setTitle(data.title);
    this.meta.updateTag({ name: 'description', content: data.description });
    this.meta.updateTag({ name: 'robots', content: data.noindex ? 'noindex, nofollow, noarchive' : 'index, follow, max-image-preview:large' });
    this.meta.updateTag({ property: 'og:locale', content: SITE.locale });
    this.meta.updateTag({ property: 'og:site_name', content: SITE.siteName });
    this.meta.updateTag({ property: 'og:type', content: data.type || 'website' });
    this.meta.updateTag({ property: 'og:title', content: data.title });
    this.meta.updateTag({ property: 'og:description', content: data.description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ name: 'twitter:card', content: data.image ? 'summary_large_image' : 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: data.title });
    this.meta.updateTag({ name: 'twitter:description', content: data.description });
    // Без картинки репост выглядит пустым блоком, поэтому подставляем логотип.
    const shareImage = data.image || `${SITE.baseUrl}/streamconflict-logo-512x512.png`;
    if (shareImage) {
      const image = shareImage.startsWith('http') ? shareImage : `${this.base}${shareImage}`;
      this.meta.updateTag({ property: 'og:image', content: image });
      this.meta.updateTag({ name: 'twitter:image', content: image });
    } else {
      this.meta.removeTag("property='og:image'");
      this.meta.removeTag("name='twitter:image'");
    }
    let canonical = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.rel = 'canonical';
      this.document.head.appendChild(canonical);
    }
    canonical.href = url;
    this.document.getElementById('seo-jsonld')?.remove();
    const blocks: Record<string, unknown>[] = [];
    if (data.structuredData) blocks.push(data.structuredData);
    if (data.breadcrumbs?.length) {
      blocks.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: data.breadcrumbs.map((crumb, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: crumb.name,
          item: `${this.base}${crumb.path === '/' ? '' : crumb.path}`,
        })),
      });
    }
    if (blocks.length) {
      const script = this.document.createElement('script');
      script.id = 'seo-jsonld';
      script.type = 'application/ld+json';
      script.text = JSON.stringify(blocks.length === 1 ? blocks[0] : blocks);
      this.document.head.appendChild(script);
    }
  }
}
