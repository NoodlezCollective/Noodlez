import {createRequire} from 'node:module';
import type {CodegenConfig} from '@graphql-codegen/cli';
import {pluckConfig, preset} from '@shopify/graphql-codegen';

/**
 * GraphQL type generation (`npm run codegen`).
 *
 * Reproduces what `shopify hydrogen codegen` generated: one `.d.ts` per API
 * whose operation types augment Hydrogen's query and mutation interfaces, so
 * `storefront.query(QUERY)` and `customerAccount.query(QUERY)` stay typed by
 * the document string. The generated files are committed;
 * `npm run codegen && git diff --exit-code *.generated.d.ts` checks for drift.
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

function augmentHydrogen(queries: string, mutations: string) {
  return ({queryType, mutationType}: InterfaceNames) =>
    `
declare module '@shopify/hydrogen' {
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
      schema: require.resolve('@shopify/hydrogen/storefront.schema.json'),
      documents: STOREFRONT_DOCUMENTS,
      presetConfig: {
        importTypes: {
          namespace: 'StorefrontAPI',
          from: '@shopify/hydrogen/storefront-api-types',
        },
        interfaceExtension: augmentHydrogen(
          'StorefrontQueries',
          'StorefrontMutations',
        ),
      },
    },
    'customer-accountapi.generated.d.ts': {
      preset,
      schema: require.resolve('@shopify/hydrogen/customer-account.schema.json'),
      documents: CUSTOMER_ACCOUNT_DOCUMENTS,
      presetConfig: {
        importTypes: {
          namespace: 'CustomerAccountAPI',
          from: '@shopify/hydrogen/customer-account-api-types',
        },
        interfaceExtension: augmentHydrogen(
          'CustomerAccountQueries',
          'CustomerAccountMutations',
        ),
      },
    },
  },
  hooks: {afterOneFileWrite: ['prettier --write']},
};

export default config;
