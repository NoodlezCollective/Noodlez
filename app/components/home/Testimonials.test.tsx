import {renderToStaticMarkup} from 'react-dom/server';
import {StaticRouter} from 'react-router';
import {describe, expect, it} from 'vitest';
import {DEFAULT_HOME_CONTENT} from '~/lib/content/defaults';
import type {Testimonial, TestimonialsContent} from '~/lib/content/types';
import {Testimonials} from './Testimonials';

function item(overrides: Partial<Testimonial> = {}): Testimonial {
  return {
    id: 't-1',
    quote: 'Best sleep in years.',
    author: 'Jenna R.',
    rating: 5,
    productTitle: null,
    productHandle: null,
    ...overrides,
  };
}

function render(items: Testimonial[]) {
  const content: TestimonialsContent = {
    heading: 'Loved By Sleepers',
    subheading: 'Real reviews.',
    items,
  };
  return renderToStaticMarkup(
    <StaticRouter location="/">
      <Testimonials content={content} />
    </StaticRouter>,
  );
}

const countStars = (html: string) => html.match(/class="stars /g)?.length ?? 0;

describe('Testimonials', () => {
  it('shows the star rating of a testimonial that has one', () => {
    // Act
    const html = render([item({rating: 4.5})]);

    // Assert
    expect(countStars(html)).toBe(1);
    expect(html).toContain('aria-label="Rated 4.5 out of 5"');
  });

  it('shows no stars and no rating text when the rating is null', () => {
    // Arrange + Act
    const html = render([item({rating: null})]);

    // Assert
    expect(countStars(html)).toBe(0);
    expect(html).not.toContain('Rated');
    expect(html).not.toContain('out of 5');
    expect(html).not.toContain('role="img"');
  });

  it('still renders the quote and author without a rating', () => {
    const html = render([item({rating: null})]);

    expect(html).toContain('“Best sleep in years.”');
    expect(html).toContain('Jenna R.');
  });

  it('does not invent stars for a rating that is missing altogether', () => {
    const html = render([item({rating: undefined as unknown as null})]);

    expect(countStars(html)).toBe(0);
  });

  it('keeps a genuine zero rating visible', () => {
    const html = render([item({rating: 0})]);

    expect(countStars(html)).toBe(1);
    expect(html).toContain('aria-label="Rated 0.0 out of 5"');
  });

  it('only gives stars to the testimonials that are rated', () => {
    const html = render([
      item({id: 'a', rating: 5}),
      item({id: 'b', rating: null}),
      item({id: 'c', rating: 3}),
    ]);

    expect(countStars(html)).toBe(2);
    expect((html.match(/class="testimonial"/g) ?? []).length).toBe(3);
  });

  it('links the product when both title and handle are known', () => {
    const html = render([
      item({productTitle: 'CloudAlign Pillow', productHandle: 'cloudalign'}),
    ]);

    expect(html).toContain('href="/products/cloudalign"');
    expect(html).toContain('CloudAlign Pillow');
  });

  it('shows a product title without a link when there is no handle', () => {
    const html = render([item({productTitle: 'CloudAlign Pillow'})]);

    expect(html).toContain('CloudAlign Pillow');
    expect(html).not.toContain('href=');
  });

  it('renders nothing without testimonials', () => {
    expect(render([])).toBe('');
  });

  it('renders the documented default content with all of its stars', () => {
    // Arrange
    const defaults = DEFAULT_HOME_CONTENT.testimonials.items;

    // Act
    const html = render(defaults);

    // Assert: the placeholder content carries explicit ratings.
    expect(defaults.every((entry) => typeof entry.rating === 'number')).toBe(
      true,
    );
    expect(countStars(html)).toBe(defaults.length);
  });
});
