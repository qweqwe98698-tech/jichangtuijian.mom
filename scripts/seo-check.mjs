/**
 * SEO 发布安全门禁。
 *
 * 这个脚本要挡的不是"排名下降",而是**整站掉索引**——那类事故有个共同特征:
 * 构建成功、页面在浏览器里完全正常、没有任何报错,只有搜索引擎那边悄悄崩掉。
 * 一个 `Disallow: /`、一个误加的 noindex、一次 canonical 批量指向首页,
 * 都能在几天内让积累几个月的收录归零,而且往往到流量掉光才被发现。
 *
 * 所以每一项检查的判据都是"搜索引擎会怎么读",不是"页面看起来对不对"。
 *
 * 页面数量变化用基线文件跨次比较:`.seo-baseline.json` 记录上次通过时的数量,
 * 突增可能是误生成了大量页面,突降可能是内容或路由被改坏——两种都要拦。
 *
 * 用法:
 *   node scripts/seo-check.mjs            正常检查(需先 build)
 *   node scripts/seo-check.mjs --accept   检查通过后把当前数量写入基线
 */
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SITE_URL } from '../src/config/site.ts';

const DIST = path.resolve('dist');
const BASELINE = path.resolve('.seo-baseline.json');
const ACCEPT = process.argv.includes('--accept');

/** 数量变化超过这个比例就拦下来人工确认 */
const COUNT_DELTA_LIMIT = 0.2;

/** 允许 noindex 的路径:这些页面本来就不该进索引 */
const NOINDEX_ALLOWED = [/^\/404/, /^\/search\//];

/** 核心 SEO 页面:任何一个取不到都属于严重事故 */
const CORE_PATHS = [
  '/',
  '/airports/',
  '/reviews/',
  '/compare/',
  '/rankings/',
  '/guides/',
  '/basics/',
  '/protocols/',
  '/risk/',
  '/free-nodes/',
  '/about/',
  '/editorial-policy/',
];

/** 被黑站点的典型注入路径 */
const SPAM = /\/(casino|bet|bets|poker|porn|xxx|viagra|cialis|loan|replica|escort|gambling)\b/i;

const results = [];
const record = (key, name, ok, detail, critical = true) =>
  results.push({ key, name, ok, detail, critical });

const attr = (html, re) => (html.match(re) || [])[1] ?? null;
const all = (s, re) => [...s.matchAll(re)];
const textOf = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/* ── 收集产物 ─────────────────────────────────────────────── */
async function collect(dir = DIST, base = '') {
  const out = [];
  for (const name of await readdir(dir)) {
    const full = path.join(dir, name);
    if ((await stat(full)).isDirectory()) out.push(...(await collect(full, `${base}/${name}`)));
    else if (name === 'index.html') out.push({ url: `${base}/`, file: full });
    else if (name.endsWith('.html')) out.push({ url: `${base}/${name}`, file: full });
  }
  return out;
}

let pages = [];
try {
  pages = await collect();
} catch {
  console.error('\n✗ 找不到 dist/。先跑 pnpm build 再执行本检查。\n');
  process.exit(1);
}
for (const p of pages) p.html = await readFile(p.file, 'utf8');

const indexable = pages.filter((p) => !NOINDEX_ALLOWED.some((re) => re.test(p.url)));

/* ── 1. Build ─────────────────────────────────────────────── */
record(
  'Build',
  '构建产物存在且页面数量合理',
  pages.length > 0,
  `产物 ${pages.length} 个 HTML,其中可索引 ${indexable.length} 个`
);

/* ── 2. robots.txt ────────────────────────────────────────── */
{
  const problems = [];
  let robots = '';
  try {
    robots = await readFile(path.join(DIST, 'robots.txt'), 'utf8');
  } catch {
    problems.push('robots.txt 不存在');
  }
  if (robots) {
    // 只看 User-agent: * 那一段有没有 Disallow: /,别把针对某个爬虫的规则误判成全站封禁
    const blocks = robots.split(/\n(?=User-agent:)/i);
    const star = blocks.find((b) => /^User-agent:\s*\*/i.test(b.trim()));
    if (star && /^\s*Disallow:\s*\/\s*$/im.test(star))
      problems.push('robots.txt 对所有爬虫 Disallow: /(全站禁止抓取)');
    for (const bot of ['Googlebot', 'Bingbot']) {
      const b = blocks.find((x) => new RegExp(`^User-agent:\\s*${bot}`, 'i').test(x.trim()));
      if (b && /^\s*Disallow:\s*\/\s*$/im.test(b)) problems.push(`robots.txt 封禁了 ${bot}`);
    }
    const sm = attr(robots, /^Sitemap:\s*(\S+)/im);
    if (!sm) problems.push('robots.txt 缺少 Sitemap 声明');
    else if (!sm.startsWith(SITE_URL)) problems.push(`robots.txt 的 Sitemap 不是正式域名:${sm}`);
    else {
      const rel = sm.replace(SITE_URL, '').replace(/^\//, '');
      try {
        await stat(path.join(DIST, rel));
      } catch {
        problems.push(`robots.txt 声明的 Sitemap 在产物中不存在:${sm}`);
      }
    }
  }
  record('Robots', 'robots.txt 未封禁搜索引擎且 Sitemap 声明有效', problems.length === 0, problems);
}

/* ── 3. Noindex ───────────────────────────────────────────── */
{
  const leaked = [];
  const NOINDEX =
    /<meta[^>]+name=["'](?:robots|googlebot|bingbot)["'][^>]+content=["'][^"']*noindex/i;
  for (const p of indexable) if (NOINDEX.test(p.html)) leaked.push(p.url);
  // 反向:该有 noindex 的页面丢了 noindex 也要报
  const missing = pages
    .filter((p) => NOINDEX_ALLOWED.some((re) => re.test(p.url)))
    .filter((p) => !NOINDEX.test(p.html))
    .map((p) => p.url);
  record(
    'Noindex',
    '正式页面无 noindex,豁免页面有 noindex',
    leaked.length === 0 && missing.length === 0,
    [
      ...leaked.map((u) => `正式页面出现 noindex:${u}`),
      ...missing.map((u) => `该有 noindex 却没有:${u}`),
    ].length
      ? [
          ...leaked.map((u) => `正式页面出现 noindex:${u}`),
          ...missing.map((u) => `缺 noindex:${u}`),
        ]
      : `${indexable.length} 个可索引页面均无 noindex;豁免页面 ${pages.length - indexable.length} 个均已标注`
  );
}

/* ── 4. Canonical ─────────────────────────────────────────── */
{
  const bad = [];
  let toHome = 0;
  for (const p of indexable) {
    const c = attr(p.html, /<link rel="canonical" href="([^"]+)"/);
    if (!c) bad.push(`${p.url} 缺 canonical`);
    else if (c !== `${SITE_URL}${p.url}`) {
      bad.push(`${p.url} → ${c}`);
      if (c === `${SITE_URL}/`) toHome++;
    }
  }
  const detail = bad.length
    ? [
        ...bad.slice(0, 10),
        toHome > 3 ? `⚠ ${toHome} 个页面 canonical 指向首页,属于大面积错误` : '',
      ].filter(Boolean)
    : `${indexable.length} 个页面 canonical 全部自指`;
  record('Canonical', 'canonical 全部自指且指向正式域名', bad.length === 0, detail);
}

/* ── 5. Sitemap ───────────────────────────────────────────── */
let sitemapUrls = [];
{
  const problems = [];
  try {
    const idx = await readFile(path.join(DIST, 'sitemap-index.xml'), 'utf8');
    for (const m of all(idx, /<loc>([^<]+)<\/loc>/g)) {
      const f = path.join(DIST, m[1].split('/').pop());
      const xml = await readFile(f, 'utf8');
      if (!/^<\?xml/.test(xml.trim())) problems.push(`${path.basename(f)} 不是合法 XML`);
      sitemapUrls.push(...all(xml, /<loc>([^<]+)<\/loc>/g).map((x) => x[1]));
    }
  } catch (e) {
    problems.push(`sitemap 读取失败:${e.message}`);
  }

  const smPaths = sitemapUrls.map((u) => u.replace(SITE_URL, ''));
  const pageUrls = new Set(pages.map((p) => p.url));

  if (sitemapUrls.some((u) => /localhost|127\.0\.0\.1|\.local|:\d{4}/.test(u)))
    problems.push('sitemap 含 localhost 或测试域名');
  const foreign = sitemapUrls.filter((u) => !u.startsWith(SITE_URL));
  if (foreign.length) problems.push(`sitemap 含非正式域名 ${foreign.length} 条`);
  const dupes = smPaths.length - new Set(smPaths).size;
  if (dupes) problems.push(`sitemap 含重复 URL ${dupes} 条`);
  const missing404 = smPaths.filter((u) => !pageUrls.has(u));
  if (missing404.length)
    problems.push(
      `sitemap 含产物中不存在的 URL ${missing404.length} 条:${missing404.slice(0, 3).join(', ')}`
    );
  const noindexInSitemap = smPaths.filter((u) => NOINDEX_ALLOWED.some((re) => re.test(u)));
  if (noindexInSitemap.length)
    problems.push(`sitemap 含 noindex/禁抓页面:${noindexInSitemap.join(', ')}`);
  const absent = [...pageUrls].filter(
    (u) => !smPaths.includes(u) && !NOINDEX_ALLOWED.some((re) => re.test(u))
  );
  if (absent.length)
    problems.push(`可索引页面未进 sitemap ${absent.length} 条:${absent.slice(0, 3).join(', ')}`);

  record(
    'Sitemap',
    'sitemap 只收录可索引的规范 URL',
    problems.length === 0,
    problems.length ? problems : `收录 ${sitemapUrls.length} 条,与可索引页面一一对应`
  );
}

/* ── 6. 核心 URL 可达 ─────────────────────────────────────── */
{
  const missing = CORE_PATHS.filter((u) => !pages.some((p) => p.url === u));
  record(
    'Core URLs',
    '核心 SEO 页面全部存在',
    missing.length === 0,
    missing.length ? missing.map((u) => `${u} 不存在`) : `${CORE_PATHS.length} 个核心页面全部就位`
  );
}

/* ── 7. 内部链接 ──────────────────────────────────────────── */
{
  const problems = [];
  const pageUrls = new Set(pages.map((p) => p.url));
  let empty = 0,
    hash = 0,
    broken = new Set();
  for (const p of pages) {
    for (const m of all(p.html, /<a\b[^>]*href="([^"]*)"/g)) {
      const href = m[1];
      if (href === '') empty++;
      else if (href === '#') hash++;
      else if (href.startsWith('/') && !href.startsWith('//')) {
        const clean = href.split('#')[0].split('?')[0];
        if (!clean) continue;
        if (!pageUrls.has(clean) && !clean.match(/\.(xml|txt|png|svg|webp|json|ico|js|css)$/)) {
          try {
            await stat(path.join(DIST, clean.replace(/^\//, '')));
          } catch {
            broken.add(`${clean}(引用自 ${p.url})`);
          }
        }
      }
    }
  }
  if (empty) problems.push(`href="" 出现 ${empty} 次`);
  if (hash) problems.push(`href="#" 出现 ${hash} 次`);
  if (broken.size) problems.push(...[...broken].slice(0, 8));
  record(
    'Internal Links',
    '无空链接、无死链',
    problems.length === 0,
    problems.length ? problems : '全站内部链接均指向存在的页面'
  );
}

/* ── 8. 点击深度 ──────────────────────────────────────────── */
{
  const byUrl = new Map(pages.map((p) => [p.url, p.html]));
  const depth = new Map([['/', 0]]);
  const queue = ['/'];
  while (queue.length) {
    const u = queue.shift();
    const html = byUrl.get(u);
    if (!html) continue;
    for (const m of all(html, /href="(\/[^"#?]*\/)"/g)) {
      if (!depth.has(m[1]) && byUrl.has(m[1])) {
        depth.set(m[1], depth.get(u) + 1);
        queue.push(m[1]);
      }
    }
  }
  const deep = [...depth.entries()].filter(([, d]) => d > 3).map(([u, d]) => `${u} 深度 ${d}`);
  const unreachable = indexable.filter((p) => !depth.has(p.url)).map((p) => p.url);
  const dist = {};
  for (const [, d] of depth) dist[d] = (dist[d] ?? 0) + 1;
  record(
    'Click Depth',
    '全部页面从首页 3 次点击内可达',
    deep.length === 0 && unreachable.length === 0,
    deep.length || unreachable.length
      ? [...deep.slice(0, 6), ...unreachable.slice(0, 6).map((u) => `${u} 首页不可达`)]
      : `深度分布 ${JSON.stringify(dist)}`
  );
}

/* ── 9. 重复 Title / Description / H1 ─────────────────────── */
{
  const group = (fn) => {
    const m = new Map();
    for (const p of indexable) {
      const k = fn(p);
      if (!k) continue;
      m.set(k, [...(m.get(k) ?? []), p.url]);
    }
    return [...m.entries()].filter(([, v]) => v.length > 1);
  };
  const dupT = group((p) => attr(p.html, /<title>([\s\S]*?)<\/title>/));
  const dupD = group((p) => attr(p.html, /<meta name="description" content="([^"]*)"/));
  const dupH = group((p) => {
    const h = p.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    return h ? textOf(h[1]) : null;
  });
  const problems = [
    ...dupT.slice(0, 5).map(([k, v]) => `重复 Title「${k.slice(0, 40)}」:${v.join(' + ')}`),
    ...dupD.slice(0, 5).map(([, v]) => `重复 Description:${v.join(' + ')}`),
    ...dupH.slice(0, 5).map(([k, v]) => `重复 H1「${k.slice(0, 30)}」:${v.join(' + ')}`),
  ];
  record(
    'Duplicates',
    'Title / Description / H1 全站唯一',
    problems.length === 0,
    problems.length ? problems : `${indexable.length} 个页面的三项均无重复`
  );
}

/* ── 10. Schema ───────────────────────────────────────────── */
{
  const broken = [];
  let count = 0;
  for (const p of pages) {
    for (const m of all(p.html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      count++;
      try {
        JSON.parse(m[1]);
      } catch (e) {
        broken.push(`${p.url}:${e.message}`);
      }
    }
  }
  record(
    'Schema',
    '结构化数据全部可解析',
    broken.length === 0,
    broken.length ? broken.slice(0, 5) : `${count} 段 JSON-LD 语法全部正确`
  );
}

/* ── 11. 垃圾页面 / 被黑检测 ──────────────────────────────── */
{
  const spam = pages.filter((p) => SPAM.test(p.url)).map((p) => p.url);
  record(
    'Spam Pages',
    '未出现可疑注入页面',
    spam.length === 0,
    spam.length
      ? [...spam.slice(0, 10), '⚠ 不要自动删除,先查清来源']
      : '未发现赌博/成人/贷款类可疑路径'
  );
}

/* ── 12. 页面数量变化 ─────────────────────────────────────── */
let baseline = null;
{
  try {
    baseline = JSON.parse(await readFile(BASELINE, 'utf8'));
  } catch {
    /* 首次运行没有基线 */
  }
  if (!baseline) {
    record(
      'Page Count',
      '页面数量基线',
      true,
      `首次运行,尚无基线。当前 ${pages.length} 页 / sitemap ${sitemapUrls.length} 条。通过后用 --accept 写入基线`,
      false
    );
  } else {
    const prev = baseline.pages;
    const delta = pages.length - prev;
    const ratio = prev ? Math.abs(delta) / prev : 0;
    const ok = ratio <= COUNT_DELTA_LIMIT;
    record(
      'Page Count',
      `页面数量变化在 ±${COUNT_DELTA_LIMIT * 100}% 内`,
      ok,
      ok
        ? `${prev} → ${pages.length}(${delta >= 0 ? '+' : ''}${delta},基线记于 ${baseline.acceptedAt})`
        : [
            `页面数量从 ${prev} 变为 ${pages.length}(${delta >= 0 ? '+' : ''}${delta},${(ratio * 100).toFixed(1)}%)`,
            delta < 0
              ? '突降通常意味着内容或路由被改坏,确认不是误删再继续'
              : '突增通常意味着误生成了大量页面,确认不是模板批量产出再继续',
            '确认无误后用 node scripts/seo-check.mjs --accept 更新基线',
          ]
    );
  }
}

/* ── 输出 ─────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok);
const blocking = failed.filter((r) => r.critical);
const pad = (s, n) => {
  const w = [...s].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0);
  return s + ' '.repeat(Math.max(0, n - w));
};

console.log('');
console.log('═'.repeat(78));
console.log('  SEO HEALTH CHECK');
console.log('═'.repeat(78));
console.log('');
for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${pad(r.key + ':', 17)}${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
  for (const line of Array.isArray(r.detail) ? r.detail : [r.detail]) console.log(`      ${line}`);
  console.log('');
}
console.log('─'.repeat(78));
console.log(
  `  产物页面 ${pages.length} · 可索引 ${indexable.length} · Sitemap ${sitemapUrls.length} 条`
);
console.log('─'.repeat(78));
console.log('');
console.log(`RELEASE_DECISION: ${blocking.length ? 'BLOCKED' : 'READY'}`);
console.log('');

if (blocking.length) {
  console.log('阻塞项:');
  for (const r of blocking) console.log(`  · ${r.key} —— ${r.name}`);
  console.log('');
  console.log('修复后重新运行本检查。检查未通过前不得部署。');
  console.log('');
  process.exit(1);
}

if (ACCEPT) {
  await writeFile(
    BASELINE,
    JSON.stringify(
      {
        pages: pages.length,
        indexable: indexable.length,
        sitemapUrls: sitemapUrls.length,
        acceptedAt: new Date().toISOString().slice(0, 10),
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
  console.log(`✓ 基线已更新:${pages.length} 页 / sitemap ${sitemapUrls.length} 条\n`);
}
