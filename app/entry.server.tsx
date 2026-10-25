import {ServerRouter} from 'react-router';
import {isbot} from 'isbot';
import {renderToReadableStream} from 'react-dom/server';
import type {EntryContext} from 'react-router';
import type {AppRouterContext} from '~/lib/context';
import {createContentSecurityPolicy} from '~/lib/csp.server';
import {NonceProvider} from '~/lib/nonce';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  context: AppRouterContext,
) {
  const {nonce, header} = createContentSecurityPolicy({
    shop: {
      checkoutDomain: context.env.PUBLIC_CHECKOUT_DOMAIN,
      storeDomain: context.env.PUBLIC_STORE_DOMAIN,
    },
    // Brand typography (Outfit + Inter) is served by Google Fonts.
    styleSrc: ['https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.shopify.com'],
    // Product/content media comes from the Shopify CDN; local assets are same-origin.
    imgSrc: [
      "'self'",
      'data:',
      'blob:',
      'https://cdn.shopify.com',
      'https://shopify.com',
    ],
    mediaSrc: ["'self'", 'blob:', 'https://cdn.shopify.com'],
    // Editorial videos may be embedded from YouTube or Vimeo (metaobject video_url).
    frameSrc: [
      "'self'",
      'https://www.youtube.com',
      'https://www.youtube-nocookie.com',
      'https://player.vimeo.com',
    ],
    // No plugins (Flash, PDF embeds, <object>): nothing here needs them.
    objectSrc: ["'none'"],
    // Every form posts to this origin (cart, newsletter, account). The sign-in
    // flow is a redirect, not a form. Sign-out is a same-origin POST that
    // redirects to Shopify's customer account domain, which Chromium also
    // checks against form-action when the form is submitted without JavaScript.
    formAction: ["'self'", 'https://shopify.com'],
  });

  const body = await renderToReadableStream(
    <NonceProvider value={nonce}>
      <ServerRouter
        context={reactRouterContext}
        url={request.url}
        nonce={nonce}
      />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', header);
  responseHeaders.set('X-Content-Type-Options', 'nosniff');
  responseHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
