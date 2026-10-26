import {Link} from 'react-router';

/**
 * The "mellow" wordmark. The second "l" is tinted lavender as in the brand mark.
 * When the Shopify brand logo is configured it is rendered instead.
 */
export function Logo({
  logoUrl,
  shopName = '{AppName}',
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
          {shopName}
        </span>
      )}
    </Link>
  );
}
