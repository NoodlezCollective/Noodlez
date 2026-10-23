import type {CartApiQueryFragment} from 'storefrontapi.generated';
import type {CartLayout} from '~/components/CartMain';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import {CartForm, Money, type OptimisticCart} from '@shopify/hydrogen';
import {useEffect, useId, useRef, useState} from 'react';
import {useFetcher} from 'react-router';
import {useAside} from '~/components/Aside';
import {Button} from '~/components/ui/Button';
import {ChevronDownIcon, CloseIcon, FeatureIcon} from '~/components/ui/Icons';
import {useSiteSettings} from '~/lib/content/useSiteSettings';

type CartSummaryProps = {
  cart: OptimisticCart<CartApiQueryFragment | null>;
  layout: CartLayout;
};

/** Shape of the data returned by the /cart action (see app/routes/cart.tsx). */
type CartActionData = {
  errors?: Array<{message: string}> | null;
  userErrors?: Array<{message: string}> | null;
  warnings?: Array<{message: string}> | null;
};

/** User-facing messages (userErrors + GraphQL errors) from a cart action. */
function getActionErrors(data: CartActionData | undefined) {
  return [
    ...(data?.userErrors?.map((e) => e.message) ?? []),
    ...(data?.errors?.map((e) => e.message) ?? []),
  ];
}

type MoneyLike = Pick<MoneyV2, 'amount' | 'currencyCode'>;

const DISCOUNT_FETCHER_KEY = 'cart-discount-codes';
const GIFT_CARD_FETCHER_KEY = 'gift-card-add';

/**
 * Focuses `element`. When the last code or card was removed its panel
 * collapses, which hides the code input; focus the panel's summary instead of
 * losing focus to <body>.
 */
function focusInPromo(element: HTMLElement | null | undefined) {
  if (!element) return;
  element.focus();
  if (document.activeElement !== element) {
    element.closest('details')?.querySelector('summary')?.focus();
  }
}

/**
 * Order summary: totals, discount and gift card forms and the checkout call to
 * action. In the drawer it is pinned to the bottom; on the cart page it is a
 * sticky lavender card beside the line items.
 */
export function CartSummary({cart, layout}: CartSummaryProps) {
  const siteSettings = useSiteSettings();
  const summaryId = useId();
  const {close} = useAside();
  const cost = cart?.cost;
  const subtotal = cost?.subtotalAmount;
  const total = cost?.totalAmount;
  const discountAmount = getDiscountAmount(cart);
  const appliedCodes =
    cart?.discountCodes?.filter((code) => code.applicable).map((c) => c.code) ??
    [];
  const giftCards = cart?.appliedGiftCards ?? [];

  return (
    <aside
      aria-labelledby={summaryId}
      className={`cart-summary cart-summary--${layout}`}
    >
      <h2 id={summaryId} className="cart-summary__title">
        Order summary
      </h2>

      <dl className="cart-summary__rows">
        <div className="cart-summary__row">
          <dt>Subtotal</dt>
          <dd>
            {subtotal?.amount ? <Money as="span" data={subtotal} /> : '—'}
          </dd>
        </div>

        {discountAmount && appliedCodes.length ? (
          <div className="cart-summary__row cart-summary__row--discount">
            <dt>
              Discount
              <span className="cart-summary__codes">
                {appliedCodes.join(', ')}
              </span>
            </dt>
            <dd>
              −<Money as="span" data={discountAmount} />
            </dd>
          </div>
        ) : null}

        {giftCards.map((giftCard) => (
          <div
            className="cart-summary__row cart-summary__row--discount"
            key={giftCard.id}
          >
            <dt>Gift card ····{giftCard.lastCharacters}</dt>
            <dd>
              −<Money as="span" data={giftCard.amountUsed} />
            </dd>
          </div>
        ))}

        <div className="cart-summary__row cart-summary__row--total">
          <dt>Total</dt>
          <dd>{total?.amount ? <Money as="span" data={total} /> : '—'}</dd>
        </div>
      </dl>
      <p className="cart-summary__note">
        Shipping &amp; taxes calculated at checkout.
      </p>

      <div className="cart-summary__promos">
        <CartDiscounts discountCodes={cart?.discountCodes} />
        <CartGiftCard giftCardCodes={cart?.appliedGiftCards} />
      </div>

      <div className="cart-summary__actions">
        {cart?.checkoutUrl ? (
          <Button href={cart.checkoutUrl} size="lg" block>
            Checkout
          </Button>
        ) : null}
        {layout === 'aside' ? (
          <Button variant="ghost" block type="button" onClick={close}>
            Continue shopping
          </Button>
        ) : (
          <Button variant="ghost" block to="/collections/all">
            Continue shopping
          </Button>
        )}
      </div>

      <ul className="trust-badges cart-summary__trust">
        {siteSettings.trustBadges.map((badge) => (
          <li key={badge.label}>
            <FeatureIcon icon={badge.icon} size={18} />
            {badge.label}
          </li>
        ))}
      </ul>
    </aside>
  );
}

/**
 * Cart-level discount. Prefers the allocations reported by Shopify
 * (`cart.discountAllocations`); falls back to the derived value
 * subtotal (+ tax + duties) − total when allocations are unavailable.
 */
function getDiscountAmount(
  cart: OptimisticCart<CartApiQueryFragment | null>,
): MoneyLike | null {
  const cost = cart?.cost;
  const currencyCode = cost?.totalAmount?.currencyCode;
  if (!currencyCode) return null;
  const allocated = (cart?.discountAllocations ?? []).reduce(
    (sum, allocation) =>
      sum + Number(allocation?.discountedAmount?.amount ?? 0),
    0,
  );
  if (allocated >= 0.005) {
    return {amount: allocated.toFixed(2), currencyCode};
  }
  if (!cost?.subtotalAmount?.amount || !cost?.totalAmount?.amount) return null;
  const discount =
    Number(cost.subtotalAmount.amount) +
    Number(cost.totalTaxAmount?.amount ?? 0) +
    Number(cost.totalDutyAmount?.amount ?? 0) -
    Number(cost.totalAmount.amount);
  if (!Number.isFinite(discount) || discount < 0.005) return null;
  return {
    amount: discount.toFixed(2),
    currencyCode,
  };
}

function PromoDetails({
  summary,
  open,
  children,
}: {
  summary: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="cart-promo" open={open || undefined}>
      <summary className="cart-promo__summary">
        <span>{summary}</span>
        <ChevronDownIcon className="cart-promo__chevron" size={18} />
      </summary>
      <div className="cart-promo__panel">{children}</div>
    </details>
  );
}

function CartMessages({
  messages,
  tone = 'error',
}: {
  messages: string[];
  tone?: 'error' | 'success' | 'info';
}) {
  if (!messages.length) return null;
  return (
    <>
      {messages.map((message) => (
        <p
          className={`form-message ${tone === 'info' ? '' : `form-message--${tone}`}`.trim()}
          key={message}
        >
          {message}
        </p>
      ))}
    </>
  );
}

function CartDiscounts({
  discountCodes,
}: {
  discountCodes?: CartApiQueryFragment['discountCodes'];
}) {
  const fetcher = useFetcher<CartActionData>({key: DISCOUNT_FETCHER_KEY});
  const inputRef = useRef<HTMLInputElement>(null);
  const chipsRef = useRef<HTMLUListElement>(null);
  const inputId = useId();
  // The code the shopper is removing and where it sat in the list.
  const [removedCode, setRemovedCode] = useState<{
    code: string;
    index: number;
  } | null>(null);
  const applied = (discountCodes ?? [])
    .filter((discount) => discount.applicable)
    .map(({code}) => code);
  const appliedKey = applied.join('\n');
  const rejected = (discountCodes ?? [])
    .filter((discount) => !discount.applicable)
    .map(({code}) => code);
  const submitting = fetcher.state !== 'idle';
  const actionErrors = getActionErrors(fetcher.data);
  const actionWarnings = fetcher.data?.warnings?.map((w) => w.message) ?? [];

  // Clear the input once the server has answered.
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && inputRef.current) {
      inputRef.current.value = '';
    }
  }, [fetcher.state, fetcher.data]);

  // The focused "remove" button disappears with its code, which would drop
  // focus to <body>. Once the code is gone, focus the one that took its place,
  // the previous one when the last code was removed, or the code input.
  useEffect(() => {
    if (!removedCode || appliedKey.split('\n').includes(removedCode.code)) {
      return;
    }
    setRemovedCode(null);
    const active = document.activeElement;
    if (active && active !== document.body) return; // the shopper moved on
    const buttons =
      chipsRef.current?.querySelectorAll<HTMLElement>('.cart-chip__remove');
    focusInPromo(
      buttons?.length
        ? buttons[Math.min(removedCode.index, buttons.length - 1)]
        : inputRef.current,
    );
  }, [appliedKey, removedCode]);

  return (
    <PromoDetails
      summary="Have a discount code?"
      open={applied.length > 0 || rejected.length > 0}
    >
      {applied.length ? (
        <ul
          className="cart-chips"
          aria-label="Applied discount codes"
          ref={chipsRef}
        >
          {applied.map((code, index) => (
            <li key={code}>
              <UpdateDiscountForm
                discountCodes={applied.filter((other) => other !== code)}
              >
                <span className="cart-chip">
                  {code}
                  <button
                    aria-label={`Remove discount code ${code}`}
                    className="cart-chip__remove"
                    onClick={() => setRemovedCode({code, index})}
                    type="submit"
                  >
                    <CloseIcon size={12} />
                  </button>
                </span>
              </UpdateDiscountForm>
            </li>
          ))}
        </ul>
      ) : null}

      <UpdateDiscountForm
        discountCodes={applied}
        fetcherKey={DISCOUNT_FETCHER_KEY}
      >
        <div className="cart-promo__form">
          <label htmlFor={inputId} className="sr-only">
            Discount code
          </label>
          <input
            autoCapitalize="characters"
            autoComplete="off"
            id={inputId}
            name="discountCode"
            placeholder="Enter code"
            ref={inputRef}
            spellCheck={false}
            type="text"
          />
          <Button
            loading={submitting}
            type="submit"
            variant="secondary"
            aria-label="Apply discount code"
          >
            Apply
          </Button>
        </div>
      </UpdateDiscountForm>

      <div className="cart-promo__messages" aria-live="polite">
        <CartMessages
          messages={rejected.map(
            (code) => `“${code}” isn’t a valid discount code.`,
          )}
        />
        <CartMessages messages={actionErrors} />
        <CartMessages messages={actionWarnings} tone="info" />
      </div>
    </PromoDetails>
  );
}

function UpdateDiscountForm({
  discountCodes,
  fetcherKey,
  children,
}: {
  discountCodes?: string[];
  fetcherKey?: string;
  children: React.ReactNode;
}) {
  return (
    <CartForm
      fetcherKey={fetcherKey}
      route="/cart"
      action={CartForm.ACTIONS.DiscountCodesUpdate}
      inputs={{
        discountCodes: discountCodes || [],
      }}
    >
      {children}
    </CartForm>
  );
}

function CartGiftCard({
  giftCardCodes,
}: {
  giftCardCodes: CartApiQueryFragment['appliedGiftCards'] | undefined;
}) {
  const giftCardCodeInput = useRef<HTMLInputElement>(null);
  const removeButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const giftCardAddFetcher = useFetcher<CartActionData>({
    key: GIFT_CARD_FETCHER_KEY,
  });
  // The card the shopper is removing and where it sat in the list.
  const [removedCard, setRemovedCard] = useState<{
    id: string;
    index: number;
  } | null>(null);
  const inputId = useId();
  const errors = getActionErrors(giftCardAddFetcher.data);
  const hasCards = Boolean(giftCardCodes && giftCardCodes.length > 0);

  useEffect(() => {
    if (giftCardAddFetcher.data) {
      if (giftCardCodeInput.current !== null) {
        giftCardCodeInput.current.value = '';
      }
    }
  }, [giftCardAddFetcher.data]);

  // The focused "remove" button disappears with its card, which would drop
  // focus to <body>. Wait until the card has actually left the list (the
  // effect also runs when the click only sets `removedCard`, while the card is
  // still listed), then focus the card that took its place, the previous one
  // when the last card was removed, or the code input when none is left.
  useEffect(() => {
    if (!removedCard) return;
    const cards = giftCardCodes ?? [];
    if (cards.some((card) => card.id === removedCard.id)) return;
    setRemovedCard(null);
    const active = document.activeElement;
    if (active && active !== document.body) return; // the shopper moved on
    const target = cards[Math.min(removedCard.index, cards.length - 1)];
    const focusButton = target ? removeButtonRefs.current.get(target.id) : null;
    focusInPromo(focusButton ?? giftCardCodeInput.current);
  }, [giftCardCodes, removedCard]);

  const handleRemoveClick = (cardId: string) => {
    const index = giftCardCodes?.findIndex((card) => card.id === cardId) ?? -1;
    if (index !== -1) setRemovedCard({id: cardId, index});
  };

  return (
    <PromoDetails
      summary="Have a gift card?"
      open={hasCards || errors.length > 0}
    >
      {hasCards ? (
        <ul className="cart-chips" aria-label="Applied gift cards">
          {giftCardCodes!.map((giftCard) => (
            <li key={giftCard.id}>
              <RemoveGiftCardForm
                giftCardId={giftCard.id}
                lastCharacters={giftCard.lastCharacters}
                onRemoveClick={() => handleRemoveClick(giftCard.id)}
                buttonRef={(el: HTMLButtonElement | null) => {
                  if (el) {
                    removeButtonRefs.current.set(giftCard.id, el);
                  } else {
                    removeButtonRefs.current.delete(giftCard.id);
                  }
                }}
              >
                ····{giftCard.lastCharacters}
                <span className="cart-chip__amount">
                  <Money as="span" data={giftCard.amountUsed} />
                </span>
              </RemoveGiftCardForm>
            </li>
          ))}
        </ul>
      ) : null}

      <AddGiftCardForm fetcherKey={GIFT_CARD_FETCHER_KEY}>
        <div className="cart-promo__form">
          <label htmlFor={inputId} className="sr-only">
            Gift card code
          </label>
          <input
            autoComplete="off"
            id={inputId}
            name="giftCardCode"
            placeholder="Gift card code"
            ref={giftCardCodeInput}
            spellCheck={false}
            type="text"
          />
          <Button
            aria-label="Apply gift card code"
            loading={giftCardAddFetcher.state !== 'idle'}
            type="submit"
            variant="secondary"
          >
            Apply
          </Button>
        </div>
      </AddGiftCardForm>
      <div className="cart-promo__messages" aria-live="polite">
        <CartMessages messages={errors} />
      </div>
    </PromoDetails>
  );
}

function AddGiftCardForm({
  fetcherKey,
  children,
}: {
  fetcherKey?: string;
  children: React.ReactNode;
}) {
  return (
    <CartForm
      fetcherKey={fetcherKey}
      route="/cart"
      action={CartForm.ACTIONS.GiftCardCodesAdd}
    >
      {children}
    </CartForm>
  );
}

function RemoveGiftCardForm({
  giftCardId,
  lastCharacters,
  children,
  onRemoveClick,
  buttonRef,
}: {
  giftCardId: string;
  lastCharacters: string;
  children: React.ReactNode;
  onRemoveClick?: () => void;
  buttonRef?: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.GiftCardCodesRemove}
      inputs={{
        giftCardCodes: [giftCardId],
      }}
    >
      <span className="cart-chip">
        {children}
        <button
          aria-label={`Remove gift card ending in ${lastCharacters}`}
          className="cart-chip__remove"
          onClick={onRemoveClick}
          ref={buttonRef}
          type="submit"
        >
          <CloseIcon size={12} />
        </button>
      </span>
    </CartForm>
  );
}
