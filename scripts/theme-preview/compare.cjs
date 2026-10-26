// Compares the storefront DOM captures with the theme's: per page, the class
// names, attributes and visible text present in one but not the other.
//   node scripts/theme-preview/compare.cjs [storefront html dir] [theme html dir] [page prefix]
const fs = require('fs');
const path = require('path');
const {parse} = require('node-html-parser');
const ref = process.argv[2] ?? path.join(__dirname, '.build/storefront-html');
const theme = process.argv[3] ?? path.join(__dirname, '.build/theme-html');
const only = process.argv[4];
const norm = (html) => {
  const root = parse(html.replace(/<!--[\s\S]*?-->/g, ''));
  const main = root.querySelector('body') ?? root;
  const classes = new Map();
  const tags = new Map();
  const texts = new Set();
  const attrs = new Map();
  for (const el of main.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase();
    if (
      [
        'svg',
        'path',
        'circle',
        'rect',
        'line',
        'polyline',
        'title',
        'g',
      ].includes(tag)
    )
      continue;
    tags.set(tag, (tags.get(tag) ?? 0) + 1);
    for (const c of (el.getAttribute('class') ?? '')
      .split(/\s+/)
      .filter(Boolean))
      classes.set(c, (classes.get(c) ?? 0) + 1);
    for (const a of [
      'role',
      'aria-label',
      'aria-labelledby',
      'aria-hidden',
      'type',
      'name',
      'href',
      'for',
    ]) {
      const v = el.getAttribute(a);
      if (v != null && a !== 'href')
        attrs.set(`${a}=${v}`, (attrs.get(`${a}=${v}`) ?? 0) + 1);
    }
    const own = el.childNodes
      .filter((n) => n.nodeType === 3)
      .map((n) => n.rawText.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ');
    if (own) texts.add(own);
  }
  return {classes, tags, texts, attrs};
};
const diffMap = (a, b) => {
  const out = [];
  for (const [k, v] of a) if (!b.has(k)) out.push(`${k} (×${v})`);
  return out;
};
const files = fs
  .readdirSync(ref)
  .filter((f) => f.endsWith('.html') && (!only || f.startsWith(only)));
let totalMissing = 0;
for (const f of files) {
  const t = `${theme}/${f}`;
  if (!fs.existsSync(t)) {
    console.log(`\n## ${f}: theme capture missing`);
    continue;
  }
  const a = norm(fs.readFileSync(`${ref}/${f}`, 'utf8'));
  const b = norm(fs.readFileSync(t, 'utf8'));
  const missingClasses = diffMap(a.classes, b.classes);
  const extraClasses = diffMap(b.classes, a.classes);
  const missingAttrs = diffMap(a.attrs, b.attrs);
  const missingText = [...a.texts].filter(
    (x) => !b.texts.has(x) && !/^\d/.test(x) && x.length > 1,
  );
  const extraText = [...b.texts].filter((x) => !a.texts.has(x) && x.length > 1);
  totalMissing += missingClasses.length;
  console.log(
    `\n## ${f}: ${missingClasses.length} classes missing, ${extraClasses.length} extra, ${missingText.length} texts missing, ${extraText.length} texts extra`,
  );
  if (missingClasses.length)
    console.log('  missing classes:', missingClasses.join(', '));
  if (extraClasses.length)
    console.log('  extra classes:', extraClasses.join(', '));
  if (missingAttrs.length)
    console.log('  missing attrs:', missingAttrs.slice(0, 25).join(' | '));
  if (missingText.length)
    console.log(
      '  missing text:',
      missingText
        .slice(0, 20)
        .map((x) => JSON.stringify(x.slice(0, 80)))
        .join(', '),
    );
  if (extraText.length)
    console.log(
      '  extra text:',
      extraText
        .slice(0, 20)
        .map((x) => JSON.stringify(x.slice(0, 80)))
        .join(', '),
    );
}
console.log(`\nTotal missing classes: ${totalMissing}`);
