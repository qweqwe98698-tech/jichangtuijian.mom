// 显式带 .ts 扩展名:Vite 与 Node 都能解析,构建期脚本才能直接 import 这个模块
import { BRANDS, getBrand } from './brands.ts';

/**
 * 品牌关键词与 URL 映射(第三阶段 T3)。
 *
 * 两条硬约束:
 *   1. 每家品牌只有一个主页面,沿用已确认的 /reviews/<slug>/,不另建 /brands/ 与之竞争。
 *   2. 品牌名 / 官网 / 注册 / 套餐 / 价格 / 优惠码 / 怎么样 / 稳定性 / 安全性
 *      这些同意图词全部归属品牌主页面,不拆成多个页面互抢。
 *
 * 主词统一取「<品牌>怎么样」——这是品牌查询里意图最明确、承接面最宽的一个,
 * 其余同意图词作为次词挂在同一页,而不是各自开页。
 *
 * 品牌故障 / 跑路 / 风险类页面**不单独建**:这些查询没有独立于品牌页的搜索意图,
 * 而且本站没有任何一家的运营异常事实可以支撑独立页面。相关内容放在品牌页的
 * 风险与状态区块及 FAQ 里(指令 T3.5)。
 */

export type DecisionStage = 'awareness' | 'consideration' | 'decision';

export interface BrandKeywordEntry {
  slug: string;
  /** 唯一主词 */
  primary: string;
  /** 同意图次词,全部由主页面覆盖 */
  secondary: string[];
  /** GEO 长尾问题,必须在正文里有真实回答位置 */
  geoQuestions: string[];
  /** 该页承接的搜索意图 */
  intent: 'comparison';
  stage: DecisionStage;
  /** 上游入口:用户通常从哪里来 */
  upstream: string[];
  /** 下游去向:读完之后最合理的下一步 */
  downstream: string[];
  /** 该品牌的测速证据引用;当前全部 review-required */
  evidenceRef: string;
  /** 复查频率 */
  updateFrequency: string;
}

/** 每家的差异化次词。共性词由 commonSecondary 统一补齐,不在这里重复 */
const TAILORED: Record<string, { extra: string[]; geo: string[] }> = {
  guangsuyun: {
    extra: ['光速云年付', '光速云安全吗'],
    geo: [
      '光速云的 7.5 元是月付价还是年付折算价?',
      '光速云运营多久了,老牌机场是不是更不容易跑路?',
      '光速云 59GB 流量对日常使用够不够?',
    ],
  },
  xingdaomeng: {
    extra: ['星岛梦不限时套餐', '星岛梦靠谱吗'],
    geo: [
      '星岛梦的不限时套餐是什么意思,和年付有什么区别?',
      '星岛梦 8 元一个月是真的吗?',
      '星岛梦适合只偶尔用一下的人吗?',
    ],
  },
  lingmao: {
    extra: ['灵猫网络月付', '灵猫网络150GB'],
    geo: [
      '灵猫网络 19 元 150GB 在月付里算便宜吗?',
      '灵猫网络 2024 年才开业,风险大不大?',
      '灵猫网络支持 Clash 和小火箭吗?',
    ],
  },
  feimaoyun: {
    extra: ['飞猫云年付', '飞猫云小流量'],
    geo: [
      '飞猫云 7 元一个月要一次性付多少钱?',
      '飞猫云 50GB 流量能看多久视频?',
      '飞猫云的季付 8 折和年付怎么算更划算?',
    ],
  },
  weituyun: {
    extra: ['唯兔云节点', '唯兔云三网优化'],
    geo: [
      '唯兔云说的 60+ 节点和三网优化是什么意思?',
      '唯兔云没有 IEPL 专线,会不会不稳定?',
      '唯兔云能用来访问 ChatGPT 吗?',
    ],
  },
  yuzhouyun: {
    extra: ['宇宙云IEPL', '宇宙云价格'],
    geo: [
      '宇宙云 14.9 元就有 IEPL 专线,是真的吗?',
      '宇宙云和唯兔云同价位该怎么选?',
      '宇宙云的自研客户端好用吗?',
    ],
  },
  u1s1: {
    extra: ['U1S1机场', 'U1S1价格'],
    geo: [
      'U1S1 是什么机场,名字是什么意思?',
      'U1S1 20 元 120GB 和同价位比亏不亏?',
      'U1S1 支持哪些客户端?',
    ],
  },
  jilianyun: {
    extra: ['极连云价格', '极连云安全吗'],
    geo: [
      '极连云 18 元 100GB 值不值?',
      '极连云的单位流量成本为什么是 16 家里最高的?',
      '极连云 2024 年开业,现在买风险大吗?',
    ],
  },
  guangnianti: {
    extra: ['光年梯靠谱吗', '光年梯新机场'],
    geo: [
      '光年梯 2025 年才开业,敢不敢买?',
      '光年梯和极连云都是 18 元,差别在哪?',
      '光年梯说支持 AI 工具,可信度有多高?',
    ],
  },
  yifanyun: {
    extra: ['一翻云150GB', '一翻云价格'],
    geo: [
      '一翻云 20 元 150GB 是 16 家里最划算的吗?',
      '一翻云没有自研客户端,新手能用吗?',
      '一翻云的流量够几个人一起用吗?',
    ],
  },
  ermaoyun: {
    extra: ['二猫云价格', '二猫云节点'],
    geo: [
      '二猫云 20 元 130GB 和一翻云 150GB 怎么选?',
      '二猫云的 AI 和流媒体到底能不能用?',
      '二猫云运营几年了?',
    ],
  },
  sogoyun: {
    extra: ['SOGO云靠谱吗', 'SOGO机场'],
    geo: [
      'SOGO 云 2026 年才开业,现在买是不是太早?',
      'SOGO 云 25 元 150GB 比一翻云贵在哪?',
      'SOGO 云的注册链接为什么和别家格式不一样?',
    ],
  },
  kexinyun: {
    extra: ['可信云价格', '可信云安全吗'],
    geo: [
      '可信云这个名字是不是就代表可信?',
      '可信云 25 元 150GB 有什么独特卖点吗?',
      '可信云的流媒体解锁能力有实测数据吗?',
    ],
  },
  sujie: {
    extra: ['速界AI', '速界ChatGPT'],
    geo: [
      '速界主打 AI,ChatGPT 真的能稳定用吗?',
      '速界和其他 25 元档机场差在哪?',
      '速界的 AI 支持是实测过的还是厂商说的?',
    ],
  },
  kuaili: {
    extra: ['快狸机场', '快狸价格'],
    geo: [
      '快狸 25 元 150GB 和可信云、速界怎么区分?',
      '快狸运营多久了?',
      '快狸的自研客户端和第三方客户端哪个好用?',
    ],
  },
  quanqiuyun: {
    extra: ['全球云靠谱吗', '全球云价格'],
    geo: [
      '全球云 2026 年新开的,值得试吗?',
      '全球云 20 元 120GB 比 U1S1 好在哪?',
      '全球云的线路是真 IEPL 吗?',
    ],
  },
};

/** 每家都要覆盖的同意图词 */
const commonSecondary = (name: string): string[] => [`${name}官网`, `${name}优惠码`, `${name}评测`];

export const BRAND_KEYWORDS: BrandKeywordEntry[] = BRANDS.map((b) => {
  const t = TAILORED[b.slug];
  if (!t) throw new Error(`品牌 ${b.slug} 缺少关键词配置`);
  return {
    slug: b.slug,
    primary: `${b.name}怎么样`,
    secondary: [...commonSecondary(b.name), ...t.extra],
    geoQuestions: t.geo,
    intent: 'comparison' as const,
    stage: 'decision' as const,
    upstream: ['/', '/reviews/', '/compare/', '/rankings/'],
    downstream: [`/compare/`, '/guides/', '/risk/'],
    evidenceRef: `speedtest-2026-08-11-cst:${b.name}`,
    updateFrequency: '价格与套餐每月复查;测速证据在复核通过后接入',
  };
});

export const brandUrl = (slug: string): string => `/reviews/${slug}/`;

export const keywordsFor = (slug: string): BrandKeywordEntry | undefined =>
  BRAND_KEYWORDS.find((k) => k.slug === slug);

/** 全部品牌关键词的扁平列表,供去重校验 */
export const allBrandKeywords = (): string[] =>
  BRAND_KEYWORDS.flatMap((k) => [k.primary, ...k.secondary]);

/** 品牌页不建独立子页面的那些查询,在品牌页内的落点 */
export const IN_PAGE_COVERAGE = {
  跑路风险: '风险与状态区块 + FAQ',
  安全性: '风险与状态区块',
  退款: '风险与状态区块的客服与退款入口',
  注册流程: '优惠与注册区块',
  套餐价格: '快速事实 + 规格表',
  客户端支持: '客户端与协议区块,并内链到对应教程',
} as const;

/** 品牌名到显示名的解析,便于文档生成 */
export const brandName = (slug: string): string => getBrand(slug)?.name ?? slug;
