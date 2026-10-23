/// <reference types="vite/client" />
/// <reference types="react-router" />
/// <reference types="@shopify/oxygen-workers-types" />
/// <reference types="@shopify/hydrogen/react-router-types" />

// Enhance TypeScript's built-in typings.
import '@total-typescript/ts-reset';

declare global {
  /**
   * Project-specific environment variables (see .env.example).
   * Hydrogen's own variables (PUBLIC_STORE_DOMAIN, SESSION_SECRET, ...)
   * are declared by `HydrogenEnv`.
   */
  interface Env {
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
