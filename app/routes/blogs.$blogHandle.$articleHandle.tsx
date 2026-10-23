import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/blogs.$blogHandle.$articleHandle';
import {Image} from '@shopify/hydrogen';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {Button} from '~/components/ui/Button';

export const meta: Route.MetaFunction = ({data}) => {
  const title = data?.article?.seo?.title || data?.article?.title;
  const description = data?.article?.seo?.description;
  return [
    {title: title ? `${title} | Mellow` : 'Journal | Mellow'},
    ...(description ? [{name: 'description', content: description}] : []),
    {property: 'og:type', content: 'article'},
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

  return {article, blogHandle: blog.handle};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  return {};
}

/** "sleep-tips" → "Sleep tips" */
function titleFromHandle(handle: string) {
  const text = handle.replace(/[-_]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function Article() {
  const {article, blogHandle} = useLoaderData<typeof loader>();
  const {title, image, contentHtml, author} = article;
  const blogTitle = titleFromHandle(blogHandle);

  const publishedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(article.publishedAt));

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
          <time dateTime={article.publishedAt}>{publishedDate}</time>
          {author?.name ? <> &middot; By {author.name}</> : null}
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
      articleByHandle(handle: $articleHandle) {
        handle
        title
        contentHtml
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
