import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/blogs._index';
import {Pagination, getPaginationVariables} from '@shopify/hydrogen';
import type {BlogsQuery} from 'storefrontapi.generated';
import {Button} from '~/components/ui/Button';
import {ArrowRightIcon} from '~/components/ui/Icons';

type BlogNode = BlogsQuery['blogs']['nodes'][0];

export const meta: Route.MetaFunction = () => {
  return [
    {property: 'og:type', content: 'website'},
    {tagName: 'link', rel: 'canonical', href: '/blogs'},
    {title: 'Journal | Mellow'},
    {
      name: 'description',
      content: 'Sleep science, product care and stories from the Mellow team.',
    },
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
async function loadCriticalData({context, request}: Route.LoaderArgs) {
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 10,
  });

  const [{blogs}] = await Promise.all([
    context.storefront.query(BLOGS_QUERY, {
      variables: {
        ...paginationVariables,
      },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  return {blogs};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  return {};
}

export default function Blogs() {
  const {blogs} = useLoaderData<typeof loader>();

  return (
    <div className="content-page container">
      <header className="page-header page-header--center">
        <p className="eyebrow page-header__eyebrow">Mellow</p>
        <h1>Journal</h1>
        <p className="page-header__description">
          Sleep science, product care and stories from the Mellow team.
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
