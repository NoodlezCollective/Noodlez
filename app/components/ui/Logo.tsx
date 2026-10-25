import {Link} from 'react-router';

/**
 * The "mellow" wordmark, set in the display face. The second "l" is tinted
 * in the accent colour.
 * When the Shopify brand logo is configured it is rendered instead.
 */
export function Logo({
  logoUrl,
  shopName = 'mellow',
  className,
}: {
  logoUrl?: string | null;
  shopName?: string;
  className?: string;
}) {
  return (
    <Link
      to="/"
      prefetch="intent"
      className={`logo ${className ?? ''}`.trim()}
      aria-label={`${shopName} – home`}
    >
      {logoUrl ? (
        <img className="logo__image" src={logoUrl} alt={shopName} />
      ) : (
        <span className="logo__wordmark" aria-hidden="true">
          mel<span className="logo__accent">l</span>ow
        </span>
      )}
    </Link>
  );
}
