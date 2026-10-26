import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/blogs._index';
import {Pagination, getPaginationVariables} from '~/lib/pagination';
import type {BlogsQuery} from 'storefrontapi.generated';
import {Button} from '~/components/ui/Button';
import {ArrowRightIcon} from '~/components/ui/Icons';
import {canonicalLink} from '~/lib/seo';

type BlogNode = BlogsQuery['blogs']['nodes'][0];

const TITLE = 'Journal | {AppName}';
const DESCRIPTION =
  'Sleep science, product care and stories from the {AppName} team.';

export const meta: Route.MetaFunction = ({data}) => {
  // No data means the loader failed: keep the error page out of the index.
  if (!data) return [{title: TITLE}, {name: 'robots', content: 'noindex'}];

  return [
    {title: TITLE},
    {name: 'description', content: DESCRIPTION},
    {property: 'og:title', content: TITLE},
    {property: 'og:description', content: DESCRIPTION},
    {property: 'og:type', content: 'website'},
    canonicalLink(data.origin, '/blogs'),
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
async function loadCriticalData({context, request}: Route.LoaderArgs) {
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 10,
  });

  const {blogs} = await context.storefront.query(BLOGS_QUERY, {
    variables: {
      ...paginationVariables,
    },
  });

  return {blogs, origin: new URL(request.url).origin};
}

export default function Blogs() {
  const {blogs} = useLoaderData<typeof loader>();

  return (
    <div className="content-page container">
      <header className="page-header page-header--center">
        <p className="eyebrow page-header__eyebrow">{'{AppName}'}</p>
        <h1>Journal</h1>
        <p className="page-header__description">
          Sleep science, product care and stories from the {'{AppName}'} team.
        </p>
      </header>

      <Pagination<BlogNode> connection={blogs}>
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
              <ul className="blog-grid">
                {nodes.map((blog) => (
                  <li key={blog.handle}>
                    <Link
                      className="blog-card"
                      prefetch="intent"
                      to={`/blogs/${blog.handle}`}
                    >
                      <span className="eyebrow">Blog</span>
                      <h2 className="blog-card__title">{blog.title}</h2>
                      {blog.seo?.description ? (
                        <p className="blog-card__description">
                          {blog.seo.description}
                        </p>
                      ) : null}
                      <span className="blog-card__cta">
                        Read articles <ArrowRightIcon size={16} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {hasNextPage ? (
                <div className="content-pagination">
                  <NextLink className="btn btn--outline btn--sm">
                    {isLoading ? 'Loading…' : 'Load more'}
                  </NextLink>
                </div>
              ) : null}
            </>
          ) : (
            <div className="empty-state content-empty">
              <h2 className="empty-state__title">No stories yet</h2>
              <p>
                We&rsquo;re writing our first articles. In the meantime, explore
                the products everyone is talking about.
              </p>
              <div className="empty-state__actions">
                <Button to="/collections/all">Shop best sellers</Button>
                <Button to="/" variant="ghost">
                  Back to home
                </Button>
              </div>
            </div>
          )
        }
      </Pagination>
    </div>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/blog
const BLOGS_QUERY = `#graphql
  query Blogs(
    $country: CountryCode
    $endCursor: String
    $first: Int
    $language: LanguageCode
    $last: Int
    $startCursor: String
  ) @inContext(country: $country, language: $language) {
    blogs(
      first: $first,
      last: $last,
      before: $startCursor,
      after: $endCursor
    ) {
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      nodes {
        title
        handle
        seo {
          title
          description
        }
      }
    }
  }
` as const;

/**
 * Keeps thrown responses (404, 502) inside this route: its `meta` only applies
 * while the route stays in the rendered tree (not-found title, `noindex`).
 */
export {RouteErrorBoundary as ErrorBoundary} from '~/components/ErrorView';
