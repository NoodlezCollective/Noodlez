import type {FormEvent} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {StaticRouter} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {SearchFormPredictive} from './SearchFormPredictive';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  asideClose: vi.fn(),
  submit: vi.fn(),
  form: {props: undefined as undefined | Record<string, unknown>},
}));

vi.mock('react-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router')>();
  return {
    ...original,
    useNavigate: () => mocks.navigate,
    useFetcher: () => ({
      state: 'idle',
      data: undefined,
      submit: mocks.submit,
      Form: (props: Record<string, unknown>) => {
        mocks.form.props = props;
        return (
          <form className={String(props.className)}>
            {props.children as never}
          </form>
        );
      },
    }),
  };
});

vi.mock('./Aside', () => ({
  useAside: () => ({type: 'search', open: vi.fn(), close: mocks.asideClose}),
}));

type Args = Parameters<
  NonNullable<Parameters<typeof SearchFormPredictive>[0]['children']>
>[0];

/** Renders the form and returns the render prop arguments and the form props. */
function render(value: string) {
  let args: Args | undefined;
  const html = renderToStaticMarkup(
    <StaticRouter location="/">
      <SearchFormPredictive>
        {(received) => {
          args = received;
          return <input name="q" />;
        }}
      </SearchFormPredictive>
    </StaticRouter>,
  );
  if (!args) throw new Error('the render prop was not called');
  args.inputRef.current = {value} as HTMLInputElement;
  const onSubmit = mocks.form.props?.onSubmit as (
    event: FormEvent<HTMLFormElement>,
  ) => void;
  return {html, args, onSubmit};
}

function submitEvent() {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as FormEvent<HTMLFormElement>;
}

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.asideClose.mockReset();
  mocks.submit.mockReset();
  mocks.form.props = undefined;
});

describe('SearchFormPredictive', () => {
  it('renders the form with the predictive class and the children', () => {
    const {html} = render('');

    expect(html).toContain('class="predictive-search-form"');
    expect(html).toContain('<input name="q"/>');
    expect(mocks.form.props?.action).toBe('/search');
  });

  it('renders nothing when the children are not a render function', () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/">
        <SearchFormPredictive>{null}</SearchFormPredictive>
      </StaticRouter>,
    );

    expect(html).toBe('');
  });

  describe('goToSearch (the Search button)', () => {
    it('opens the search page for the typed term and closes the drawer', () => {
      const {args} = render('pillow');

      args.goToSearch();

      expect(mocks.navigate).toHaveBeenCalledWith('/search?q=pillow');
      expect(mocks.asideClose).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['a&b', '/search?q=a%26b'],
      ['cool pillow', '/search?q=cool%20pillow'],
      ['100% cotton', '/search?q=100%25%20cotton'],
      ['x=1#frag', '/search?q=x%3D1%23frag'],
      ['café 😴', '/search?q=caf%C3%A9%20%F0%9F%98%B4'],
      ['  padded  ', '/search?q=padded'],
    ])('encodes %j as %s', (term, expected) => {
      const {args} = render(term);

      args.goToSearch();

      expect(mocks.navigate).toHaveBeenCalledWith(expected);
    });

    it('opens the bare search page for an empty input', () => {
      const {args} = render('   ');

      args.goToSearch();

      expect(mocks.navigate).toHaveBeenCalledWith('/search');
    });
  });

  describe('submitting the form (Enter, mobile "Search" key)', () => {
    it('opens the search page for the typed term and closes the drawer', () => {
      const {onSubmit} = render('pillow');
      const event = submitEvent();

      onSubmit(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mocks.navigate).toHaveBeenCalledWith('/search?q=pillow');
      expect(mocks.asideClose).toHaveBeenCalledTimes(1);
    });

    it('encodes the term, so "a&b" searches for "a&b" and not "a"', () => {
      const {onSubmit} = render('a&b');

      onSubmit(submitEvent());

      expect(mocks.navigate).toHaveBeenCalledWith('/search?q=a%26b');
    });

    it.each(['', '   ', '\t'])(
      'does nothing for an empty input (%j)',
      (value) => {
        const {onSubmit} = render(value);
        const event = submitEvent();

        onSubmit(event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(mocks.navigate).not.toHaveBeenCalled();
        expect(mocks.asideClose).not.toHaveBeenCalled();
      },
    );

    it('never lets the browser submit the form itself', () => {
      const {onSubmit} = render('pillow');
      const event = submitEvent();

      onSubmit(event);

      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchResults (typing)', () => {
    it('asks the predictive endpoint for results', () => {
      const {args} = render('');

      args.fetchResults({target: {value: 'pillow'}} as never);

      expect(mocks.submit).toHaveBeenCalledWith(
        {q: 'pillow', limit: 5, predictive: true},
        {method: 'GET', action: '/search'},
      );
    });

    it('sends an empty term when the input is cleared', () => {
      const {args} = render('');

      args.fetchResults({target: {value: ''}} as never);

      expect(mocks.submit).toHaveBeenCalledWith(
        {q: '', limit: 5, predictive: true},
        {method: 'GET', action: '/search'},
      );
    });
  });
});
