import {Suspense} from 'react';
import {Await} from 'react-router';
import type {ProductRecommendationsQuery} from 'storefrontapi.generated';
import {ProductCard} from '~/components/ProductCard';
import {SectionHeading} from '~/components/ui/SectionHeading';

export const RECOMMENDED_PRODUCTS_COUNT = 4;

const SKELETON_KEYS = ['one', 'two', 'three', 'four'];
const CARD_SIZES = '(min-width: 64em) 25vw, (min-width: 40em) 50vw, 100vw';

/**
 * "You may also like" grid fed by the deferred `productRecommendations`
 * query. Streams in behind a skeleton and disappears when there is nothing
 * to recommend.
 */
export function RecommendedProducts({
  products,
  heading = 'You may also like',
}: {
  products: Promise<ProductRecommendationsQuery | null>;
  heading?: string;
}) {
  return (
    <Suspense fallback={<RecommendedProductsSkeleton heading={heading} />}>
      <Await resolve={products} errorElement={null}>
        {(data) => {
          const items = (data?.productRecommendations ?? []).slice(
            0,
            RECOMMENDED_PRODUCTS_COUNT,
          );
          if (!items.length) return null;
          return (
            <section
              className="section section--tight recommended"
              aria-labelledby="recommended-heading"
            >
              <div className="container">
                <SectionHeading title={heading} id="recommended-heading" />
                <div className="product-grid product-grid--4">
                  {items.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      sizes={CARD_SIZES}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        }}
      </Await>
    </Suspense>
  );
}

function RecommendedProductsSkeleton({heading}: {heading: string}) {
  return (
    <section
      className="section section--tight recommended"
      aria-label={heading}
      aria-busy="true"
    >
      <div className="container">
        <SectionHeading title={heading} />
        <div className="product-grid product-grid--4">
          {SKELETON_KEYS.map((key) => (
            <div className="skeleton-card" key={key} aria-hidden="true">
              <div className="skeleton skeleton--media" />
              <div className="skeleton skeleton--line" style={{width: '55%'}} />
              <div className="skeleton skeleton--line" style={{width: '80%'}} />
              <div className="skeleton skeleton--line" style={{width: '35%'}} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
