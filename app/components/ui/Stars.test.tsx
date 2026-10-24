import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Stars} from './Stars';

describe('Stars', () => {
  it('renders nothing without a rating', () => {
    expect(renderToStaticMarkup(<Stars rating={null} />)).toBe('');
    expect(renderToStaticMarkup(<Stars />)).toBe('');
    expect(renderToStaticMarkup(<Stars rating={Number.NaN} />)).toBe('');
  });

  it('labels the rating and the review count', () => {
    const html = renderToStaticMarkup(<Stars rating={4.9} count={51644} />);
    expect(html).toContain(
      'aria-label="Rated 4.9 out of 5 from 51,644 reviews"',
    );
    expect(html).toContain('(51,644)');
  });

  it('clamps ratings to the scale', () => {
    expect(renderToStaticMarkup(<Stars rating={7} />)).toContain(
      'Rated 5.0 out of 5',
    );
    expect(renderToStaticMarkup(<Stars rating={-1} />)).toContain(
      'Rated 0.0 out of 5',
    );
  });
});
