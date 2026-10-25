import type {ProductReview} from '~/lib/content/types';
import {QuoteIcon} from '~/components/ui/Icons';

const MAX_LENGTH = 190;

function trim(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX_LENGTH) return clean;
  const cut = clean.slice(0, MAX_LENGTH);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 80))}…`;
}

/**
 * One customer sentence above the product title: the first thing a shopper
 * reads in the buy box is a peer saying the product fixed their problem, which
 * turns "do I need a new pillow?" into "is my pillow the problem?".
 */
export function FeaturedQuote({
  review,
  className,
}: {
  review: ProductReview;
  className?: string;
}) {
  return (
    <figure className={`featured-quote ${className ?? ''}`.trim()}>
      <QuoteIcon size={18} className="featured-quote__icon" />
      <blockquote className="featured-quote__text">
        “{trim(review.body)}”
      </blockquote>
      <figcaption className="featured-quote__author">
        {review.author}
        {review.verified ? (
          <span className="featured-quote__verified">Verified buyer</span>
        ) : null}
      </figcaption>
    </figure>
  );
}
