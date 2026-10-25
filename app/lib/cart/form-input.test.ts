import {afterEach, describe, expect, it, vi} from 'vitest';
import {CART_ACTIONS, CART_FORM_INPUT_NAME, getFormInput} from './form-input';

/** Every action Hydrogen's `CartForm.ACTIONS` offered, which the cart route switches on. */
const HYDROGEN_ACTION_NAMES = [
  'AttributesUpdateInput',
  'BuyerIdentityUpdate',
  'Create',
  'DiscountCodesUpdate',
  'GiftCardCodesUpdate',
  'GiftCardCodesAdd',
  'GiftCardCodesRemove',
  'LinesAdd',
  'LinesRemove',
  'LinesUpdate',
  'NoteUpdate',
  'SelectedDeliveryOptionsUpdate',
  'MetafieldsSet',
  'MetafieldDelete',
  'DeliveryAddressesAdd',
  'DeliveryAddressesUpdate',
  'DeliveryAddressesRemove',
  'DeliveryAddressesReplace',
];

/** A form the way <CartForm> submits it: the action and inputs as JSON in one hidden field. */
function cartForm(
  cartFormInput: unknown,
  fields: ReadonlyArray<[name: string, value: string]> = [],
): FormData {
  const formData = new FormData();
  formData.append(CART_FORM_INPUT_NAME, JSON.stringify(cartFormInput));
  for (const [name, value] of fields) formData.append(name, value);
  return formData;
}

/** A form with only plain fields, no `cartFormInput`. */
function plainForm(fields: ReadonlyArray<[name: string, value: string]>) {
  const formData = new FormData();
  for (const [name, value] of fields) formData.append(name, value);
  return formData;
}

describe('CART_FORM_INPUT_NAME', () => {
  it('is the field name the cart action and the browser forms agree on', () => {
    expect(CART_FORM_INPUT_NAME).toBe('cartFormInput');
  });
});

describe('CART_ACTIONS', () => {
  it('has the 18 action names Hydrogen offered', () => {
    expect(Object.keys(CART_ACTIONS).sort()).toEqual(
      [...HYDROGEN_ACTION_NAMES].sort(),
    );
  });

  it.each(HYDROGEN_ACTION_NAMES)('maps %s to its own name', (name) => {
    expect(CART_ACTIONS[name as keyof typeof CART_ACTIONS]).toBe(name);
  });
});

describe('getFormInput', () => {
  describe('the cartFormInput field', () => {
    it('reads the action and the inputs from the JSON', () => {
      const formData = cartForm({
        action: 'LinesAdd',
        inputs: {
          lines: [
            {merchandiseId: 'gid://shopify/ProductVariant/1', quantity: 2},
          ],
        },
      });

      const result = getFormInput(formData);

      expect(result).toEqual({
        action: 'LinesAdd',
        inputs: {
          lines: [
            {merchandiseId: 'gid://shopify/ProductVariant/1', quantity: 2},
          ],
        },
      });
    });

    it('gives an action without inputs an empty inputs object', () => {
      const result = getFormInput(cartForm({action: 'GiftCardCodesAdd'}));

      expect(result).toEqual({action: 'GiftCardCodesAdd', inputs: {}});
    });

    it('gives undefined for the action when there is no cartFormInput field', () => {
      const result = getFormInput(plainForm([['discountCode', 'SAVE10']]));

      expect(result.action).toBeUndefined();
      expect(result.inputs).toEqual({discountCode: 'SAVE10'});
    });

    it('treats an empty cartFormInput field like a missing one', () => {
      const formData = plainForm([[CART_FORM_INPUT_NAME, '']]);

      expect(getFormInput(formData)).toEqual({action: undefined, inputs: {}});
    });

    it('gives an empty result for an empty form', () => {
      expect(getFormInput(new FormData())).toEqual({
        action: undefined,
        inputs: {},
      });
    });

    it('does not leak the cartFormInput field itself into the inputs', () => {
      const result = getFormInput(cartForm({action: 'LinesAdd', inputs: {}}));

      expect(result.inputs).not.toHaveProperty(CART_FORM_INPUT_NAME);
    });

    it.each([
      ['an unterminated object', '{"action":'],
      ['plain text', 'LinesAdd'],
      ['a truncated escape', '{"action":"LinesAdd\\'],
      ['an on/off value', 'on'],
    ])('throws a SyntaxError for %s', (_label, text) => {
      const formData = plainForm([[CART_FORM_INPUT_NAME, text]]);

      expect(() => getFormInput(formData)).toThrow(SyntaxError);
    });

    it('throws when the cartFormInput field is submitted more than once', () => {
      const formData = plainForm([
        [CART_FORM_INPUT_NAME, '{"action":"LinesAdd"}'],
        [CART_FORM_INPUT_NAME, '{"action":"LinesRemove"}'],
      ]);

      expect(() => getFormInput(formData)).toThrow();
    });

    it.each([
      ['null', 'null'],
      ['a number', '5'],
      ['a string', '"LinesAdd"'],
      ['a boolean', 'true'],
      ['an array', '[{"action":"LinesAdd"}]'],
    ])('ignores valid JSON that is %s instead of an object', (_label, text) => {
      const formData = plainForm([
        [CART_FORM_INPUT_NAME, text],
        ['note', 'hi'],
      ]);

      expect(getFormInput(formData)).toEqual({
        action: undefined,
        inputs: {note: 'hi'},
      });
    });

    it.each([[5], [null], [['LinesAdd']], [{name: 'LinesAdd'}]])(
      'gives undefined for an action that is not a string (%j)',
      (action) => {
        const result = getFormInput(cartForm({action, inputs: {a: 1}}));

        expect(result).toEqual({action: undefined, inputs: {a: 1}});
      },
    );

    it.each([[5], ['text'], [null], [true], [[1, 2]]])(
      'ignores inputs that are not an object (%j)',
      (inputs) => {
        const result = getFormInput(
          cartForm({action: 'LinesAdd', inputs}, [['note', 'hi']]),
        );

        expect(result).toEqual({action: 'LinesAdd', inputs: {note: 'hi'}});
      },
    );
  });

  describe('merging the other fields into the inputs', () => {
    it('adds fields next to the inputs from the JSON', () => {
      const formData = cartForm(
        {action: 'DiscountCodesUpdate', inputs: {discountCodes: ['OLD']}},
        [['discountCode', 'NEW10']],
      );

      const result = getFormInput(formData);

      expect(result.inputs).toEqual({
        discountCodes: ['OLD'],
        discountCode: 'NEW10',
      });
    });

    it('lets a form field win over an input of the same name', () => {
      const formData = cartForm(
        {action: 'LinesAdd', inputs: {note: 'from json', keep: 1}},
        [['note', 'from field']],
      );

      const result = getFormInput(formData);

      expect(result.inputs).toEqual({note: 'from field', keep: 1});
    });

    it('keeps a single value as a string', () => {
      const result = getFormInput(plainForm([['lineId', 'gid://l/1']]));

      expect(result.inputs.lineId).toBe('gid://l/1');
    });

    it('turns a repeated field name into an array in submission order', () => {
      const result = getFormInput(
        plainForm([
          ['lineIds', 'a'],
          ['other', 'x'],
          ['lineIds', 'b'],
          ['lineIds', 'c'],
        ]),
      );

      expect(result.inputs).toEqual({lineIds: ['a', 'b', 'c'], other: 'x'});
    });

    it('turns a field that is submitted twice into an array of two', () => {
      const result = getFormInput(
        plainForm([
          ['codes', 'a'],
          ['codes', 'b'],
        ]),
      );

      expect(result.inputs.codes).toEqual(['a', 'b']);
    });

    it('turns the checkbox value "on" into true and "off" into false', () => {
      const result = getFormInput(
        plainForm([
          ['subscribe', 'on'],
          ['gift', 'off'],
        ]),
      );

      expect(result.inputs).toEqual({subscribe: true, gift: false});
    });

    it('only converts the exact values "on" and "off"', () => {
      const result = getFormInput(
        plainForm([
          ['a', 'ON'],
          ['b', 'true'],
          ['c', ''],
          ['d', 'off '],
        ]),
      );

      expect(result.inputs).toEqual({a: 'ON', b: 'true', c: '', d: 'off '});
    });

    it('leaves the values of a repeated field untouched, even "on" and "off"', () => {
      const result = getFormInput(
        plainForm([
          ['flags', 'on'],
          ['flags', 'off'],
        ]),
      );

      expect(result.inputs.flags).toEqual(['on', 'off']);
    });

    it('keeps an uploaded file as the File', () => {
      const formData = new FormData();
      const file = new File(['hello'], 'hello.txt', {type: 'text/plain'});
      formData.append('attachment', file);

      const result = getFormInput(formData);

      expect(result.inputs.attachment).toBeInstanceOf(File);
    });

    it('returns objects that are not shared between calls', () => {
      const formData = cartForm({action: 'LinesAdd', inputs: {lines: []}});

      const first = getFormInput(formData);
      const second = getFormInput(formData);

      expect(first).toEqual(second);
      expect(first.inputs).not.toBe(second.inputs);
    });
  });

  describe('keys that could alter an object prototype', () => {
    it('drops a __proto__ form field', () => {
      const formData = cartForm({action: 'LinesAdd', inputs: {lines: []}}, [
        ['__proto__', 'polluted'],
        ['ok', '1'],
      ]);

      const {inputs} = getFormInput(formData);

      expect(Object.keys(inputs).sort()).toEqual(['lines', 'ok']);
      expect(Object.getPrototypeOf(inputs)).toBe(Object.prototype);
    });

    it('drops a repeated __proto__ form field instead of making an array its prototype', () => {
      const formData = plainForm([
        ['__proto__', 'a'],
        ['__proto__', 'b'],
        ['ok', '1'],
      ]);

      const {inputs} = getFormInput(formData);

      expect(Object.keys(inputs)).toEqual(['ok']);
      expect(Object.getPrototypeOf(inputs)).toBe(Object.prototype);
      expect(inputs).not.toHaveProperty('length');
    });

    it('drops a __proto__ key from the JSON inputs', () => {
      const formData = plainForm([
        [
          CART_FORM_INPUT_NAME,
          '{"action":"LinesAdd","inputs":{"__proto__":{"polluted":true},"lines":[]}}',
        ],
      ]);

      const {inputs} = getFormInput(formData);

      expect(Object.keys(inputs)).toEqual(['lines']);
      expect(Object.getPrototypeOf(inputs)).toBe(Object.prototype);
      expect(inputs).not.toHaveProperty('polluted');
    });

    it('drops a __proto__ key at any depth of the JSON inputs', () => {
      const formData = plainForm([
        [
          CART_FORM_INPUT_NAME,
          '{"action":"LinesAdd","inputs":{"lines":[{"merchandiseId":"m","__proto__":{"x":1}}]}}',
        ],
      ]);

      const {inputs} = getFormInput(formData);

      const [line] = inputs.lines as Array<Record<string, unknown>>;
      expect(Object.keys(line)).toEqual(['merchandiseId']);
      expect(line.x).toBeUndefined();
    });

    it('does not pollute Object.prototype', () => {
      const formData = plainForm([
        [CART_FORM_INPUT_NAME, '{"inputs":{"__proto__":{"polluted":true}}}'],
        ['__proto__', 'x'],
      ]);

      getFormInput(formData);

      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('keeps a legitimate key that merely contains the text __proto__', () => {
      const formData = plainForm([['a__proto__b', '1']]);

      expect(getFormInput(formData).inputs).toEqual({a__proto__b: '1'});
    });
  });

  describe('forms with many fields', () => {
    const DISTINCT_NAMES = 20_000;

    afterEach(() => {
      vi.restoreAllMocks();
    });

    /** `count` fields, each with a name of its own, in submission order. */
    function distinctFields(
      count: number,
    ): Array<[name: string, value: string]> {
      return Array.from({length: count}, (_, index) => [
        `field-${index}`,
        `value-${index}`,
      ]);
    }

    // POST /cart is public: a form can carry any number of distinct names, and a
    // lookup per name (`getAll`) walks the whole form each time, so the cost
    // grows with the square of the field count (the Phase 3/4a security review
    // measured about 23 s of CPU in workerd at 80,000 names).
    it('reads thousands of distinct field names without a lookup per name (no getAll)', () => {
      // Arrange
      const formData = plainForm(distinctFields(DISTINCT_NAMES));
      const getAll = vi.spyOn(FormData.prototype, 'getAll');

      // Act
      const {inputs} = getFormInput(formData);

      // Assert
      expect(getAll).toHaveBeenCalledTimes(0);
      expect(Object.keys(inputs)).toHaveLength(DISTINCT_NAMES);
      expect(inputs['field-0']).toBe('value-0');
      expect(inputs[`field-${DISTINCT_NAMES - 1}`]).toBe(
        `value-${DISTINCT_NAMES - 1}`,
      );
    });

    it('finds the cartFormInput field among thousands of others without getAll', () => {
      // Arrange
      const formData = cartForm(
        {action: 'LinesRemove', inputs: {lineIds: ['gid://l/1']}},
        distinctFields(DISTINCT_NAMES),
      );
      const getAll = vi.spyOn(FormData.prototype, 'getAll');

      // Act
      const result = getFormInput(formData);

      // Assert
      expect(getAll).toHaveBeenCalledTimes(0);
      expect(result.action).toBe('LinesRemove');
      expect(result.inputs.lineIds).toEqual(['gid://l/1']);
      expect(Object.keys(result.inputs)).toHaveLength(DISTINCT_NAMES + 1);
    });

    it('keeps a repeated name as an array while reading thousands of other names', () => {
      // Arrange
      const formData = plainForm([
        ['lineIds', 'a'],
        ...distinctFields(DISTINCT_NAMES),
        ['lineIds', 'b'],
        ['subscribe', 'on'],
      ]);

      // Act
      const {inputs} = getFormInput(formData);

      // Assert
      expect(inputs.lineIds).toEqual(['a', 'b']);
      expect(inputs.subscribe).toBe(true);
      expect(inputs[`field-${DISTINCT_NAMES - 1}`]).toBe(
        `value-${DISTINCT_NAMES - 1}`,
      );
    });

    it('lists the names in the order each first appeared, repeats included', () => {
      const result = getFormInput(
        plainForm([
          ['lineIds', 'a'],
          ['other', 'x'],
          ['lineIds', 'b'],
          ['last', 'y'],
          ['other', 'z'],
        ]),
      );

      expect(Object.keys(result.inputs)).toEqual(['lineIds', 'other', 'last']);
      expect(result.inputs).toEqual({
        lineIds: ['a', 'b'],
        other: ['x', 'z'],
        last: 'y',
      });
    });

    it('reads the cartFormInput field wherever it sits among the other fields', () => {
      const formData = new FormData();
      formData.append('first', '1');
      formData.append(
        CART_FORM_INPUT_NAME,
        JSON.stringify({action: 'NoteUpdate', inputs: {note: 'from json'}}),
      );
      formData.append('last', '2');

      expect(getFormInput(formData)).toEqual({
        action: 'NoteUpdate',
        inputs: {note: 'from json', first: '1', last: '2'},
      });
    });
  });

  describe('awkward values', () => {
    it.each([
      ['an emoji', 'SAVE🎉'],
      ['accented letters', 'ÉTÉ-ça va'],
      ['CJK text', '割引コード'],
      ['SQL characters', "'; DROP TABLE carts; --"],
      ['HTML', '<img src=x onerror=alert(1)>'],
      ['quotes and backslashes', 'say "hi" \\ bye'],
      ['a newline', 'line1\nline2'],
    ])('carries %s through unchanged', (_label, text) => {
      const formData = cartForm(
        {action: 'DiscountCodesUpdate', inputs: {discountCodes: [text]}},
        [['discountCode', text]],
      );

      const {inputs} = getFormInput(formData);

      expect(inputs.discountCodes).toEqual([text]);
      expect(inputs.discountCode).toBe(text);
    });

    it('handles thousands of repeated values', () => {
      const count = 10_000;
      const formData = new FormData();
      for (let index = 0; index < count; index += 1) {
        formData.append('lineIds', `gid://shopify/CartLine/${index}`);
      }

      const {inputs} = getFormInput(formData);

      const lineIds = inputs.lineIds as string[];
      expect(lineIds).toHaveLength(count);
      expect(lineIds[0]).toBe('gid://shopify/CartLine/0');
      expect(lineIds[count - 1]).toBe(`gid://shopify/CartLine/${count - 1}`);
    });
  });
});
