import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type Ref,
} from 'react';
import {Link, useSubmit} from 'react-router';
import type {CollectionFilterFragment} from 'storefrontapi.generated';
import {Accordion, type AccordionItem} from '~/components/ui/Accordion';
import {Button} from '~/components/ui/Button';
import {CheckIcon, CloseIcon} from '~/components/ui/Icons';
import {
  FILTER_URL_PREFIX,
  REVERSE_PARAM,
  SORT_KEY_PARAM,
  clearFilterParams,
  countAppliedFilters,
  currencySymbol,
  filterInputToParam,
  getPriceFilter,
  isFilterValueActive,
  parseFilterInput,
  toPriceFilter,
  type PriceFilter,
} from '~/lib/collectionFilters';
import {useListingState, useOptimisticParams} from './useListingState';

type FilterValue = CollectionFilterFragment['values'][number];

type FilterPanelProps = {
  filters: CollectionFilterFragment[];
  currencyCode?: string;
  /** Id for the "Filters" heading so the containing region can be labelled. */
  headingId?: string;
  /** Closes the panel on small screens (renders close + "Show results"). */
  onClose?: () => void;
  closeButtonRef?: Ref<HTMLButtonElement>;
};

/** Preferred display order: availability, price, product type, swatches, rest. */
const GROUP_ORDER: Record<string, number> = {
  'filter.v.availability': 0,
  'filter.v.price': 1,
  'filter.p.product_type': 2,
};

function groupRank(filter: CollectionFilterFragment) {
  return GROUP_ORDER[filter.id] ?? (filter.presentation === 'SWATCH' ? 3 : 4);
}

function activeCountInGroup(
  filter: CollectionFilterFragment,
  params: URLSearchParams,
) {
  if (filter.type === 'PRICE_RANGE') return getPriceFilter(params) ? 1 : 0;
  return filter.values.filter((value) =>
    isFilterValueActive(params, value.input),
  ).length;
}

/**
 * Collection filters as a native GET form. Checkbox changes submit the form
 * immediately (the URL is the single source of truth); the price range is
 * applied with its button or the Enter key.
 */
export function FilterPanel({
  filters,
  currencyCode = 'USD',
  headingId,
  onClose,
  closeButtonRef,
}: FilterPanelProps) {
  const submit = useSubmit();
  const uid = useId();
  const {params: urlParams, pathname} = useListingState();
  const [params, setOptimisticParams] = useOptimisticParams(urlParams);
  const sortKey = params.get(SORT_KEY_PARAM);
  const reverse = params.get(REVERSE_PARAM);
  const activeCount = countAppliedFilters(params);
  const clearSearch = clearFilterParams(params).toString();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [clearing, setClearing] = useState(false);

  // "Clear all" unmounts itself once no filter is left, which would drop
  // focus to <body>: keep it in the panel, on its heading.
  useEffect(() => {
    if (!clearing || activeCount > 0) return;
    setClearing(false);
    const active = document.activeElement;
    if (!active || active === document.body) titleRef.current?.focus();
  }, [clearing, activeCount]);

  function submitForm(form: HTMLFormElement) {
    const data = new FormData(form);
    const next = new URLSearchParams();
    let min: string | undefined;
    let max: string | undefined;
    for (const [name, value] of data.entries()) {
      if (typeof value !== 'string') continue;
      if (name === 'price_min') {
        min = value;
      } else if (name === 'price_max') {
        max = value;
      } else if (
        name.startsWith(FILTER_URL_PREFIX) ||
        name === SORT_KEY_PARAM ||
        name === REVERSE_PARAM
      ) {
        next.append(name, value);
      }
    }
    const price = toPriceFilter(min, max);
    if (price) next.set(`${FILTER_URL_PREFIX}price`, JSON.stringify(price));
    setOptimisticParams(next);
    void submit(next, {
      method: 'get',
      action: pathname,
      preventScrollReset: true,
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitForm(event.currentTarget);
  }

  function handleOptionChange(event: FormEvent<HTMLInputElement>) {
    const form = event.currentTarget.form;
    if (form) submitForm(form);
  }

  const groups = filters
    .filter((filter) => filter.values.length > 0)
    .map((filter, index) => ({filter, index}))
    .sort(
      (a, b) => groupRank(a.filter) - groupRank(b.filter) || a.index - b.index,
    )
    .map(({filter}) => filter);

  const items: AccordionItem[] = groups.map((filter) => {
    const count = activeCountInGroup(filter, params);
    let content;
    if (filter.type === 'PRICE_RANGE') {
      content = (
        <PriceRangeFields
          filter={filter}
          uid={uid}
          currencyCode={currencyCode}
          price={getPriceFilter(params)}
        />
      );
    } else if (filter.presentation === 'SWATCH') {
      content = (
        <SwatchOptions
          filter={filter}
          uid={uid}
          params={params}
          onChange={handleOptionChange}
        />
      );
    } else {
      content = (
        <ListOptions
          filter={filter}
          uid={uid}
          params={params}
          onChange={handleOptionChange}
        />
      );
    }
    return {
      id: filter.id,
      defaultOpen: true,
      title: (
        <>
          {filter.label}
          {count ? <span className="filters__badge">{count}</span> : null}
        </>
      ),
      content,
    };
  });

  return (
    <form
      className="filters"
      method="get"
      action={pathname}
      onSubmit={handleSubmit}
    >
      <div className="filters__header">
        <h2
          className="filters__title"
          id={headingId}
          ref={titleRef}
          tabIndex={-1}
        >
          Filters
          {activeCount ? (
            <span className="filters__badge">{activeCount}</span>
          ) : null}
        </h2>
        <div className="filters__header-actions">
          {activeCount ? (
            <Link
              className="filters__clear link"
              to={{pathname, search: clearSearch ? `?${clearSearch}` : ''}}
              preventScrollReset
              onClick={() => setClearing(true)}
            >
              Clear all
            </Link>
          ) : null}
          {onClose ? (
            <button
              className="icon-btn filters__close"
              type="button"
              onClick={onClose}
              aria-label="Close filters"
              ref={closeButtonRef}
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>
      </div>
      {sortKey ? (
        <input type="hidden" name={SORT_KEY_PARAM} value={sortKey} />
      ) : null}
      {reverse ? (
        <input type="hidden" name={REVERSE_PARAM} value={reverse} />
      ) : null}
      <Accordion className="filters__groups" items={items} />
      {onClose ? (
        <div className="filters__footer">
          <Button type="button" block onClick={onClose}>
            Show results
          </Button>
        </div>
      ) : null}
    </form>
  );
}

type OptionsProps = {
  filter: CollectionFilterFragment;
  uid: string;
  params: URLSearchParams;
  onChange: (event: FormEvent<HTMLInputElement>) => void;
};

function optionInputId(uid: string, value: FilterValue) {
  return `${uid}-${value.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function ListOptions({filter, uid, params, onChange}: OptionsProps) {
  return (
    <ul className="filter-options">
      {filter.values.map((value) => {
        const param = filterInputToParam(value.input);
        if (!param) return null;
        const inputId = optionInputId(uid, value);
        return (
          <li key={value.id}>
            <label className="filter-option" htmlFor={inputId}>
              <input
                id={inputId}
                type="checkbox"
                name={param.name}
                value={param.value}
                checked={params.getAll(param.name).includes(param.value)}
                onChange={onChange}
              />
              <span className="filter-option__label">{value.label}</span>
              <span className="filter-option__count">
                {value.count}
                <span className="sr-only">
                  {value.count === 1 ? ' product' : ' products'}
                </span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function SwatchOptions({filter, uid, params, onChange}: OptionsProps) {
  return (
    <ul className="swatch-options">
      {filter.values.map((value) => {
        const param = filterInputToParam(value.input);
        if (!param) return null;
        const inputId = optionInputId(uid, value);
        const style = value.swatch?.color
          ? ({'--swatch-color': value.swatch.color} as CSSProperties)
          : undefined;
        return (
          <li key={value.id}>
            <label className="swatch-option" htmlFor={inputId}>
              <input
                id={inputId}
                className="swatch-option__input sr-only"
                type="checkbox"
                name={param.name}
                value={param.value}
                checked={params.getAll(param.name).includes(param.value)}
                onChange={onChange}
              />
              <span
                className="swatch-option__dot"
                style={style}
                aria-hidden="true"
              >
                <CheckIcon className="swatch-option__check" size={14} />
              </span>
              <span className="swatch-option__label">{value.label}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function parsePriceRange(filter: CollectionFilterFragment): PriceFilter {
  const parsed = parseFilterInput(filter.values[0]?.input) as {
    price?: PriceFilter;
  } | null;
  return parsed?.price ?? {};
}

function PriceRangeFields({
  filter,
  uid,
  currencyCode,
  price,
}: {
  filter: CollectionFilterFragment;
  uid: string;
  currencyCode: string;
  price: PriceFilter | null;
}) {
  const range = parsePriceRange(filter);
  const symbol = currencySymbol(currencyCode);
  const appliedMin = price?.min?.toString() ?? '';
  const appliedMax = price?.max?.toString() ?? '';
  const [min, setMin] = useState(appliedMin);
  const [max, setMax] = useState(appliedMax);

  // Keep the inputs in sync when the price filter changes from elsewhere
  // (chip removal, "Clear all", back/forward navigation).
  useEffect(() => setMin(appliedMin), [appliedMin]);
  useEffect(() => setMax(appliedMax), [appliedMax]);

  const minId = `${uid}-price-min`;
  const maxId = `${uid}-price-max`;
  return (
    <div className="price-filter">
      <div className="price-filter__fields">
        <div className="price-filter__field">
          <label htmlFor={minId}>Min</label>
          <div className="price-filter__input">
            <span className="price-filter__symbol" aria-hidden="true">
              {symbol}
            </span>
            <input
              id={minId}
              type="number"
              inputMode="decimal"
              name="price_min"
              min={0}
              step="1"
              placeholder={String(range.min ?? 0)}
              value={min}
              onChange={(event) => setMin(event.target.value)}
            />
          </div>
        </div>
        <span className="price-filter__separator" aria-hidden="true">
          –
        </span>
        <div className="price-filter__field">
          <label htmlFor={maxId}>Max</label>
          <div className="price-filter__input">
            <span className="price-filter__symbol" aria-hidden="true">
              {symbol}
            </span>
            <input
              id={maxId}
              type="number"
              inputMode="decimal"
              name="price_max"
              min={0}
              step="1"
              placeholder={range.max !== undefined ? String(range.max) : 'Any'}
              value={max}
              onChange={(event) => setMax(event.target.value)}
            />
          </div>
        </div>
      </div>
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        className="price-filter__apply"
      >
        Apply price
      </Button>
    </div>
  );
}
