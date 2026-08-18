/**
 * 内容合规检测。在 `astro build` 之后对 dist 执行。
 *
 * 覆盖内链规则:
 *   R09 免费节点栏目净化(不得出现任何可用节点/订阅协议前缀)
 *   R10 品牌外链合规(必须带 sponsored + nofollow + noopener,且页面存在合作披露)
 *   R11 品牌链接密度(知识型栏目正文不得出现品牌卡)
 *   R15 索引页权重隔离(/tags/ /search/ /404/ 必须 noindex)
 *
 * 另外做几项 SEO 底线检查:title / description / canonical / h1 唯一性 / JSON-LD 可解析。
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');

/** 节点分发相关的协议前缀,免费节点与风险栏目一旦出现即视为违规 */
const NODE_PROTOCOLS = /\b(ss|ssr|vmess|vless|trojan|hysteria2?|clash|sub):\/\//i;

/** 不得在正文出现品牌卡的栏目 */
const NO_BRAND_CARD = ['/basics/', '/protocols/', '/risk/', '/free-nodes/'];

/** 必须 noindex 的路径前缀 */
const MUST_NOINDEX = ['/tags/', '/search/', '/404'];

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

const errors = [];
const warnings = [];
let scanned = 0;

/** 读取 brands.ts 里的推广域名,用于校验外链合规 */
const brandsSrc = await readFile(path.resolve('src/data/brands.ts'), 'utf8');
const vendorHosts = [...brandsSrc.matchAll(/affiliateUrl:\s*'https:\/\/([^/']+)/g)].map(
  (m) => m[1]
);

for await (const file of walk(DIST)) {
  const html = await readFile(file, 'utf8');
  const route = toRoute(file);
  scanned++;

  /* ---- SEO 底线 ---- */
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  if (!title) errors.push(`${route}  缺少 <title>`);
  else if (title.length > 70) warnings.push(`${route}  title 过长(${title.length} 字符)`);

  const desc = html.match(/<meta name="description" content="([^"]*)"/i)?.[1];
  if (!desc) errors.push(`${route}  缺少 meta description`);
  else if (desc.length < 40 || desc.length > 170)
    warnings.push(`${route}  description 长度 ${desc.length},建议 40-160`);

  if (!/<link rel="canonical"/i.test(html)) errors.push(`${route}  缺少 canonical`);

  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  if (h1Count !== 1) errors.push(`${route}  H1 数量为 ${h1Count},应为 1`);

  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1];
  if (!ld) errors.push(`${route}  缺少 JSON-LD`);
  else {
    try {
      const parsed = JSON.parse(ld);
      if (!Array.isArray(parsed['@graph']) || parsed['@graph'].length === 0)
        errors.push(`${route}  JSON-LD @graph 为空`);
    } catch {
      errors.push(`${route}  JSON-LD 无法解析`);
    }
  }

  /* ---- R15 索引页权重隔离 ---- */
  if (MUST_NOINDEX.some((p) => route.startsWith(p))) {
    if (!/<meta name="robots" content="noindex/i.test(html))
      errors.push(`${route}  必须输出 noindex(R15)`);
  }

  /* ---- R09 免费节点栏目净化 ---- */
  if (route.startsWith('/free-nodes/')) {
    // 只检查正文区,避免误伤代码高亮示例之外的正常文字
    const bodyOnly = html
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '');
    const hit = bodyOnly.match(NODE_PROTOCOLS);
    if (hit) errors.push(`${route}  免费节点栏目出现节点协议前缀「${hit[0]}」(R09)`);
    for (const host of vendorHosts) {
      if (bodyOnly.includes(host))
        errors.push(`${route}  免费节点栏目出现品牌推广域名 ${host}(R09)`);
    }
  }

  /* ---- R11 知识型栏目不得出现品牌卡 ---- */
  if (NO_BRAND_CARD.some((p) => route.startsWith(p)) && /class="bcard/.test(html)) {
    errors.push(`${route}  知识型栏目正文出现品牌卡(R11)`);
  }

  /* ---- 测速证据的表述红线 ----
   *
   * 当前 transcriptStatus = not-transcribed:没有任何一个图中数值经过人工核对。
   * 因此品牌评测页上出现的任何具体速率数字都不可能有来源,只可能是编造或
   * 从截图目测得来的——两种都被指令明令禁止。
   *
   * 单位换算尤其危险:把图里的 MB 写成 MB/s,数值凭空放大 8 倍,读起来却毫无破绽。
   */
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');

  if (route.startsWith('/reviews/') && route !== '/reviews/') {
    const speedClaim = bodyText.match(/\d+(\.\d+)?\s*(MB\s*\/\s*s|Mbps|MB\/s|兆每秒)/i);
    if (speedClaim)
      errors.push(
        `${route}  品牌页出现具体速率数值「${speedClaim[0].trim()}」,但本批证据尚未转录,该数字无来源`
      );
  }

  /* 指令 §八 逐字列出的禁语,全站适用 */
  const FORBIDDEN_PHRASES = [
    { re: /所有节点都能满速|全部节点满速/, why: '同一张图里就同时存在高速节点与 0B 节点' },
    { re: /100\s*%\s*解锁|全区解锁|全部解锁/, why: '本批次没有测过任何解锁能力' },
    { re: /无日志/, why: '无法验证的隐私声明' },
    { re: /绝对安全|完全安全/, why: '不存在可验证的绝对安全' },
    { re: /永不(掉线|跑路|限速)/, why: '无法对未来做承诺' },
  ];
  /*
   * 关键难点:本站大量内容的价值恰恰在于**批判**这些话术
   * (「任何『全部解锁』的说法都应该被怀疑」「识别永久有效、绝对不跑路、100% 解锁」),
   * 把它们一律判为违规会逼着作者绕开这个话题,反而降低内容质量。
   *
   * 判定规则:被引号包起来、或前后出现批判/枚举信号的,视为「在讨论这个说法」而非「在主张它」。
   * 只有赤裸裸的断言才算违规。
   */
  const QUOTES = ['「', '」', '"', '"', '『', '』', "'", '&quot;', '&#34;'];
  const CRITIQUE_BEFORE =
    /(不能|不得|禁止|别信|不要|无法|不存在|任何|所谓|声称|号称|自称|识别|典型包括|警惕|常见的?话术|宣传语|营销话术|与其寻找|不做任何|避免|谨防|这类)[^。;!?]{0,20}$/;
  const CRITIQUE_AFTER =
    /^[^。;!?]{0,30}(的说法|这类说法|都应该被怀疑|应当怀疑|不成立|是营销话术|不可信|站不住|基本不可能|请直接跳过|是危险信号|无法保证|无法验证|无法被验证|无法事先确认|为什么不可能|判定权|取决于|随时变化|扣分)/;

  for (const f of FORBIDDEN_PHRASES) {
    for (const hit of bodyText.matchAll(new RegExp(f.re, 'g'))) {
      const idx = hit.index ?? 0;
      const before = bodyText.slice(Math.max(0, idx - 40), idx);
      const after = bodyText.slice(idx + hit[0].length, idx + hit[0].length + 40);

      // 紧邻引号 = 在引述某个说法,不是本站在主张
      const quoted =
        QUOTES.some((q) => before.trimEnd().endsWith(q)) ||
        QUOTES.some((q) => after.trimStart().startsWith(q));

      if (quoted || CRITIQUE_BEFORE.test(before) || CRITIQUE_AFTER.test(after)) continue;

      errors.push(
        `${route}  出现禁用表述「${hit[0]}」(${f.why});上文:…${before.trim().slice(-24)}`
      );
    }
  }

  /* ---- R10 品牌外链合规 ---- */
  const anchors = [...html.matchAll(/<a\b([^>]*?)>/gi)].map((m) => m[1]);
  let hasVendorLink = false;
  for (const attrs of anchors) {
    const href = attrs.match(/href="([^"]+)"/)?.[1];
    if (!href || !vendorHosts.some((h) => href.includes(h))) continue;
    hasVendorLink = true;

    const rel = attrs.match(/rel="([^"]*)"/)?.[1] ?? '';
    for (const token of ['sponsored', 'nofollow', 'noopener']) {
      if (!rel.includes(token)) errors.push(`${route}  品牌外链缺少 rel="${token}"(R10):${href}`);
    }
    if (!/target="_blank"/.test(attrs)) errors.push(`${route}  品牌外链缺少 target="_blank"(R10)`);
  }
  if (hasVendorLink && !/class="disclosure/.test(html)) {
    errors.push(`${route}  出现品牌推广链接但缺少合作披露组件(R10)`);
  }
}

const line = '─'.repeat(64);
console.log(line);
console.log(`内容合规检测:扫描 ${scanned} 个页面 · ${vendorHosts.length} 个推广域名`);
console.log(line);

if (warnings.length) {
  console.log(`\n⚠  ${warnings.length} 条警告:`);
  for (const w of warnings.slice(0, 40)) console.log(`   ${w}`);
  if (warnings.length > 40) console.log(`   …还有 ${warnings.length - 40} 条`);
}

if (errors.length) {
  console.error(`\n✗  ${errors.length} 条错误:`);
  for (const e of errors.slice(0, 60)) console.error(`   ${e}`);
  if (errors.length > 60) console.error(`   …还有 ${errors.length - 60} 条`);
  process.exit(1);
}

console.log(`\n✓  全部通过(${warnings.length} 条警告)`);
