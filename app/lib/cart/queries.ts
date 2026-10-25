import {CART_QUERY_FRAGMENT} from '~/lib/fragments';

/**
 * Storefront API cart documents for the cart service (cart.server.ts). Each is
 * a `#graphql` literal `as const`, so codegen types the `storefront.query` /
 * `storefront.mutate` calls that use it.
 *
 * They are Hydrogen's cart documents (same operation names and variables)
 * with two differences: no `@defer`, which our plain-JSON Storefront client
 * cannot stream (D-8 in docs/hydrogen-removal-plan.md), and every mutation
 * selects only the minimal cart below; `cart.get()` reads the full cart. The
 * fragment names are prefixed `CartApi` so they never clash with the app's
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

/** The full cart (the app's CART_QUERY_FRAGMENT), with up to 100 lines. */
export const CART_QUERY = `#graphql
  query CartQuery(
    $cartId: ID!
    $numCartLines: Int = 100
    $country: CountryCode = ZZ
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cart(id: $cartId) {
      ...CartApiQuery
    }
  }
  ${CART_QUERY_FRAGMENT}
` as const;

export const CART_CREATE_MUTATION = `#graphql
  mutation cartCreate(
    $input: CartInput!
    $country: CountryCode = ZZ
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartCreate(input: $input) {
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

export const CART_LINES_ADD_MUTATION = `#graphql
  mutation cartLinesAdd(
    $cartId: ID!
    $lines: [CartLineInput!]!
    $country: CountryCode = ZZ
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
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

export const CART_LINES_UPDATE_MUTATION = `#graphql
  mutation cartLinesUpdate(
    $cartId: ID!
    $lines: [CartLineUpdateInput!]!
    $country: CountryCode = ZZ
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
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

export const CART_LINES_REMOVE_MUTATION = `#graphql
  mutation cartLinesRemove(
    $cartId: ID!
    $lineIds: [ID!]!
    $country: CountryCode = ZZ
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
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

export const CART_GIFT_CARD_CODES_ADD_MUTATION = `#graphql
  mutation cartGiftCardCodesAdd(
    $cartId: ID!
    $giftCardCodes: [String!]!
    $country: CountryCode = ZZ
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartGiftCardCodesAdd(cartId: $cartId, giftCardCodes: $giftCardCodes) {
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

export const CART_GIFT_CARD_CODES_REMOVE_MUTATION = `#graphql
  mutation cartGiftCardCodesRemove(
    $cartId: ID!
    $appliedGiftCardIds: [ID!]!
    $country: CountryCode = ZZ
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartGiftCardCodesRemove(
      cartId: $cartId
      appliedGiftCardIds: $appliedGiftCardIds
    ) {
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

export const CART_BUYER_IDENTITY_UPDATE_MUTATION = `#graphql
  mutation cartBuyerIdentityUpdate(
    $cartId: ID!
    $buyerIdentity: CartBuyerIdentityInput!
    $country: CountryCode = ZZ
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
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
