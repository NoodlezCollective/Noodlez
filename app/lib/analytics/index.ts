import {
  AnalyticsCollectionView,
  AnalyticsProductView,
  AnalyticsProvider,
  AnalyticsSearchView,
} from './provider';

/**
 * Analytics for routes and the root layout: our replacement for Hydrogen's
 * `Analytics` with the same props (`<Analytics.ProductView data={...}>`).
 * Client-safe; the root loader's config comes from ./shop.server.
 */
export const Analytics = {
  Provider: AnalyticsProvider,
  ProductView: AnalyticsProductView,
  CollectionView: AnalyticsCollectionView,
  SearchView: AnalyticsSearchView,
};

export {AnalyticsProvider};
export type {AnalyticsConfig, AnalyticsShop, ConsentConfig} from './config';
export type {
  AnalyticsProduct,
  CollectionViewData,
  ConsentState,
  ProductViewData,
  SearchViewData,
} from './events';
