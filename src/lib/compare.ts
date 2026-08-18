import {
  BRANDS,
  getBrand,
  costPerGB,
  formatCostPerGB,
  protocolLabel,
  lineLabel,
} from '@data/brands';
import type { Brand } from '@data/brands';

/**
 * 品牌对比工具。
 *
 * URL 稳定性要求(内链规则 R08):对比页的 slug 必须由两个品牌 slug 按字典序排序后拼接,
 * 保证 A-vs-B 与 B-vs-A 永远解析到同一个 URL,不会产生重复内容。
 */

export function pairSlug(a: string, b: string): string {
  return [a, b].sort().join('-vs-');
}

/**
 * 跨计价口径的对比页。
 *
 * `comparableWith` 是「同价位可比品牌」——它有意只收同口径的品牌,
 * 因为把 7.5 元年付折算和 18 元月付并列在"同价位"里会误导读者。
 *
 * 但「月付 18 元 vs 年付折算 7.5 元该怎么选」本身是个真实且高频的问题,
 * 只是它属于**计价形态对比**而不是同价位对比。这类组合在这里单独登记,
 * 于是两种需求各自成立,互不污染。
 */
const CROSS_BASIS_PAIRS: [string, string][] = [
  ['guangsuyun', 'jilianyun'],
  ['guangnianti', 'guangsuyun'],
  ['guangsuyun', 'yuzhouyun'],
  ['feimaoyun', 'weituyun'],
  ['lingmao', 'xingdaomeng'],
];

/** 全部去重对比组合:同价位可比 + 跨计价口径 */
export function comparePairs(): [string, string][] {
  const seen = new Set<string>();
  const pairs: [string, string][] = [];

  const add = (x: string, y: string) => {
    const [a, b] = [x, y].sort();
    const key = `${a}|${b}`;
    if (a !== b && !seen.has(key) && getBrand(a) && getBrand(b)) {
      seen.add(key);
      pairs.push([a, b]);
    }
  };

  for (const brand of BRANDS) {
    for (const peer of brand.editorial.comparableWith) add(brand.slug, peer);
  }
  for (const [a, b] of CROSS_BASIS_PAIRS) add(a, b);

  return pairs;
}

export interface DiffRow {
  label: string;
  a: string;
  b: string;
  /** 哪一方在该项上更占优;tie 表示本项没有客观优劣 */
  winner: 'a' | 'b' | 'tie';
  /** 该项为什么这样判定,避免读者把编辑判断误读为客观事实 */
  note?: string;
}

/** 逐项对比。只对存在客观可比口径的项目判定优劣,其余一律 tie 并说明原因 */
export function diffRows(a: Brand, b: Brand): DiffRow[] {
  const rows: DiffRow[] = [];

  const sameBasis = a.vendor.pricing.basis === b.vendor.pricing.basis;
  rows.push({
    label: '入门价格',
    a: `${a.vendor.pricing.entryPriceCNY} 元${a.vendor.pricing.basis === 'annual-equivalent' ? '(年付折算)' : '/月'}`,
    b: `${b.vendor.pricing.entryPriceCNY} 元${b.vendor.pricing.basis === 'annual-equivalent' ? '(年付折算)' : '/月'}`,
    winner: !sameBasis
      ? 'tie'
      : a.vendor.pricing.entryPriceCNY === b.vendor.pricing.entryPriceCNY
        ? 'tie'
        : a.vendor.pricing.entryPriceCNY < b.vendor.pricing.entryPriceCNY
          ? 'a'
          : 'b',
    note: sameBasis
      ? undefined
      : '两者计价口径不同(月付 vs 年付折算),价格不具备直接可比性,因此本项不判优劣。',
  });

  rows.push({
    label: '入门流量',
    a: `${a.vendor.pricing.trafficGB} GB / 月`,
    b: `${b.vendor.pricing.trafficGB} GB / 月`,
    winner:
      a.vendor.pricing.trafficGB === b.vendor.pricing.trafficGB
        ? 'tie'
        : a.vendor.pricing.trafficGB > b.vendor.pricing.trafficGB
          ? 'a'
          : 'b',
  });

  const pa = costPerGB(a);
  const pb = costPerGB(b);
  rows.push({
    label: '单位流量成本',
    a: `约 ${formatCostPerGB(a)} 元 / GB`,
    b: `约 ${formatCostPerGB(b)} 元 / GB`,
    winner: pa === pb ? 'tie' : pa < pb ? 'a' : 'b',
    note: sameBasis ? undefined : '注意:年付折算方的单位成本建立在一次性支付一年费用的前提上。',
  });

  const lineRank = (brand: Brand): number =>
    brand.vendor.lines.includes('IEPL') || brand.vendor.lines.includes('IPLC')
      ? 3
      : brand.vendor.lines.includes('内网专线')
        ? 2
        : brand.vendor.lines.includes('中转')
          ? 1
          : 0;
  /* 一方线路未标明时不判优劣:那是信息缺口,不是劣势 */
  const lineUnstated = a.vendor.lines.length === 0 || b.vendor.lines.length === 0;
  rows.push({
    label: '线路类型',
    a: lineLabel(a),
    b: lineLabel(b),
    winner: lineUnstated
      ? 'tie'
      : lineRank(a) === lineRank(b)
        ? 'tie'
        : lineRank(a) > lineRank(b)
          ? 'a'
          : 'b',
    note: lineUnstated
      ? '其中一方的公开资料没有标明线路类型,无法比较。未标明不等于线路更差,只说明这项信息缺失。'
      : '专线(IEPL / IPLC)的主要卖点是高峰时段的稳定性,但本站尚未完成实测,这里只按线路类型的技术定位判定。',
  });

  const protoUnstated = a.vendor.protocols.length === 0 || b.vendor.protocols.length === 0;
  rows.push({
    label: '主要协议',
    a: protocolLabel(a),
    b: protocolLabel(b),
    winner: 'tie',
    note: protoUnstated
      ? '其中一方的公开资料未标明协议。协议本身也没有绝对优劣,这一项无论如何都不判胜负。'
      : '协议本身没有绝对优劣,取决于你使用的客户端与网络环境。',
  });

  rows.push({
    label: '开业年份',
    a: a.vendor.since ? `${a.vendor.since} 年` : '未标明',
    b: b.vendor.since ? `${b.vendor.since} 年` : '未标明',
    winner:
      !a.vendor.since || !b.vendor.since
        ? 'tie'
        : a.vendor.since === b.vendor.since
          ? 'tie'
          : a.vendor.since < b.vendor.since
            ? 'a'
            : 'b',
    note: '运营时间长只说明它活得久,不保证未来稳定,但确实能排除掉一部分开业即跑路的情况。',
  });

  rows.push({
    label: '自研客户端',
    a: a.vendor.claims.ownClient ? '提供' : '公开资料未提及',
    b: b.vendor.claims.ownClient ? '提供' : '公开资料未提及',
    winner:
      a.vendor.claims.ownClient === b.vendor.claims.ownClient
        ? 'tie'
        : a.vendor.claims.ownClient
          ? 'a'
          : 'b',
    note: '自研客户端主要降低新手的上手门槛;熟悉 Clash 等第三方客户端的用户不需要在意这一项。',
  });

  const claimCount = (brand: Brand): number =>
    [brand.vendor.claims.streaming, brand.vendor.claims.aiTools].filter((c) => c === 'vendor-claim')
      .length;
  rows.push({
    label: '流媒体 / AI 场景',
    a: describeClaims(a),
    b: describeClaims(b),
    winner: claimCount(a) === claimCount(b) ? 'tie' : claimCount(a) > claimCount(b) ? 'a' : 'b',
    note: '两方均为厂商公开声明,本站尚未完成实测。声明得多不等于实际更好用,只说明该品牌把这个场景作为卖点。',
  });

  rows.push({
    label: '支付方式',
    a: a.commercial.payments.join(' / '),
    b: b.commercial.payments.join(' / '),
    winner: 'tie',
  });

  return rows;
}

function describeClaims(brand: Brand): string {
  const parts: string[] = [];
  if (brand.vendor.claims.streaming === 'vendor-claim') parts.push('流媒体');
  if (brand.vendor.claims.aiTools === 'vendor-claim') parts.push('AI 工具');
  return parts.length ? `声明覆盖${parts.join('、')}` : '公开资料未明确说明';
}

/** 按使用场景给出判断。要求至少有一个场景判给 b,否则视为伪对比(内链规则 R07) */
export interface ScenarioVerdict {
  scenario: string;
  winner: 'a' | 'b';
  reason: string;
}

export function scenarioVerdicts(a: Brand, b: Brand): ScenarioVerdict[] {
  const cheaper = costPerGB(a) <= costPerGB(b) ? 'a' : 'b';
  const moreTraffic = a.vendor.pricing.trafficGB >= b.vendor.pricing.trafficGB ? 'a' : 'b';
  const older = (a.vendor.since ?? 9999) <= (b.vendor.since ?? 9999) ? 'a' : 'b';
  const easier =
    a.vendor.claims.ownClient && !b.vendor.claims.ownClient
      ? 'a'
      : b.vendor.claims.ownClient && !a.vendor.claims.ownClient
        ? 'b'
        : older;
  const lowerEntry = a.vendor.pricing.entryPriceCNY <= b.vendor.pricing.entryPriceCNY ? 'a' : 'b';
  const scenarioClaims =
    [a.vendor.claims.streaming, a.vendor.claims.aiTools].filter((c) => c === 'vendor-claim')
      .length >=
    [b.vendor.claims.streaming, b.vendor.claims.aiTools].filter((c) => c === 'vendor-claim').length
      ? 'a'
      : 'b';

  const name = (w: 'a' | 'b') => (w === 'a' ? a.name : b.name);

  return [
    {
      scenario: '每月流量需求大(看视频、多设备)',
      winner: moreTraffic,
      reason: `${name(moreTraffic)}的入门套餐流量更高(${(moreTraffic === 'a' ? a : b).vendor.pricing.trafficGB}GB),同样的钱能撑更久。`,
    },
    {
      scenario: '预算优先,想把每月支出压到最低',
      winner: lowerEntry,
      reason: `${name(lowerEntry)}的入门价更低。若两者计价口径不同,还要把一次性付一年的资金占用算进来。`,
    },
    {
      scenario: '单位流量成本最划算',
      winner: cheaper,
      reason: `${name(cheaper)}的每 GB 成本更低,适合把流量当作主要衡量标准的人。`,
    },
    {
      scenario: '第一次用机场,希望少折腾',
      winner: easier,
      reason: (easier === 'a' ? a : b).vendor.claims.ownClient
        ? `${name(easier)}提供自研客户端,不用先学会配置 Clash 或小火箭就能开始用。`
        : `${name(easier)}运营时间更长,遇到问题时能找到的社区经验相对更多。`,
    },
    {
      scenario: '主要用来访问 AI 工具或流媒体',
      winner: scenarioClaims,
      reason: `${name(scenarioClaims)}把这类场景作为公开卖点。注意这是厂商声明而非本站实测,建议先用最短周期套餐验证。`,
    },
    {
      scenario: '在意运营历史,不想踩到新站跑路',
      winner: older,
      reason: `${name(older)}开业更早(${(older === 'a' ? a : b).vendor.since ?? '未标明'}),经历过的时间更长。这能降低但不能消除风险。`,
    },
  ];
}
