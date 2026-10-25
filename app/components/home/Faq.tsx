import {Accordion} from '~/components/ui/Accordion';
import {SectionHeading} from '~/components/ui/SectionHeading';
import type {FaqContent} from '~/lib/content/types';

export function Faq({content}: {content: FaqContent}) {
  if (!content.items.length) return null;
  return (
    <section className="section section--tight" aria-labelledby="faq-heading" id="faq">
      <div className="container faq">
        <SectionHeading id="faq-heading" title={content.heading} />
        <Accordion
          items={content.items.map((item) => ({
            id: item.id,
            title: item.question,
            content: <p>{item.answer}</p>,
          }))}
        />
      </div>
    </section>
  );
}
