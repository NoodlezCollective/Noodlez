import type {LanguageCode} from '@shopify/hydrogen-react/customer-account-api-types';
import {redirect} from 'react-router';
import type {AppSession} from '~/lib/session';
import {safeRedirectPath} from '~/lib/urls';
import type {CustomerAccount, CustomerAccountLogoutOptions} from './types';

/**
 * Customer accounts are deferred (docs/hydrogen-removal-architecture.md,
 * ADR-D, option D2), so the router context carries this stub instead of
 * Hydrogen's OAuth client (`createCustomerAccountClient` in Hydrogen
 * 2026.4.7, whose method names and redirects it keeps). It answers like
 * a signed-out customer, sends every call that needs a signed-in one to the
 * sign-in page, and the sign-in page explains, with a 503, that accounts are
 * not available yet. A store without the Customer Account API variables sees
 * the same pages as before; a store with them sees them too, until the OAuth
 * client (option D1) is ported. Signing out works, from this site only.
 */

/** The sign-in route: calls that need a signed-in customer redirect here. */
export const ACCOUNT_LOGIN_PATH = '/account/login';

export interface CreateCustomerAccountStubOptions {
  /** The request's session. Only `logout()` changes it. */
  session: AppSession;
  /**
   * The incoming request. `logout()` refuses it when it comes from another
   * origin and resolves `postLogoutRedirectUri` against its URL.
   */
  request: Request;
  /** The language of Customer Account API documents ('EN' by default). */
  language?: LanguageCode;
}

/** The session keys Hydrogen's client kept the tokens and the buyer under. */
const CUSTOMER_ACCOUNT_SESSION_KEY = 'customerAccount';
const BUYER_SESSION_KEY = 'buyer';

const DEFAULT_LANGUAGE: LanguageCode = 'EN';
const UNAVAILABLE_STATUS = 503;
const UNAVAILABLE_MESSAGE =
  'Customer accounts are not available on this storefront yet.';
const BAD_REQUEST_STATUS = 400;
const LOGOUT_REDIRECT_PATH = '/';

export function createCustomerAccountStub({
  session,
  request,
  language = DEFAULT_LANGUAGE,
}: CreateCustomerAccountStubOptions): CustomerAccount {
  return {
    i18n: Object.freeze({language}),
    // Sign-in options only shape the OAuth request, which does not exist.
    login: async () => accountsUnavailableResponse(),
    authorize: rejectWithSignInRedirect,
    logout: async (options) => signOut(session, request, options),
    isLoggedIn: async () => false,
    handleAuthStatus: rejectWithSignInRedirect,
    getAccessToken: async () => undefined,
    getApiUrl: () => '',
    getBuyer: async () => undefined,
    // There is no customer to attach a buyer to, and a session write here
    // would send a session cookie with every page.
    setBuyer: () => {},
    query: rejectWithSignInRedirect,
    mutate: rejectWithSignInRedirect,
  };
}

/**
 * Throws a new 302 to the sign-in page on every call, as Hydrogen's default
 * auth status handler does (without its `return_to`: there is nothing to
 * return to after a sign-in that cannot happen).
 */
async function rejectWithSignInRedirect(): Promise<never> {
  throw redirect(ACCOUNT_LOGIN_PATH);
}

/** The sign-in answer while customer accounts are deferred. */
function accountsUnavailableResponse(): Response {
  return new Response(UNAVAILABLE_MESSAGE, {
    status: UNAVAILABLE_STATUS,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Hydrogen's `logout` without the Shopify sign-out step (the stub never
 * stores an id token): removes the customer and the buyer, destroys the
 * session unless `keepSession` is set, and redirects home, or to
 * `postLogoutRedirectUri` when that is on this site. A request from another
 * origin is refused with a 400 before the session is touched, so it sets no
 * cookie.
 */
async function signOut(
  session: AppSession,
  request: Request,
  options: CustomerAccountLogoutOptions = {},
): Promise<Response> {
  if (isCrossOriginRequest(request.headers)) {
    throw new Response('Bad Request', {status: BAD_REQUEST_STATUS});
  }

  session.unset(CUSTOMER_ACCOUNT_SESSION_KEY);
  session.unset(BUYER_SESSION_KEY);

  // A copy, so the caller's Headers object is left as it was.
  const headers = new Headers(options.headers);
  if (!options.keepSession) {
    // Appended, so a cookie the caller clears (the cart, say) is kept.
    headers.append('Set-Cookie', await session.destroy());
    // The session is gone: server.ts must not commit it again.
    session.isPending = false;
  }

  const location = safeRedirectPath(
    options.postLogoutRedirectUri,
    new URL(request.url).origin,
    LOGOUT_REDIRECT_PATH,
  );
  return redirect(location, {headers});
}

/**
 * React Router's rule for actions (`throwIfPotentialCSRFAttack`, react-router
 * 7.16): a request is cross-origin when the host of its `Origin` differs from
 * the first `X-Forwarded-Host` value, or from `Host` without one. `Origin:
 * null` (sandboxed frames, redirects) and an `Origin` that is not a URL count
 * as cross-origin; a request without `Origin` does not. React Router applies
 * the rule to document and `.data` actions only, not to resource routes such
 * as /account/logout, so the sign-out applies it itself.
 */
function isCrossOriginRequest(headers: Headers): boolean {
  const origin = headers.get('Origin');
  if (origin === null) return false;

  const host =
    headers.get('X-Forwarded-Host')?.split(',')[0].trim() ||
    headers.get('Host');
  if (!host || origin === 'null') return true;

  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}
