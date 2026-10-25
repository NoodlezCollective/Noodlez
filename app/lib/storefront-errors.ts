import type {Storefront} from '~/lib/storefront/client.server';
import {getOperationName} from '~/lib/storefront/graphql';

/** Status returned when the Storefront API answers with errors and no data. */
export const STOREFRONT_API_ERROR_STATUS = 502;

type GraphQLErrorLike = {message?: unknown; extensions?: {code?: unknown}};

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

/** The client's operation name; `'anonymous'` for a non-string document too. */
function describeOperation(document: unknown): string {
  return getOperationName(typeof document === 'string' ? document : '');
}

/** What development logs show for an entry that has no message. */
const UNKNOWN_ERROR_MESSAGE = 'unknown error';

/**
 * A log-safe summary of a GraphQL `errors` list: the count and the error
 * codes, plus the messages in development builds only. Messages echo variable
 * values (`Variable "$term" got invalid value …`), which can hold buyer
 * identity or search terms. Malformed entries (`errors: [null]`) count as
 * errors without a code or message instead of throwing.
 */
export function describeErrors(
  errors: ReadonlyArray<GraphQLErrorLike | null | undefined>,
): string {
  const codes = errors
    .map((error) => error?.extensions?.code)
    .filter((code): code is string => typeof code === 'string');
  const summary = `${errors.length} error(s)${codes.length > 0 ? ` [${codes.join(', ')}]` : ''}`;
  if (!import.meta.env.DEV || errors.length === 0) return summary;
  const messages = errors.map((error) =>
    String(error?.message ?? UNKNOWN_ERROR_MESSAGE),
  );
  return `${summary}: ${messages.join('; ')}`;
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
 * same honest failure. Only the operation name and `describeErrors`' summary
 * are logged: variables never, messages only in development, because both can
 * hold personal data.
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
