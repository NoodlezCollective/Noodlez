import {graphql} from 'graphql';
import type {Storefront} from '~/lib/storefront/client.server';
import {getOperationName} from '~/lib/storefront/graphql';
import {getCatalog} from './graph.server';
import {createRootValue} from './root.server';
import {getMockSchema} from './schema.server';

type QueryOptions = {variables?: Record<string, unknown>} | undefined;

/**
 * Replaces `storefront.query` / `storefront.mutate` with an in-process GraphQL
 * executor backed by the Mellow demo catalog. The cart service shares the
 * same storefront instance, so cart mutations are mocked as well.
 *
 * Development only. See app/lib/mock/README.md.
 */
export function installMockStorefront(
  storefront: Storefront,
  request: Request,
) {
  const origin = new URL(request.url).origin;
  const rootValue = createRootValue(getCatalog(), origin);
  const schema = getMockSchema();

  async function execute(source: string, options: QueryOptions) {
    const result = await graphql({
      schema,
      source,
      rootValue,
      variableValues: options?.variables,
    });
    if (result.errors?.length) {
      console.error(
        `[mock-storefront] ${getOperationName(source)}: ${result.errors.map((error) => error.message).join('; ')}`,
      );
      // Same shape as the live API and Hydrogen's `formatAPIResult`: the
      // errors next to whatever data resolved (none at all when validation or
      // variable coercion fails). Nothing is thrown here; app/lib/context.ts
      // guards the client afterwards, exactly as it does in production.
      return {
        ...result.data,
        errors: result.errors.map((error) => ({message: error.message})),
      };
    }
    return result.data;
  }

  const mocked = storefront as unknown as {
    query: (query: string, options?: QueryOptions) => Promise<unknown>;
    mutate: (mutation: string, options?: QueryOptions) => Promise<unknown>;
  };
  mocked.query = (query, options) => execute(query, options);
  mocked.mutate = (mutation, options) => execute(mutation, options);
}
