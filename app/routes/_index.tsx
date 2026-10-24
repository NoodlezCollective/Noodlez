import {useLoaderData} from 'react-router';
import type {Route} from './+types/_index';
import {Hero} from '~/components/home/Hero';
import {PressBar} from '~/components/home/PressBar';
import {Story} from '~/components/home/Story';
import {FeaturedProducts} from '~/components/home/FeaturedProducts';
import {UgcGrid} from '~/components/home/UgcGrid';
import {LifestyleGallery} from '~/components/home/LifestyleGallery';
import {Testimonials} from '~/components/home/Testimonials';
import {Faq} from '~/components/home/Faq';
import {NewsletterBand} from '~/components/home/NewsletterBand';
import {PRODUCT_CARD_FRAGMENT} from '~/lib/fragments';
import {HOME_CONTENT_QUERY, mapHomeContent} from '~/lib/content/metaobjects';
import {FEATURED_PRODUCTS_COUNT} from '~/lib/content/config';
import {DEFAULT_DESCRIPTION, DEFAULT_TITLE} from '~/lib/seo';

export const meta: Route.MetaFunction = ({data}) => {
  const description = data?.content.hero.subheadline ?? DEFAULT_DESCRIPTION;
  return [
    {title: DEFAULT_TITLE},
    {name: 'description', content: description},
    {property: 'og:title', content: DEFAULT_TITLE},
    {property: 'og:description', content: description},
    {property: 'og:type', content: 'website'},
    ...(data?.content.hero.image?.url.startsWith('https://')
      ? [{property: 'og:image', content: data.content.hero.image.url}]
      : []),
    {tagName: 'link', rel: 'canonical', href: `${data?.origin ?? ''}/`},
  ];
};

export async function loader(args: Route.LoaderArgs) {
  const criticalData = await loadCriticalData(args);
  return {...criticalData};
}

/**
 * Homepage content (metaobjects) is loaded first because it decides which
 * collection feeds the featured grid. Both queries are cached by Hydrogen.
 * Content falls back to the documented defaults when the metaobjects do not
 * exist yet; the product grid falls back to best sellers when the configured
 * collection is empty or missing.
 */
async function loadCriticalData({context, request}: Route.LoaderArgs) {
  const {storefront} = context;

  const contentData = await storefront
    .query(HOME_CONTENT_QUERY, {cache: storefront.CacheLong()})
    .catch((error: Error) => {
      console.error(error);
      return null;
    });
  const content = mapHomeContent(contentData);

  const {featured, bestSellers} = await storefront.query(HOMEPAGE_QUERY, {
    cache: storefront.CacheShort(),
    variables: {
      featuredHandle: content.featured.collectionHandle,
      first: FEATURED_PRODUCTS_COUNT,
    },
  });

  const products = featured?.products.nodes.length
    ? featured.products.nodes
    : bestSellers.nodes;

  return {
    origin: new URL(request.url).origin,
    content,
    products,
  };
}

export default function Homepage() {
  const {content, products} = useLoaderData<typeof loader>();
  return (
    <div className="home">
      <Hero content={content.hero} />
      <PressBar logos={content.pressLogos} />
      <Story content={content.story} />
      <FeaturedProducts content={content.featured} products={products} />
      <UgcGrid content={content.ugc} />
      <LifestyleGallery images={content.lifestyle} />
      <Testimonials content={content.testimonials} />
      <Faq content={content.faq} />
      <NewsletterBand content={content.newsletter} />
    </div>
  );
}

const HOMEPAGE_QUERY = `#graphql
  query Homepage(
    $country: CountryCode
    $language: LanguageCode
    $featuredHandle: String!
    $first: Int!
  ) @inContext(country: $country, language: $language) {
    featured: collection(handle: $featuredHandle) {
      id
      handle
      title
      products(first: $first) {
        nodes {
          ...ProductCard
        }
      }
    }
    bestSellers: products(first: $first, sortKey: BEST_SELLING) {
      nodes {
        ...ProductCard
      }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
` as const;
