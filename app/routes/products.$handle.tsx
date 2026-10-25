import {useMemo} from 'react';
import {useLoaderData, useLocation} from 'react-router';
import type {Route} from './+types/products.$handle';
import {useSelectedOptionsInUrl} from '~/lib/useSelectedOptionsInUrl';
import {getSelectedProductOptions, useOptimisticVariant} from '~/lib/variants';
import {useNonce} from '~/lib/nonce';
import {Analytics} from '~/lib/analytics';
import {
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
} from '@shopify/hydrogen-react';
import type {ProductFragment} from 'storefrontapi.generated';
import {ProductForm} from '~/components/ProductForm';
import {ProductPrice} from '~/components/ProductPrice';
import {FeaturedQuote} from '~/components/product/FeaturedQuote';
import {ProductAccordions} from '~/components/product/ProductAccordions';
import {ProductFeatures} from '~/components/product/ProductFeatures';
import {ProofStrip} from '~/components/product/ProofStrip';
import {VelocityBadge} from '~/components/product/VelocityBadge';
import {
  ProductGallery,
  findGalleryIndex,
  type GalleryImage,
} from '~/components/product/ProductGallery';
import {RecommendedProducts} from '~/components/product/RecommendedProducts';
import {ReviewsCarousel} from '~/components/product/ReviewsCarousel';
import {SavingsNote} from '~/components/product/SavingsNote';
import {TrustBadges} from '~/components/product/TrustBadges';
import {isDiscounted} from '~/components/ui/Price';
import {Stars} from '~/components/ui/Stars';
import {useSiteSettings} from '~/lib/content/useSiteSettings';
import {
  mapReviewMetaobjects,
  parseFeatures,
  parseInteger,
  parsePackTiers,
  parseParagraphs,
  parseRating,
  parseSoldRecently,
  parseSwatchGroups,
} from '~/lib/content/metafields';
import type {ProductAddon} from '~/lib/content/types';
import {PRODUCT_CARD_FRAGMENT} from '~/lib/fragments';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {SITE_NAME} from '~/lib/seo';

export const meta: Route.MetaFunction = ({data}) => {
  const product = data?.product;
  if (!product) {
    return [
      {title: `Product not found | ${SITE_NAME}`},
      {name: 'robots', content: 'noindex'},
    ];
  }

  const title = product.seo?.title?.trim() || `${product.title} | ${SITE_NAME}`;
  const description =
    product.seo?.description?.trim() || product.description || '';
  const image = absoluteUrl(product.featuredImage?.url, data?.origin);

  return [
    {title},
    {name: 'description', content: description},
    {property: 'og:title', content: title},
    {property: 'og:description', content: description},
    {property: 'og:type', content: 'product'},
    ...(image ? [{property: 'og:image', content: image}] : []),
    {
      tagName: 'link',
      rel: 'canonical',
      href: `${data?.origin ?? ''}/products/${product.handle}`,
    },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  // Recommendations depend on the product id and stream in after the page
  const deferredData = loadDeferredData(args, criticalData.product.id);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const {product} = await storefront.query(PRODUCT_QUERY, {
    variables: {handle, selectedOptions: getSelectedProductOptions(request)},
  });

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: product});

  return {
    product,
    origin: new URL(request.url).origin,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs, productId: string) {
  const {storefront} = context;

  const recommendations = storefront
    .query(PRODUCT_RECOMMENDATIONS_QUERY, {
      variables: {productId},
      cache: storefront.CacheShort(),
    })
    .catch((error: Error) => {
      console.error(error);
      return null;
    });

  return {recommendations};
}

export default function Product() {
  const {product, recommendations, origin} = useLoaderData<typeof loader>();
  const {pathname} = useLocation();
  const nonce = useNonce();

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Mirrors the selected variant into the URL without a navigation (guarded so
  // a cancelled navigation never writes it into another page's URL).
  useSelectedOptionsInUrl(selectedVariant.selectedOptions, pathname);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {title, descriptionHtml} = product;
  const rating = parseRating(product.rating);
  const ratingCount = parseInteger(product.ratingCount);
  const features = parseFeatures(product.features);
  const materials = parseParagraphs(product.materials);
  const care = parseParagraphs(product.care);
  const swatchGroups = parseSwatchGroups(product.swatchGroups);
  const soldRecently = parseSoldRecently(product.soldRecently);
  const sizeGuide = product.sizeGuide?.value?.trim() || null;
  const packTiers = parsePackTiers(product.packTiers);
  const proof = parseFeatures(product.proof);
  const addon = mapAddon(product);
  const reviews = mapReviewMetaobjects(
    (product.featuredReviews?.references?.nodes ?? []).filter(isReviewNode),
  );
  const galleryImages = useMemo(
    () => buildGalleryImages(product, selectedVariant?.image),
    [product, selectedVariant?.image],
  );
  const selectedImageIndex = findGalleryIndex(
    galleryImages,
    selectedVariant?.image,
  );
  const selectedImageId =
    selectedImageIndex >= 0 ? galleryImages[selectedImageIndex].id : null;

  const onSale = isDiscounted(
    selectedVariant?.price,
    selectedVariant?.compareAtPrice,
  );
  const siteSettings = useSiteSettings();
  const savingsNote =
    product.savingsNote?.value?.trim() || siteSettings.savingsNote;

  const jsonLd = buildProductJsonLd({
    product,
    variant: selectedVariant,
    images: galleryImages,
    origin,
    rating,
    ratingCount,
  });

  // Keyed by product so React Router reusing this route element for another
  // `:handle` remounts the page and resets the quantity, gallery and review
  // carousel state instead of carrying it over to the next product.
  return (
    <div className="product-page" key={product.id}>
      <div className="container container--narrow product-layout">
        <div className="product-layout__media">
          <ProductGallery
            images={galleryImages}
            selectedImageId={selectedImageId}
            productTitle={title}
          />
        </div>

        <div className="product-layout__info">
          <div className="product-info">
            {reviews[0] ? <FeaturedQuote review={reviews[0]} /> : null}
            {rating !== null ? (
              <Stars
                rating={rating}
                count={ratingCount}
                size="md"
                className="product-info__stars"
              />
            ) : null}
            <h1 className="product-info__title">{title}</h1>
            <ProductPrice
              price={selectedVariant?.price}
              compareAtPrice={selectedVariant?.compareAtPrice}
              size="lg"
              className="product-info__price"
            />
            {onSale ? (
              <SavingsNote
                note={savingsNote}
                explanation={siteSettings.savingsExplanation}
              />
            ) : null}
            {soldRecently !== null ? (
              <VelocityBadge count={soldRecently} />
            ) : null}
            <ProductForm
              productOptions={productOptions}
              selectedVariant={selectedVariant}
              swatchGroups={swatchGroups}
              sizeGuide={sizeGuide}
              packTiers={packTiers}
              addon={addon}
            >
              <ProductFeatures features={features} />
            </ProductForm>
            <TrustBadges badges={siteSettings.trustBadges} />
            <ProofStrip items={proof} />
            <ProductAccordions
              descriptionHtml={descriptionHtml}
              materials={materials}
              care={care}
            />
          </div>
        </div>

        {reviews.length ? (
          <div className="product-layout__reviews">
            <ReviewsCarousel reviews={reviews} />
          </div>
        ) : null}
      </div>

      <RecommendedProducts products={recommendations} />

      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
      {/* Browsers hide nonce values from the DOM, so React Router's own
          <Scripts> suppresses the same hydration warning for inline scripts. */}
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{__html: jsonLd}}
      />
    </div>
  );
}

/**
 * The `mellow.addon` product reference as a buy-box offer. Nothing is offered
 * when the reference is missing, is not a product or has no sellable variant.
 */
function mapAddon(product: ProductFragment): ProductAddon | null {
  const ref = product.addon?.reference;
  if (!ref || ref.__typename !== 'Product') return null;
  const variant = ref.selectedOrFirstAvailableVariant;
  if (!variant?.id) return null;
  return {
    handle: ref.handle,
    title: ref.title,
    variantId: variant.id,
    availableForSale: Boolean(variant.availableForSale),
    price: variant.price,
    image: ref.featuredImage
      ? {
          url: ref.featuredImage.url,
          altText: ref.featuredImage.altText ?? null,
          width: ref.featuredImage.width,
          height: ref.featuredImage.height,
        }
      : null,
    note: product.addonNote?.value?.trim() || null,
  };
}

type ReviewNode = {
  id: string;
  handle: string;
  fields: Array<{key: string; value?: string | null}>;
};

function isReviewNode(node: unknown): node is ReviewNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    'fields' in node &&
    Array.isArray((node as ReviewNode).fields)
  );
}

type VariantImage = NonNullable<
  ProductFragment['selectedOrFirstAvailableVariant']
>['image'];

/**
 * Gallery images come from product media (images only); the selected
 * variant's image is prepended when it is not part of the media list.
 */
function buildGalleryImages(
  product: ProductFragment,
  variantImage?: VariantImage,
): GalleryImage[] {
  const images: GalleryImage[] = [];
  const seen = new Set<string>();
  const push = (image: GalleryImage) => {
    const key = image.url.split('?')[0];
    if (seen.has(key)) return;
    seen.add(key);
    images.push(image);
  };

  for (const node of product.media?.nodes ?? []) {
    const image =
      node.__typename === 'MediaImage' && node.image?.url
        ? node.image
        : node.previewImage;
    if (!image?.url) continue;
    push({
      id: image.id ?? node.id,
      url: image.url,
      altText: image.altText ?? node.alt ?? null,
      width: image.width,
      height: image.height,
    });
  }

  if (!images.length && product.featuredImage?.url) {
    push({
      ...product.featuredImage,
      id: product.featuredImage.id ?? 'featured',
    });
  }

  if (variantImage?.url && findGalleryIndex(images, variantImage) < 0) {
    images.unshift({...variantImage, id: variantImage.id ?? variantImage.url});
  }

  return images;
}

function absoluteUrl(url?: string | null, origin?: string | null) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (!origin) return null;
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

function buildProductJsonLd({
  product,
  variant,
  images,
  origin,
  rating,
  ratingCount,
}: {
  product: ProductFragment;
  variant: ProductFragment['selectedOrFirstAvailableVariant'];
  images: GalleryImage[];
  origin: string;
  rating: number | null;
  ratingCount: number | null;
}) {
  const url = `${origin}/products/${product.handle}`;
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    image: images
      .map((image) => absoluteUrl(image.url, origin))
      .filter(Boolean),
    brand: {'@type': 'Brand', name: product.vendor},
    url,
  };
  if (variant?.sku) data.sku = variant.sku;
  if (variant) {
    data.offers = {
      '@type': 'Offer',
      url,
      price: variant.price.amount,
      priceCurrency: variant.price.currencyCode,
      availability: variant.availableForSale
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      ...(variant.sku ? {sku: variant.sku} : {}),
    };
  }
  if (rating !== null && ratingCount) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating,
      reviewCount: ratingCount,
    };
  }
  // "<" is escaped so the JSON can never close the script element early.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
  }
` as const;

/**
 * The metafield namespaces and keys read here are documented in
 * docs/shopify-setup.md (section 4).
 */
const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    encodedVariantExistence
    encodedVariantAvailability
    featuredImage {
      id
      url
      altText
      width
      height
    }
    media(first: 20) {
      nodes {
        __typename
        id
        alt
        previewImage {
          id
          url
          altText
          width
          height
        }
        ... on MediaImage {
          image {
            id
            url
            altText
            width
            height
          }
        }
      }
    }
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    seo {
      description
      title
    }
    badge: metafield(namespace: "mellow", key: "badge") {
      value
      type
    }
    shortDescription: metafield(namespace: "mellow", key: "short_description") {
      value
      type
    }
    rating: metafield(namespace: "reviews", key: "rating") {
      value
      type
    }
    ratingCount: metafield(namespace: "reviews", key: "rating_count") {
      value
      type
    }
    features: metafield(namespace: "mellow", key: "features") {
      value
      type
    }
    materials: metafield(namespace: "mellow", key: "materials") {
      value
      type
    }
    care: metafield(namespace: "mellow", key: "care") {
      value
      type
    }
    swatchGroups: metafield(namespace: "mellow", key: "swatch_groups") {
      value
      type
    }
    savingsNote: metafield(namespace: "mellow", key: "savings_note") {
      value
      type
    }
    soldRecently: metafield(namespace: "mellow", key: "sold_recently") {
      value
    }
    sizeGuide: metafield(namespace: "mellow", key: "size_guide") {
      value
    }
    packTiers: metafield(namespace: "mellow", key: "pack_tiers") {
      value
    }
    proof: metafield(namespace: "mellow", key: "proof") {
      value
    }
    addonNote: metafield(namespace: "mellow", key: "addon_note") {
      value
    }
    addon: metafield(namespace: "mellow", key: "addon") {
      reference {
        __typename
        ... on Product {
          id
          handle
          title
          featuredImage {
            url
            altText
            width
            height
          }
          selectedOrFirstAvailableVariant {
            id
            availableForSale
            price {
              amount
              currencyCode
            }
          }
        }
      }
    }
    featuredReviews: metafield(namespace: "mellow", key: "featured_reviews") {
      value
      type
      references(first: 10) {
        nodes {
          ... on Metaobject {
            id
            handle
            fields {
              key
              value
            }
          }
        }
      }
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;

const PRODUCT_RECOMMENDATIONS_QUERY = `#graphql
  query ProductRecommendations(
    $country: CountryCode
    $language: LanguageCode
    $productId: ID!
  ) @inContext(country: $country, language: $language) {
    productRecommendations(productId: $productId, intent: RELATED) {
      ...ProductCard
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
` as const;

/**
 * Renders missing products (404) with the designed error view while keeping
 * this route's "Product not found" meta.
 */
export {RouteErrorBoundary as ErrorBoundary} from '~/components/ErrorView';
