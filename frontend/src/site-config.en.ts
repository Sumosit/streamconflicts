/** Настройки англоязычного сайта. Подменяет site-config.ts в сборке en. */
import { SiteConfig } from './site-config.model';

export const SITE: SiteConfig = {
  lang: 'en',
  locale: 'en_US',
  siteName: 'StreamArchive',
  baseUrl: 'https://streamconflicts.com',
  path: '/en',
  apiBase: '/en',
  other: { href: 'https://streamconflicts.com', label: 'RU', title: 'Русская версия', lang: 'ru' },
};
