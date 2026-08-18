/**
 * 死链与孤儿页检测。在 `astro build` 之后对 dist 执行。
 *
 * 覆盖内链规则:
 *   R02 nextStep 可达性(所有站内链接必须解析到实际产物)
 *   R04 孤儿页检测(排除全站导航/页脚/面包屑后仍无入链的页面)
 *   R16 死胡同兜底(每个页面正文区至少 1 条站内出链)
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');

/** 这些前缀的页面允许没有入链(它们靠导航或直接访问进入) */
const ORPHAN_EXEMPT = ['/', '/404/', '/search/', '/tags/', '/rss.xml', '/sitemap'];

/** 全站导航/页脚里的链接不计入"入链",否则每个页面都会被判定为有入链 */
const CHROME_SELECTORS = [
  /<header class="site-head"[\s\S]*?<\/header>/gi,
  /<footer class="site-foot"[\s\S]*?<\/footer>/gi,
  /<nav class="crumbs"[\s\S]*?<\/nav>/gi,
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith('.html')) yield full;
  }
}

const toRoute = (file) => {
  const rel = path.relative(DIST, file).split(path.sep).join('/');
  return rel === 'index.html' ? '/' : `/${rel.replace(/index\.html$/, '')}`;
};

const extractHrefs = (html) => [...html.matchAll(/<a\b[^>]*?\shref="([^"]+)"/gi)].map((m) => m[1]);

const stripChrome = (html) => {
  let out = html;
  for (const re of CHROME_SELECTORS) out = out.replace(re, '');
  return out;
};

/** 只关心站内链接;外链、锚点、mailto 等跳过 */
const isInternal = (href) =>
  href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/_astro/');

const normalize = (href) => {
  const clean = href.split('#')[0].split('?')[0];
  if (!clean) return null;
  return clean;
};

const pages = new Map(); // route -> { bodyLinks:Set, allLinks:Set }
const errors = [];
const warnings = [];

for await (const file of walk(DIST)) {
  const html = await readFile(file, 'utf8');
  const route = toRoute(file);
  const body = stripChrome(html);

  pages.set(route, {
    allLinks: new Set(
      extractHrefs(html)
        .map(normalize)
        .filter((h) => h && isInternal(h))
    ),
    bodyLinks: new Set(
      extractHrefs(body)
        .map(normalize)
        .filter((h) => h && isInternal(h))
    ),
  });
}

const routes = new Set(pages.keys());
const exists = (href) => routes.has(href) || routes.has(`${href}/`) || href.includes('.');

/* ---- R02: 死链 ---- */
for (const [route, { allLinks }] of pages) {
  for (const href of allLinks) {
    if (!exists(href)) errors.push(`死链  ${route}  ->  ${href}`);
  }
}

/* ---- R04: 孤儿页 ---- */
const inbound = new Map([...routes].map((r) => [r, 0]));
for (const [route, { bodyLinks }] of pages) {
  for (const href of bodyLinks) {
    const target = routes.has(href) ? href : `${href}/`;
    if (target !== route && inbound.has(target)) inbound.set(target, inbound.get(target) + 1);
  }
}
for (const [route, count] of inbound) {
  if (count === 0 && !ORPHAN_EXEMPT.some((p) => route === p || route.startsWith(p))) {
    warnings.push(`孤儿页(正文区无入链)  ${route}`);
  }
}

/* ---- R16: 死胡同 ---- */
for (const [route, { bodyLinks }] of pages) {
  const outbound = [...bodyLinks].filter((h) => h !== route);
  if (outbound.length === 0) errors.push(`死胡同(正文区无站内出链)  ${route}`);
}

const line = '─'.repeat(64);
console.log(line);
console.log(`死链检测:扫描 ${pages.size} 个页面`);
console.log(line);

if (warnings.length) {
  console.log(`\n⚠  ${warnings.length} 条警告:`);
  for (const w of warnings) console.log(`   ${w}`);
}

if (errors.length) {
  console.error(`\n✗  ${errors.length} 条错误:`);
  for (const e of errors) console.error(`   ${e}`);
  process.exit(1);
}

console.log(`\n✓  无死链、无死胡同(${warnings.length} 条孤儿页警告)`);
