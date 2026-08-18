/**
 * 大纲去模板化审计(第三阶段 T3 门禁)。
 *
 * 指令原文:「每家建立独立大纲,不复制同一章节顺序后替换品牌名」。
 * 这条约束靠人眼很难守住——16 份大纲由 4 个智能体分批产出,
 * 批内能互相错开,**跨批次却看不到对方**,撞车正是这么发生的。
 *
 * 这个脚本做三件事:
 *   1. 章节标题去掉品牌名后两两比对相似度,揪出换词式重复
 *   2. 统计每份大纲的结构签名(章节数 + 各节数据层序列),重复签名报警
 *   3. 检查 canonical / 内链 / 数据层标注的合规性
 */
import { readFile } from 'node:fs/promises';

const FILE = process.argv[2];
if (!FILE) {
  console.error('用法: node scripts/audit-outline-uniqueness.mjs <brand-outlines.json>');
  process.exit(1);
}

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

const stripBom = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);
const outlines = JSON.parse(stripBom(await readFile(FILE, 'utf8')));

/** 抹掉品牌名与具体数字,只留下句式骨架 */
const skeleton = (s) => {
  let t = s;
  for (const n of BRAND_NAMES) t = t.split(n).join('※');
  return t
    .replace(/[\d.]+/g, '#')
    .replace(/[\s,。:;、「」()()??!!—·]/g, '')
    .toLowerCase();
};

/** 两个字符串的字符级 Jaccard 相似度 */
const similarity = (a, b) => {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((c) => B.has(c)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : inter / union;
};

const errors = [];
const warnings = [];

/* ---- 1. 章节标题跨品牌相似度 ----
 *
 * commercial 层的章节(价格、优惠、推广披露)刻意排除在外:
 * 这类区块**应该**全站一致——统一的商业披露是合规要求,
 * 为了「看起来不同」而改写披露措辞,反而会让读者更难识别它。
 * 模板化的真正风险在分析性章节,那才是这项检查的目标。
 */
const headingPairs = [];
for (let i = 0; i < outlines.length; i++) {
  for (let j = i + 1; j < outlines.length; j++) {
    for (const [ai, a] of outlines[i].sections.entries()) {
      if (a.dataLayer === 'commercial') continue;
      for (const [bi, b] of outlines[j].sections.entries()) {
        if (b.dataLayer === 'commercial') continue;
        const sim = similarity(skeleton(a.heading), skeleton(b.heading));
        if (sim >= 0.72) {
          headingPairs.push({
            a: `${outlines[i].slug}#${ai + 1}`,
            b: `${outlines[j].slug}#${bi + 1}`,
            sim: sim.toFixed(2),
            ta: a.heading,
            tb: b.heading,
          });
        }
      }
    }
  }
}

/* ---- 2. 结构签名重复 ---- */
const sigMap = new Map();
for (const o of outlines) {
  const sig = `${o.sections.length}|${o.sections.map((s) => s.dataLayer).join('>')}`;
  sigMap.set(sig, [...(sigMap.get(sig) ?? []), o.slug]);
}
const dupSigs = [...sigMap.entries()].filter(([, v]) => v.length > 1);

/* ---- 3. 合规检查 ---- */
const VALID_LAYERS = ['vendor', 'measured', 'commercial', 'editorial', 'mixed'];
for (const o of outlines) {
  if (o.canonical !== `/reviews/${o.slug}/`)
    errors.push(`${o.slug} canonical 应为 /reviews/${o.slug}/,实际 ${o.canonical}`);
  if (o.sections.length < 6) errors.push(`${o.slug} 章节仅 ${o.sections.length} 节,少于 6 节`);
  for (const s of o.sections) {
    if (!VALID_LAYERS.includes(s.dataLayer))
      errors.push(`${o.slug} 章节「${s.heading}」的 dataLayer「${s.dataLayer}」非法`);
  }
  if (!o.evidenceBlock?.cannotProve?.length) errors.push(`${o.slug} 缺少「不能证明」清单`);
  const measuredSections = o.sections.filter((s) => s.dataLayer === 'measured');
  if (measuredSections.length === 0)
    warnings.push(`${o.slug} 没有任何 measured 层章节,测速证据可能没有落点`);

  // 反过来要求:每份大纲都必须有商业披露落点。缺了它才是问题,一致不是问题
  const hasDisclosure =
    o.sections.some((s) => s.dataLayer === 'commercial') ||
    (o.disclosurePlacement ?? '').length > 20;
  if (!hasDisclosure) errors.push(`${o.slug} 缺少商业披露章节或披露位置说明`);
  for (const l of o.internalLinks ?? []) {
    if (!l.href.startsWith('/') || !l.href.endsWith('/'))
      errors.push(`${o.slug} 内链 ${l.href} 必须以 / 开头且以 / 结尾`);
    if (l.href === o.canonical) errors.push(`${o.slug} 内链指向自身`);
  }
  const faqUnanswered = (o.faq ?? []).filter((f) => !f.answeredIn || f.answeredIn.length < 4);
  if (faqUnanswered.length)
    errors.push(`${o.slug} 有 ${faqUnanswered.length} 条 FAQ 没写明正文落点`);
}

/* ---- 输出 ---- */
const line = '═'.repeat(74);
console.log(line);
console.log(`大纲去模板化审计 · ${outlines.length} 份`);
console.log(line);

console.log('\n【章节标题结构多样性】');
console.log(`  跨品牌相似标题对(阈值 0.72):${headingPairs.length}`);
if (headingPairs.length) {
  for (const p of headingPairs.slice(0, 10)) {
    console.log(`  ⚠ ${p.sim}  ${p.a} ↔ ${p.b}`);
    console.log(`      「${p.ta}」`);
    console.log(`      「${p.tb}」`);
  }
  if (headingPairs.length > 10) console.log(`      …还有 ${headingPairs.length - 10} 对`);
}

console.log('\n【结构签名】');
console.log(`  ${sigMap.size} 种不同签名 / ${outlines.length} 份大纲`);
if (dupSigs.length) {
  for (const [sig, slugs] of dupSigs) {
    console.log(`  ⚠ 签名重复:${slugs.join(' / ')}`);
    console.log(`      ${sig}`);
  }
} else {
  console.log('  ✓ 每份大纲的章节数与数据层序列组合都不相同');
}

console.log('\n【首节开篇】');
for (const o of outlines) {
  console.log(`  ${o.slug.padEnd(14)} ${o.sections[0].heading}`);
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

if (headingPairs.length > 0) {
  console.error(`\n✗ 存在 ${headingPairs.length} 对高相似度章节标题,属于模板换词,需要改写`);
  process.exit(1);
}

console.log(`\n✓ T3 去模板化门禁通过(${warnings.length} 条警告)`);
