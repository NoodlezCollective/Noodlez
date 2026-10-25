/**
 * Reading a cart action back out of a submitted form: the counterpart of the
 * hidden field `<CartForm>` renders. Ported from Hydrogen's `getFormInput` and
 * `CartForm.ACTIONS`. Pure and client-safe, so the cart route (server) and the
 * optimistic cart (browser) read forms the same way.
 */

/** The hidden field `<CartForm>` renders; it holds `JSON.stringify({action, inputs})`. */
export const CART_FORM_INPUT_NAME = 'cartFormInput';

/** Every action a cart form can carry (all of Hydrogen's `CartForm.ACTIONS`). */
export const CART_ACTIONS = {
  AttributesUpdateInput: 'AttributesUpdateInput',
  BuyerIdentityUpdate: 'BuyerIdentityUpdate',
  Create: 'Create',
  DiscountCodesUpdate: 'DiscountCodesUpdate',
  GiftCardCodesUpdate: 'GiftCardCodesUpdate',
  GiftCardCodesAdd: 'GiftCardCodesAdd',
  GiftCardCodesRemove: 'GiftCardCodesRemove',
  LinesAdd: 'LinesAdd',
  LinesRemove: 'LinesRemove',
  LinesUpdate: 'LinesUpdate',
  NoteUpdate: 'NoteUpdate',
  SelectedDeliveryOptionsUpdate: 'SelectedDeliveryOptionsUpdate',
  MetafieldsSet: 'MetafieldsSet',
  MetafieldDelete: 'MetafieldDelete',
  DeliveryAddressesAdd: 'DeliveryAddressesAdd',
  DeliveryAddressesUpdate: 'DeliveryAddressesUpdate',
  DeliveryAddressesRemove: 'DeliveryAddressesRemove',
  DeliveryAddressesReplace: 'DeliveryAddressesReplace',
} as const;

/** What a submitted cart form asks for. */
export type CartFormInput = {
  /** The requested action, or `undefined` when the form carries none. */
  action: string | undefined;
  /** The action's inputs merged with the form's other fields. */
  inputs: Record<string, unknown>;
};

type PlainRecord = Record<string, unknown>;

/** The one key that changes an object's prototype when it is assigned. */
const PROTOTYPE_KEY = '__proto__';

function isPlainRecord(value: unknown): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `JSON.parse` reviver: returning `undefined` removes the key, so a
 * `__proto__` key never survives parsing, at any depth.
 */
function dropPrototypeKey(key: string, value: unknown): unknown {
  return key === PROTOTYPE_KEY ? undefined : value;
}

/** A checkbox posts "on" or "off"; everything else is kept as submitted. */
function toFieldValue(value: FormDataEntryValue): FormDataEntryValue | boolean {
  if (value === 'on') return true;
  if (value === 'off') return false;
  return value;
}

/** Fields that carry data: not the cart input itself, and never `__proto__`. */
function isDataField(name: string): boolean {
  return name !== CART_FORM_INPUT_NAME && name !== PROTOTYPE_KEY;
}

/** Every value submitted under each field name, in submission order. */
type FieldGroups = ReadonlyMap<string, FormDataEntryValue[]>;

/**
 * The form's values grouped by field name, in one pass over its entries; the
 * names keep the order in which they first appear. The form is
 * attacker-controlled and `formData.getAll(name)` walks every field, so a
 * lookup per distinct name would cost time quadratic in the number of fields.
 * The groups are local to this call until it returns them, so filling them in
 * place changes nothing a caller can see.
 */
function groupByName(formData: FormData): FieldGroups {
  const groups = new Map<string, FormDataEntryValue[]>();
  for (const [name, value] of formData.entries()) {
    const values = groups.get(name);
    if (values) values.push(value);
    else groups.set(name, [value]);
  }
  return groups;
}

/** One value as submitted; a name submitted more than once gives all its values. */
function toInputValue(values: FormDataEntryValue[]): unknown {
  return values.length > 1 ? values : toFieldValue(values[0]);
}

/**
 * The form's fields other than the cart input. A name that is submitted more
 * than once becomes an array of all its values; a lone "on" or "off" becomes a
 * boolean. Built with `Object.fromEntries`, which defines each key as plain
 * data instead of assigning it.
 */
function readFields(groups: FieldGroups): PlainRecord {
  return Object.fromEntries(
    [...groups]
      .filter(([name]) => isDataField(name))
      .map(([name, values]) => [name, toInputValue(values)]),
  );
}

/**
 * The `{action, inputs}` JSON of the cart input field. A missing or empty field
 * gives no action; JSON that is not an object is ignored. Throws when the field
 * is repeated or is not valid JSON.
 */
function readCartInput(groups: FieldGroups): {
  action: string | undefined;
  inputs: PlainRecord;
} {
  const submitted = groups.get(CART_FORM_INPUT_NAME) ?? [];
  if (submitted.length > 1) {
    throw new Error(
      `Expected one "${CART_FORM_INPUT_NAME}" field, got ${submitted.length}`,
    );
  }
  if (submitted.length === 0 || submitted[0] === '') {
    return {action: undefined, inputs: {}};
  }

  const parsed: unknown = JSON.parse(String(submitted[0]), dropPrototypeKey);
  if (!isPlainRecord(parsed)) return {action: undefined, inputs: {}};
  return {
    action: typeof parsed.action === 'string' ? parsed.action : undefined,
    inputs: isPlainRecord(parsed.inputs) ? parsed.inputs : {},
  };
}

/**
 * Reads the cart action and its inputs from a submitted form: the JSON in the
 * cart input field, with the form's other fields merged over its inputs.
 *
 * The form is attacker-controlled on the server, so the result only promises
 * `action` is a string or `undefined` and `inputs` is a plain object; callers
 * still validate the inputs they use. Invalid JSON throws a `SyntaxError`
 * (the cart route answers 400). The time taken grows linearly with the number
 * of fields, however many distinct names they have.
 */
export function getFormInput(formData: FormData): CartFormInput {
  const groups = groupByName(formData);
  const {action, inputs} = readCartInput(groups);
  return {action, inputs: {...inputs, ...readFields(groups)}};
}
