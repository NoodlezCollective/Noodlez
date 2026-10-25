import type {Config} from '@react-router/dev/config';

/**
 * React Router framework-mode configuration.
 *
 * The explicit values are what Hydrogen's preset used to apply (app/ and dist/
 * directories, SSR, split route modules, middleware, no subresource
 * integrity because the CSP relies on nonces), plus the Vite Environment API
 * that the Cloudflare plugin needs to run the server build in workerd.
 */
export default {
  appDirectory: 'app',
  buildDirectory: 'dist',
  ssr: true,
  subResourceIntegrity: false,
  // Ship the whole route manifest with the document instead of fetching
  // /__manifest patches on every navigation: the storefront has few routes,
  // it removes a request per navigation, and it keeps the dev worker from
  // wedging under the e2e suite's request volume.
  routeDiscovery: {mode: 'initial'},
  future: {
    v8_middleware: true,
    v8_splitRouteModules: true,
    v8_viteEnvironmentApi: true,
    unstable_optimizeDeps: true,
  },
} satisfies Config;
