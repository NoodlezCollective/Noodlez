import {createRequire} from 'node:module';
import type {CodegenConfig} from '@graphql-codegen/cli';
import {pluckConfig, preset} from '@shopify/graphql-codegen';

/**
 * GraphQL type generation (`npm run codegen`).
 *
 * One `.d.ts` per API, generated against hydrogen-react's schemas. Storefront
 * API operation types extend the global `StorefrontQueries` and
 * `StorefrontMutations` interfaces of our own client
 * (app/lib/storefront/client.server.ts), so `storefront.query(QUERY)` stays
 * typed by the document string. Customer Account API operation types extend
 * the global `CustomerAccountQueries` and `CustomerAccountMutations`
 * interfaces (app/lib/customer-account/types.ts) the same way, which types
 * `customerAccount.query/mutate` in the account routes. The generated files
 * are committed; `npm run codegen && git diff --exit-code *.generated.d.ts`
 * checks for drift.
 */
const require = createRequire(import.meta.url);

/** Files searched for `#graphql` documents against the Storefront API. */
export const STOREFRONT_DOCUMENTS = [
  './*.{ts,tsx,js,jsx}',
  './app/**/*.{ts,tsx,js,jsx}',
  '!./app/graphql/**/*.{ts,tsx,js,jsx}',
];

/** Files searched for `#graphql` documents against the Customer Account API. */
export const CUSTOMER_ACCOUNT_DOCUMENTS = [
  './app/graphql/customer-account/*.{ts,tsx,js,jsx}',
];

type InterfaceNames = {queryType: string; mutationType: string};
type InterfaceExtension = (names: InterfaceNames) => string;

/** Extends our global operation interfaces (one pair per API). */
function augmentGlobal(queries: string, mutations: string): InterfaceExtension {
  return ({queryType, mutationType}) =>
    `
declare global {
  interface ${queries} extends ${queryType} {}
  interface ${mutations} extends ${mutationType} {}
}`;
}

const config: CodegenConfig = {
  overwrite: true,
  // Shopify's pluck functions (isGqlTemplateLiteral, pluckStringFromFile) are
  // valid graphql-tag-pluck options that the CLI's public type leaves out.
  pluckConfig: pluckConfig as CodegenConfig['pluckConfig'],
  generates: {
    'storefrontapi.generated.d.ts': {
      preset,
      schema: require.resolve('@shopify/hydrogen-react/storefront.schema.json'),
      documents: STOREFRONT_DOCUMENTS,
      presetConfig: {
        importTypes: {
          namespace: 'StorefrontAPI',
          from: '@shopify/hydrogen-react/storefront-api-types',
        },
        interfaceExtension: augmentGlobal(
          'StorefrontQueries',
          'StorefrontMutations',
        ),
      },
    },
    'customer-accountapi.generated.d.ts': {
      preset,
      schema:
        require.resolve('@shopify/hydrogen-react/customer-account.schema.json'),
      documents: CUSTOMER_ACCOUNT_DOCUMENTS,
      presetConfig: {
        importTypes: {
          namespace: 'CustomerAccountAPI',
          from: '@shopify/hydrogen-react/customer-account-api-types',
        },
        interfaceExtension: augmentGlobal(
          'CustomerAccountQueries',
          'CustomerAccountMutations',
        ),
      },
    },
  },
  hooks: {afterOneFileWrite: ['prettier --write']},
};

export default config;
