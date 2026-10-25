/**
 * Temporary, types only. Hydrogen helpers that still run during the removal
 * (`getShopAnalytics`, until Phase 4c) expect Hydrogen's `Storefront`; call
 * sites hand them our client with an explicit
 * `storefront as unknown as HydrogenStorefront`. Deleted in Phase 4c of
 * docs/hydrogen-removal-plan.md, once the last of those helpers is gone.
 */
export type {Storefront as HydrogenStorefront} from '@shopify/hydrogen';
