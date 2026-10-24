import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import {cloudflare} from '@cloudflare/vite-plugin';
import {reactRouter} from '@react-router/dev/vite';

export default defineConfig({
  plugins: [
    // Runs server.ts in workerd (the Workers runtime) in dev and preview, and
    // builds the Worker for `wrangler deploy`. React Router's SSR environment
    // is the Worker environment.
    cloudflare({
      viteEnvironment: {name: 'ssr'},
      // Honour public/_headers in dev as production does.
      experimental: {headersAndRedirectsDevModeSupport: true},
    }),
    reactRouter(),
  ],
  resolve: {
    alias: {
      // Vite's native tsconfig path resolver does not cover JavaScript
      // projects that use jsconfig.json, so define the app alias here.
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
    tsconfigPaths: true,
  },
  build: {
    // Allow a strict Content-Security-Policy
    // without inlining assets as base64:
    assetsInlineLimit: 0,
  },
  ssr: {
    optimizeDeps: {
      /**
       * Include dependencies here if they throw CJS<>ESM errors.
       * For example, for the following error:
       *
       * > ReferenceError: module is not defined
       * >   at /Users/.../node_modules/example-dep/index.js:1:1
       *
       * Include 'example-dep' in the array below.
       * @see https://vitejs.dev/config/dep-optimization-options
       */
      include: [
        'react-router > set-cookie-parser',
        'react-router > cookie',
        'react-router',
      ],
    },
  },
  server: {
    // Playwright and coverage write into the repo while the dev server runs;
    // watching them triggers full reloads in every connected browser.
    watch: {
      ignored: [
        '**/playwright-report/**',
        '**/test-results/**',
        '**/coverage/**',
      ],
    },
  },
});
