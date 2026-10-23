import {
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useRouteError,
} from 'react-router';
import type {Route} from './+types/blogs.$blogHandle.$articleHandle';
import {Image} from '@shopify/hydrogen';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {formatDate} from '~/lib/dates';
import {SITE_NAME, canonicalLink, notFoundMeta} from '~/lib/seo';
import {ErrorView} from '~/components/ErrorView';
import {Button} from '~/components/ui/Button';

export const meta: Route.MetaFunction = ({data}) => {
  if (!data?.article) return notFoundMeta('Article');

  const {article, blogHandle, origin} = data;
  const title = `${article.seo?.title || article.title} | ${SITE_NAME}`;
  // SEO description, else the merchant's excerpt, else the start of the text.
  const description =
    article.seo?.description || article.excerpt || article.content;
  const image = article.image?.url;
  return [
    {title},
    ...(description ? [{name: 'description', content: description}] : []),
    {property: 'og:title', content: title},
    ...(description
      ? [{property: 'og:description', content: description}]
      : []),
    {property: 'og:type', content: 'article'},
    ...(image?.startsWith('https://')
      ? [{property: 'og:image', content: image}]
      : []),
    {property: 'article:published_time', content: article.publishedAt},
    canonicalLink(origin, `/blogs/${blogHandle}/${article.handle}`),
  ];
};

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, request, params}: Route.LoaderArgs) {
  const {blogHandle, articleHandle} = params;

  if (!articleHandle || !blogHandle) {
    throw new Response('Not found', {status: 404});
  }

  const [{blog}] = await Promise.all([
    context.storefront.query(ARTICLE_QUERY, {
      variables: {blogHandle, articleHandle},
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!blog?.articleByHandle) {
    throw new Response(null, {status: 404});
  }

  redirectIfHandleIsLocalized(
    request,
    {
      handle: articleHandle,
      data: blog.articleByHandle,
    },
    {
      handle: blogHandle,
      data: blog,
    },
  );

  const article = blog.articleByHandle;

  return {
    article,
    blogHandle: blog.handle,
    blogTitle: blog.title,
    origin: new URL(request.url).origin,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  return {};
}

/** "September 12, 2026", always in UTC so server and browser agree. */
const PUBLISHED_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

export default function Article() {
  const {article, blogHandle, blogTitle} = useLoaderData<typeof loader>();
  const {title, image, contentHtml, author} = article;

  const publishedDate = formatDate(article.publishedAt, PUBLISHED_FORMAT);

  return (
    <article className="content-page article container container--text">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/blogs" prefetch="intent">
          Journal
        </Link>
        <span aria-hidden="true">/</span>
        <Link to={`/blogs/${blogHandle}`} prefetch="intent">
          {blogTitle}
        </Link>
      </nav>

      <header className="article__header">
        <p className="article__meta">
          {publishedDate ? (
            <time dateTime={article.publishedAt}>{publishedDate}</time>
          ) : null}
          {publishedDate && author?.name ? <> &middot; </> : null}
          {author?.name ? <>By {author.name}</> : null}
        </p>
        <h1>{title}</h1>
      </header>

      {image ? (
        <figure className="article__hero">
          <Image
            alt={image.altText || title}
            aspectRatio="16/9"
            data={image}
            loading="eager"
            sizes="(min-width: 64em) 760px, 100vw"
          />
        </figure>
      ) : null}

      <div
        className="prose article__body"
        dangerouslySetInnerHTML={{__html: contentHtml}}
      />

      <footer className="article__footer">
        <Button to={`/blogs/${blogHandle}`} variant="outline" size="sm">
          More from {blogTitle}
        </Button>
        <Button to="/collections/all" variant="ghost" size="sm">
          Shop best sellers
        </Button>
      </footer>
    </article>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/blog#field-blog-articlebyhandle
const ARTICLE_QUERY = `#graphql
  query Article(
    $articleHandle: String!
    $blogHandle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(language: $language, country: $country) {
    blog(handle: $blogHandle) {
      handle
      title
      articleByHandle(handle: $articleHandle) {
        handle
        title
        contentHtml
        content(truncateAt: 160)
        excerpt(truncateAt: 160)
        publishedAt
        author: authorV2 {
          name
        }
        image {
          id
          altText
          url
          width
          height
        }
        seo {
          description
          title
        }
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
