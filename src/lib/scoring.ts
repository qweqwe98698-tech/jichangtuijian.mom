import type { Brand } from '@data/brands';
import { BRANDS, costPerGB } from '@data/brands';

/**
 * 编辑评分体系。
 *
 * 关键约束:本站目前没有完成 16 家的统一实测,因此评分**不得**表述为"实测评分"。
 * 这里的分数完全由公开可核对的字段按固定公式算出,任何人拿到同一份品牌数据都能复现同一结果。
 * 评分口径公开在 /editorial-policy/,页面上必须标注"编辑评分(基于公开资料)"。
 *
 * 一旦 measured 层补齐真实实测数据,再新增 measuredScore 维度,不影响既有页面结构。
 */

export interface ScoreBreakdown {
  /** 单位流量价格表现 */
  value: number;
  /** 线路等级(专线 > 中转 > 直连) */
  line: number;
  /** 运营时长 */
  track: number;
  /** 客户端上手友好度 */
  client: number;
  /** 使用场景覆盖广度(基于厂商公开声明,非实测) */
  coverage: number;
  /** 加权总分 */
  overall: number;
}

const WEIGHTS = {
  value: 0.3,
  line: 0.25,
  track: 0.15,
  client: 0.15,
  coverage: 0.15,
} as const;

/** 评分口径说明,前台需可展示,保证读者知道分数怎么来的 */
export const SCORING_RUBRIC = [
  {
    key: 'value',
    label: '流量性价比',
    weight: '30%',
    basis: '入门套餐的单位流量价格(元/GB),在本站收录的 16 家中做线性归一',
  },
  {
    key: 'line',
    label: '线路等级',
    weight: '25%',
    basis: 'IEPL / IPLC 企业专线得分最高,中转次之,纯直连最低',
  },
  {
    key: 'track',
    label: '运营时长',
    weight: '15%',
    basis: '公开开业年份距今的年数,5 年及以上取满分',
  },
  {
    key: 'client',
    label: '客户端友好度',
    weight: '15%',
    basis: '是否提供自研客户端、是否支持第三方客户端订阅导入',
  },
  {
    key: 'coverage',
    label: '场景覆盖',
    weight: '15%',
    basis: '厂商公开声明覆盖的流媒体与 AI 工具场景广度(属声明,非本站实测)',
  },
] as const;

/** 评分基准年,与内容复查周期同步;改动会使全站分数变化,需同步更新 /editorial-policy/ */
const SCORING_BASE_YEAR = 2026;

const clamp = (n: number, min = 0, max = 10): number => Math.min(max, Math.max(min, n));
const round1 = (n: number): number => Math.round(n * 10) / 10;

/** 单位流量价格越低越好,按全站极值线性归一到 4–10 分 */
function valueScore(brand: Brand): number {
  const all = BRANDS.map(costPerGB);
  const best = Math.min(...all);
  const worst = Math.max(...all);
  if (worst === best) return 8;
  const ratio = (worst - costPerGB(brand)) / (worst - best);
  return clamp(4 + ratio * 6);
}

function lineScore(brand: Brand): number {
  const lines = brand.vendor.lines;
  // 未标明线路类型时取 7.0,与「中转」同档。
  // 理由和场景覆盖那一项一致:不能因为厂商资料写得少就重罚。
  // 专线是需要主动标注的卖点,不标注确实降低了它是专线的可能性,
  // 但把它压到最低档等于用信息缺口给品牌定罪,那不是评分该做的事。
  if (lines.length === 0) return 7;
  if (lines.includes('IEPL') || lines.includes('IPLC')) return lines.includes('内网专线') ? 9.5 : 9;
  if (lines.includes('内网专线')) return 8.5;
  if (lines.includes('中转')) return 7;
  return 6;
}

function trackScore(brand: Brand): number {
  if (brand.vendor.since === null) return 6;
  const years = SCORING_BASE_YEAR - brand.vendor.since;
  return clamp(6 + years * 0.8, 6, 10);
}

function clientScore(brand: Brand): number {
  const { ownClient, thirdPartyClient } = brand.vendor.claims;
  if (ownClient && thirdPartyClient) return 9.5;
  if (ownClient) return 8.5;
  if (thirdPartyClient) return 7.5;
  return 6;
}

function coverageScore(brand: Brand): number {
  const { streaming, aiTools } = brand.vendor.claims;
  const declared = [streaming, aiTools].filter((c) => c === 'vendor-claim').length;
  // 未声明不等于不支持,因此下限设为 7 分,避免惩罚公开资料较少的品牌
  return [7, 8.3, 9.2][declared] ?? 7;
}

export function scoreBrand(brand: Brand): ScoreBreakdown {
  const value = round1(valueScore(brand));
  const line = round1(lineScore(brand));
  const track = round1(trackScore(brand));
  const client = round1(clientScore(brand));
  const coverage = round1(coverageScore(brand));

  const overall = round1(
    value * WEIGHTS.value +
      line * WEIGHTS.line +
      track * WEIGHTS.track +
      client * WEIGHTS.client +
      coverage * WEIGHTS.coverage
  );

  return { value, line, track, client, coverage, overall };
}

/** 按总分排序;年付折算口径的品牌单独成组,避免与月付价直接混排 */
export function rankedBrands(options: { basis?: 'monthly' | 'annual-equivalent' } = {}): {
  brand: Brand;
  score: ScoreBreakdown;
}[] {
  return BRANDS.filter((b) => !options.basis || b.vendor.pricing.basis === options.basis)
    .map((brand) => ({ brand, score: scoreBrand(brand) }))
    .sort((a, b) => b.score.overall - a.score.overall);
}

/** 取该品牌在某维度上的最强项,用于卡片上突出显示 */
export function topDimension(score: ScoreBreakdown): { label: string; value: number } {
  const dims = [
    { label: '流量性价比', value: score.value },
    { label: '线路等级', value: score.line },
    { label: '运营时长', value: score.track },
    { label: '客户端友好度', value: score.client },
    { label: '场景覆盖', value: score.coverage },
  ];
  return dims.reduce((max, d) => (d.value > max.value ? d : max));
}
