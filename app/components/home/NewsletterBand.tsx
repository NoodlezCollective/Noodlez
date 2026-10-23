import {NewsletterForm} from '~/components/NewsletterForm';
import type {NewsletterContent} from '~/lib/content/types';

export function NewsletterBand({content}: {content: NewsletterContent}) {
  return (
    <section className="section section--tight" aria-labelledby="newsletter-heading">
      <div className="container">
        <div className="newsletter-band">
          <div>
            <h2 id="newsletter-heading">{content.heading}</h2>
            <p className="newsletter-band__body">{content.body}</p>
          </div>
          <NewsletterForm
            id="home"
            source="homepage"
            placeholder={content.placeholder}
            ctaLabel={content.ctaLabel}
          />
        </div>
      </div>
    </section>
  );
}
