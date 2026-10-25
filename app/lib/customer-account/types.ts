import type {
  ClientReturn,
  ClientVariablesInRestParams,
} from '@shopify/graphql-codegen';
import type {
  CountryCode,
  LanguageCode,
} from '@shopify/hydrogen-react/customer-account-api-types';

/**
 * The customer-account client's types (client-safe: types only). The
 * interface keeps the shape of Hydrogen's `CustomerAccount`, so the account
 * routes stay unchanged. While customer accounts are deferred
 * (docs/hydrogen-removal-architecture.md, ADR-D), the router context carries
 * the stub in app/lib/customer-account/stub.server.ts.
 */

declare global {
  /** Query types by document string; customer-accountapi.generated.d.ts extends it. */
  interface CustomerAccountQueries {}
  /** Mutation types by document string; customer-accountapi.generated.d.ts extends it. */
  interface CustomerAccountMutations {}
}

/** A GraphQL error from the Customer Account API. */
export type CustomerAccountApiError = {
  message: string;
  extensions?: Record<string, unknown>;
  path?: ReadonlyArray<string | number>;
};

/** Options for starting the OAuth sign-in (Hydrogen's `LoginOptions`). */
export type CustomerAccountLoginOptions = {
  countryCode?: CountryCode;
  acrValues?: string;
  loginHint?: string;
  loginHintMode?: string;
  locale?: string;
  uiLocales?: string;
};

/** Options for signing out (Hydrogen's `LogoutOptions`). */
export type CustomerAccountLogoutOptions = {
  /** Where the customer lands after signing out: a path on this site. */
  postLogoutRedirectUri?: string;
  /** Extra headers for the sign-out redirect, such as cookies to clear. */
  headers?: HeadersInit;
  /** Keep the rest of the session; only the customer and buyer are removed. */
  keepSession?: boolean;
};

/** The buyer the cart attaches for a signed-in customer. */
export type CustomerAccountBuyer = {
  customerAccessToken: string;
  companyLocationId?: string;
};

/** A Customer Account API answer, as the account routes read it. */
export type CustomerAccountResult<TData> = {
  data: TData;
  errors?: CustomerAccountApiError[];
};

export interface CustomerAccount {
  /** The language Customer Account API documents run in (`@inContext`). */
  readonly i18n: {language: LanguageCode};
  /** Starts the sign-in; the route returns this Response. */
  login(options?: CustomerAccountLoginOptions): Promise<Response>;
  /** Completes the OAuth sign-in on `/account/authorize`. */
  authorize(): Promise<Response>;
  /** Signs the customer out; the action returns this redirect. */
  logout(options?: CustomerAccountLogoutOptions): Promise<Response>;
  isLoggedIn(): Promise<boolean>;
  /** Throws a redirect to the sign-in page unless the customer is signed in. */
  handleAuthStatus(): Promise<void>;
  getAccessToken(): Promise<string | undefined>;
  /** The Customer Account API GraphQL endpoint. */
  getApiUrl(): string;
  getBuyer(): Promise<CustomerAccountBuyer | undefined>;
  setBuyer(buyer: {companyLocationId?: string}): void;
  query<OverrideReturnType = never, RawGqlString extends string = string>(
    query: RawGqlString,
    ...options: ClientVariablesInRestParams<
      CustomerAccountQueries,
      RawGqlString
    >
  ): Promise<
    CustomerAccountResult<
      ClientReturn<CustomerAccountQueries, RawGqlString, OverrideReturnType>
    >
  >;
  mutate<OverrideReturnType = never, RawGqlString extends string = string>(
    mutation: RawGqlString,
    ...options: ClientVariablesInRestParams<
      CustomerAccountMutations,
      RawGqlString
    >
  ): Promise<
    CustomerAccountResult<
      ClientReturn<CustomerAccountMutations, RawGqlString, OverrideReturnType>
    >
  >;
}
