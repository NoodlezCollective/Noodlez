/**
 * Fixed badge shown while the development Storefront API mock is active so
 * mock data is never mistaken for a connected Shopify store.
 */
export function DevNotice() {
  return (
    <div className="dev-notice" role="status">
      <span className="dev-notice__dot" aria-hidden="true" />
      <span>
        Development mock data. Link a store and remove{' '}
        <code>MOCK_STOREFRONT</code> to use Shopify.
      </span>
    </div>
  );
}
