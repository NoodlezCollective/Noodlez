import {useEffect, useRef, useState, type ReactNode} from 'react';
import {type FetcherWithComponents} from 'react-router';
import {CartForm, type OptimisticCartLineInput} from '@shopify/hydrogen';
import {Button} from '~/components/ui/Button';

type CartActionError = {message?: string | null} | null | undefined;
type CartActionData = {errors?: CartActionError[] | null} | undefined;

/**
 * Submits a `LinesAdd` cart action. Shows a busy label while the fetcher is
 * in flight, announces the result to assistive technology and renders any
 * cart errors returned by the action inline.
 */
export function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
  busyLabel = 'Adding…',
  className,
}: {
  analytics?: unknown;
  children: ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
  busyLabel?: string;
  className?: string;
}) {
  return (
    <CartForm route="/cart" inputs={{lines}} action={CartForm.ACTIONS.LinesAdd}>
      {(fetcher: FetcherWithComponents<CartActionData>) => {
        const busy = fetcher.state !== 'idle';
        const errors = (fetcher.data?.errors ?? []).filter(
          (error): error is {message: string} =>
            typeof error?.message === 'string' && error.message.length > 0,
        );
        return (
          <div className={`add-to-cart ${className ?? ''}`.trim()}>
            <input
              name="analytics"
              type="hidden"
              value={JSON.stringify(analytics)}
            />
            <Button
              type="submit"
              size="lg"
              block
              loading={busy}
              disabled={disabled}
              onClick={onClick}
            >
              {busy ? busyLabel : children}
            </Button>
            <AddToCartStatus
              state={fetcher.state}
              busyLabel={busyLabel}
              errorCount={errors.length}
            />
            {errors.length ? (
              <ul
                className="form-message form-message--error add-to-cart__errors"
                role="alert"
              >
                {errors.map((error) => (
                  <li key={error.message}>{error.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      }}
    </CartForm>
  );
}

function AddToCartStatus({
  state,
  busyLabel,
  errorCount,
}: {
  state: FetcherWithComponents<unknown>['state'];
  busyLabel: string;
  errorCount: number;
}) {
  const [message, setMessage] = useState('');
  const previousState = useRef(state);

  useEffect(() => {
    if (state !== 'idle') {
      setMessage(busyLabel);
    } else if (previousState.current !== 'idle') {
      setMessage(errorCount ? 'Could not add to cart.' : 'Added to cart.');
    }
    previousState.current = state;
  }, [state, busyLabel, errorCount]);

  return (
    <p className="sr-only" role="status" aria-live="polite">
      {message}
    </p>
  );
}
