import {useId} from 'react';
import {StarIcon} from './Icons';

export type StarsProps = {
  /** Rating between 0 and `max`. Nothing is rendered without a rating. */
  rating?: number | null;
  max?: number;
  /** Number of ratings; rendered as "(51,644)" or with a custom label. */
  count?: number | null;
  /** Overrides the count label e.g. "124,952+ Happy Sleepers". */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZE_PX = {sm: 14, md: 18, lg: 22} as const;

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Five coral stars with optional partial fill and a count/label. Renders
 * nothing when there is no rating.
 */
export function Stars({
  rating,
  max = 5,
  count,
  label,
  size = 'md',
  className,
}: StarsProps) {
  const id = useId();
  // A missing rating must never look like a perfect one.
  if (typeof rating !== 'number' || Number.isNaN(rating)) return null;
  const safeRating = Math.max(0, Math.min(max, rating));
  const text =
    label ??
    (typeof count === 'number' ? `(${formatCount(count)})` : undefined);
  const px = SIZE_PX[size];

  return (
    <div
      className={`stars stars--${size} ${className ?? ''}`.trim()}
      role="img"
      aria-label={`Rated ${safeRating.toFixed(1)} out of ${max}${
        typeof count === 'number' ? ` from ${formatCount(count)} reviews` : ''
      }`}
    >
      <span className="stars__row" aria-hidden="true">
        {Array.from({length: max}).map((_, index) => {
          const fill = Math.max(0, Math.min(1, safeRating - index));
          const clipId = `${id}-${index}`;
          return (
            <span className="stars__star" key={clipId} style={{width: px}}>
              <StarIcon size={px} className="stars__base" />
              {fill > 0 ? (
                <span className="stars__fill" style={{width: `${fill * 100}%`}}>
                  <StarIcon size={px} />
                </span>
              ) : null}
            </span>
          );
        })}
      </span>
      {text ? <span className="stars__label">{text}</span> : null}
    </div>
  );
}
