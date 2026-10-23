import type {ReactNode} from 'react';
import {PlusIcon} from './Icons';

export type AccordionItem = {
  id: string;
  title: ReactNode;
  content: ReactNode;
  defaultOpen?: boolean;
};

/**
 * Accessible accordion built on native <details>/<summary>.
 * The plus icon rotates into a minus when open (see app.css).
 */
export function Accordion({
  items,
  className,
}: {
  items: AccordionItem[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <div className={`accordion ${className ?? ''}`.trim()}>
      {items.map((item) => (
        <details
          className="accordion__item"
          key={item.id}
          open={item.defaultOpen}
        >
          <summary className="accordion__summary">
            <span className="accordion__title">{item.title}</span>
            <span className="accordion__icon" aria-hidden="true">
              <PlusIcon size={16} />
            </span>
          </summary>
          <div className="accordion__panel">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
