import {afterEach, describe, expect, it, vi} from 'vitest';
import {humanizeStatus, isPendingStatus, statusTone} from './orderUtils';

/**
 * `formatOrderDate` is imported fresh for each test so a module-level
 * formatter cannot capture the time zone the test runner happened to start in.
 */
async function loadFormatOrderDate(timeZone: string) {
  vi.stubEnv('TZ', timeZone);
  vi.resetModules();
  const module = await import('./orderUtils');
  return module.formatOrderDate;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** [input, expected UTC calendar day]. Each crosses midnight in some zone. */
const ORDER_DATES: Array<[string, string]> = [
  // Midnight UTC is the previous evening west of UTC.
  ['2026-09-12', 'Sep 12, 2026'],
  ['2026-10-12T04:30:00Z', 'Oct 12, 2026'],
  // 23:30 UTC is already the next morning east of UTC.
  ['2026-10-12T23:30:00Z', 'Oct 12, 2026'],
  ['2026-12-31T23:30:00Z', 'Dec 31, 2026'],
];

const ZONES = [
  'UTC',
  'America/Los_Angeles',
  'Pacific/Auckland',
  'Pacific/Kiritimati',
];

describe('formatOrderDate', () => {
  const cases = ZONES.flatMap((zone) =>
    ORDER_DATES.map(([input, expected]) => [zone, input, expected] as const),
  );

  it.each(cases)('in %s renders %s as %s', async (zone, input, expected) => {
    // Arrange
    const formatOrderDate = await loadFormatOrderDate(zone);

    // Act
    const result = formatOrderDate(input);

    // Assert
    expect(result).toBe(expected);
  });

  it.each(ZONES)(
    'renders the same text in %s as on the server (UTC)',
    async (zone) => {
      // Arrange: the Worker renders in UTC, browsers in the visitor's own zone.
      const server = await loadFormatOrderDate('UTC');
      const serverText = ORDER_DATES.map(([input]) => server(input));
      const browser = await loadFormatOrderDate(zone);

      // Act
      const browserText = ORDER_DATES.map(([input]) => browser(input));

      // Assert
      expect(browserText).toEqual(serverText);
    },
  );

  it.each([null, undefined, '', 'not a date'])(
    'returns an empty string for %j',
    async (value) => {
      const formatOrderDate = await loadFormatOrderDate('UTC');

      expect(formatOrderDate(value)).toBe('');
    },
  );
});

describe('humanizeStatus', () => {
  it('turns API enum values into sentence case', () => {
    expect(humanizeStatus('PARTIALLY_FULFILLED')).toBe('Partially fulfilled');
    expect(humanizeStatus('PAID')).toBe('Paid');
  });

  it.each([null, undefined, ''])('returns an empty string for %j', (value) => {
    expect(humanizeStatus(value)).toBe('');
  });
});

describe('statusTone', () => {
  it.each(['PAID', 'FULFILLED', 'SUCCESS', 'DELIVERED', 'PICKED_UP'])(
    'marks %s as success',
    (status) => {
      expect(statusTone(status)).toBe('success');
    },
  );

  it.each(['REFUNDED', 'CANCELLED', 'FAILURE', 'ON_HOLD', 'EXPIRED'])(
    'marks %s as needing attention',
    (status) => {
      expect(statusTone(status)).toBe('accent');
    },
  );

  it('treats in-progress and unknown statuses as primary', () => {
    expect(statusTone('IN_TRANSIT')).toBe('primary');
    expect(statusTone('SOMETHING_NEW')).toBe('primary');
  });

  it.each([null, undefined, ''])('is neutral for %j', (status) => {
    expect(statusTone(status)).toBe('neutral');
  });

  it('does not treat inherited object keys as statuses', () => {
    expect(statusTone('constructor')).toBe('primary');
    expect(statusTone('toString')).toBe('primary');
  });
});

describe('isPendingStatus', () => {
  it('is true only for in-progress statuses', () => {
    expect(isPendingStatus('IN_PROGRESS')).toBe(true);
    expect(isPendingStatus('PAID')).toBe(false);
    expect(isPendingStatus('CANCELLED')).toBe(false);
    expect(isPendingStatus(null)).toBe(false);
  });
});
