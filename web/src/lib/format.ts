import { UI_LANG } from './i18n';

/** "12m ago" / "৩ ঘণ্টা আগে" — compacts nicely on cards. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const diffMs = then - Date.now();
  const abs = Math.abs(diffMs);
  const locale = UI_LANG === 'bn' ? 'bn' : 'en';

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['minute', 60_000],
    ['hour', 3_600_000],
    ['day', 86_400_000],
    ['week', 604_800_000],
    ['month', 2_592_000_000],
    ['year', 31_536_000_000],
  ];
  void abs;

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
    for (let i = units.length - 1; i >= 0; i--) {
      const [unit, ms] = units[i];
      if (Math.abs(diffMs) >= ms || unit === 'minute') {
        return rtf.format(Math.round(diffMs / ms), unit);
      }
    }
  } catch {
    /* Intl not available — fall through to a plain date */
  }
  return fullDate(iso);
}

export function fullDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(UI_LANG === 'bn' ? 'bn-BD' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

/** Deterministic accent colour per category (kept in code so Tailwind can't purge it). */
export const CATEGORY_COLORS: Record<string, string> = {
  World: '#2563eb',
  Politics: '#7c3aed',
  'War & Conflict': '#b91c1c',
  'Economy & Business': '#047857',
  Technology: '#0891b2',
  Science: '#4f46e5',
  Health: '#0d9488',
  Climate: '#15803d',
  Sports: '#ea580c',
  'Culture & Entertainment': '#c026d3',
  'Middle East': '#b45309',
  'South Asia': '#0369a1',
  Opinion: '#52525b',
  Other: '#6b7280',
};

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other;
}

/** Two-letter monogram used when a story has no image. */
export function sourceMonogram(source: string): string {
  return source
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

export function hostname(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
