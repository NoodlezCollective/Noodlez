import {useId, useState} from 'react';
import type {ProductReview} from '~/lib/content/types';
import {Stars} from '~/components/ui/Stars';
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '~/components/ui/Icons';

/**
 * Featured reviews (mellow_review metaobjects) in a lavender box with
 * previous/next controls and dots. Renders nothing without reviews.
 */
export function ReviewsCarousel({
  reviews,
  className,
}: {
  reviews: ProductReview[];
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const id = useId();
  const count = reviews.length;

  if (!count) return null;

  const current = Math.min(index, count - 1);
  const review = reviews[current];
  const go = (delta: number) =>
    setIndex((value) => (value + delta + count) % count);

  return (
    <section
      className={`reviews ${className ?? ''}`.trim()}
      aria-roledescription="carousel"
      aria-labelledby={`${id}-heading`}
    >
      <h2 id={`${id}-heading`} className="sr-only">
        Customer reviews
      </h2>
      <div className="reviews__viewport" aria-live="polite">
        <article
          className="reviews__slide"
          key={review.id}
          aria-roledescription="slide"
          aria-label={`Review ${current + 1} of ${count}`}
        >
          <Stars rating={review.rating} size="md" />
          {review.title ? (
            <h3 className="reviews__title">{review.title}</h3>
          ) : null}
          <blockquote className="reviews__body">
            <p>{review.body}</p>
          </blockquote>
          <p className="reviews__meta">
            <span className="reviews__author">{review.author}</span>
            {review.verified ? (
              <span className="reviews__verified">
                <CheckIcon size={14} />
                Verified buyer
              </span>
            ) : null}
          </p>
        </article>
      </div>
      {count > 1 ? (
        <div className="reviews__controls">
          <button
            type="button"
            className="reviews__arrow"
            aria-label="Previous review"
            onClick={() => go(-1)}
          >
            <ChevronLeftIcon size={16} />
          </button>
          <div className="reviews__dots">
            {reviews.map((item, dotIndex) => (
              <button
                type="button"
                key={item.id}
                className={`reviews__dot ${
                  dotIndex === current ? 'is-active' : ''
                }`.trim()}
                aria-label={`Go to review ${dotIndex + 1}`}
                aria-current={dotIndex === current ? 'true' : undefined}
                onClick={() => setIndex(dotIndex)}
              />
            ))}
          </div>
          <button
            type="button"
            className="reviews__arrow"
            aria-label="Next review"
            onClick={() => go(1)}
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>
      ) : null}
    </section>
  );
}
