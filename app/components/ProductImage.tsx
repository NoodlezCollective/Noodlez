import {Image} from '@shopify/hydrogen-react';

export type ProductImageData = {
  id?: string | null;
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
};

/**
 * Square product image with rounded corners. Used for every gallery slide.
 */
export function ProductImage({
  image,
  alt,
  loading = 'lazy',
  sizes = '(min-width: 64em) 600px, 100vw',
  className,
}: {
  image?: ProductImageData | null;
  alt?: string;
  loading?: 'eager' | 'lazy';
  sizes?: string;
  className?: string;
}) {
  if (!image) {
    return (
      <div
        className={`product-image product-image--empty ${className ?? ''}`.trim()}
        aria-hidden="true"
      />
    );
  }
  return (
    <div className={`product-image ${className ?? ''}`.trim()}>
      <Image
        alt={alt ?? image.altText ?? 'Product image'}
        aspectRatio="1/1"
        data={image}
        loading={loading}
        sizes={sizes}
      />
    </div>
  );
}
