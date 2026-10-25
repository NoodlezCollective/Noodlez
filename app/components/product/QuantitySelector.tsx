import {useEffect, useId, useState} from 'react';
import {MinusIcon, PlusIcon} from '~/components/ui/Icons';

/**
 * Pill shaped −/+ quantity control with a numeric input (never below `min`).
 */
export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max,
  label = 'Quantity',
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  className?: string;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const clamp = (next: number) =>
    Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, next));
  // The buttons are `aria-disabled` at the bounds instead of `disabled`: a
  // disabled button cannot keep focus, so reaching the limit with the keyboard
  // would drop focus to <body>.
  const atMinimum = value <= min;
  const atMaximum = max !== undefined && value >= max;

  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    const next = Number.isFinite(parsed) ? clamp(parsed) : min;
    setText(String(next));
    onChange(next);
  };

  return (
    <div className={`quantity ${className ?? ''}`.trim()}>
      <label className="quantity__label" htmlFor={id}>
        {label}
      </label>
      <div className="quantity__control">
        <button
          type="button"
          className="quantity__button"
          aria-label="Decrease quantity"
          aria-disabled={atMinimum || undefined}
          onClick={() => {
            if (!atMinimum) onChange(clamp(value - 1));
          }}
        >
          <MinusIcon size={16} />
        </button>
        <input
          id={id}
          className="quantity__input"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => commit(text)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(text);
            }
          }}
        />
        <button
          type="button"
          className="quantity__button"
          aria-label="Increase quantity"
          aria-disabled={atMaximum || undefined}
          onClick={() => {
            if (!atMaximum) onChange(clamp(value + 1));
          }}
        >
          <PlusIcon size={16} />
        </button>
      </div>
    </div>
  );
}
