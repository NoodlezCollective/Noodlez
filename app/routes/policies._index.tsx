import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/policies._index';
import type {PoliciesQuery, PolicyItemFragment} from 'storefrontapi.generated';
import {ArrowRightIcon} from '~/components/ui/Icons';
import {canonicalLink, notFoundMeta} from '~/lib/seo';

/** Short blurbs for the standard Shopify policies, keyed by handle. */
const POLICY_DESCRIPTIONS: Record<string, string> = {
  'privacy-policy':
    'How we collect, use and protect your personal information.',
  'shipping-policy': 'Processing times, delivery estimates and tracking.',
  'refund-policy': 'Our 30-night trial and how returns and refunds work.',
  'terms-of-service': 'The terms that apply when you shop with Mellow.',
  'subscription-policy': 'How subscriptions renew, pause and cancel.',
};

export const meta: Route.MetaFunction = ({data}) => {
  if (!data) return notFoundMeta('Policies');

  const title = 'Policies | Mellow';
  const description =
    'Shipping, returns, privacy and terms of service for the Mellow store.';
  return [
    {title},
    {name: 'description', content: description},
    {property: 'og:title', content: title},
    {property: 'og:description', content: description},
    {property: 'og:type', content: 'website'},
    canonicalLink(data.origin, '/policies'),
  ];
};

export async function loader({context, request}: Route.LoaderArgs) {
  const data: PoliciesQuery = await context.storefront.query(POLICIES_QUERY);

  const shopPolicies = data.shop;
  const policies: PolicyItemFragment[] = [
    shopPolicies?.privacyPolicy,
    shopPolicies?.shippingPolicy,
    shopPolicies?.termsOfService,
    shopPolicies?.refundPolicy,
    shopPolicies?.subscriptionPolicy,
  ].filter((policy): policy is PolicyItemFragment => policy != null);

  if (!policies.length) {
    throw new Response('No policies found', {status: 404});
  }

  return {policies, origin: new URL(request.url).origin};
}

export default function Policies() {
  const {policies} = useLoaderData<typeof loader>();

  return (
    <div className="content-page container container--text">
      <header className="page-header">
        <p className="eyebrow page-header__eyebrow">Mellow</p>
        <h1>Policies</h1>
        <p className="page-header__description">
          The fine print, in plain language: how we ship, how returns work and
          how we look after your information.
        </p>
      </header>
      <ul className="policy-list">
        {policies.map((policy) => (
          <li key={policy.handle}>
            <Link
              className="policy-card"
              prefetch="intent"
              to={`/policies/${policy.handle}`}
            >
              <span className="policy-card__body">
                <span className="policy-card__title">{policy.title}</span>
                <span className="policy-card__description">
                  {POLICY_DESCRIPTIONS[policy.handle] ??
                    'Read the full policy.'}
                </span>
              </span>
              <ArrowRightIcon className="policy-card__arrow" size={20} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const POLICIES_QUERY = `#graphql
  fragment PolicyItem on ShopPolicy {
    id
    title
    handle
  }
  query Policies ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    shop {
      privacyPolicy {
        ...PolicyItem
      }
      shippingPolicy {
        ...PolicyItem
      }
      termsOfService {
        ...PolicyItem
      }
      refundPolicy {
        ...PolicyItem
      }
      subscriptionPolicy {
        id
        title
        handle
      }
    }
  }
` as const;

/**
 * Keeps thrown responses (404, 502) inside this route: its `meta` only applies
 * while the route stays in the rendered tree (not-found title, `noindex`).
 */
export {RouteErrorBoundary as ErrorBoundary} from '~/components/ErrorView';
