/// <reference types="vite/client" />
/// <reference types="react-router" />

// Enhance TypeScript's built-in typings.
import '@total-typescript/ts-reset';

declare global {
  /**
   * The Workers runtime globals server.ts relies on. Declared here instead of
   * pulling in @cloudflare/workers-types: that package also declares the
   * HTMLRewriter `Element` globally, which shadows the DOM `Element.append`
   * the Playwright specs use. Request, Response and `caches` come from the
   * DOM lib, whose Fetch API shapes match the runtime's.
   */
  interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  }
  interface ExportedHandler<TEnv = unknown> {
    fetch?(
      request: Request,
      env: TEnv,
      ctx: ExecutionContext,
    ): Response | Promise<Response>;
  }
  /**
   * The Worker's variables and secrets: every variable the app reads. Set
   * them with Wrangler (`wrangler secret put`, dashboard variables) in
   * production and in .dev.vars locally; see .dev.vars.example.
   */
  interface Env {
    SESSION_SECRET: string;
    PUBLIC_STORE_DOMAIN: string;
    PUBLIC_STOREFRONT_API_TOKEN: string;
    /**
     * Server-only and not configured yet. When set, the Worker's own Storefront
     * API calls use it (with the buyer IP) instead of the public token; it never
     * reaches the browser or the same-origin Storefront API proxy.
     */
    PRIVATE_STOREFRONT_API_TOKEN?: string;
    PUBLIC_STOREFRONT_ID?: string;
    PUBLIC_CHECKOUT_DOMAIN?: string;
    PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID?: string;
    PUBLIC_CUSTOMER_ACCOUNT_API_URL?: string;
    SHOP_ID?: string;
    /**
     * Development only. When set to "true" the Storefront API is replaced by a
     * local in-memory mock with Mellow demo data so the UI can be developed and
     * reviewed without a connected Shopify store. See app/lib/mock/README.md.
     */
    MOCK_STOREFRONT?: string;
    /**
     * Optional webhook that receives newsletter signups as JSON
     * ({email, source}). When unset the newsletter form reports that the
     * integration is not configured instead of pretending to succeed.
     */
    NEWSLETTER_WEBHOOK_URL?: string;
  }
}
