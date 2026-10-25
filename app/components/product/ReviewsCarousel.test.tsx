import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {ProductReview} from '~/lib/content/types';
import {ReviewsCarousel} from './ReviewsCarousel';

function review(overrides: Partial<ProductReview> = {}): ProductReview {
  return {
    id: 'r-1',
    rating: 5,
    title: 'Finally, no neck pain',
    body: 'I wake up without neck pain.',
    author: 'Jenna R.',
    verified: true,
    date: '2026-09-12',
    ...overrides,
  };
}

const render = (reviews: ProductReview[]) =>
  renderToStaticMarkup(<ReviewsCarousel reviews={reviews} />);

const countStars = (html: string) => html.match(/class="stars /g)?.length ?? 0;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('ReviewsCarousel', () => {
  it('renders nothing without reviews', () => {
    expect(render([])).toBe('');
  });

  describe('rating', () => {
    it('shows the stars of a rated review', () => {
      const html = render([review({rating: 4})]);

      expect(countStars(html)).toBe(1);
      expect(html).toContain('aria-label="Rated 4.0 out of 5"');
    });

    it('shows no stars and no rating text when the rating is null', () => {
      const html = render([review({rating: null})]);

      expect(countStars(html)).toBe(0);
      expect(html).not.toContain('Rated');
      expect(html).not.toContain('out of 5');
      expect(html).not.toContain('role="img"');
    });

    it('does not invent stars for a rating that is missing altogether', () => {
      const html = render([review({rating: undefined as unknown as null})]);

      expect(countStars(html)).toBe(0);
    });

    it('keeps the rest of the review when the rating is null', () => {
      const html = render([review({rating: null})]);

      expect(html).toContain('Finally, no neck pain');
      expect(html).toContain('I wake up without neck pain.');
      expect(html).toContain('Jenna R.');
    });
  });

  describe('verified badge', () => {
    it('shows "Verified buyer" for a verified review', () => {
      expect(render([review({verified: true})])).toContain('Verified buyer');
    });

    it('does not show it for an unverified review', () => {
      expect(render([review({verified: false})])).not.toContain(
        'Verified buyer',
      );
    });
  });

  describe('date', () => {
    it('formats a date-only value as that calendar day', () => {
      const html = render([review({date: '2026-09-12'})]);

      expect(html).toContain('dateTime="2026-09-12"');
      expect(html).toContain('>Sep 12, 2026</time>');
    });

    it.each([
      'UTC',
      'America/Los_Angeles',
      'Pacific/Auckland',
      'Pacific/Pago_Pago',
    ])('renders the same text in %s (no hydration mismatch)', (zone) => {
      // Arrange: the server renders in UTC, the browser in its own zone.
      vi.stubEnv('TZ', zone);

      // Act
      const html = render([review({date: '2026-09-12'})]);

      // Assert
      expect(html).toContain('>Sep 12, 2026</time>');
      expect(html).not.toContain('Sep 11');
    });

    it('renders a timestamp as its UTC calendar day', () => {
      vi.stubEnv('TZ', 'America/Los_Angeles');

      const html = render([review({date: '2026-09-12T03:30:00Z'})]);

      expect(html).toContain('>Sep 12, 2026</time>');
    });

    it.each([null, undefined, '', 'not a date'])(
      'omits the date element for %j',
      (date) => {
        const html = render([review({date})]);

        expect(html).not.toContain('<time');
        expect(html).not.toContain('not a date');
      },
    );
  });

  it('shows the controls only when there is more than one review', () => {
    const single = render([review({id: 'a'})]);
    const several = render([review({id: 'a'}), review({id: 'b'})]);

    expect(single).not.toContain('Next review');
    expect(several).toContain('Next review');
    expect(several).toContain('Previous review');
    expect(several).toContain('Review 1 of 2');
  });
});
