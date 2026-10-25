import {
  buildClientSchema,
  type GraphQLSchema,
  type IntrospectionQuery,
} from 'graphql';
import storefrontSchema from '@shopify/hydrogen-react/storefront.schema.json';

let cached: GraphQLSchema | undefined;

/**
 * The real Storefront API schema that ships with @shopify/hydrogen-react,
 * built once.
 * Executing app queries against it means the mock validates documents the
 * same way the live API would (unknown fields fail loudly in development).
 */
export function getMockSchema(): GraphQLSchema {
  if (!cached) {
    cached = buildClientSchema(
      storefrontSchema as unknown as IntrospectionQuery,
    );
  }
  return cached;
}
