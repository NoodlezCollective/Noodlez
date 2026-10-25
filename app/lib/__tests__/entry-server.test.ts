import {describe, expect, it, vi} from 'vitest';

// The document body is irrelevant here; only the headers `handleRequest` sets.
vi.mock('react-dom/server', () => ({
  renderToReadableStream: vi.fn(async () =>
    Object.assign(new ReadableStream(), {allReady: Promise.resolve()}),
  ),
}));

import type {EntryContext} from 'react-router';
import handleRequest from '../../entry.server';

async function render(status = 200) {
  const response = await handleRequest(
    new Request('https://shop.example/', {
      headers: {'user-agent': 'Mozilla/5.0'},
    }),
    status,
    new Headers(),
    {} as EntryContext,
    {
      env: {
        PUBLIC_CHECKOUT_DOMAIN: 'checkout.shop.example',
        PUBLIC_STORE_DOMAIN: 'mellow.myshopify.com',
      },
    } as never,
  );
  return response;
}

/** The sources listed for one CSP directive, e.g. `form-action`. */
function directive(csp: string, name: string): string[] | undefined {
  const entry = csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
  return entry?.split(/\s+/).slice(1);
}

describe('entry.server response headers', () => {
  it('forbids plugins and embedded objects', async () => {
    const csp = (await render()).headers.get('Content-Security-Policy')!;
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
  });

  it('restricts form targets to this origin (and Shopify sign-out)', async () => {
    const csp = (await render()).headers.get('Content-Security-Policy')!;
    expect(directive(csp, 'form-action')).toEqual([
      "'self'",
      'https://shopify.com',
    ]);
  });

  it('keeps the existing protections and allowances', async () => {
    const csp = (await render()).headers.get('Content-Security-Policy')!;

    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
    expect(directive(csp, 'default-src')).toEqual(
      expect.arrayContaining([
        "'self'",
        expect.stringMatching(/^'nonce-[\w-]+'$/),
      ]),
    );
    expect(directive(csp, 'font-src')).toEqual(
      expect.arrayContaining(['https://fonts.gstatic.com']),
    );
    expect(directive(csp, 'style-src')).toEqual(
      expect.arrayContaining(['https://fonts.googleapis.com']),
    );
    expect(directive(csp, 'frame-src')).toEqual(
      expect.arrayContaining([
        'https://www.youtube.com',
        'https://player.vimeo.com',
      ]),
    );
    expect(directive(csp, 'connect-src')).toEqual(
      expect.arrayContaining([
        'https://checkout.shop.example',
        'https://mellow.myshopify.com',
      ]),
    );
  });

  it('never allows a wildcard or unsafe script source', async () => {
    const csp = (await render()).headers.get('Content-Security-Policy')!;
    expect(csp).not.toMatch(/'unsafe-eval'/);
    expect(directive(csp, 'script-src')).toBeUndefined();
    expect(directive(csp, 'default-src')).not.toContain('*');
    expect(directive(csp, 'default-src')).not.toContain("'unsafe-inline'");
  });

  it('uses a fresh nonce for every response', async () => {
    const first = (await render()).headers.get('Content-Security-Policy');
    const second = (await render()).headers.get('Content-Security-Policy');
    expect(first).not.toBe(second);
  });

  it('sets nosniff and a strict referrer policy next to the CSP', async () => {
    const response = await render();
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(response.headers.get('Content-Type')).toBe('text/html');
  });

  it('keeps the status code it was given', async () => {
    expect((await render(404)).status).toBe(404);
  });
});
