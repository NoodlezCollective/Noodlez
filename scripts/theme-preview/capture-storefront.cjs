// Saves the hydrated DOM of every page and interactive state of the React
// storefront (npm run dev in mock mode) as the reference for compare.cjs.
//   node scripts/theme-preview/capture-storefront.cjs [out dir] [base url]
const {chromium} = require('playwright');
const fs = require('fs');
const path = require('path');
const out = process.argv[2] ?? path.join(__dirname, '.build/storefront-html');
const base = process.argv[3] ?? 'http://localhost:3000';
fs.mkdirSync(out, {recursive: true});
const pages = [
  ['home', '/'],
  ['collections', '/collections'],
  ['shop-all', '/collections/all'],
  ['collection-pillows', '/collections/pillows?sortKey=PRICE&reverse=true'],
  ['collection-filtered', '/collections/pillows?filter.v.availability=1'],
  ['product', '/products/cloudalign-pillow'],
  ['product-swatches', '/products/pebble-pillow?Color=Charcoal'],
  ['search', '/search?q=pillow'],
  ['search-empty', '/search?q=zzzz'],
  ['cart-empty', '/cart'],
  ['about', '/pages/about'],
  ['journal', '/blogs'],
  ['policies', '/policies'],
  ['policy-privacy', '/policies/privacy-policy'],
  ['policy-terms', '/policies/terms-of-service'],
  ['policy-refund', '/policies/refund-policy'],
  ['policy-shipping', '/policies/shipping-policy'],
  ['policy-contact', '/policies/contact-information'],
  ['policy-legal', '/policies/legal-notice'],
  ['account', '/account'],
  ['not-found', '/this-page-does-not-exist'],
];
const clean = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<link[^>]*rel="modulepreload"[^>]*>/g, '');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width: 1440, height: 900}});
  const page = await ctx.newPage();
  const save = async (name) => {
    const html = await page.evaluate(() => document.documentElement.outerHTML);
    fs.writeFileSync(`${out}/${name}.html`, clean(html));
    console.log('saved', name, html.length);
  };
  for (const [id, path] of pages) {
    await page.goto(base + path, {waitUntil: 'networkidle', timeout: 90000});
    await page.waitForTimeout(400);
    await save(id);
  }
  // Interactive states
  await page.goto(base + '/products/cloudalign-pillow', {
    waitUntil: 'networkidle',
  });
  await page
    .getByRole('button', {name: /add to cart/i})
    .first()
    .click();
  await page.waitForTimeout(1500);
  await save('cart-drawer');
  await page.keyboard.press('Escape');
  await page.goto(base + '/products/pebble-pillow', {waitUntil: 'networkidle'});
  await page
    .getByRole('button', {name: /add to cart/i})
    .first()
    .click();
  await page.waitForTimeout(1500);
  await page.goto(base + '/cart', {waitUntil: 'networkidle'});
  await page.waitForTimeout(400);
  await save('cart');
  await page.goto(base + '/', {waitUntil: 'networkidle'});
  await page
    .getByRole('button', {name: /search/i})
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type('pil');
  await page.waitForTimeout(1200);
  await save('search-drawer');
  await page.keyboard.press('Escape');
  await page.setViewportSize({width: 390, height: 844});
  await page.waitForTimeout(300);
  await page.getByRole('button', {name: /open menu/i}).click();
  await page.waitForTimeout(400);
  await save('mobile-menu');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
