/**
 * 品牌档案的去模板化与完整性审计(第三阶段 T5 门禁)。
 *
 * 指令原文:「每页有独立信息增量;没有模板换词」。
 * 这条约束靠人眼守不住 —— 16 份档案由多个智能体分批产出,批内能互相错开,
 * **跨批次却看不到对方**。T3 阶段就是这么撞车的(光年梯 vs 全球云)。
 *
 * 检查项:
 *   1. 章节标题跨品牌相似度(抹掉品牌名与数字后比对句式骨架)
 *   2. 结构签名重复(章节数 + 首节句式)
 *   3. 正文不得重复模板已渲染的结构块
 *   4. 与 BRANDS 一一对应,slug 合法
 *   5. 红线:速率数值、禁语、自营
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = path.resolve('src/content/brand-profiles');

const BRAND_SLUGS = [
  'guangsuyun',
  'xingdaomeng',
  'lingmao',
  'feimaoyun',
  'weituyun',
  'yuzhouyun',
  'u1s1',
  'jilianyun',
  'guangnianti',
  'yifanyun',
  'ermaoyun',
  'sogoyun',
  'kexinyun',
  'sujie',
  'kuaili',
  'quanqiuyun',
];

const BRAND_NAMES = [
  '光速云',
  '星岛梦',
  '灵猫网络',
  '灵猫',
  '飞猫云',
  '唯兔云',
  '宇宙云',
  'U1S1',
  '极连云',
  '光年梯',
  '一翻云',
  '二猫云',
  'SOGO 云',
  'SOGO云',
  'SOGO',
  '可信云',
  '速界',
  '快狸',
  '全球云',
];

/** 模板已经渲染的结构块。正文里再写一遍就是重复劳动,也会让页面读起来像两遍 */
const TEMPLATE_SECTIONS = [
  { re: /^##\s*(套餐与线路规格|规格表|基本参数|套餐规格)/m, what: '规格表(模板已渲染)' },
  { re: /^##\s*(编辑评分明细|评分明细|评分拆解)/m, what: '评分明细(模板已渲染)' },
  { re: /^##\s*(优点与需要权衡|优缺点)\s*$/m, what: '优缺点两栏(模板已渲染)' },
  { re: /^##\s*(优惠与注册|注册与优惠)/m, what: '优惠注册区块(模板已渲染)' },
  { re: /^##\s*(常见问题|FAQ)\s*$/m, what: 'FAQ(模板从 frontmatter 渲染)' },
];

const skeleton = (s) => {
  let t = s;
  for (const n of BRAND_NAMES) t = t.split(n).join('※');
  return t
    .replace(/[\d.]+/g, '#')
    .replace(/[\s,。:;、「」『』()()??!!—·]/g, '')
    .toLowerCase();
};

const similarity = (a, b) => {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((c) => B.has(c)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : inter / union;
};

const cjk = (s) => (s.match(/[一-鿿]/g) ?? []).length;

let files;
try {
  files = (await readdir(DIR)).filter((f) => f.endsWith('.md'));
} catch {
  console.log('尚无品牌档案目录,跳过');
  process.exit(0);
}

const errors = [];
const warnings = [];
const profiles = [];

for (const file of files) {
  const slug = path.basename(file, '.md');
  const src = await readFile(path.join(DIR, file), 'utf8');
  const body = src.replace(/^---[\s\S]*?---/, '');

  if (!BRAND_SLUGS.includes(slug)) {
    errors.push(`${slug} 不是有效的品牌 slug`);
    continue;
  }

  const headings = [...body.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) =>
    m[1].replace(/\s*#\s*$/, '').trim()
  );
  const words = cjk(body);

  if (headings.length < 5) errors.push(`${slug} 只有 ${headings.length} 个 H2,少于 5 节`);
  if (words < 1000) errors.push(`${slug} 正文仅 ${words} 中文字,过短`);
  else if (words > 2600) warnings.push(`${slug} 正文 ${words} 中文字,超出 2200 目标值`);

  for (const t of TEMPLATE_SECTIONS) {
    if (t.re.test(body)) errors.push(`${slug} 正文重复了${t.what}`);
  }

  /* 速率数值:测速证据尚未转录,任何具体速率都无来源 */
  const speed = body.match(/\d+(\.\d+)?\s*(MB\s*\/\s*s|Mbps|兆每秒)/i);
  if (speed) errors.push(`${slug} 出现无来源速率数值「${speed[0].trim()}」`);

  /* 「自营」只允许出现在否定语境 */
  for (const m of body.matchAll(/(.{0,8})自营/g)) {
    if (!/(没有|不是|非|无|并非|而非|全部为推广|不存在)\s*$/.test(m[1])) {
      errors.push(`${slug} 声称「自营」(上文:…${m[1]})`);
    }
  }

  /* frontmatter 必填项的存在性(长度由 Zod 保证,这里只查漏) */
  for (const key of ['differentiator', 'whenToPickOthers', 'supportEntry', 'ctaCondition']) {
    if (!new RegExp(`^${key}:`, 'm').test(src)) errors.push(`${slug} 缺少 frontmatter 字段 ${key}`);
  }

  profiles.push({ slug, headings, words });
}

/* ---- 跨品牌章节相似度 ---- */
const pairs = [];
for (let i = 0; i < profiles.length; i++) {
  for (let j = i + 1; j < profiles.length; j++) {
    for (const [ai, a] of profiles[i].headings.entries()) {
      for (const [bi, b] of profiles[j].headings.entries()) {
        const sim = similarity(skeleton(a), skeleton(b));
        if (sim >= 0.75) {
          pairs.push({
            a: `${profiles[i].slug}#${ai + 1}`,
            b: `${profiles[j].slug}#${bi + 1}`,
            sim: sim.toFixed(2),
            ta: a,
            tb: b,
          });
        }
      }
    }
  }
}

/* ---- 首节开篇是否雷同 ---- */
const openings = new Map();
for (const p of profiles) {
  const k = skeleton(p.headings[0] ?? '');
  openings.set(k, [...(openings.get(k) ?? []), p.slug]);
}
const dupOpenings = [...openings.entries()].filter(([, v]) => v.length > 1);

const line = '═'.repeat(74);
console.log(line);
console.log(`品牌档案审计 · ${profiles.length} / ${BRAND_SLUGS.length} 家已撰写`);
console.log(line);

const missing = BRAND_SLUGS.filter((s) => !profiles.some((p) => p.slug === s));
if (missing.length) console.log(`\n未撰写:${missing.join('、')}`);

console.log('\n【各家骨架】');
for (const p of profiles.sort((a, b) => a.slug.localeCompare(b.slug))) {
  console.log(
    `  ${p.slug.padEnd(13)} ${String(p.words).padStart(4)} 字 · ${p.headings.length} 节 · ${p.headings[0]}`
  );
}

console.log(`\n【跨品牌相似章节】阈值 0.75:${pairs.length} 对`);
for (const p of pairs.slice(0, 8)) {
  console.log(`  ⚠ ${p.sim}  ${p.a} ↔ ${p.b}`);
  console.log(`      「${p.ta}」`);
  console.log(`      「${p.tb}」`);
}

if (dupOpenings.length) {
  console.log('\n【首节开篇雷同】');
  for (const [, slugs] of dupOpenings) console.log(`  ⚠ ${slugs.join(' / ')}`);
}

if (warnings.length) {
  console.log(`\n⚠ ${warnings.length} 条警告:`);
  for (const w of warnings) console.log(`   ${w}`);
}

if (errors.length) {
  console.error(`\n✗ ${errors.length} 条错误:`);
  for (const e of errors) console.error(`   ${e}`);
  process.exit(1);
}
if (pairs.length || dupOpenings.length) {
  console.error(`\n✗ 存在模板换词风险,需要改写`);
  process.exit(1);
}

console.log(`\n✓ T5 去模板化门禁通过(${warnings.length} 条警告)`);
