/**
 * Настройки конкретного языкового сайта.
 * Для англоязычной сборки этот файл подменяется на site-config.en.ts
 * (см. конфигурацию en в angular.json).
 */
import { SiteConfig } from './site-config.model';

export const SITE: SiteConfig = {
  lang: 'ru',
  locale: 'ru_RU',
  siteName: 'Стримархив',
  baseUrl: 'https://streamconflicts.com',
  /** Путь сайта внутри домена: '' для корня, '/en' для англоязычной версии. */
  path: '',
  /** Префикс запросов к API: '' → /api, '/en' → /en/api. */
  apiBase: '',
  /** Ссылка на соседний языковой сайт. */
  other: { href: 'https://streamconflicts.com/en', label: 'EN', title: 'English version', lang: 'en' },
};
