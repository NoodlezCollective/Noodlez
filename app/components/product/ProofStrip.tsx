import {FeatureIcon} from '~/components/ui/Icons';
import type {ProductFeature} from '~/lib/content/types';

/**
 * Authority chips under the buy box: clinical and institutional proof
 * ("Recommended by our chiropractic partners", "OEKO-TEX certified cover")
 * for the analytical buyer, beside the peer proof the reviews give the
 * impulsive one.
 */
export function ProofStrip({
  items,
  className,
}: {
  items: ProductFeature[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <ul
      className={`proof-strip ${className ?? ''}`.trim()}
      aria-label="Why sleepers trust it"
    >
      {items.map((item) => (
        <li className="proof-chip" key={item.text}>
          <FeatureIcon icon={item.icon} size={16} />
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}
