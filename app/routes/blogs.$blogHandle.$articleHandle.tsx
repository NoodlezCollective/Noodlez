import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/blogs.$blogHandle.$articleHandle';
import {Image} from '@shopify/hydrogen-react';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {LONG_DATE_FORMAT, formatDate} from '~/lib/dates';
import {SITE_NAME, canonicalLink, notFoundMeta} from '~/lib/seo';
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
  const criticalData = await loadCriticalData(args);
  return {...criticalData};
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

  const {blog} = await context.storefront.query(ARTICLE_QUERY, {
    variables: {blogHandle, articleHandle},
  });

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

export default function Article() {
  const {article, blogHandle, blogTitle} = useLoaderData<typeof loader>();
  const {title, image, contentHtml, author} = article;

  const publishedDate = formatDate(article.publishedAt, LONG_DATE_FORMAT);

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
export {RouteErrorBoundary as ErrorBoundary} from '~/components/ErrorView';
