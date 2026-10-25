import {Image} from '@shopify/hydrogen-react';
import type {ImageContent} from '~/lib/content/types';

type ContentImageProps = {
  image: ImageContent;
  sizes?: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
  className?: string;
  aspectRatio?: string;
  alt?: string;
};

function isShopifyCdnUrl(url: string) {
  return /^https:\/\/cdn\.shopify\.com\//i.test(url);
}

/**
 * Renders editorial imagery. Shopify-hosted files use hydrogen-react's <Image>
 * (responsive srcset via the Shopify CDN); any other URL (e.g. the local
 * placeholder artwork) renders as a plain <img> with intrinsic dimensions.
 */
export function ContentImage({
  image,
  sizes = '100vw',
  loading = 'lazy',
  fetchPriority,
  className,
  aspectRatio,
  alt,
}: ContentImageProps) {
  const altText = alt ?? image.altText ?? '';
  // React 18 expects the lowercase DOM attribute name for fetch priority.
  // Both branches forward it: hydrogen-react's <Image> passes unknown props on to
  // the <img>, so a Shopify-hosted hero keeps `fetchpriority="high"`.
  const priorityAttribute = fetchPriority ? {fetchpriority: fetchPriority} : {};
  if (isShopifyCdnUrl(image.url)) {
    return (
      <Image
        data={{
          url: image.url,
          altText,
          width: image.width ?? undefined,
          height: image.height ?? undefined,
        }}
        alt={altText}
        sizes={sizes}
        loading={loading}
        className={className}
        aspectRatio={aspectRatio}
        {...priorityAttribute}
      />
    );
  }
  return (
    <img
      src={image.url}
      alt={altText}
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      loading={loading}
      decoding="async"
      className={className}
      style={aspectRatio ? {aspectRatio} : undefined}
      {...priorityAttribute}
    />
  );
}
