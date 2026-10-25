/**
 * Date formatting that produces the same text on the server (the Worker
 * renders in UTC) and in the visitor's browser, so hydration never mismatches
 * and date-only values such as `2026-09-12` never display a day early.
 */

/** "Oct 12, 2026" (the default). */
export const SHORT_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

/** "October 12, 2026". */
export const LONG_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
};

export function formatDate(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = SHORT_DATE_FORMAT,
  locale = 'en-US',
): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {...options, timeZone: 'UTC'}).format(
    date,
  );
}
