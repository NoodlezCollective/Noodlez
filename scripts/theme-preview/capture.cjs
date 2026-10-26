// Captures the theme rendered by the local preview (npm run theme:preview):
// the hydrated DOM and a full-page screenshot of every page and state.
//   node scripts/theme-preview/capture.cjs [base url] [html dir] [shots dir]
const {chromium} = require('playwright');
const fs = require('fs');
const path = require('path');
const base = process.argv[2] ?? 'http://localhost:3200';
const outHtml = process.argv[3] ?? path.join(__dirname, '.build/theme-html');
const outShots = process.argv[4] ?? path.join(__dirname, '.build/theme-shots');
fs.mkdirSync(outHtml, {recursive: true});
fs.mkdirSync(outShots, {recursive: true});
const pages = [
  ['home', '/'],
  ['collections', '/collections'],
  ['shop-all', '/collections/all'],
  ['collection-pillows', '/collections/pillows?sort_by=price-descending'],
  ['collection-filtered', '/collections/pillows?filter.v.availability=1'],
  ['product', '/products/cloudalign-pillow'],
  ['product-swatches', '/products/pebble-pillow'],
  ['search', '/search?q=pillow'],
  ['search-empty', '/search?q=zzzz'],
  ['cart-empty', '/cart'],
  ['about', '/pages/about'],
  ['journal', '/blogs/journal'],
  ['policies', '/pages/policies'],
  ['policy-privacy', '/pages/privacy-policy'],
  ['policy-terms', '/pages/terms-of-service'],
  ['policy-refund', '/pages/refund-policy'],
  ['policy-shipping', '/pages/shipping-policy'],
  ['policy-contact', '/pages/contact-information'],
  ['policy-legal', '/pages/legal-notice'],
  ['account', '/account/login'],
  ['not-found', '/this-page-does-not-exist'],
];
const clean = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width: 1440, height: 900}});
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${page.url()}: console ${m.text()}`);
  });
  const scrollThrough = async () => {
    await page.evaluate(async () => {
      const step = 700;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(300);
  };
  const save = async (name) => {
    if (!name.includes('drawer') && !name.includes('menu'))
      await scrollThrough();
    const html = await page.evaluate(() => document.documentElement.outerHTML);
    fs.writeFileSync(`${outHtml}/${name}.html`, clean(html));
    await page.screenshot({
      path: `${outShots}/${name}.jpg`,
      fullPage: true,
      type: 'jpeg',
      quality: 78,
    });
    console.log('saved', name);
  };
  await page.request.post(base + '/cart/clear.js');
  for (const [id, path] of pages) {
    await page.goto(base + path, {waitUntil: 'networkidle', timeout: 60000});
    await page.waitForTimeout(400);
    await save(id);
  }
  await page.goto(base + '/products/cloudalign-pillow', {
    waitUntil: 'networkidle',
  });
  const add = page.getByRole('button', {name: /add to cart/i}).first();
  await add.click();
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
    .getByRole('button', {name: /^search$/i})
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
  await page.keyboard.press('Escape');
  for (const [id, path] of [
    ['home', '/'],
    ['product', '/products/cloudalign-pillow'],
    ['shop-all', '/collections/all'],
  ]) {
    await page.goto(base + path, {waitUntil: 'networkidle'});
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `${outShots}/${id}-mobile.jpg`,
      fullPage: true,
      type: 'jpeg',
      quality: 78,
    });
  }
  await browser.close();
  fs.writeFileSync(`${outHtml}/_errors.txt`, errors.join('\n'));
  console.log('page errors:', errors.length);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
