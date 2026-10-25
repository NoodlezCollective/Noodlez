import type {ProductCardFragment} from 'storefrontapi.generated';
import {ProductCard} from '~/components/ProductCard';
import {SectionHeading} from '~/components/ui/SectionHeading';
import type {FeaturedProductsContent} from '~/lib/content/types';

export function FeaturedProducts({
  content,
  products,
}: {
  content: FeaturedProductsContent;
  products: ProductCardFragment[];
}) {
  return (
    <section
      className="section section--tight"
      aria-labelledby="featured-products-heading"
      id="shop"
    >
      <div className="container container--narrow">
        <SectionHeading
          id="featured-products-heading"
          title={content.heading}
          subtitle={content.subheading}
        />
        {products.length ? (
          <div className="product-grid">
            {products.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                loading={index < 3 ? 'eager' : 'lazy'}
                ctaLabel={content.ctaLabel}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p className="empty-state__title">Products are on their way</p>
            <p>
              Add products to the “{content.collectionHandle}” collection in
              Shopify to feature them here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
