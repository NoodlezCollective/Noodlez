import type {Storefront} from '@shopify/hydrogen';

/** Status returned when the Storefront API answers with errors and no data. */
export const STOREFRONT_API_ERROR_STATUS = 502;

type GraphQLErrorLike = {message?: unknown};

/**
 * True when a Storefront API result has GraphQL `errors` and nothing usable
 * next to them: either `errors` is the only key (the API answered `{errors}`
 * with no `data`) or every data field is null/undefined. Partial data with
 * errors is not matched; callers can still render what did resolve.
 */
export function isErrorsOnlyResult(
  result: unknown,
): result is {errors: GraphQLErrorLike[]} {
  if (!result || typeof result !== 'object') return false;
  const {errors, ...data} = result as Record<string, unknown>;
  if (!Array.isArray(errors) || errors.length === 0) return false;
  return Object.values(data).every((value) => value == null);
}

function describeOperation(document: unknown): string {
  if (typeof document !== 'string') return 'anonymous';
  return (
    /\b(?:query|mutation)\s+([A-Za-z0-9_]+)/.exec(document)?.[1] ?? 'anonymous'
  );
}

function describeErrors(errors: GraphQLErrorLike[]): string {
  return errors
    .map((error) => String(error?.message ?? 'unknown error'))
    .join('; ');
}

type Operation = (document: string, options?: unknown) => Promise<unknown>;

/**
 * Makes `storefront.query` / `storefront.mutate` reject with a 502 `Response`
 * when the API reports GraphQL errors without any data.
 *
 * Hydrogen only throws for non-2xx HTTP statuses. The Storefront API reports
 * invalid or failed operations as HTTP 200 with `{errors}` and no `data`, which
 * resolves to an object whose data fields are all `undefined`. Loaders read
 * that as "not found" (a bogus 404 for collections and products) or crash on it
 * (`header.shop` in the layout). Rejecting once, here, gives every caller the
 * same honest failure. Only the operation name and the messages are logged;
 * variables can hold personal data (buyer identity) and are never printed.
 */
export function guardStorefrontErrors(storefront: Storefront): void {
  const target = storefront as unknown as {query: Operation; mutate: Operation};

  for (const method of ['query', 'mutate'] as const) {
    const original = target[method];
    target[method] = async (document, options) => {
      const result = await original.call(storefront, document, options);
      if (isErrorsOnlyResult(result)) {
        console.error(
          `[storefront] ${describeOperation(document)} failed: ${describeErrors(result.errors)}`,
        );
        throw new Response('Storefront API error', {
          status: STOREFRONT_API_ERROR_STATUS,
        });
      }
      return result;
    };
  }
}
