import { LOCALE, T } from '../i18n';

/**
 * Дата события с той точностью, которую подтверждают источники.
 * Показывать «1 июня 2011», когда известен только месяц, — значит выдумать
 * факт, поэтому precision определяет формат, а не наоборот.
 */
export function historyDateLabel(value: string | null, precision: string): string {
  if (!value) return T.history.dateUnknown;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return T.history.dateUnknown;
  switch (precision) {
    case 'year':
    case 'period':
      return String(parsed.getUTCFullYear());
    case 'month':
      return capitalize(new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parsed));
    case 'unknown':
      return T.history.dateUnknown;
    default:
      return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parsed);
  }
}

/** Диапазон для событий, растянутых во времени: «2011 — 2014». */
export function historyRangeLabel(start: string | null, end: string | null, precision: string): string {
  const from = historyDateLabel(start, precision);
  if (!end || end === start) return from;
  return `${from} — ${historyDateLabel(end, precision)}`;
}

function capitalize(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}
