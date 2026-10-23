/**
 * Date formatting that produces the same text on the server (Oxygen renders in
 * UTC) and in the visitor's browser, so hydration never mismatches and
 * date-only values such as `2026-09-12` never display a day early.
 */
const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

export function formatDate(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = DEFAULT_OPTIONS,
  locale = 'en-US',
): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {...options, timeZone: 'UTC'}).format(
    date,
  );
}
