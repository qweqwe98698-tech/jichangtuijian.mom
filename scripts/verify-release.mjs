/**
 * T7 发布验收校验。
 *
 * 前面每个门禁各守一段:check-model 守数据、check-links 守内链、check-content 守措辞。
 * 这个脚本守的是**产物**——只读 dist 里真正会被搜索引擎和读者拿到的 HTML,
 * 因为源码正确和产物正确不是同一件事,中间隔着模板、构建与集成。
 *
 * 每一项对应第三阶段 T7 验收清单里的一条。BLOCK 级不通过即不得进入阶段 I。
 *
 * 用法:node scripts/verify-release.mjs
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const DIST = path.resolve('dist');
const SITE = 'https://jichangtuijian.mom';

const results = [];
const record = (level, id, name, ok, detail) => results.push({ level, id, name, ok, detail });

/** 收集 dist 下全部 index.html,返回 { url, file, html } */
async function collectPages(dir = DIST, base = '') {
  const out = [];
  for (const name of await readdir(dir)) {
    const full = path.join(dir, name);
    if ((await stat(full)).isDirectory()) {
      out.push(...(await collectPages(full, `${base}/${name}`)));
    } else if (name === 'index.html') {
      out.push({ url: `${base}/`, file: full, html: await readFile(full, 'utf8') });
    }
  }
  return out;
}

const attr = (html, re) => (html.match(re) || [])[1] ?? null;
const all = (html, re) => [...html.matchAll(re)];
const stripTags = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const noScript = (html) =>
  html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');

const pages = await collectPages();

// ── 1. 每页基础 SEO 元素 ───────────────────────────────────────────
{
  const bad = [];
  for (const p of pages) {
    const title = attr(p.html, /<title>([\s\S]*?)<\/title>/);
    const desc = attr(p.html, /<meta name="description" content="([^"]*)"/);
    const canonical = attr(p.html, /<link rel="canonical" href="([^"]*)"/);
    const h1s = all(p.html, /<h1[\s>]/g).length;
    const problems = [];
    if (!title || title.length < 8) problems.push('title 缺失或过短');
    if (!desc || desc.length < 40) problems.push('description 缺失或过短');
    if (!canonical) problems.push('canonical 缺失');
    else if (canonical !== `${SITE}${p.url}`) problems.push(`canonical 不自指(${canonical})`);
    if (h1s !== 1) problems.push(`H1 数量 = ${h1s}`);
    if (problems.length) bad.push(`${p.url} → ${problems.join('; ')}`);
  }
  record(
    'BLOCK',
    'T7-10',
    'Title / Description / H1 / canonical 一致性',
    bad.length === 0,
    bad.length ? bad.slice(0, 12) : `${pages.length} 页全部合规`
  );
}

// ── 2. Title 全站唯一(关键词自相残杀检测)──────────────────────
{
  const seen = new Map();
  const dupes = [];
  for (const p of pages) {
    const title = attr(p.html, /<title>([\s\S]*?)<\/title>/) ?? '';
    if (seen.has(title)) dupes.push(`「${title}」 ← ${seen.get(title)} 与 ${p.url}`);
    else seen.set(title, p.url);
  }
  record(
    'BLOCK',
    'T7-14',
    'Title 全站唯一(无关键词自相残杀)',
    dupes.length === 0,
    dupes.length ? dupes.slice(0, 12) : `${seen.size} 个标题互不重复`
  );
}

// ── 3. 16 个品牌页可达且结构完整 ──────────────────────────────────
{
  const src = await readFile('src/data/brands.ts', 'utf8');
  const slugs = [...new Set(all(src, /slug: '([a-z0-9-]+)'/g).map((m) => m[1]))];
  const bad = [];
  for (const slug of slugs) {
    const p = pages.find((x) => x.url === `/reviews/${slug}/`);
    if (!p) {
      bad.push(`${slug} 页面缺失`);
      continue;
    }
    const problems = [];
    if (!/"@type":\s*"BreadcrumbList"/.test(p.html)) problems.push('缺 BreadcrumbList');
    if (!/"@type":\s*"(Product|Review)"/.test(p.html)) problems.push('缺 Product/Review');
    if (!/rel="sponsored nofollow noopener"/.test(p.html)) problems.push('推广链接缺 rel');
    if (problems.length) bad.push(`${slug}: ${problems.join('; ')}`);
  }
  record(
    'BLOCK',
    'T7-02',
    `${slugs.length} 个品牌页 URL / 面包屑 / Schema / rel`,
    bad.length === 0,
    bad.length ? bad : `${slugs.length} 个品牌页全部合规`
  );
}

// ── 4. JSON-LD 全站可解析 ─────────────────────────────────────────
{
  const broken = [];
  for (const p of pages) {
    for (const m of all(p.html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try {
        JSON.parse(m[1]);
      } catch (e) {
        broken.push(`${p.url} → ${e.message}`);
      }
    }
  }
  record(
    'BLOCK',
    'T7-10b',
    'JSON-LD 全部可解析',
    broken.length === 0,
    broken.length ? broken.slice(0, 6) : '全部结构化数据语法正确'
  );
}

// ── 5. sitemap 覆盖 ───────────────────────────────────────────────
{
  const urls = [];
  try {
    const idx = await readFile(path.join(DIST, 'sitemap-index.xml'), 'utf8');
    for (const m of all(idx, /<loc>([^<]+)<\/loc>/g)) {
      const f = path.join(DIST, m[1].split('/').pop());
      urls.push(...all(await readFile(f, 'utf8'), /<loc>([^<]+)<\/loc>/g).map((x) => x[1]));
    }
  } catch {
    /* 下方按 0 条处理并失败 */
  }
  const set = new Set(urls.map((u) => u.replace(SITE, '')));
  // /404 与 /search/ 是刻意排除的:两者都带 noindex,把它们放进 sitemap
  // 等于一边说"别收录"一边说"请收录",详见 astro.config.mjs 的 sitemap filter
  const EXCLUDED = /^\/404|^\/search\//;
  const absent = pages.filter((p) => !set.has(p.url) && !EXCLUDED.test(p.url)).map((p) => p.url);
  record(
    'BLOCK',
    'T7-02b',
    'sitemap 覆盖全部可索引页面',
    absent.length === 0 && urls.length > 0,
    absent.length ? absent.slice(0, 12) : `sitemap 收录 ${set.size} 条`
  );
}

// ── 6. 图片有 alt 与显式尺寸(防 CLS)───────────────────────────
{
  const bad = [];
  for (const p of pages) {
    for (const m of all(p.html, /<img\b[^>]*>/g)) {
      const tag = m[0];
      if (!/\salt=/.test(tag)) bad.push(`${p.url} → 缺 alt: ${tag.slice(0, 80)}`);
      else if (!/\bwidth=/.test(tag) || !/\bheight=/.test(tag))
        bad.push(`${p.url} → 缺显式宽高: ${tag.slice(0, 80)}`);
    }
  }
  record(
    'BLOCK',
    'T7-11',
    '图片 alt 与显式宽高(防 CLS)',
    bad.length === 0,
    bad.length ? bad.slice(0, 10) : '全站图片合规'
  );
}

// ── 7. 原图 SHA-256 与登记表一致 ─────────────────────────────────
{
  const registry = JSON.parse(await readFile('src/data/evidence/speedtest-assets.json', 'utf8'));
  const list = Array.isArray(registry) ? registry : (registry.assets ?? []);
  const ORIGINALS = path.resolve('public/evidence/speedtest/2026-08-11');
  const bad = [];
  for (const a of list) {
    const file = path.join(ORIGINALS, a.file);
    try {
      const buf = await readFile(file);
      // 登记表存的是大写十六进制,统一成小写再比,免得靠大小写差异误判
      const sha = createHash('sha256').update(buf).digest('hex').toLowerCase();
      if (sha !== String(a.sha256).toLowerCase())
        bad.push(`${a.brand} SHA-256 不符(原图被改动或覆盖过)`);
      else if (a.bytes && buf.length !== a.bytes)
        bad.push(`${a.brand} 字节数不符:登记 ${a.bytes},实际 ${buf.length}`);
    } catch {
      bad.push(`${a.brand} 原图缺失: ${a.file}`);
    }
  }
  record(
    'BLOCK',
    'T7-04',
    `原图 ${list.length} 张 SHA-256 复核`,
    bad.length === 0,
    bad.length ? bad : `${list.length} 张原图哈希与登记表一致,未被覆盖或裁剪`
  );
}

// ── 8. 未放行证据不得出现在产物中 ────────────────────────────────
{
  const leaked = pages.filter((p) => /kexinyun[^"']*\.(png|webp)/.test(p.html)).map((p) => p.url);
  record(
    'BLOCK',
    'T7-05',
    '未放行证据(可信云)未泄漏进产物',
    leaked.length === 0,
    leaked.length ? leaked : '可信云测速图在全站产物中均未出现'
  );
}

// ── 9. 禁用结论措辞不得出现在产物中 ──────────────────────────────
{
  const BANNED = [
    '全球最快',
    '永不掉线',
    '百分百解锁',
    '100% 解锁',
    '所有节点满速',
    '绝对安全',
    '完全匿名',
    '保证不被封',
    '不经公网',
  ];
  // 本站大量文章的主题就是拆穿这些话术,引用与批判是合规用法。
  // 只有「本站自己在下这个结论」才是违规,靠上下文区分——
  // 一刀切会把风险预警栏目整个判成违规,那等于惩罚正确的写法。
  const QUOTED = (body, i, kw) => {
    const near = body.slice(Math.max(0, i - 3), i + kw.length + 3);
    return /[「『"“][^」』"”]*$/.test(body.slice(Math.max(0, i - 40), i)) || /[「『"“]/.test(near);
  };
  const CRITIQUE =
    /不成立|不可能|值得警惕|无法被验证|无法验证|无法保证|随时变化|不做任何|不能让你|典型包括|这类说法|谨慎|警惕|话术|承诺|识别|red.?flag|不该|别信|谎|误导|冲突|追责/;
  const hits = [];
  for (const p of pages) {
    const body = stripTags(noScript(p.html));
    for (const b of BANNED) {
      let i = body.indexOf(b);
      while (i !== -1) {
        const ctx = body.slice(Math.max(0, i - 90), i + b.length + 90);
        if (!QUOTED(body, i, b) && !CRITIQUE.test(ctx))
          hits.push(`${p.url} → 「${b}」:${ctx.slice(60, 170)}`);
        i = body.indexOf(b, i + b.length);
      }
    }
  }
  record(
    'BLOCK',
    'T7-06',
    '无绝对化结论 / 单图外推(引用与批判语境豁免)',
    hits.length === 0,
    hits.length ? hits.slice(0, 12) : '未发现本站自述的禁用结论'
  );
}

// ── 10. 年付折算价必须带周期标注 ─────────────────────────────────
{
  const src = await readFile('src/data/brands.ts', 'utf8');
  const annual = [
    ...new Set(
      all(src, /entryPriceCNY: ([\d.]+),\s*\n?\s*basis: 'annual-equivalent'/g).map((m) => m[1])
    ),
  ];
  const bad = [];
  for (const p of pages) {
    const body = stripTags(noScript(p.html));
    for (const price of annual) {
      // 前面加边界,否则「27 元」里的「7 元」会被当成折算价命中
      const re = new RegExp(`(^|[^\\d.])${price.replace('.', '\\.')}\\s*元`, 'g');
      for (const m of all(body, re)) {
        // 折算价的说明常写在整段的开头或结尾,±70 字窗口盖不住,放宽到 ±200
        const ctx = body.slice(Math.max(0, m.index - 200), m.index + 220);
        if (!/年付|折算|按年|一整年|一次性支付/.test(ctx))
          bad.push(`${p.url} → ${price} 元 附近无付款周期标注:${ctx.slice(170, 260)}`);
      }
    }
  }
  record(
    'BLOCK',
    'T7-09',
    '年付折算价均带付款周期标注',
    bad.length === 0,
    bad.length
      ? bad.slice(0, 10)
      : `${annual.length} 个折算价(${annual.join(' / ')} 元)全部标注周期`
  );
}

// ── 11. SOGO 云 Hash 链接逐字未改 ───────────────────────────────
{
  const EXPECT = 'https://guangs.sogoyunaff.cc/#/?code=327Vs0w7';
  const inSrc = (await readFile('src/data/brands.ts', 'utf8')).includes(EXPECT);
  const p = pages.find((x) => x.url === '/reviews/sogoyun/');
  const inHtml = p ? p.html.includes(EXPECT) : false;
  record(
    'BLOCK',
    'T7-09b',
    'SOGO 云 Hash 推广链接逐字未改',
    inSrc && inHtml,
    inSrc && inHtml ? 'Hash 路径与 code 参数完整保留' : `源码=${inSrc} 产物=${inHtml}`
  );
}

// ── 12. 推广链接 rel 完整且页面有披露 ───────────────────────────
{
  const bad = [];
  for (const p of pages) {
    const affLinks = all(p.html, /<a\b[^>]*>/g).filter((m) => /sponsored/.test(m[0]));
    if (!affLinks.length) continue;
    for (const m of affLinks) {
      if (!/nofollow/.test(m[0]) || !/noopener/.test(m[0]))
        bad.push(`${p.url} → rel 不完整: ${m[0].slice(0, 90)}`);
    }
    if (!/推广|合作|返佣|佣金/.test(stripTags(noScript(p.html))))
      bad.push(`${p.url} → 有推广链接但页面无披露`);
  }
  record(
    'BLOCK',
    'T7-09c',
    '推广链接 rel 完整且页面有披露',
    bad.length === 0,
    bad.length ? bad.slice(0, 10) : '全部推广链接合规'
  );
}

// ── 13. meta 里引用的资源必须真实存在 ──────────────────────────
{
  // og:image 指向一个不存在的文件时,构建不报错、页面看起来也正常,
  // 只有把链接发到微信或 Telegram 才会发现没有预览图 —— 那时已经上线了。
  const refs = new Map();
  for (const p of pages) {
    for (const re of [
      /<meta property="og:image" content="([^"]+)"/g,
      /<meta name="twitter:image" content="([^"]+)"/g,
      /<link rel="icon"[^>]*href="([^"]+)"/g,
    ]) {
      for (const m of all(p.html, re)) refs.set(m[1], p.url);
    }
  }
  const bad = [];
  for (const [url, from] of refs) {
    if (!url.startsWith(SITE) && /^https?:/.test(url)) continue; // 站外资源不校验
    const rel = url.replace(SITE, '').replace(/^\//, '').split('?')[0];
    try {
      await stat(path.join(DIST, rel));
    } catch {
      bad.push(`${url} 不存在(引用自 ${from})`);
    }
  }
  record(
    'BLOCK',
    'T7-11c',
    'og:image / favicon 等 meta 资源均可取到',
    bad.length === 0,
    bad.length ? bad : `${refs.size} 个 meta 资源全部存在于产物中`
  );
}

// ── 14. 主推位:商业位必须自曝身份 ────────────────────────────
{
  const src = await readFile('src/data/brands.ts', 'utf8');
  const hasFeatured = /featured:\s*\{/.test(src);
  const problems = [];
  if (hasFeatured) {
    const home = pages.find((p) => p.url === '/');
    if (!home) problems.push('首页缺失,无法核对主推位');
    else if (!/id="featured"/.test(home.html)) problems.push('首页未渲染主推位');
    else {
      const body = stripTags(noScript(home.html));
      // 披露必须在产物里,不是只写在组件源码里
      for (const need of ['商业合作', '这不是排名结果', '谁应该跳过它']) {
        if (!body.includes(need)) problems.push(`主推位缺少「${need}」`);
      }
      // 主推位不得夹带评分类结构化数据
      const ld = all(home.html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
        .map((m) => m[1])
        .join(' ');
      if (/"aggregateRating"|"ratingValue"/.test(ld))
        problems.push('首页 JSON-LD 含评分字段,主推位不得产出评分信号');
      // 出口必须在同一屏,避免商业位成为内容死胡同
      if (!/href="\/airports\/"/.test(home.html) || !/href="\/rankings\/"/.test(home.html))
        problems.push('主推位缺少通往完整名单/客观排序的出口');
    }
  }
  record(
    'BLOCK',
    'T7-15',
    hasFeatured ? '主推位已披露为商业位且不产出评分信号' : '主推位未启用(跳过)',
    problems.length === 0,
    problems.length ? problems : hasFeatured ? '披露、跳过条件与出口三项齐备' : '当前无主推品牌'
  );
}

// ── 14. 表格已包滚动容器(移动端不横向溢出的结构前提)──────────
{
  const bad = [];
  for (const p of pages) {
    for (const m of all(p.html, /<table\b/g)) {
      const before = p.html.slice(Math.max(0, m.index - 300), m.index);
      // table-shell 的 overflow-x 写在 components.css 里,HTML 里只看得到类名
      if (!/md-table-scroll|table-scroll|table-shell|overflow/.test(before))
        bad.push(`${p.url} → 有未包滚动容器的表格`);
    }
  }
  record(
    'BLOCK',
    'T7-11b',
    '全部表格包在横向滚动容器内',
    bad.length === 0,
    bad.length ? [...new Set(bad)].slice(0, 10) : '全站表格均可横向滚动'
  );
}

// ── 输出 ─────────────────────────────────────────────────────────
const pad = (s, n) => {
  const w = [...s].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0);
  return s + ' '.repeat(Math.max(0, n - w));
};
console.log('');
console.log('═'.repeat(78));
console.log('  第三阶段 T7 发布验收(产物层)');
console.log('═'.repeat(78));
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`\n${r.ok ? '✓' : '✗'} [${r.level}] ${pad(r.id, 9)} ${r.name}`);
  for (const line of Array.isArray(r.detail) ? r.detail : [r.detail]) console.log(`      ${line}`);
}
console.log('');
console.log('─'.repeat(78));
console.log(`  ${results.length} 项检查 · ${results.length - failed} 通过 · ${failed} 失败`);
console.log('─'.repeat(78));
console.log('');
process.exit(failed ? 1 : 0);
