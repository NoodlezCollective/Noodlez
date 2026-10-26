import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/policies._index';
import type {PoliciesQuery, PolicyItemFragment} from 'storefrontapi.generated';
import {ArrowRightIcon} from '~/components/ui/Icons';
import {STOREFRONT_POLICIES} from '~/lib/content/policies';
import {canonicalLink, notFoundMeta} from '~/lib/seo';

type PolicyListItem = {handle: string; title: string; description: string};

const SUBSCRIPTION_DESCRIPTION = 'How subscriptions renew, pause and cancel.';

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

/**
 * Lists the storefront's policies in a fixed order. A policy the store has
 * published in Shopify takes its title from there; otherwise the storefront's
 * own document stands in. The subscription policy is listed only when Shopify
 * has one; contact information and the legal notice always come from the
 * storefront (the Storefront API does not expose them).
 */
export async function loader({context, request}: Route.LoaderArgs) {
  const data: PoliciesQuery = await context.storefront.query(POLICIES_QUERY);
  const shop = data.shop;

  const policies: PolicyListItem[] = [];
  for (const local of STOREFRONT_POLICIES) {
    const fromShop: PolicyItemFragment | null | undefined = local.shopField
      ? shop?.[local.shopField]
      : null;
    policies.push({
      handle: fromShop?.handle ?? local.handle,
      title: fromShop?.title ?? local.title,
      description: local.description,
    });
    if (local.shopField === 'refundPolicy' && shop?.subscriptionPolicy) {
      policies.push({
        handle: shop.subscriptionPolicy.handle,
        title: shop.subscriptionPolicy.title,
        description: SUBSCRIPTION_DESCRIPTION,
      });
    }
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
                  {policy.description}
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
