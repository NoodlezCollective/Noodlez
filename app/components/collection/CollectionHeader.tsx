import type {ReactNode} from 'react';
import {Image} from '@shopify/hydrogen-react';

export type CollectionHeaderImage = {
  id?: string | null;
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
};

/**
 * Soft lavender banner used at the top of collection style pages:
 * eyebrow, h1, description and an optional collection image.
 */
export function CollectionHeader({
  eyebrow,
  title,
  description,
  image,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string | null;
  image?: CollectionHeaderImage | null;
  children?: ReactNode;
}) {
  const hasImage = Boolean(image?.url);
  return (
    <header
      className={`collection-header ${
        hasImage ? 'collection-header--has-image' : ''
      }`.trim()}
    >
      <div className="collection-header__content">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="collection-header__title">{title}</h1>
        {description ? (
          <p className="collection-header__description">{description}</p>
        ) : null}
        {children}
      </div>
      {hasImage && image ? (
        <div className="collection-header__media">
          <Image
            alt={image.altText ?? ''}
            aspectRatio="3/2"
            data={image}
            loading="eager"
            sizes="(min-width: 48em) 40vw, 100vw"
          />
        </div>
      ) : null}
    </header>
  );
}
