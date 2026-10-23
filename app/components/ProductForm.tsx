import {useState, type ReactNode} from 'react';
import {type MappedProductOptions} from '@shopify/hydrogen';
import type {ProductFragment} from 'storefrontapi.generated';
import type {SwatchGroups} from '~/lib/content/metafields';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import {QuantitySelector} from './product/QuantitySelector';
import {VariantSelector} from './product/VariantSelector';

/**
 * Variant selection, quantity and add to cart. `children` (feature bullets)
 * render between the option pickers and the buy box, matching the design.
 */
export function ProductForm({
  productOptions,
  selectedVariant,
  swatchGroups,
  children,
}: {
  productOptions: MappedProductOptions[];
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  swatchGroups?: SwatchGroups | null;
  children?: ReactNode;
}) {
  const {open} = useAside();
  const [quantity, setQuantity] = useState(1);
  const available = Boolean(selectedVariant?.availableForSale);
  // Never submit a variant that does not exist or is sold out.
  const canAdd = Boolean(selectedVariant?.id) && available;

  return (
    <div className="product-form">
      <VariantSelector
        productOptions={productOptions}
        swatchGroups={swatchGroups}
      />
      {children}
      <div className="product-buy">
        <QuantitySelector value={quantity} onChange={setQuantity} />
        <AddToCartButton
          disabled={!canAdd}
          // Open the drawer once the add succeeded: while it is open the rest
          // of the page is inert, which would hide the status and any error.
          onAdded={() => open('cart')}
          lines={
            canAdd && selectedVariant
              ? [
                  {
                    merchandiseId: selectedVariant.id,
                    quantity,
                    selectedVariant,
                  },
                ]
              : []
          }
        >
          {available ? 'Add to cart' : 'Sold out'}
        </AddToCartButton>
      </div>
    </div>
  );
}
