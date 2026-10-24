import {renderToStaticMarkup} from 'react-dom/server';
import {
  StaticRouterProvider,
  createStaticHandler,
  createStaticRouter,
} from 'react-router';
import {describe, expect, it} from 'vitest';
import {SearchForm} from './SearchForm';

/** `Form` needs a data router, so render inside a static one. */
async function render(node: React.ReactNode) {
  const handler = createStaticHandler([
    {path: '/search', Component: () => node},
  ]);
  const context = await handler.query(
    new Request('https://mellow.example/search'),
  );
  if (context instanceof Response) throw new Error('unexpected redirect');
  const router = createStaticRouter(handler.dataRoutes, context);
  return renderToStaticMarkup(
    <StaticRouterProvider router={router} context={context} hydrate={false} />,
  );
}

describe('SearchForm', () => {
  it('renders a GET search form around the children', async () => {
    const html = await render(
      <SearchForm className="search-form">
        {({inputRef}) => <input ref={inputRef} name="q" type="search" />}
      </SearchForm>,
    );

    expect(html).toContain('method="get"');
    expect(html).toContain('role="search"');
    expect(html).toContain('class="search-form"');
    expect(html).toContain('<input name="q" type="search"/>');
  });

  it('passes extra props on to the form', async () => {
    const html = await render(
      <SearchForm id="main-search" aria-label="Site search">
        {() => null}
      </SearchForm>,
    );

    expect(html).toContain('id="main-search"');
    expect(html).toContain('aria-label="Site search"');
  });

  it('renders nothing when the children are not a render function', async () => {
    const html = await render(
      <SearchForm>{null as unknown as () => React.ReactNode}</SearchForm>,
    );

    expect(html).toBe('');
  });
});
