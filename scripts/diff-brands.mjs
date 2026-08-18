/**
 * T2 品牌数据差异比对。
 *
 * 第三阶段指令明确要求:「检查第三阶段品牌清单与第二阶段品牌数据的差异;冲突字段不静默覆盖」。
 * 这个脚本把新清单解析出来,逐字段与当前 brands.ts 比对,只报告差异,不修改任何数据。
 *
 * 用法: node scripts/diff-brands.mjs <新品牌清单.txt>
 */
import { readFile } from 'node:fs/promises';
import { BRANDS } from '../src/data/brands.ts';

const LIST_PATH = process.argv[2];
if (!LIST_PATH) {
  console.error('用法: node scripts/diff-brands.mjs <新品牌清单.txt>');
  process.exit(1);
}

const raw = await readFile(LIST_PATH, 'utf8');

/**
 * 兼容两种清单格式:
 *   旧版纯文本  「1. 光速云」 + 「优惠码： AMM」
 *   新版 Markdown「# 1. 光速云」 + 「**优惠码：** `AMM`」
 * 两版都用全角冒号,字段值可能被 ** 或 ` 包裹。
 */
/* 源文件里有 `---# 4. U1S1` 这种分隔线与标题紧贴的写法,先把它拆开再切块 */
const blocks = raw
  .replace(/---\s*#\s*(\d+\.)/g, '\n\n# $1')
  .split(/\r?\n(?=#*\s*\d+\.\s)/)
  .map((b) => b.trim())
  .filter((b) => /^#*\s*\d+\.\s/.test(b));

/** 去掉 Markdown 强调与代码标记,只留字面值 */
const clean = (s) =>
  s
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s{2,}$/, '')
    .trim();

const field = (block, key) => {
  const m = block.match(new RegExp(`^\\*{0,2}${key}\\*{0,2}[：:]\\*{0,2}\\s*(.+)$`, 'm'));
  return m ? clean(m[1]) : null;
};

/** 从「17 元/月,110GB」或「年付折合约 7.5 元/月,59GB」里抽价格、流量与计价口径 */
function parsePlan(text) {
  if (!text) return null;
  const price = text.match(/([\d.]+)\s*元\s*\/\s*月/);
  const traffic = text.match(/([\d.]+)\s*GB/i);
  const isAnnual = /年付/.test(text);
  return {
    priceCNY: price ? Number(price[1]) : null,
    trafficGB: traffic ? Number(traffic[1]) : null,
    basis: isAnnual ? 'annual-equivalent' : 'monthly',
    raw: text,
  };
}

const NAME_TO_SLUG = new Map(BRANDS.map((b) => [b.name.replace(/\s+/g, ''), b.slug]));

const rows = [];
for (const block of blocks) {
  const name = clean(block.match(/^#*\s*\d+\.\s*(.+)$/m)?.[1] ?? '');
  if (!name) continue;
  const slug = NAME_TO_SLUG.get(name.replace(/\s+/g, ''));
  if (!slug) continue;

  /* 注册链接在新版里是独立成行的裸 URL,不在「注册链接:」同一行 */
  const url =
    field(block, '注册链接') ??
    block.match(/^\*{0,2}注册链接\*{0,2}[：:]\s*\r?\n\s*(https?:\/\/\S+)/m)?.[1] ??
    null;

  rows.push({
    slug,
    name,
    plan: parsePlan(field(block, '入门套餐')),
    since: Number((field(block, '开业时间') ?? '').replace(/[^\d]/g, '')) || null,
    promoCode: field(block, '优惠码'),
    promoText: field(block, '优惠活动'),
    url,
    lines: field(block, '线路特点'),
    protocols: field(block, '协议类型'),
    priceType: field(block, '价格类型'),
  });
}

const diffs = [];
const same = [];

for (const n of rows) {
  const cur = BRANDS.find((b) => b.slug === n.slug);
  if (!cur) continue;
  const p = cur.vendor.pricing;
  const local = [];

  if (n.plan?.priceCNY != null && n.plan.priceCNY !== p.entryPriceCNY)
    local.push({ f: '入门价格', old: `${p.entryPriceCNY} 元`, neu: `${n.plan.priceCNY} 元` });
  if (n.plan?.trafficGB != null && n.plan.trafficGB !== p.trafficGB)
    local.push({ f: '入门流量', old: `${p.trafficGB} GB`, neu: `${n.plan.trafficGB} GB` });
  if (n.plan && n.plan.basis !== p.basis)
    local.push({ f: '计价口径', old: p.basis, neu: n.plan.basis });
  if (n.since && n.since !== cur.vendor.since)
    local.push({ f: '开业年份', old: String(cur.vendor.since), neu: String(n.since) });
  if (n.promoCode && n.promoCode !== cur.commercial.promoCode)
    local.push({ f: '优惠码', old: cur.commercial.promoCode ?? '(无)', neu: n.promoCode });
  if (n.url && n.url !== cur.commercial.affiliateUrl)
    local.push({ f: '推广链接', old: cur.commercial.affiliateUrl, neu: n.url });

  /* 协议:新清单出现「未统一提供」而站上写了具体协议,属于把未知写成了已知,必须报出来 */
  if (n.protocols) {
    const unknown = /未统一提供|未提供|无统一/.test(n.protocols);
    const curProto = cur.vendor.protocols.join('/');
    if (unknown && cur.vendor.protocols.length > 0) {
      local.push({ f: '协议类型', old: curProto, neu: '当前资料未统一提供(站上写了具体协议)' });
    } else if (!unknown && !n.protocols.includes(curProto)) {
      local.push({ f: '协议类型', old: curProto, neu: n.protocols });
    }
  }

  /* 线路:只做提示性比对,措辞差异不算冲突,但关键词缺失要报 */
  if (n.lines) {
    const curLines = cur.vendor.lines.join('/');
    const newHasIepl = /IEPL/i.test(n.lines);
    const curHasIepl = cur.vendor.lines.includes('IEPL');
    if (newHasIepl !== curHasIepl) {
      local.push({ f: '线路(IEPL)', old: curLines, neu: n.lines });
    }
  }

  if (local.length) diffs.push({ slug: n.slug, name: n.name, fields: local, rawPlan: n.plan?.raw });
  else same.push(n.name);
}

console.log('═'.repeat(74));
console.log(`T2 品牌数据差异比对 · 新清单 ${rows.length} 家 / 当前数据 ${BRANDS.length} 家`);
console.log('═'.repeat(74));

if (rows.length !== BRANDS.length) {
  console.log(`\n⚠ 解析出的品牌数与当前数据不等,请检查清单格式`);
}

console.log(`\n【一致】${same.length} 家:${same.join('、')}`);

if (diffs.length === 0) {
  console.log('\n✓ 无字段冲突');
} else {
  console.log(`\n【冲突】${diffs.length} 家 —— 按指令不得静默覆盖,需人工裁决:\n`);
  for (const d of diffs) {
    console.log(`  ${d.name} (${d.slug})`);
    if (d.rawPlan) console.log(`    新清单原文: 入门套餐:${d.rawPlan}`);
    for (const f of d.fields) {
      console.log(`    ${f.f.padEnd(6)} 当前: ${String(f.old).padEnd(26)} → 新清单: ${f.neu}`);
    }
    console.log('');
  }
}

/* 影响面提示:价格与流量是评分输入,改动会波及全站 */
if (diffs.some((d) => d.fields.some((f) => ['入门价格', '入门流量', '计价口径'].includes(f.f)))) {
  console.log('影响面:');
  console.log('  · 单位流量成本会变 → 性价比维度是全站归一化的,一家变动会改变所有品牌的得分');
  console.log('  · 计价口径变动会改变该品牌在「月付 / 年付折算」分组中的归属');
  console.log('  · 首页结论段、榜单筛选结果、对比页判定、/editorial-policy/ 的复算示例都会跟着变');
  console.log('  · src/lib/rubric-examples.test.ts 会失败 —— 那是提醒同步的信号,不是 bug');
}
