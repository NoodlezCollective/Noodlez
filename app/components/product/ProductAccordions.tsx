import {Accordion, type AccordionItem} from '~/components/ui/Accordion';

/**
 * Overview (description), Materials and Care accordions. Items whose content
 * is missing are omitted.
 */
export function ProductAccordions({
  descriptionHtml,
  materials,
  care,
  className,
}: {
  descriptionHtml?: string | null;
  materials: string[];
  care: string[];
  className?: string;
}) {
  const items: AccordionItem[] = [];

  if (descriptionHtml?.trim()) {
    items.push({
      id: 'overview',
      title: 'Overview',
      content: (
        <div
          className="prose"
          dangerouslySetInnerHTML={{__html: descriptionHtml}}
        />
      ),
    });
  }
  if (materials.length) {
    items.push({
      id: 'materials',
      title: 'Materials',
      content: <Paragraphs lines={materials} />,
    });
  }
  if (care.length) {
    items.push({
      id: 'care',
      title: 'Care',
      content: <Paragraphs lines={care} />,
    });
  }

  if (!items.length) return null;
  return (
    <Accordion
      items={items}
      className={`product-accordions ${className ?? ''}`.trim()}
    />
  );
}

function Paragraphs({lines}: {lines: string[]}) {
  return (
    <div className="prose">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}
