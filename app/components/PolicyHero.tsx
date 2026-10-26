import type {ReactNode} from 'react';
import {Stars} from '~/components/ui/Stars';
import type {ImageContent} from '~/lib/content/types';

/**
 * Indigo banner above policy and information pages: the happy-sleepers rating,
 * a friendly headline (the page's h1), one line of reassurance and a photo on
 * the right. The policy's formal name sits above the headline as the eyebrow
 * so the page still reads as "Privacy Policy" to a screen reader and to search.
 */
export function PolicyHero({
  eyebrow,
  headline,
  subheadline,
  ratingLabel,
  image,
  children,
}: {
  eyebrow?: string;
  headline: ReactNode;
  subheadline?: string | null;
  ratingLabel?: string | null;
  image?: ImageContent | null;
  children?: ReactNode;
}) {
  return (
    <section className="policy-hero" aria-labelledby="policy-hero-heading">
      <div className="policy-hero__content">
        {ratingLabel ? (
          <Stars rating={5} label={ratingLabel} size="md" />
        ) : null}
        {eyebrow ? <p className="policy-hero__eyebrow">{eyebrow}</p> : null}
        <h1 id="policy-hero-heading" className="policy-hero__heading">
          {headline}
        </h1>
        {subheadline ? <p className="policy-hero__sub">{subheadline}</p> : null}
        {children}
      </div>
      {image ? (
        <div className="policy-hero__media">
          <img
            src={image.url}
            alt={image.altText ?? ''}
            width={image.width ?? 800}
            height={image.height ?? 640}
            loading="eager"
            decoding="async"
          />
        </div>
      ) : null}
    </section>
  );
}
