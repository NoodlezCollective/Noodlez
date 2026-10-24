import {Link} from 'react-router';
import {Image} from '@shopify/hydrogen-react';
import type {CollectionFragment} from 'storefrontapi.generated';
import {truncate} from '~/components/ProductCard';
import {ArrowRightIcon} from '~/components/ui/Icons';

/**
 * Collection tile for the collections index: 4:3 image with a soft
 * gradient and the title overlaid. Falls back to a lavender card when the
 * collection has no image.
 */
export function CollectionCard({
  collection,
  loading = 'lazy',
}: {
  collection: CollectionFragment;
  loading?: 'eager' | 'lazy';
}) {
  const image = collection.image;
  const description = truncate(collection.description, 90);
  return (
    <Link
      className={`collection-card ${image ? '' : 'collection-card--text'}`.trim()}
      to={`/collections/${collection.handle}`}
      prefetch="intent"
    >
      {image ? (
        <Image
          alt={image.altText ?? ''}
          aspectRatio="4/3"
          data={image}
          loading={loading}
          sizes="(min-width: 64em) 33vw, (min-width: 40em) 50vw, 100vw"
        />
      ) : null}
      <span className="collection-card__overlay" aria-hidden="true" />
      <span className="collection-card__body">
        <h2 className="collection-card__title">{collection.title}</h2>
        {description ? (
          <span className="collection-card__description">{description}</span>
        ) : null}
        <span className="collection-card__cta">
          Shop now <ArrowRightIcon size={16} />
        </span>
      </span>
    </Link>
  );
}
