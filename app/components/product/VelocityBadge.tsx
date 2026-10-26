import {formatCount} from '~/components/ui/Stars';

/**
 * "2,184 sold in the last 7 days" with a pulsing radar dot. Rhythmic motion
 * draws peripheral vision to recent sales velocity; the animation stops under
 * `prefers-reduced-motion` (see product.css).
 */
export function VelocityBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  return (
    <p className={`velocity ${className ?? ''}`.trim()}>
      <span className="velocity__pulse" aria-hidden="true" />
      <strong>{formatCount(count)}</strong> sold in the last 7 days
    </p>
  );
}
