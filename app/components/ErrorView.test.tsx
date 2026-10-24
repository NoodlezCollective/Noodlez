import {renderToStaticMarkup} from 'react-dom/server';
import {
  StaticRouterProvider,
  createStaticHandler,
  createStaticRouter,
} from 'react-router';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {RouteErrorBoundary} from './ErrorView';

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Renders a route whose loader threw `thrown`, using the shared boundary. */
async function renderThrown(thrown: unknown) {
  const handler = createStaticHandler([
    {
      path: '/',
      Component: () => null,
      ErrorBoundary: RouteErrorBoundary,
      loader: () => {
        throw thrown;
      },
    },
  ]);
  const context = await handler.query(new Request('https://mellow.example/'));
  if (context instanceof Response) throw new Error('unexpected response');
  const router = createStaticRouter(handler.dataRoutes, context);
  return renderToStaticMarkup(
    <StaticRouterProvider router={router} context={context} hydrate={false} />,
  );
}

describe('RouteErrorBoundary', () => {
  it('renders the designed not found view for a thrown 404', async () => {
    // Act
    const html = await renderThrown(
      new Response('Collection nope not found', {status: 404}),
    );

    // Assert
    expect(html).toContain(
      '<p class="route-error__code" aria-hidden="true">404</p>',
    );
    expect(html).toContain('<h1>We couldn’t find that page</h1>');
    expect(html).toContain('Back to home');
    expect(html).toContain('href="/collections/all"');
    // A 404 is an expected outcome: its body is never printed.
    expect(html).not.toContain('<pre>');
  });

  it('renders the generic view and the response body for other statuses', async () => {
    // Act
    const html = await renderThrown(new Response('Bad gateway', {status: 502}));

    // Assert
    expect(html).toContain(
      '<p class="route-error__code" aria-hidden="true">502</p>',
    );
    expect(html).toContain('<h1>Something went wrong</h1>');
    expect(html).toContain('<pre>Bad gateway</pre>');
  });

  it('treats a thrown Error as a 500 and escapes its message', async () => {
    // Act
    const html = await renderThrown(new Error('boom <b>'));

    // Assert
    expect(html).toContain(
      '<p class="route-error__code" aria-hidden="true">500</p>',
    );
    expect(html).toContain('<pre>boom &lt;b&gt;</pre>');
  });

  it('shows no message for a thrown value that is not an Error', async () => {
    // Act
    const html = await renderThrown('plain string');

    // Assert
    expect(html).toContain('<h1>Something went wrong</h1>');
    expect(html).not.toContain('<pre>');
  });

  it('keeps messages out of production builds', async () => {
    // Arrange
    vi.stubEnv('DEV', false);

    // Act
    const html = await renderThrown(new Error('secret detail'));

    // Assert
    expect(html).toContain('<h1>Something went wrong</h1>');
    expect(html).not.toContain('secret detail');
  });
});
