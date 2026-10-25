import type {ReactNode} from 'react';
import {useFetcher, type FetcherWithComponents} from 'react-router';
import type {
  CartBuyerIdentityInput,
  CartLineUpdateInput,
} from '@shopify/hydrogen-react/storefront-api-types';
import {CART_ACTIONS, CART_FORM_INPUT_NAME, getFormInput} from './form-input';
import type {OptimisticCartLineInput} from './types';

/** Other fields the cart action may also read from the submitted form. */
type OtherFormData = Record<string, unknown>;

/** The action a form submits, with the inputs that action takes. */
type CartActionProps =
  | {
      action: 'LinesAdd';
      inputs: {lines: OptimisticCartLineInput[]} & OtherFormData;
    }
  | {
      action: 'LinesUpdate';
      inputs: {lines: CartLineUpdateInput[]} & OtherFormData;
    }
  | {
      action: 'LinesRemove';
      inputs: {lineIds: string[]} & OtherFormData;
    }
  | {
      action: 'DiscountCodesUpdate';
      inputs?: {discountCodes: string[]} & OtherFormData;
    }
  | {
      action: 'GiftCardCodesAdd';
      inputs?: {giftCardCodes: string[]} & OtherFormData;
    }
  | {
      action: 'GiftCardCodesRemove';
      inputs: {giftCardCodes: string[]} & OtherFormData;
    }
  | {
      action: 'BuyerIdentityUpdate';
      inputs: {buyerIdentity: CartBuyerIdentityInput} & OtherFormData;
    };

/** `TData` is what the form's fetcher receives from the action (`fetcher.data`). */
export type CartFormProps<TData = unknown> = CartActionProps & {
  /** The form's content, or a function that receives the form's fetcher. */
  children: ReactNode | ((fetcher: FetcherWithComponents<TData>) => ReactNode);
  /** The route whose action receives the form. Defaults to the current route. */
  route?: string;
  /**
   * Shares one fetcher between forms, and lets other components read it with
   * `useFetcher({key})`. Forms with the same key cancel each other's request.
   */
  fetcherKey?: string;
};

/**
 * A form that submits a cart action (`CART_ACTIONS`) to a route's action
 * without navigating. The action and its inputs travel as JSON in a hidden
 * `cartFormInput` field, which `getFormInput` reads on the server and
 * `useOptimisticCart` reads in the browser while the request is in flight.
 * Ported from Hydrogen's `CartForm`, with the same markup.
 */
export function CartForm<TData = unknown>({
  children,
  action,
  inputs,
  route,
  fetcherKey,
}: CartFormProps<TData>) {
  const fetcher = useFetcher({key: fetcherKey});

  return (
    <fetcher.Form action={route ?? ''} method="post">
      {action || inputs ? (
        <input
          type="hidden"
          name={CART_FORM_INPUT_NAME}
          value={JSON.stringify({action, inputs})}
        />
      ) : null}
      {typeof children === 'function' ? children(fetcher) : children}
    </fetcher.Form>
  );
}

CartForm.ACTIONS = CART_ACTIONS;
CartForm.INPUT_NAME = CART_FORM_INPUT_NAME;
CartForm.getFormInput = getFormInput;
