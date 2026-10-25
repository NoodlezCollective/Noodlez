import {useId, type ChangeEvent} from 'react';
import {useNavigate} from 'react-router';
import {ChevronDownIcon} from '~/components/ui/Icons';
import {
  applySortParams,
  getSortOption,
  type SortOption,
} from '~/lib/collectionFilters';
import {useListingState, useOptimisticParams} from './useListingState';

/**
 * Pill shaped sort <select> driven by the `sort_key` / `reverse` URL params.
 * Changing it navigates in place (scroll position is kept).
 */
export function SortSelect({
  options,
  className,
}: {
  options: SortOption[];
  className?: string;
}) {
  const id = useId();
  const navigate = useNavigate();
  const {params: urlParams, pathname} = useListingState();
  const [params, setOptimisticParams] = useOptimisticParams(urlParams);
  const active = getSortOption(params, options);

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const option = options.find(
      ({id: optionId}) => optionId === event.target.value,
    );
    if (!option) return;
    const next = applySortParams(params, option, options);
    setOptimisticParams(next);
    const search = next.toString();
    void navigate(
      {pathname, search: search ? `?${search}` : ''},
      {preventScrollReset: true},
    );
  }

  return (
    <div className={`sort-select ${className ?? ''}`.trim()}>
      <label className="sort-select__label" htmlFor={id}>
        Sort by
      </label>
      <div className="sort-select__control">
        <select id={id} name="sort" value={active.id} onChange={handleChange}>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="sort-select__icon" size={16} />
      </div>
    </div>
  );
}
