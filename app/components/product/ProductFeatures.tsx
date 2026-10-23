import type {ProductFeature} from '~/lib/content/types';
import {FeatureIcon} from '~/components/ui/Icons';

/** Feature bullets from the `mellow.features` metafield. */
export function ProductFeatures({
  features,
  className,
}: {
  features: ProductFeature[];
  className?: string;
}) {
  if (!features.length) return null;
  return (
    <ul className={`feature-list product-features ${className ?? ''}`.trim()}>
      {features.map((feature) => (
        <li key={`${feature.icon}|${feature.text}`}>
          <FeatureIcon icon={feature.icon} size={20} />
          <span>{feature.text}</span>
        </li>
      ))}
    </ul>
  );
}
