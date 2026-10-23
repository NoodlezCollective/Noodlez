import {
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useRouteError,
} from 'react-router';
import type {Route} from './+types/policies.$handle';
import {Button} from '~/components/ui/Button';
import {SITE_NAME, canonicalLink, notFoundMeta} from '~/lib/seo';
import {ErrorView} from '~/components/ErrorView';

type PolicyField =
  | 'privacyPolicy'
  | 'shippingPolicy'
  | 'termsOfService'
  | 'refundPolicy'
  | 'subscriptionPolicy';

/**
 * The policy URLs this route serves and the `Shop` field behind each one.
 * `params.handle` comes from the URL, so it is only ever used as a key into
 * this map; indexing the API response with it would let `/policies/constructor`
 * or `/policies/__proto__` reach `Object` members.
 */
const POLICY_FIELDS: ReadonlyMap<string, PolicyField> = new Map([
  ['privacy-policy', 'privacyPolicy'],
  ['shipping-policy', 'shippingPolicy'],
  ['terms-of-service', 'termsOfService'],
  ['refund-policy', 'refundPolicy'],
  ['subscription-policy', 'subscriptionPolicy'],
]);

export const meta: Route.MetaFunction = ({data}) => {
  if (!data?.policy) return notFoundMeta('Policy');

  const {policy, origin} = data;
  const title = `${policy.title} | ${SITE_NAME}`;
  const description = `${policy.title} for the ${SITE_NAME} store.`;
  return [
    {title},
    {name: 'description', content: description},
    {property: 'og:title', content: title},
    {property: 'og:description', content: description},
    {property: 'og:type', content: 'website'},
    canonicalLink(origin, `/policies/${policy.handle}`),
  ];
};

export async function loader({params, context, request}: Route.LoaderArgs) {
  const field = params.handle ? POLICY_FIELDS.get(params.handle) : undefined;

  if (!field) {
    throw new Response('Could not find the policy', {status: 404});
  }

  const data = await context.storefront.query(POLICY_CONTENT_QUERY, {
    variables: {
      privacyPolicy: field === 'privacyPolicy',
      shippingPolicy: field === 'shippingPolicy',
      termsOfService: field === 'termsOfService',
      refundPolicy: field === 'refundPolicy',
      subscriptionPolicy: field === 'subscriptionPolicy',
      language: context.storefront.i18n?.language,
    },
  });

  const policy = data.shop?.[field];

  if (!policy) {
    throw new Response('Could not find the policy', {status: 404});
  }

  return {policy, origin: new URL(request.url).origin};
}

export default function Policy() {
  const {policy} = useLoaderData<typeof loader>();

  return (
    <article className="content-page container container--text">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/policies" prefetch="intent">
          Policies
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{policy.title}</span>
      </nav>
      <header className="page-header">
        <p className="eyebrow page-header__eyebrow">Mellow</p>
        <h1>{policy.title}</h1>
      </header>
      <div className="prose" dangerouslySetInnerHTML={{__html: policy.body}} />
      <footer className="policy__footer">
        <Button to="/policies" variant="outline" size="sm">
          All policies
        </Button>
        <Button to="/collections/all" variant="ghost" size="sm">
          Continue shopping
        </Button>
      </footer>
    </article>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/Shop
const POLICY_CONTENT_QUERY = `#graphql
  fragment Policy on ShopPolicy {
    body
    handle
    id
    title
    url
  }
  fragment SubscriptionPolicy on ShopPolicyWithDefault {
    body
    handle
    id
    title
    url
  }
  query Policy(
    $country: CountryCode
    $language: LanguageCode
    $privacyPolicy: Boolean!
    $refundPolicy: Boolean!
    $shippingPolicy: Boolean!
    $subscriptionPolicy: Boolean!
    $termsOfService: Boolean!
  ) @inContext(language: $language, country: $country) {
    shop {
      privacyPolicy @include(if: $privacyPolicy) {
        ...Policy
      }
      shippingPolicy @include(if: $shippingPolicy) {
        ...Policy
      }
      termsOfService @include(if: $termsOfService) {
        ...Policy
      }
      refundPolicy @include(if: $refundPolicy) {
        ...Policy
      }
      subscriptionPolicy @include(if: $subscriptionPolicy) {
        ...SubscriptionPolicy
      }
    }
  }
` as const;

/**
 * Keeps thrown responses (404, 502) inside this route: its `meta` only applies
 * while the route stays in the rendered tree (not-found title, `noindex`).
 */
export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = isRouteErrorResponse(error)
    ? String(error.data ?? '')
    : error instanceof Error
      ? error.message
      : undefined;
  return <ErrorView status={status} message={message} />;
}
