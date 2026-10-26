import {describe, expect, it} from 'vitest';
import {loader, meta} from '../../routes/policies.$handle';
import {
  getStorefrontPolicy,
  getStorefrontPolicyForField,
} from '../content/policies';

/** The banner the loader attaches from the storefront document, if any. */
function heroFor(field: string) {
  const doc = getStorefrontPolicyForField(
    field as Parameters<typeof getStorefrontPolicyForField>[0],
  );
  return doc
    ? {
        headline: doc.heroHeadline,
        subheadline: doc.heroSubheadline,
        image: doc.heroImage,
      }
    : null;
}
import {
  ORIGIN,
  callRoute,
  createFakeStorefront,
  expectValidStorefrontDocument,
  thrownResponse,
} from './route-test-utils';

const POLICIES = [
  ['privacy-policy', 'privacyPolicy'],
  ['shipping-policy', 'shippingPolicy'],
  ['terms-of-service', 'termsOfService'],
  ['refund-policy', 'refundPolicy'],
  ['subscription-policy', 'subscriptionPolicy'],
] as const;

const FLAGS = POLICIES.map(([, field]) => field);

function policyLoader(handle: string | undefined, data: unknown) {
  const storefront = createFakeStorefront(data);
  const promise = callRoute(loader, {
    request: new Request(`${ORIGIN}/policies/${handle}`),
    context: {storefront},
    params: {handle},
  });
  return {promise, storefront};
}

describe('policies/:handle loader', () => {
  it.each(POLICIES)('serves %s from shop.%s', async (handle, field) => {
    // Arrange
    const policy = {
      id: 'gid://shopify/ShopPolicy/1',
      handle,
      title: 'A policy',
      body: '<p>Text</p>',
      url: ORIGIN,
    };
    const {promise, storefront} = policyLoader(handle, {
      shop: {[field]: policy},
    });

    // Act
    const result = await promise;

    // Assert: the page gets the handle, title and body of Shopify's policy.
    expect(result).toEqual({
      policy: {
        handle,
        title: 'A policy',
        body: '<p>Text</p>',
        hero: heroFor(field),
      },
      origin: ORIGIN,
    });
    expect(storefront.query).toHaveBeenCalledTimes(1);
    const [document, options] = storefront.query.mock.calls[0] as [
      string,
      {variables: Record<string, unknown>},
    ];
    expect(options.variables).toEqual({
      ...Object.fromEntries(FLAGS.map((flag) => [flag, flag === field])),
      language: 'EN',
    });
    expectValidStorefrontDocument(document);
  });

  it('serves the subscription policy, whose id may be null for a default policy', async () => {
    const policy = {
      id: null,
      handle: 'subscription-policy',
      title: 'Subscription policy',
      body: '<p>Default</p>',
      url: ORIGIN,
    };
    const {promise} = policyLoader('subscription-policy', {
      shop: {subscriptionPolicy: policy},
    });
    expect(await promise).toEqual({
      policy: {
        handle: 'subscription-policy',
        title: 'Subscription policy',
        body: '<p>Default</p>',
        hero: null,
      },
      origin: ORIGIN,
    });
  });

  it.each([
    'privacy-policy',
    'shipping-policy',
    'terms-of-service',
    'refund-policy',
  ])(
    'serves the storefront document for %s when the store has not published one',
    async (handle) => {
      const {promise, storefront} = policyLoader(handle, {shop: {}});

      const result = (await promise) as {
        policy: {handle: string; body: string};
      };

      expect(storefront.query).toHaveBeenCalledTimes(1);
      const doc = getStorefrontPolicy(handle);
      expect(result.policy).toEqual({
        handle,
        title: doc?.title,
        body: doc?.body,
        hero: doc ? heroFor(doc.shopField ?? '') : null,
      });
      expect(result.policy.body).toContain('<h2>');
    },
  );

  it.each(['contact-information', 'legal-notice'])(
    'serves %s from the storefront without calling the API',
    async (handle) => {
      const {promise, storefront} = policyLoader(handle, {shop: {}});

      const result = (await promise) as {policy: {handle: string}};

      expect(storefront.query).not.toHaveBeenCalled();
      expect(result.policy.handle).toBe(handle);
    },
  );

  it.each([
    'constructor',
    '__proto__',
    'prototype',
    'toString',
    'valueOf',
    'hasOwnProperty',
    'privacyPolicy',
    'PRIVACY-POLICY',
    'privacy-policy/',
    ' privacy-policy',
    'nope',
    '',
  ])('answers 404 for %j without calling the API', async (handle) => {
    const {promise, storefront} = policyLoader(handle, {shop: {}});

    const response = await thrownResponse(promise);

    expect(response.status).toBe(404);
    expect(storefront.query).not.toHaveBeenCalled();
  });

  it('answers 404 when the param is missing', async () => {
    const {promise, storefront} = policyLoader(undefined, {shop: {}});
    expect((await thrownResponse(promise)).status).toBe(404);
    expect(storefront.query).not.toHaveBeenCalled();
  });

  it('answers 404 for the subscription policy when the store has none (no storefront fallback)', async () => {
    const {promise} = policyLoader('subscription-policy', {
      shop: {subscriptionPolicy: null},
    });
    expect((await thrownResponse(promise)).status).toBe(404);
  });

  it('never returns Object members, even if the API response had them', async () => {
    // A live Storefront response is a plain object: `data.shop['constructor']`
    // is `Object`. The allowlist keeps the handle from ever being used as a key.
    const {promise} = policyLoader('constructor', {shop: {}});
    expect((await thrownResponse(promise)).status).toBe(404);
  });
});

describe('policies/:handle meta', () => {
  const policy = {handle: 'refund-policy', title: 'Refund policy'};

  it('has a title, description, Open Graph tags and an absolute canonical', () => {
    const tags = callRoute(meta, {data: {policy, origin: ORIGIN}}) as unknown[];

    expect(tags).toEqual([
      {title: 'Refund policy | {AppName}'},
      {name: 'description', content: 'Refund policy for the {AppName} store.'},
      {property: 'og:title', content: 'Refund policy | {AppName}'},
      {
        property: 'og:description',
        content: 'Refund policy for the {AppName} store.',
      },
      {property: 'og:type', content: 'website'},
      {
        tagName: 'link',
        rel: 'canonical',
        href: `${ORIGIN}/policies/refund-policy`,
      },
    ]);
  });

  it('is a noindex "not found" page when the loader threw', () => {
    expect(callRoute(meta, {data: undefined})).toEqual([
      {title: 'Policy not found | {AppName}'},
      {name: 'robots', content: 'noindex'},
    ]);
  });
});
