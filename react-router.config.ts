import type {Config} from '@react-router/dev/config';
import {hydrogenPreset} from '@shopify/hydrogen/react-router-preset';

/**
 * React Router 7.9.x Configuration for Hydrogen
 *
 * This configuration uses the official Hydrogen preset to provide optimal
 * React Router settings for Shopify Oxygen deployment. The preset enables
 * validated performance optimizations while ensuring compatibility.
 */
export default {
  presets: [hydrogenPreset()],
  // Ship the whole route manifest with the document instead of fetching
  // /__manifest patches on every navigation: the storefront has few routes,
  // it removes a request per navigation, and it keeps the dev worker from
  // wedging under the e2e suite's request volume.
  routeDiscovery: {mode: 'initial'},
} satisfies Config;
