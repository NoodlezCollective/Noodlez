/**
 * Placeholder cards shown while another page of products is loading.
 * With `inline` the cards are rendered without a wrapper so they can be
 * appended to an existing `.product-grid`.
 */
export function ProductCardSkeleton() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton skeleton--media" />
      <div className="skeleton skeleton--line" style={{width: '38%'}} />
      <div className="skeleton skeleton--line" style={{width: '72%'}} />
      <div className="skeleton skeleton--line" style={{width: '92%'}} />
      <div className="skeleton skeleton--line skeleton--button" />
    </div>
  );
}

export function ProductGridSkeleton({
  count = 6,
  inline = false,
}: {
  count?: number;
  inline?: boolean;
}) {
  // Skeletons are static placeholders, so the index is a stable key here.
  const items = Array.from({length: count}, (_, index) => (
    <ProductCardSkeleton key={index} />
  ));
  if (inline) return <>{items}</>;
  return (
    <div
      className="product-grid"
      aria-busy="true"
      aria-label="Loading products"
    >
      {items}
    </div>
  );
}
