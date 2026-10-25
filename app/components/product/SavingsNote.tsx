import {useEffect, useId, useRef, useState} from 'react';

/**
 * "Savings based on comparable value. Learn more" with a popover style
 * disclosure that explains how compare-at prices are calculated.
 */
export function SavingsNote({
  note,
  explanation,
  className,
}: {
  note: string;
  explanation: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    document.addEventListener(
      'keydown',
      (event: KeyboardEvent) => {
        if (event.key === 'Escape') setOpen(false);
      },
      {signal: controller.signal},
    );
    document.addEventListener(
      'pointerdown',
      (event: PointerEvent) => {
        if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
      },
      {signal: controller.signal},
    );
    return () => controller.abort();
  }, [open]);

  return (
    <div className={`savings-note ${className ?? ''}`.trim()} ref={rootRef}>
      <p className="savings-note__text">
        {note}{' '}
        <button
          type="button"
          className="savings-note__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          Learn more
        </button>
      </p>
      <div
        id={panelId}
        className="savings-note__panel"
        role="note"
        hidden={!open}
      >
        <p>{explanation}</p>
      </div>
    </div>
  );
}
