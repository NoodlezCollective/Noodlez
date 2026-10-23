import {Link} from 'react-router';
import {Image} from '@shopify/hydrogen';
import type {ProductCardFragment} from 'storefrontapi.generated';
import {Badge} from '~/components/ui/Badge';
import {Button} from '~/components/ui/Button';
import {Price} from '~/components/ui/Price';
import {Stars} from '~/components/ui/Stars';
import {parseInteger, parseRating} from '~/lib/content/metafields';

export type ProductCardProps = {
  product: ProductCardFragment;
  loading?: 'eager' | 'lazy';
  /** Label of the full-width call to action. Defaults to "Shop Now". */
  ctaLabel?: string;
  showDescription?: boolean;
  showCta?: boolean;
  className?: string;
  /** Responsive `sizes` attribute for the product image. */
  sizes?: string;
  /** Overrides the product URL (e.g. search results add Shopify tracking params). */
  to?: string;
  /**
   * Heading level of the product title. Use the level below the section the
   * card sits in: 3 under a section `h2` (default), 2 directly under the page
   * `h1` (listing pages).
   */
  headingLevel?: 2 | 3 | 4;
};

export function truncate(text: string | null | undefined, max = 200) {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 60))}…`;
}

/**
 * Mellow product card: square image with optional badge, star rating,
 * title, short description, price with compare-at and a "Shop Now" button.
 * Driven entirely by the `ProductCard` Storefront API fragment.
 */
export function ProductCard({
  product,
  loading = 'lazy',
  ctaLabel = 'Shop Now',
  showDescription = true,
  showCta = true,
  className,
  sizes = '(min-width: 64em) 400px, (min-width: 48em) 50vw, 100vw',
  to,
  headingLevel = 3,
}: ProductCardProps) {
  const Heading = `h${headingLevel}` as const;
  const url = to ?? `/products/${product.handle}`;
  const image = product.featuredImage;
  const rating = parseRating(product.rating);
  const ratingCount = parseInteger(product.ratingCount);
  const badge = product.badge?.value?.trim();
  const description =
    product.shortDescription?.value?.trim() || truncate(product.description);
  const price = product.priceRange.minVariantPrice;
  const compareAt = product.compareAtPriceRange?.minVariantPrice;
  return (
    <article className={`product-card ${className ?? ''}`.trim()}>
      <Link
        className="product-card__media"
        to={url}
        prefetch="intent"
        aria-hidden="true"
        tabIndex={-1}
      >
        {image ? (
          <Image
            alt={image.altText || product.title}
            aspectRatio="1/1"
            data={image}
            loading={loading}
            sizes={sizes}
          />
        ) : (
          <div className="product-card__placeholder" aria-hidden="true" />
        )}
        {badge ? <Badge className="product-card__badge">{badge}</Badge> : null}
        {!product.availableForSale ? (
          <Badge tone="neutral" className="product-card__soldout">
            Sold out
          </Badge>
        ) : null}
      </Link>
      <div className="product-card__body">
        {rating !== null ? (
          <Stars rating={rating} count={ratingCount} size="sm" />
        ) : null}
        <Heading className="product-card__title">
          <Link to={url} prefetch="intent">
            {product.title}
          </Link>
        </Heading>
        {showDescription && description ? (
          <p className="product-card__description">{description}</p>
        ) : null}
        <Price
          className="product-card__price"
          price={price}
          compareAtPrice={compareAt}
        />
        {showCta ? (
          // The visible label comes first so the name still contains it; the
          // product title tells the many identical "Shop Now" links apart.
          <Button
            to={url}
            block
            className="product-card__cta"
            aria-label={`${ctaLabel}: ${product.title}`}
          >
            {ctaLabel}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
