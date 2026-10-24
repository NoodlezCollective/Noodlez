import {useId} from 'react';
import {Link, useNavigate} from 'react-router';
import {type MappedProductOptions} from '@shopify/hydrogen';
import type {
  Maybe,
  ProductOptionValueSwatch,
} from '@shopify/hydrogen/storefront-api-types';
import type {SwatchGroups} from '~/lib/content/metafields';

type OptionValue = MappedProductOptions['optionValues'][number];
type ValueGroup = {label: string | null; values: OptionValue[]};

function hasSwatch(swatch: OptionValue['swatch']) {
  return Boolean(swatch?.color || swatch?.image?.previewImage?.url);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

/**
 * Groups option values under the labels of the `mellow.swatch_groups`
 * metafield. Values that belong to no group are listed under the option name.
 */
function groupOptionValues(
  option: MappedProductOptions,
  swatchGroups?: SwatchGroups | null,
): ValueGroup[] {
  const ungrouped: ValueGroup[] = [{label: null, values: option.optionValues}];
  if (!swatchGroups) return ungrouped;

  const assigned = new Set<string>();
  const groups: ValueGroup[] = [];
  for (const [label, names] of Object.entries(swatchGroups)) {
    const lookup = new Set(names.map(normalize));
    const values = option.optionValues.filter((value) =>
      lookup.has(normalize(value.name)),
    );
    if (!values.length) continue;
    values.forEach((value) => assigned.add(value.name));
    groups.push({label, values});
  }
  if (!groups.length) return ungrouped;

  const rest = option.optionValues.filter((value) => !assigned.has(value.name));
  if (rest.length) groups.push({label: option.name, values: rest});
  return groups;
}

/**
 * Option pickers. Options with swatches render round colour swatches
 * (grouped when the product has swatch groups); other options render pills.
 * Buttons navigate to the variant with a replace navigation so the URL stays
 * shareable, combined-listing values render as links.
 */
export function VariantSelector({
  productOptions,
  swatchGroups,
  className,
}: {
  productOptions: MappedProductOptions[];
  swatchGroups?: SwatchGroups | null;
  className?: string;
}) {
  const navigate = useNavigate();
  const id = useId();
  const options = productOptions.filter(
    (option) => option.optionValues.length > 1,
  );
  if (!options.length) return null;

  return (
    <div className={`variant-selector ${className ?? ''}`.trim()}>
      {options.map((option, optionIndex) => {
        const selected = option.optionValues.find((value) => value.selected);
        const isSwatch = option.optionValues.some((value) =>
          hasSwatch(value.swatch),
        );
        const groups = isSwatch
          ? groupOptionValues(option, swatchGroups)
          : [{label: null, values: option.optionValues}];
        const labelId = `${id}-option-${optionIndex}`;

        return (
          <div
            className="product-option"
            key={option.name}
            role="group"
            aria-labelledby={labelId}
          >
            <p className="product-option__label" id={labelId}>
              <span className="product-option__prefix">
                Select {option.name}:
              </span>{' '}
              <span className="product-option__value">{selected?.name}</span>
            </p>
            {groups.map((group) => (
              <div className="product-option__group" key={group.label ?? 'all'}>
                {group.label ? (
                  <p className="product-option__group-label">{group.label}</p>
                ) : null}
                <div
                  className={`product-option__values ${
                    isSwatch ? 'product-option__values--swatches' : ''
                  }`.trim()}
                >
                  {group.values.map((value) => (
                    <OptionValueControl
                      key={option.name + value.name}
                      value={value}
                      isSwatch={isSwatch}
                      onSelect={() => {
                        if (!value.selected) {
                          void navigate(`?${value.variantUriQuery}`, {
                            replace: true,
                            preventScrollReset: true,
                          });
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function OptionValueControl({
  value,
  isSwatch,
  onSelect,
}: {
  value: OptionValue;
  isSwatch: boolean;
  onSelect: () => void;
}) {
  const {
    name,
    handle,
    variantUriQuery,
    selected,
    available,
    exists,
    isDifferentProduct,
    swatch,
  } = value;
  const className = [
    isSwatch ? 'swatch' : 'option-pill',
    selected ? 'is-selected' : '',
    available ? '' : 'is-unavailable',
  ]
    .filter(Boolean)
    .join(' ');
  const accessibleName = available ? name : `${name} (sold out)`;
  const content = isSwatch ? (
    <SwatchDot swatch={swatch} />
  ) : (
    <span className="option-pill__label">{name}</span>
  );

  if (isDifferentProduct) {
    // Combined listing child products live at another URL: render a real
    // link so search engines can crawl it.
    return (
      <Link
        className={className}
        prefetch="intent"
        preventScrollReset
        replace
        to={`/products/${handle}?${variantUriQuery}`}
        aria-current={selected ? 'true' : undefined}
        aria-label={accessibleName}
        title={name}
      >
        {content}
      </Link>
    );
  }

  // Variants of this product only change the search params: a button with a
  // JS navigation keeps bots from indexing duplicate URLs.
  return (
    <button
      type="button"
      className={className}
      aria-pressed={selected}
      aria-label={accessibleName}
      title={name}
      disabled={!exists}
      onClick={onSelect}
    >
      {content}
    </button>
  );
}

function SwatchDot({
  swatch,
}: {
  swatch?: Maybe<ProductOptionValueSwatch> | undefined;
}) {
  const image = swatch?.image?.previewImage?.url;
  const color = swatch?.color;
  return (
    <span
      className="swatch__dot"
      style={color ? {backgroundColor: color} : undefined}
    >
      {image ? <img src={image} alt="" /> : null}
    </span>
  );
}
