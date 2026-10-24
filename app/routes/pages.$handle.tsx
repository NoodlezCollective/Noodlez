import {isRouteErrorResponse, useLoaderData, useRouteError} from 'react-router';
import type {Route} from './+types/pages.$handle';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {SITE_NAME, canonicalLink, notFoundMeta} from '~/lib/seo';
import {ErrorView} from '~/components/ErrorView';

export const meta: Route.MetaFunction = ({data}) => {
  if (!data?.page) return notFoundMeta('Page');

  const {page, origin} = data;
  const title = `${page.seo?.title || page.title} | ${SITE_NAME}`;
  const description = page.seo?.description || page.bodySummary;
  return [
    {title},
    ...(description ? [{name: 'description', content: description}] : []),
    {property: 'og:title', content: title},
    ...(description
      ? [{property: 'og:description', content: description}]
      : []),
    {property: 'og:type', content: 'website'},
    canonicalLink(origin, `/pages/${page.handle}`),
  ];
};

export async function loader(args: Route.LoaderArgs) {
  const criticalData = await loadCriticalData(args);
  return {...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, request, params}: Route.LoaderArgs) {
  if (!params.handle) {
    throw new Error('Missing page handle');
  }

  const {page} = await context.storefront.query(PAGE_QUERY, {
    variables: {
      handle: params.handle,
    },
  });

  if (!page) {
    throw new Response('Not Found', {status: 404});
  }

  redirectIfHandleIsLocalized(request, {handle: params.handle, data: page});

  return {
    page,
    origin: new URL(request.url).origin,
  };
}

export default function Page() {
  const {page} = useLoaderData<typeof loader>();

  return (
    <article className="content-page container container--text">
      <header className="page-header">
        <p className="eyebrow page-header__eyebrow">Mellow</p>
        <h1>{page.title}</h1>
      </header>
      <div className="prose" dangerouslySetInnerHTML={{__html: page.body}} />
    </article>
  );
}

const PAGE_QUERY = `#graphql
  query Page(
    $language: LanguageCode,
    $country: CountryCode,
    $handle: String!
  )
  @inContext(language: $language, country: $country) {
    page(handle: $handle) {
      handle
      id
      title
      body
      bodySummary
      seo {
        description
        title
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
