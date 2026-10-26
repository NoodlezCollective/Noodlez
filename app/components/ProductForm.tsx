import {useState, type ReactNode} from 'react';
import type {MappedProductOptions} from '@shopify/hydrogen-react';
import type {ProductFragment} from 'storefrontapi.generated';
import type {SwatchGroups} from '~/lib/content/metafields';
import type {PackTier, ProductAddon} from '~/lib/content/types';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import {AddonOffer} from './product/AddonOffer';
import {PackTiers} from './product/PackTiers';
import {QuantitySelector} from './product/QuantitySelector';
import {VariantSelector} from './product/VariantSelector';

/**
 * Variant selection, pack tiers, add-on, quantity and add to cart. `children`
 * (feature bullets) render between the option pickers and the buy box.
 *
 * A pack tier sets the quantity; the stepper stays for fine control and shows
 * the same number. The add-on is submitted as a second line in the same
 * cart action, so one click builds the box.
 */
export function ProductForm({
  productOptions,
  selectedVariant,
  swatchGroups,
  sizeGuide,
  packTiers = [],
  addon,
  children,
}: {
  productOptions: MappedProductOptions[];
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  swatchGroups?: SwatchGroups | null;
  sizeGuide?: string | null;
  packTiers?: PackTier[];
  addon?: ProductAddon | null;
  children?: ReactNode;
}) {
  const {open} = useAside();
  const [quantity, setQuantity] = useState(packTiers[0]?.quantity ?? 1);
  const [withAddon, setWithAddon] = useState(false);
  const available = Boolean(selectedVariant?.availableForSale);
  // Never submit a variant that does not exist or is sold out.
  const canAdd = Boolean(selectedVariant?.id) && available;
  const addonSelected = Boolean(addon?.availableForSale && withAddon);

  return (
    <div className="product-form">
      <VariantSelector
        productOptions={productOptions}
        swatchGroups={swatchGroups}
        sizeGuide={sizeGuide}
      />
      <PackTiers
        tiers={packTiers}
        value={quantity}
        onChange={setQuantity}
        price={selectedVariant?.price}
        compareAtPrice={selectedVariant?.compareAtPrice}
      />
      {addon ? (
        <AddonOffer addon={addon} checked={withAddon} onChange={setWithAddon} />
      ) : null}
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
                  ...(addonSelected && addon
                    ? [{merchandiseId: addon.variantId, quantity: 1}]
                    : []),
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
