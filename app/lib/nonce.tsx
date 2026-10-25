import {createContext, useContext} from 'react';

/**
 * The CSP nonce of the current document (replaces Hydrogen's NonceProvider
 * and useNonce). entry.server.tsx provides the nonce of the
 * Content-Security-Policy header; entry.client.tsx provides the one it reads
 * back from the server-rendered scripts, so hydration renders the same value.
 */
const NonceContext = createContext<string | undefined>(undefined);

export const NonceProvider = NonceContext.Provider;

/** The nonce for inline `<script>` elements, or undefined outside a provider. */
export function useNonce(): string | undefined {
  return useContext(NonceContext);
}
