import {
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useRouteError,
} from 'react-router';
import type {Route} from './+types/blogs.$blogHandle._index';
import {Image, Pagination, getPaginationVariables} from '@shopify/hydrogen';
import type {ArticleItemFragment} from 'storefrontapi.generated';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {formatDate} from '~/lib/dates';
import {SITE_NAME, canonicalLink, notFoundMeta} from '~/lib/seo';
import {ErrorView} from '~/components/ErrorView';
import {Button} from '~/components/ui/Button';
import {ArrowRightIcon} from '~/components/ui/Icons';

export const meta: Route.MetaFunction = ({data}) => {
  if (!data?.blog) return notFoundMeta('Blog');

  const {blog, origin} = data;
  const title = `${blog.seo?.title || blog.title} | ${SITE_NAME}`;
  const description = blog.seo?.description;
  return [
    {title},
    ...(description ? [{name: 'description', content: description}] : []),
    {property: 'og:title', content: title},
    ...(description
      ? [{property: 'og:description', content: description}]
      : []),
    {property: 'og:type', content: 'website'},
    canonicalLink(origin, `/blogs/${blog.handle}`),
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
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 4,
  });

  if (!params.blogHandle) {
    throw new Response(`blog not found`, {status: 404});
  }

  const [{blog}] = await Promise.all([
    context.storefront.query(BLOGS_QUERY, {
      variables: {
        blogHandle: params.blogHandle,
        ...paginationVariables,
      },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!blog?.articles) {
    throw new Response('Not found', {status: 404});
  }

  redirectIfHandleIsLocalized(request, {handle: params.blogHandle, data: blog});

  return {blog, origin: new URL(request.url).origin};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  return {};
}

export default function Blog() {
  const {blog} = useLoaderData<typeof loader>();
  const {articles} = blog;

  return (
    <div className="content-page container">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/blogs" prefetch="intent">
          Journal
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{blog.title}</span>
      </nav>
      <header className="page-header">
        <p className="eyebrow page-header__eyebrow">Mellow journal</p>
        <h1>{blog.title}</h1>
        {blog.seo?.description ? (
          <p className="page-header__description">{blog.seo.description}</p>
        ) : null}
      </header>

      <Pagination<ArticleItemFragment> connection={articles}>
        {({
          nodes,
          isLoading,
          PreviousLink,
          NextLink,
          hasPreviousPage,
          hasNextPage,
        }) =>
          nodes.length ? (
            <>
              {hasPreviousPage ? (
                <div className="content-pagination">
                  <PreviousLink className="btn btn--outline btn--sm">
                    {isLoading ? 'Loading…' : 'Load previous'}
                  </PreviousLink>
                </div>
              ) : null}
              <ul className="article-grid">
                {nodes.map((article, index) => (
                  <ArticleItem
                    article={article}
                    key={article.id}
                    loading={index < 3 ? 'eager' : 'lazy'}
                  />
                ))}
              </ul>
              {hasNextPage ? (
                <div className="content-pagination">
                  <NextLink className="btn btn--outline btn--sm">
                    {isLoading ? 'Loading…' : 'Load more articles'}
                  </NextLink>
                </div>
              ) : null}
            </>
          ) : (
            <div className="empty-state content-empty">
              <h2 className="empty-state__title">No articles yet</h2>
              <p>
                This blog doesn&rsquo;t have any published articles. Check back
                soon or browse the rest of the journal.
              </p>
              <div className="empty-state__actions">
                <Button to="/blogs" variant="outline">
                  Back to the journal
                </Button>
                <Button to="/collections/all" variant="ghost">
                  Shop best sellers
                </Button>
              </div>
            </div>
          )
        }
      </Pagination>
    </div>
  );
}

/** "September 12, 2026", always in UTC so server and browser agree. */
const PUBLISHED_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

function ArticleItem({
  article,
  loading,
}: {
  article: ArticleItemFragment;
  loading?: HTMLImageElement['loading'];
}) {
  const publishedAt = formatDate(article.publishedAt, PUBLISHED_FORMAT);
  // The merchant's excerpt when there is one, else the start of the article.
  // Both come from the API as single-line plain text, already truncated.
  const excerpt = article.excerpt || article.content;

  return (
    <li className="article-card">
      <Link
        className="article-card__link"
        prefetch="intent"
        to={`/blogs/${article.blog.handle}/${article.handle}`}
      >
        <div className="article-card__media">
          {article.image ? (
            <Image
              alt={article.image.altText || article.title}
              aspectRatio="3/2"
              data={article.image}
              loading={loading}
              sizes="(min-width: 64em) 33vw, (min-width: 40em) 50vw, 100vw"
            />
          ) : null}
        </div>
        <div className="article-card__body">
          <p className="article-card__meta">
            {publishedAt ? (
              <time dateTime={article.publishedAt}>{publishedAt}</time>
            ) : null}
            {publishedAt && article.author?.name ? <> &middot; </> : null}
            {article.author?.name}
          </p>
          <h2 className="article-card__title">{article.title}</h2>
          {excerpt ? <p className="article-card__excerpt">{excerpt}</p> : null}
          <span className="article-card__cta">
            Read more <ArrowRightIcon size={16} />
          </span>
        </div>
      </Link>
    </li>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/blog
const BLOGS_QUERY = `#graphql
  query Blog(
    $language: LanguageCode
    $blogHandle: String!
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(language: $language) {
    blog(handle: $blogHandle) {
      title
      handle
      seo {
        title
        description
      }
      articles(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
      ) {
        nodes {
          ...ArticleItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
  fragment ArticleItem on Article {
    author: authorV2 {
      name
    }
    content(truncateAt: 160)
    excerpt(truncateAt: 160)
    handle
    id
    image {
      id
      altText
      url
      width
      height
    }
    publishedAt
    title
    blog {
      handle
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
