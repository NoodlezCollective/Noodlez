import {DEFAULT_SITE_SETTINGS} from '~/lib/content/defaults';
import type {TrustBadge} from '~/lib/content/types';
import {FeatureIcon} from '~/components/ui/Icons';

/** "30-Day Trial · Hassle-Free Returns" row shown under the add to cart button. */
export function TrustBadges({
  badges = DEFAULT_SITE_SETTINGS.trustBadges,
  className,
}: {
  badges?: TrustBadge[];
  className?: string;
}) {
  if (!badges.length) return null;
  return (
    <ul
      className={`trust-badges product-trust ${className ?? ''}`.trim()}
      aria-label="Guarantees"
    >
      {badges.map((badge) => (
        <li key={badge.label}>
          <FeatureIcon icon={badge.icon} size={20} />
          <span>{badge.label}</span>
        </li>
      ))}
    </ul>
  );
}
