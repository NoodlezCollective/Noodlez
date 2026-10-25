/**
 * In-memory cart store for the development mock.
 *
 * Carts live for the lifetime of the dev server process. Cart ids are stored
 * by the cart service in the `cart` cookie exactly like real Shopify cart
 * ids, so the rest of the application (CartForm actions, optimistic UI, cart
 * drawer) runs unchanged against this store.
 */
import {connection, money, type GqlObject, type MockCatalog} from './graph.server';

export type StoredLine = {
  id: string;
  merchandiseId: string;
  quantity: number;
  attributes: Array<{key: string; value: string}>;
};

export type StoredCart = {
  id: string;
  lines: StoredLine[];
  discountCodes: string[];
  note: string | null;
  attributes: Array<{key: string; value: string}>;
  buyerIdentity: {countryCode: string; email: string | null; phone: string | null};
  createdAt: string;
  updatedAt: string;
};

/** Discount codes the mock treats as applicable (percentage off subtotal). */
export const MOCK_DISCOUNTS: Record<string, number> = {
  MELLOW10: 0.1,
  WELCOME15: 0.15,
};

const carts = new Map<string, StoredCart>();
let lineCounter = 0;

function randomToken() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function touch(cart: StoredCart) {
  cart.updatedAt = new Date().toISOString();
  return cart;
}

export function createCart(input: GqlObject = {}): StoredCart {
  const now = new Date().toISOString();
  const cart: StoredCart = {
    id: `gid://shopify/Cart/mock${randomToken()}`,
    lines: [],
    discountCodes: [],
    note: (input.note as string) ?? null,
    attributes: ((input.attributes as StoredCart['attributes']) ?? []).map(({key, value}) => ({key, value})),
    buyerIdentity: {
      countryCode: (input.buyerIdentity?.countryCode as string) ?? 'US',
      email: (input.buyerIdentity?.email as string) ?? null,
      phone: (input.buyerIdentity?.phone as string) ?? null,
    },
    createdAt: now,
    updatedAt: now,
  };
  carts.set(cart.id, cart);
  if (Array.isArray(input.lines)) addLines(cart, input.lines as GqlObject[]);
  if (Array.isArray(input.discountCodes)) {
    cart.discountCodes = (input.discountCodes as string[]).map((code) => code.toUpperCase());
  }
  return cart;
}

export function getCart(id: string | null | undefined): StoredCart | undefined {
  return id ? carts.get(id) : undefined;
}

/** Returns the stored cart, recreating it if the dev server lost it (restart). */
export function ensureCart(id: string): StoredCart {
  const existing = carts.get(id);
  if (existing) return existing;
  const now = new Date().toISOString();
  const cart: StoredCart = {
    id,
    lines: [],
    discountCodes: [],
    note: null,
    attributes: [],
    buyerIdentity: {countryCode: 'US', email: null, phone: null},
    createdAt: now,
    updatedAt: now,
  };
  carts.set(id, cart);
  return cart;
}

function sameAttributes(a: StoredLine['attributes'], b: StoredLine['attributes']) {
  if (a.length !== b.length) return false;
  return a.every((attr) => b.some((other) => other.key === attr.key && other.value === attr.value));
}

export function addLines(cart: StoredCart, lines: GqlObject[]) {
  for (const input of lines) {
    const merchandiseId = String(input.merchandiseId);
    const quantity = Math.max(1, Number(input.quantity ?? 1));
    const attributes = ((input.attributes as StoredLine['attributes']) ?? []).map(({key, value}) => ({key, value}));
    const existing = cart.lines.find(
      (line) => line.merchandiseId === merchandiseId && sameAttributes(line.attributes, attributes),
    );
    if (existing) {
      existing.quantity += quantity;
    } else {
      lineCounter += 1;
      cart.lines.push({
        id: `gid://shopify/CartLine/mock-line-${lineCounter}?cart=${cart.id.split('/').pop()}`,
        merchandiseId,
        quantity,
        attributes,
      });
    }
  }
  return touch(cart);
}

export function updateLines(cart: StoredCart, lines: GqlObject[]) {
  for (const input of lines) {
    const line = cart.lines.find((l) => l.id === input.id);
    if (!line) continue;
    if (typeof input.quantity === 'number') {
      if (input.quantity <= 0) {
        cart.lines = cart.lines.filter((l) => l !== line);
        continue;
      }
      line.quantity = input.quantity;
    }
    if (input.merchandiseId) line.merchandiseId = String(input.merchandiseId);
    if (Array.isArray(input.attributes)) {
      line.attributes = (input.attributes as StoredLine['attributes']).map(({key, value}) => ({key, value}));
    }
  }
  return touch(cart);
}

export function removeLines(cart: StoredCart, lineIds: string[]) {
  cart.lines = cart.lines.filter((line) => !lineIds.includes(line.id));
  return touch(cart);
}

export function updateDiscountCodes(cart: StoredCart, codes: string[]) {
  cart.discountCodes = [...new Set(codes.map((code) => code.trim().toUpperCase()).filter(Boolean))];
  return touch(cart);
}

export function updateNote(cart: StoredCart, note: string | null) {
  cart.note = note;
  return touch(cart);
}

export function updateAttributes(cart: StoredCart, attributes: StoredCart['attributes']) {
  cart.attributes = attributes.map(({key, value}) => ({key, value}));
  return touch(cart);
}

export function updateBuyerIdentity(cart: StoredCart, buyerIdentity: GqlObject) {
  cart.buyerIdentity = {
    countryCode: (buyerIdentity.countryCode as string) ?? cart.buyerIdentity.countryCode,
    email: buyerIdentity.email === undefined ? cart.buyerIdentity.email : (buyerIdentity.email as string | null),
    phone: buyerIdentity.phone === undefined ? cart.buyerIdentity.phone : (buyerIdentity.phone as string | null),
  };
  return touch(cart);
}

/** Converts a stored cart into a Storefront API `Cart` object graph. */
export function buildCartObject(cart: StoredCart, catalog: MockCatalog, origin: string): GqlObject {
  const lineObjects = cart.lines.flatMap((line) => {
    const variant = catalog.registry.resolveNode(line.merchandiseId);
    if (!variant) return [];
    const unitPrice = Number(variant.price.amount);
    const compareAt = variant.compareAtPrice ? Number(variant.compareAtPrice.amount) : null;
    const lineTotal = unitPrice * line.quantity;
    const cost = {
      __typename: 'CartLineCost',
      totalAmount: money(lineTotal),
      subtotalAmount: money(lineTotal),
      amountPerQuantity: money(unitPrice),
      compareAtAmountPerQuantity: compareAt != null ? money(compareAt) : null,
    };
    return [
      {
        __typename: 'CartLine',
        id: line.id,
        quantity: line.quantity,
        attributes: line.attributes.map((attr) => ({__typename: 'Attribute', ...attr})),
        attribute: ({key}: {key: string}) => {
          const match = line.attributes.find((attr) => attr.key === key);
          return match ? {__typename: 'Attribute', ...match} : null;
        },
        merchandise: variant,
        cost,
        estimatedCost: cost,
        discountAllocations: [],
        sellingPlanAllocation: null,
        parentRelationship: null,
        instructions: null,
        __total: lineTotal,
      },
    ];
  });

  const subtotal = lineObjects.reduce((sum, line) => sum + (line.__total as number), 0);
  const discountRate = cart.discountCodes.reduce(
    (rate, code) => Math.max(rate, MOCK_DISCOUNTS[code] ?? 0),
    0,
  );
  const discount = Math.round(subtotal * discountRate * 100) / 100;
  const total = Math.max(0, subtotal - discount);
  const checkoutUrl = new URL('/dev/mock-checkout', origin);
  checkoutUrl.searchParams.set('cart', cart.id);

  return {
    __typename: 'Cart',
    id: cart.id,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
    checkoutUrl: checkoutUrl.toString(),
    note: cart.note,
    attributes: cart.attributes.map((attr) => ({__typename: 'Attribute', ...attr})),
    attribute: ({key}: {key: string}) => {
      const match = cart.attributes.find((attr) => attr.key === key);
      return match ? {__typename: 'Attribute', ...match} : null;
    },
    totalQuantity: cart.lines.reduce((sum, line) => sum + line.quantity, 0),
    buyerIdentity: {
      __typename: 'CartBuyerIdentity',
      countryCode: cart.buyerIdentity.countryCode,
      email: cart.buyerIdentity.email,
      phone: cart.buyerIdentity.phone,
      customer: null,
      deliveryAddressPreferences: [],
      preferences: null,
      purchasingCompany: null,
    },
    lines: (args: GqlObject) => connection(lineObjects, args),
    cost: {
      __typename: 'CartCost',
      subtotalAmount: money(subtotal),
      subtotalAmountEstimated: false,
      totalAmount: money(total),
      totalAmountEstimated: false,
      totalTaxAmount: null,
      totalTaxAmountEstimated: false,
      totalDutyAmount: null,
      totalDutyAmountEstimated: false,
      checkoutChargeAmount: money(total),
    },
    discountCodes: cart.discountCodes.map((code) => ({
      __typename: 'CartDiscountCode',
      code,
      applicable: Boolean(MOCK_DISCOUNTS[code]),
    })),
    discountAllocations:
      discount > 0
        ? [
            {
              __typename: 'CartCodeDiscountAllocation',
              code: cart.discountCodes.find((code) => MOCK_DISCOUNTS[code]) ?? '',
              discountedAmount: money(discount),
              targetType: 'LINE_ITEM',
              discountApplication: null,
            },
          ]
        : [],
    appliedGiftCards: [],
    deliveryGroups: (args: GqlObject) => connection([], args),
    delivery: {__typename: 'CartDelivery', addresses: []},
    metafield: () => null,
    metafields: () => [],
  };
}
