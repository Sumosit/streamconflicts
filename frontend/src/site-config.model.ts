export interface SiteConfig {
  lang: 'ru' | 'en';
  locale: string;
  siteName: string;
  baseUrl: string;
  /** Путь сайта внутри домена: '' для корня, '/en' для англоязычной версии. */
  path: string;
  /** Префикс запросов к API: '' → /api, '/en' → /en/api. */
  apiBase: string;
  /** Ссылка на соседний языковой сайт. */
  other: { href: string; label: string; title: string; lang: 'ru' | 'en' };
}
