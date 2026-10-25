import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  DISABLED_ANALYTICS_CONFIG,
  getAnalyticsSettings,
  isAnalyticsEnabled,
} from './config';

type AnalyticsEnv = Parameters<typeof isAnalyticsEnabled>[0];

/** A store with both analytics variables set and the mock off. */
const CONFIGURED: AnalyticsEnv = {
  PUBLIC_CHECKOUT_DOMAIN: 'checkout.mellow.example',
  PUBLIC_STOREFRONT_ID: '1000014925',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isAnalyticsEnabled', () => {
  it('is on when the checkout domain and the storefront id are set', () => {
    expect(isAnalyticsEnabled(CONFIGURED)).toBe(true);
  });

  it.each([
    ['neither variable', {}],
    [
      'only the checkout domain',
      {PUBLIC_CHECKOUT_DOMAIN: 'checkout.mellow.example'},
    ],
    ['only the storefront id', {PUBLIC_STOREFRONT_ID: '1000014925'}],
    ['an empty checkout domain', {...CONFIGURED, PUBLIC_CHECKOUT_DOMAIN: ''}],
    ['an empty storefront id', {...CONFIGURED, PUBLIC_STOREFRONT_ID: ''}],
    ['a blank checkout domain', {...CONFIGURED, PUBLIC_CHECKOUT_DOMAIN: '  '}],
    ['a blank storefront id', {...CONFIGURED, PUBLIC_STOREFRONT_ID: '\t'}],
  ])('is off with %s', (_label, env: AnalyticsEnv) => {
    expect(isAnalyticsEnabled(env)).toBe(false);
  });

  it('is off while the development mock serves the Storefront API', () => {
    // Arrange: `react-router dev` with MOCK_STOREFRONT=true (the e2e setup).
    vi.stubEnv('DEV', true);

    // Act
    const enabled = isAnalyticsEnabled({
      ...CONFIGURED,
      MOCK_STOREFRONT: 'true',
    });

    // Assert
    expect(enabled).toBe(false);
  });

  it.each(['false', '', 'TRUE', '1'])(
    'stays on in development when MOCK_STOREFRONT is %j',
    (value) => {
      vi.stubEnv('DEV', true);

      expect(isAnalyticsEnabled({...CONFIGURED, MOCK_STOREFRONT: value})).toBe(
        true,
      );
    },
  );

  it('stays on in a production build, where MOCK_STOREFRONT has no effect', () => {
    // Arrange: production bundles can never install the mock.
    vi.stubEnv('DEV', false);

    // Act
    const enabled = isAnalyticsEnabled({
      ...CONFIGURED,
      MOCK_STOREFRONT: 'true',
    });

    // Assert
    expect(enabled).toBe(true);
  });
});

describe('getAnalyticsSettings', () => {
  it('returns the checkout domain and the storefront id when analytics run', () => {
    expect(getAnalyticsSettings(CONFIGURED)).toEqual({
      checkoutDomain: 'checkout.mellow.example',
      storefrontId: '1000014925',
    });
  });

  it('is null whenever isAnalyticsEnabled is false', () => {
    vi.stubEnv('DEV', true);

    expect(
      getAnalyticsSettings({PUBLIC_STOREFRONT_ID: '1000014925'}),
    ).toBeNull();
    expect(
      getAnalyticsSettings({...CONFIGURED, MOCK_STOREFRONT: 'true'}),
    ).toBeNull();
  });
});

describe('DISABLED_ANALYTICS_CONFIG', () => {
  it('carries neither shop data nor a consent configuration', () => {
    expect(DISABLED_ANALYTICS_CONFIG).toEqual({
      enabled: false,
      shop: null,
      consent: null,
    });
  });

  it('cannot be changed by a caller', () => {
    expect(Object.isFrozen(DISABLED_ANALYTICS_CONFIG)).toBe(true);
  });
});
