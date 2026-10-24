import type {ReactElement, ReactNode} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ProductReview} from '~/lib/content/types';
import {ReviewsCarousel} from './ReviewsCarousel';

// The carousel's navigation lives in event handlers, which a server render
// never runs. Replace the state hook so the element tree can be inspected and
// its handlers called directly.
const mocks = vi.hoisted(() => ({index: 0, setIndex: vi.fn()}));

vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>();
  return {
    ...original,
    useState: () => [mocks.index, mocks.setIndex],
    useId: () => 'carousel',
  };
});

function reviews(count: number): ProductReview[] {
  return Array.from({length: count}, (_, i) => ({
    id: `r-${i}`,
    rating: 5,
    title: `Title ${i}`,
    body: `Body ${i}`,
    author: `Author ${i}`,
    verified: true,
    date: null,
  }));
}

/** Every React element below `node`, depth first. */
function elements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) {
    return (node as ReactNode[]).flatMap((child) => elements(child));
  }
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const element = node as ReactElement<{children?: ReactNode}>;
  return [element, ...elements(element.props.children)];
}

function render(count: number) {
  const tree = ReviewsCarousel({reviews: reviews(count)});
  const all = elements(tree);
  const byLabel = (label: string) =>
    all.find(
      (element) =>
        (element.props as {'aria-label'?: string})['aria-label'] === label,
    );
  const click = (element: ReactElement | undefined) => {
    const onClick = (element?.props as {onClick?: () => void} | undefined)
      ?.onClick;
    if (!onClick) throw new Error('no click handler found');
    onClick();
  };
  return {tree, all, byLabel, click};
}

beforeEach(() => {
  mocks.index = 0;
  mocks.setIndex.mockReset();
});

describe('ReviewsCarousel navigation', () => {
  it('renders nothing without reviews', () => {
    expect(ReviewsCarousel({reviews: []})).toBeNull();
  });

  describe('previous and next', () => {
    it.each([
      [0, 1],
      [1, 2],
      [2, 0],
    ])('"Next" moves from slide %d to %d, wrapping at the end', (from, to) => {
      const {byLabel, click} = render(3);

      click(byLabel('Next review'));

      const update = mocks.setIndex.mock.calls[0][0] as (v: number) => number;
      expect(update(from)).toBe(to);
    });

    it.each([
      [2, 1],
      [1, 0],
      [0, 2],
    ])(
      '"Previous" moves from slide %d to %d, wrapping at the start',
      (from, to) => {
        const {byLabel, click} = render(3);

        click(byLabel('Previous review'));

        const update = mocks.setIndex.mock.calls[0][0] as (v: number) => number;
        expect(update(from)).toBe(to);
      },
    );
  });

  describe('dots', () => {
    it('has one dot per review and jumps to the chosen one', () => {
      const {byLabel, click} = render(4);

      click(byLabel('Go to review 3'));

      expect(byLabel('Go to review 4')).toBeDefined();
      expect(byLabel('Go to review 5')).toBeUndefined();
      expect(mocks.setIndex).toHaveBeenCalledWith(2);
    });

    it('marks only the current dot', () => {
      mocks.index = 1;
      const {byLabel} = render(3);

      const current = (label: string) =>
        (byLabel(label)?.props as {'aria-current'?: string})['aria-current'];
      expect(current('Go to review 1')).toBeUndefined();
      expect(current('Go to review 2')).toBe('true');
      expect(current('Go to review 3')).toBeUndefined();
    });
  });

  describe('current slide', () => {
    it('is announced as "n of total"', () => {
      mocks.index = 1;
      const {byLabel} = render(3);

      expect(byLabel('Review 2 of 3')).toBeDefined();
    });

    it('stays on the last review when the list shrinks below the index', () => {
      mocks.index = 7;
      const {byLabel} = render(2);

      expect(byLabel('Review 2 of 2')).toBeDefined();
    });
  });

  it('has no controls for a single review', () => {
    const {byLabel} = render(1);

    expect(byLabel('Next review')).toBeUndefined();
    expect(byLabel('Previous review')).toBeUndefined();
  });
});
