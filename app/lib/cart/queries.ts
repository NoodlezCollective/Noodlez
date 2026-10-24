/**
 * Storefront API cart documents. Each is a `#graphql` literal `as const`, so
 * codegen types the `storefront.mutate` calls that use it.
 *
 * Phase 2 of docs/hydrogen-removal-plan.md only needs the discount mutation
 * (D-8); Phase 3 adds the other cart mutations around the shared fragments.
 * The fragment names are prefixed `CartApi` so they never clash with the app's
 * `Money`, `CartLine`, `CartLineComponent` and `CartApiQuery` fragments.
 */

/** The cart fields every mutation returns (Hydrogen's minimal mutate fragment). */
export const CART_API_MUTATION_FRAGMENT = `#graphql
  fragment CartApiMutation on Cart {
    id
    totalQuantity
    checkoutUrl
  }
` as const;

export const CART_API_ERROR_FRAGMENT = `#graphql
  fragment CartApiError on CartUserError {
    message
    field
    code
  }
` as const;

export const CART_API_WARNING_FRAGMENT = `#graphql
  fragment CartApiWarning on CartWarning {
    code
    message
    target
  }
` as const;

/**
 * Hydrogen's `cartDiscountCodesUpdate` mutation without its `@defer` on the
 * cart: our Storefront client reads plain JSON and cannot stream incremental
 * delivery responses.
 */
export const CART_DISCOUNT_CODES_UPDATE_MUTATION = `#graphql
  mutation cartDiscountCodesUpdate(
    $cartId: ID!
    $discountCodes: [String!]!
    $country: CountryCode = ZZ
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
      cart {
        ...CartApiMutation
      }
      userErrors {
        ...CartApiError
      }
      warnings {
        ...CartApiWarning
      }
    }
  }
  ${CART_API_MUTATION_FRAGMENT}
  ${CART_API_ERROR_FRAGMENT}
  ${CART_API_WARNING_FRAGMENT}
` as const;
