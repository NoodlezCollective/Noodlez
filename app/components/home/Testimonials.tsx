import {Link} from 'react-router';
import {SectionHeading} from '~/components/ui/SectionHeading';
import {Stars} from '~/components/ui/Stars';
import type {TestimonialsContent} from '~/lib/content/types';

export function Testimonials({content}: {content: TestimonialsContent}) {
  if (!content.items.length) return null;
  return (
    <section className="section" aria-labelledby="reviews-heading" id="reviews">
      <div className="container">
        <SectionHeading
          id="reviews-heading"
          title={content.heading}
          subtitle={content.subheading}
        />
        <ul className="testimonials">
          {content.items.map((item) => (
            <li className="testimonial" key={item.id}>
              <Stars rating={item.rating} size="sm" />
              <blockquote className="testimonial__quote">“{item.quote}”</blockquote>
              <div className="testimonial__meta">
                <span className="testimonial__author">{item.author}</span>
                {item.productTitle ? (
                  item.productHandle ? (
                    <Link className="testimonial__product" to={`/products/${item.productHandle}`}>
                      {item.productTitle}
                    </Link>
                  ) : (
                    <span className="testimonial__product">{item.productTitle}</span>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
