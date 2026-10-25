import type {IGraphQLConfig} from 'graphql-config';
import {CUSTOMER_ACCOUNT_DOCUMENTS, STOREFRONT_DOCUMENTS} from './codegen';

/**
 * GraphQL Config for editors (the GraphQL language server). Type generation
 * is configured in codegen.ts, which owns the document globs used here.
 * @see https://the-guild.dev/graphql/config/docs/user/usage
 */
const graphqlConfig: IGraphQLConfig = {
  projects: {
    default: {
      schema: 'node_modules/@shopify/hydrogen-react/storefront.schema.json',
      documents: STOREFRONT_DOCUMENTS,
    },

    customer: {
      schema:
        'node_modules/@shopify/hydrogen-react/customer-account.schema.json',
      documents: CUSTOMER_ACCOUNT_DOCUMENTS,
    },

    // Add your own GraphQL projects here for CMS, Shopify Admin API, etc.
  },
};

export default graphqlConfig;
