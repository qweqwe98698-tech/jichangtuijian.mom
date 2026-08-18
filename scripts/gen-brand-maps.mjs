/**
 * 从 src/data/brand-keywords.ts 生成 T3 的两份交付文档。
 *
 * 刻意做成生成器而不是手写文档:手写的映射表会在代码改动后静默过期,
 * 而这两份文档正是用来证明「关键词唯一归属」的,过期等于失效。
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BRANDS } from '../src/data/brands.ts';
import { BRAND_KEYWORDS, brandUrl, IN_PAGE_COVERAGE } from '../src/data/brand-keywords.ts';
import { assetForBrand, SPEEDTEST_BATCH } from '../src/data/evidence.ts';

const stamp = '2026-08-18';
const name = (slug) => BRANDS.find((b) => b.slug === slug)?.name ?? slug;

/* ---------- BRAND-KEYWORD-MAP ---------- */

let km = `# 品牌关键词映射表(BRAND-KEYWORD-MAP)

生成时间:${stamp}
生成方式:\`node scripts/gen-brand-maps.mjs\`,数据源为 \`src/data/brand-keywords.ts\`
唯一性校验:\`src/lib/brand-keywords.test.ts\`(9 项断言,构建前必过)

---

## 归属原则

品牌名、官网、注册、套餐、价格、优惠码、怎么样、稳定性、安全性这些**同意图词全部归属品牌主页面**,
不拆成多个页面互抢。主词统一取「<品牌>怎么样」——品牌查询里意图最明确、承接面最宽的一个。

以下查询**不单独建页**,在品牌页内消化:

| 查询类型 | 页面内落点 |
| --- | --- |
${Object.entries(IN_PAGE_COVERAGE)
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join('\n')}

理由(指令 T3.5):品牌故障 / 跑路 / 风险类查询没有独立于品牌页的搜索意图,
而且本站没有任何一家的运营异常事实可以支撑独立页面。凭空建页就是薄内容。

---

## 逐品牌映射

`;

for (const k of BRAND_KEYWORDS) {
  const b = BRANDS.find((x) => x.slug === k.slug);
  const asset = assetForBrand(k.slug);
  km += `### ${name(k.slug)}

| 项 | 值 |
| --- | --- |
| URL | \`${brandUrl(k.slug)}\` |
| 主关键词 | **${k.primary}** |
| 次关键词 | ${k.secondary.join(' · ')} |
| 搜索意图 | ${k.intent} |
| 决策阶段 | ${k.stage} |
| 上游入口 | ${k.upstream.join(' · ')} |
| 下游去向 | ${k.downstream.join(' · ')} |
| 测速证据 | \`${asset?.file ?? '—'}\`(${asset?.testedAt.slice(11, 19) ?? '—'},${asset?.protocolDisplayed ?? '—'}) |
| 证据状态 | ${SPEEDTEST_BATCH.reviewStatus}${asset?.dateConfidence !== 'visible-in-image' ? ' · **日期需复核**' : ''} |
| 复查频率 | ${k.updateFrequency} |
| 计价口径 | ${b.vendor.pricing.basis === 'annual-equivalent' ? '**年付折算**(不可与月付混排)' : '月付'} |

GEO 长尾问题(必须在正文有真实回答位置):

${k.geoQuestions.map((q) => `- ${q}`).join('\n')}

`;
}

await writeFile(path.resolve('docs/BRAND-KEYWORD-MAP.md'), km, 'utf8');

/* ---------- BRAND-URL-MAP ---------- */

let um = `# 品牌 URL 映射表(BRAND-URL-MAP)

生成时间:${stamp}
生成方式:\`node scripts/gen-brand-maps.mjs\`

---

## 决策:沿用 \`/reviews/\`,不另建 \`/brands/\`

指令 T3.2 要求「每家品牌只建立一个主页面,优先沿用 \`/brands/<brand-slug>/\` 或已确认 URL」。

本站在第一、二阶段已经建立并收录了 \`/reviews/<slug>/\`,16 个 URL 全部存在且已进入 sitemap 与内链体系。
**另建 \`/brands/\` 会与之竞争同一批关键词**,违反指令 §十三红线第 13 条(不创建与第二阶段品牌页竞争的新 URL)。

因此:品牌库页面(T4)链接到现有的 \`/reviews/<slug>/\`,不产生第二套品牌详情 URL。

---

## 16 个品牌主页面

| 品牌 | slug | URL | 主关键词 | 入门价 | 计价口径 |
| --- | --- | --- | --- | --- | --- |
`;

for (const k of BRAND_KEYWORDS) {
  const b = BRANDS.find((x) => x.slug === k.slug);
  um += `| ${name(k.slug)} | \`${k.slug}\` | \`${brandUrl(k.slug)}\` | ${k.primary} | ${b.vendor.pricing.entryPriceCNY} 元 | ${b.vendor.pricing.basis === 'annual-equivalent' ? '年付折算' : '月付'} |\n`;
}

um += `
---

## 相关 URL 命名空间

| 命名空间 | 用途 | 与品牌页的关系 |
| --- | --- | --- |
| \`/reviews/\` | 品牌评测索引 | 品牌页的上游入口 |
| \`/reviews/<slug>/\` | **品牌主页面(唯一)** | — |
| \`/compare/<a>-vs-<b>/\` | 两两对比,slug 按字典序 | 下游;每个品牌至少被 2 个对比页链接 |
| \`/rankings/<scene>/\` | 场景榜单 | 上游;按客观字段筛选,**不按总分排序** |
| \`/airports/\` | 品牌库(T4 待建) | 上游;链接到 \`/reviews/<slug>/\`,不重复建详情页 |

---

## 证据资源路径

| 资源 | 路径 |
| --- | --- |
| 原图(只读) | \`/evidence/speedtest/${SPEEDTEST_BATCH.measurementDate}/<品牌>-节点测速实测.png\` |
| 批次说明 | \`/evidence/speedtest/${SPEEDTEST_BATCH.measurementDate}/README_16个机场测速实测资料_最新版.txt\` |
| 机读 manifest | \`/evidence/speedtest/${SPEEDTEST_BATCH.measurementDate}/speedtest-manifest.json\` |

原图只读保存,不裁剪、不覆盖、不改写图内数值。衍生图由 \`astro:assets\` 从
\`src/assets/evidence/speedtest/\` 生成,必须标注 Derived View 并可追溯到原图 SHA-256。
`;

await writeFile(path.resolve('docs/BRAND-URL-MAP.md'), um, 'utf8');

console.log('✓ docs/BRAND-KEYWORD-MAP.md');
console.log('✓ docs/BRAND-URL-MAP.md');
console.log(
  `  ${BRAND_KEYWORDS.length} 家品牌 · ${BRAND_KEYWORDS.length} 个主词 · ${BRAND_KEYWORDS.reduce((n, k) => n + k.secondary.length, 0)} 个次词 · ${BRAND_KEYWORDS.reduce((n, k) => n + k.geoQuestions.length, 0)} 个 GEO 问题`
);
