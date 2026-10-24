import type {
  CountryCode,
  LanguageCode,
} from '@shopify/hydrogen-react/storefront-api-types';

/**
 * Shared Storefront API types. Client-safe: no runtime code, so routes and
 * components can import them without pulling in the server client.
 */

/** The buyer's locale, sent as `$country` / `$language` (`@inContext`). */
export type I18n = {language: LanguageCode; country: CountryCode};

/** One entry of a GraphQL response's `errors` array. */
export type StorefrontApiError = {
  message: string;
  extensions?: {code?: string} & Record<string, unknown>;
  path?: ReadonlyArray<string | number>;
  locations?: ReadonlyArray<{line: number; column: number}>;
};

/** Mixed into every result: `errors` is present only when the API sent some. */
export type StorefrontErrors = {errors?: StorefrontApiError[]};
