/**
 * Whether the development Storefront API mock is active.
 *
 * Only true when the app runs through `react-router dev` (Vite dev mode)
 * AND the developer opted in with MOCK_STOREFRONT=true. Production builds can
 * never enable the mock: the import of the mock module is guarded by
 * `import.meta.env.DEV` at its call site so it is removed from the bundle.
 */
export function isMockStorefrontEnabled(
  env: {MOCK_STOREFRONT?: string} | undefined,
): boolean {
  return Boolean(import.meta.env?.DEV) && env?.MOCK_STOREFRONT === 'true';
}
