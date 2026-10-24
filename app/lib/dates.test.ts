import {afterEach, describe, expect, it, vi} from 'vitest';
import {formatDate} from './dates';

const OPTIONS_LONG: Intl.DateTimeFormatOptions = {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
};

/** Zones on both sides of UTC, including the +14h and -11h extremes. */
const TIME_ZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'Asia/Kolkata',
  'Pacific/Auckland',
  'Pacific/Kiritimati',
  'Pacific/Pago_Pago',
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('formatDate', () => {
  it.each(TIME_ZONES)(
    'formats a date-only value as that calendar day in %s',
    (zone) => {
      // Arrange
      vi.stubEnv('TZ', zone);

      // Act
      const result = formatDate('2026-09-12');

      // Assert
      expect(result).toBe('Sep 12, 2026');
    },
  );

  it('does not shift the day the way local-time formatting does', () => {
    // Arrange: a zone west of UTC, where `new Date('2026-09-12')` is still
    // the evening of Sep 11 on the wall clock.
    vi.stubEnv('TZ', 'America/Los_Angeles');
    const localFormat = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date('2026-09-12'));

    // Act
    const result = formatDate('2026-09-12');

    // Assert: the control proves the zone took effect and would have broken.
    expect(localFormat).toBe('Sep 11, 2026');
    expect(result).toBe('Sep 12, 2026');
  });

  it('renders timestamps as their UTC calendar day', () => {
    vi.stubEnv('TZ', 'Pacific/Auckland');

    expect(formatDate('2026-10-12T23:59:59Z')).toBe('Oct 12, 2026');
    expect(formatDate('2026-10-13T00:00:00Z')).toBe('Oct 13, 2026');
  });

  it('accepts a Date instance', () => {
    expect(formatDate(new Date(Date.UTC(2026, 0, 31, 23, 0)))).toBe(
      'Jan 31, 2026',
    );
  });

  it('applies custom options and a custom locale', () => {
    expect(formatDate('2026-09-12', OPTIONS_LONG)).toBe('September 12, 2026');
    expect(
      formatDate(
        '2026-09-12',
        {day: '2-digit', month: '2-digit', year: 'numeric'},
        'en-GB',
      ),
    ).toBe('12/09/2026');
  });

  it('always formats in UTC even when the options name another zone', () => {
    const result = formatDate('2026-09-12T23:00:00Z', {
      ...OPTIONS_LONG,
      timeZone: 'Pacific/Kiritimati',
    });

    expect(result).toBe('September 12, 2026');
  });

  it.each([null, undefined, '', 'not a date', '2026-13-45', '   '])(
    'returns null for %j',
    (value) => {
      expect(formatDate(value)).toBeNull();
    },
  );

  it('returns null for an invalid Date instance', () => {
    expect(formatDate(new Date('nope'))).toBeNull();
  });
});
