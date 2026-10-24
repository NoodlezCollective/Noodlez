import {useEffect, useRef, useState, type ReactNode} from 'react';
import {type FetcherWithComponents} from 'react-router';
import {CartForm, type OptimisticCartLineInput} from '@shopify/hydrogen';
import {Button} from '~/components/ui/Button';
import type {CartActionData} from '~/routes/cart';

const FALLBACK_ERROR =
  'We couldn’t add this item to your cart. Please try again.';

/**
 * Failures of a cart action: GraphQL `errors` and the Storefront API's
 * `userErrors` (stock limits, invalid merchandise, …). `messages` is what is
 * shown to the shopper; `failed` is true even when no message came back.
 */
function getCartFailure(data: CartActionData) {
  const failures = [...(data?.userErrors ?? []), ...(data?.errors ?? [])];
  const messages = failures
    .map((failure) => failure?.message)
    .filter(
      (message): message is string =>
        typeof message === 'string' && message.length > 0,
    );
  return {
    failed: failures.length > 0,
    messages: failures.length && !messages.length ? [FALLBACK_ERROR] : messages,
  };
}

/**
 * Submits a `LinesAdd` cart action. Shows a busy label (and stays disabled)
 * while the fetcher is in flight, announces the result to assistive
 * technology and renders any cart errors returned by the action inline, next
 * to the button.
 *
 * `onAdded` runs once the add has completed without errors. Callers open the
 * cart drawer from it: opening it earlier would make the rest of the page
 * `inert`, hiding the status and any error from assistive technology and
 * showing an empty cart when the add fails.
 */
export function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onAdded,
  busyLabel = 'Adding…',
  className,
}: {
  analytics?: unknown;
  children: ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onAdded?: () => void;
  busyLabel?: string;
  className?: string;
}) {
  return (
    <CartForm route="/cart" inputs={{lines}} action={CartForm.ACTIONS.LinesAdd}>
      {(fetcher: FetcherWithComponents<CartActionData>) => (
        <AddToCartFields
          fetcher={fetcher}
          analytics={analytics}
          disabled={disabled}
          onAdded={onAdded}
          busyLabel={busyLabel}
          className={className}
        >
          {children}
        </AddToCartFields>
      )}
    </CartForm>
  );
}

function AddToCartFields({
  fetcher,
  analytics,
  children,
  disabled,
  onAdded,
  busyLabel,
  className,
}: {
  fetcher: FetcherWithComponents<CartActionData>;
  analytics?: unknown;
  children: ReactNode;
  disabled?: boolean;
  onAdded?: () => void;
  busyLabel: string;
  className?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const onAddedRef = useRef(onAdded);
  // True from the click until the add has completed and been handled.
  const pending = useRef(false);
  // The button had focus when it was clicked (it is disabled while busy).
  const hadFocus = useRef(false);

  const busy = fetcher.state !== 'idle';
  const {failed, messages} = getCartFailure(fetcher.data);
  // `fetcher.data` still holds the previous result while a new add is in
  // flight; hide it so a repeated error is announced again.
  const errors = busy ? [] : messages;

  useEffect(() => {
    onAddedRef.current = onAdded;
  });

  useEffect(() => {
    if (busy) {
      pending.current = true;
      return;
    }
    if (!pending.current) return;
    pending.current = false;

    // A disabled button cannot keep focus: put it back (unless the shopper
    // moved on) so the keyboard position and the drawer's return target survive.
    const active = document.activeElement;
    if (hadFocus.current && (!active || active === document.body)) {
      buttonRef.current?.focus();
    }
    hadFocus.current = false;

    if (fetcher.data && !failed) onAddedRef.current?.();
  }, [busy, failed, fetcher.data]);

  return (
    <div className={`add-to-cart ${className ?? ''}`.trim()}>
      <input name="analytics" type="hidden" value={JSON.stringify(analytics)} />
      <Button
        ref={buttonRef}
        type="submit"
        size="lg"
        block
        loading={busy}
        disabled={disabled}
        onClick={(event) => {
          hadFocus.current = document.activeElement === event.currentTarget;
        }}
      >
        {busy ? busyLabel : children}
      </Button>
      <AddToCartStatus
        state={fetcher.state}
        busyLabel={busyLabel}
        failed={failed}
      />
      {errors.length ? (
        <ul
          className="form-message form-message--error add-to-cart__errors"
          role="alert"
        >
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AddToCartStatus({
  state,
  busyLabel,
  failed,
}: {
  state: FetcherWithComponents<unknown>['state'];
  busyLabel: string;
  failed: boolean;
}) {
  const [message, setMessage] = useState('');
  const previousState = useRef(state);

  useEffect(() => {
    if (state !== 'idle') {
      setMessage(busyLabel);
    } else if (previousState.current !== 'idle') {
      setMessage(failed ? 'Could not add to cart.' : 'Added to cart.');
    }
    previousState.current = state;
  }, [state, busyLabel, failed]);

  return (
    <p className="sr-only" role="status" aria-live="polite">
      {message}
    </p>
  );
}
