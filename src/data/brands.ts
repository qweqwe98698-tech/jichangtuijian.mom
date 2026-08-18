/**
 * 16 家机场品牌数据层。
 *
 * 严格分四层存储,任何页面渲染时都必须保留层级归属,不得把厂商声明当作本站实测结论:
 *   vendor      厂商公开资料(价格、流量、协议、线路、AI/流媒体声明)
 *   measured    本站实测(未实测时 status 为 'pending',页面须显示"尚未实测")
 *   commercial  商业信息(优惠码、活动、推广链接、支付方式)——全部为推广合作
 *   editorial   编辑判断(适合人群、定位、优缺点、同价位比较)
 *
 * 补真实实测数据时只需更新 measured 层,无需改动任何页面或文章。
 */

export type Protocol = 'VLESS' | 'VMess' | 'Trojan' | 'Shadowsocks' | 'Hysteria2';
export type LineType = 'IEPL' | 'IPLC' | '中转' | '直连' | '内网专线';

/**
 * 空数组表示「厂商公开资料未标明」,不是「没有」。
 *
 * 这两者在页面上必须区分:未标明是信息缺口,写成具体值就是把未知伪装成已知。
 * 站上曾经给星岛梦、飞猫云、灵猫网络、极连云填过 VLESS,但品牌清单原文只写了线路特点、
 * 根本没提协议 —— 那是凭空补的,已在 2026-08-18 按新版清单更正。
 */
export const UNSTATED = '公开资料未标明';

export const protocolLabel = (brand: Brand): string =>
  brand.vendor.protocols.length ? brand.vendor.protocols.join(' / ') : UNSTATED;

export const lineLabel = (brand: Brand): string =>
  brand.vendor.lines.length ? brand.vendor.lines.join(' · ') : UNSTATED;
export type BillingBasis = 'monthly' | 'annual-equivalent';
export type ClaimLevel = 'vendor-claim' | 'measured' | 'unknown';

export interface BrandPricing {
  /** 入门套餐价格(人民币) */
  entryPriceCNY: number;
  /** 该价格的计价基准。annual-equivalent 表示年付折算,禁止与月付价直接排名比较 */
  basis: BillingBasis;
  /** 入门套餐月流量(GB) */
  trafficGB: number;
  /** 价格口径说明,basis 为 annual-equivalent 时必填 */
  note?: string;
}

export interface BrandVendor {
  /** 品牌公开的开业年份;未知为 null */
  since: number | null;
  protocols: Protocol[];
  lines: LineType[];
  pricing: BrandPricing;
  /** 厂商声明的能力,一律标注为 vendor-claim,页面不得渲染成"已验证" */
  claims: {
    streaming: ClaimLevel;
    aiTools: ClaimLevel;
    ownClient: boolean;
    thirdPartyClient: boolean;
  };
  /** 厂商公开的其他卖点关键词 */
  highlights: string[];
}

export interface MeasuredSample {
  /** 测试日期 ISO 字符串 */
  date: string;
  /** 峰值下载速率(Mbps) */
  downloadMbps?: number;
  /** 平均延迟(ms) */
  latencyMs?: number;
  /** 测试所用节点区域 */
  region?: string;
  /** 测试环境说明,避免读者把单次结果当作普遍结论 */
  environment?: string;
}

export interface BrandMeasured {
  /** pending = 尚未实测;review-required = 有原始素材待整理;done = 已核验可展示 */
  status: 'pending' | 'review-required' | 'done';
  /** 实测样本;status 非 done 时前台标注"参考数据" */
  samples: MeasuredSample[];
  /** 流媒体/AI 解锁实测结论;未实测时保持空对象 */
  unlock: Record<string, 'pass' | 'fail' | 'partial'>;
  /** 最近一次实测时间,用于前台展示与复查排期 */
  lastTestedAt: string | null;
}

/**
 * 主推位。这是**商业位**,不是评测结论。
 *
 * 放在 commercial 层是刻意的:这一层的字段在全站范围内不参与任何排序或评分,
 * 有测试锁定。主推只决定「哪几家出现在首页那个明确标着『商业合作』的区块里」,
 * 不改榜单顺序、不改品牌库排序、不进 JSON-LD 的评分字段。
 *
 * `caution` 是必填的。一个只写好话的主推位和广告没有区别,
 * 而这个站的全部价值来自「敢说自己不知道什么」——主推位不能是那个例外。
 */
export interface BrandFeatured {
  /** 展示顺序,越小越靠前。仅控制陈列,与质量无关 */
  order: number;
  /** 为什么把它放进主推位:要写具体适合谁,不要写宣传语 */
  reason: string;
  /** 谁应该跳过这一家。必填 */
  caution: string;
}

export interface BrandCommercial {
  /** 全部 16 家均为推广合作关系,不存在自营 */
  relationship: 'affiliate';
  promoCode: string | null;
  promoText: string | null;
  /** 推广链接需原样保留,不得改写 hash 路径或参数 */
  affiliateUrl: string;
  payments: string[];
  /** 主推位;不在主推名单里的品牌为 null */
  featured?: BrandFeatured | null;
}

export interface BrandEditorial {
  /** 一句话推荐定位,用于卡片副标题与列表页 */
  positioning: string;
  /** 适合人群 */
  bestFor: string;
  pros: string[];
  cons: string[];
  /** 编辑给出的标签,用于筛选与内链聚类 */
  tags: string[];
  /** 同价位可对比的品牌 slug,驱动对比页与内链 */
  comparableWith: string[];
  /** 需要特别提示读者的口径问题 */
  caveat?: string;
}

export interface Brand {
  slug: string;
  name: string;
  /** 用于 title/meta 的英文或拼音别名,提升实体识别 */
  alias: string;
  vendor: BrandVendor;
  measured: BrandMeasured;
  commercial: BrandCommercial;
  editorial: BrandEditorial;
}

/** 尚未开展实测时的统一占位,保证页面结构完整且不做虚假承诺 */
const notYetMeasured = (): BrandMeasured => ({
  status: 'pending',
  samples: [],
  unlock: {},
  lastTestedAt: null,
});

/**
 * 商业字段的核实日期。
 *
 * 指令要求所有商业字段带 lastVerified —— 价格、优惠码这类信息会变,
 * 页面上不标核实日期,读者就无法判断自己看到的是不是过期数据。
 *
 * 16 家在同一天完成核对,因此用一个常量而不是 16 行重复;
 * 将来某家单独复查时,在 VERIFIED_OVERRIDES 里覆盖即可。
 */
export const COMMERCIAL_VERIFIED_AT = '2026-08-18';

const VERIFIED_OVERRIDES: Record<string, string> = {};

export const lastVerified = (slug: string): string =>
  VERIFIED_OVERRIDES[slug] ?? COMMERCIAL_VERIFIED_AT;

/**
 * 公开资料显示提供「不限时套餐」的品牌。
 *
 * 这是一种独立的计费形态:一次性付费、不按月计,与月付/年付的决策逻辑完全不同,
 * 因此在品牌库里作为独立筛选条件,而不是混在价格档里。
 */
const UNLIMITED_TIME_PLAN = new Set(['xingdaomeng', 'lingmao']);

export const hasUnlimitedTimePlan = (slug: string): boolean => UNLIMITED_TIME_PLAN.has(slug);

export const BRANDS: Brand[] = [
  {
    slug: 'guangsuyun',
    name: '光速云',
    alias: 'Guangsu Cloud',
    vendor: {
      since: 2020,
      protocols: ['VLESS'],
      lines: ['IEPL', '内网专线'],
      pricing: {
        entryPriceCNY: 7.5,
        basis: 'annual-equivalent',
        trafficGB: 59,
        note: '7.5 元/月为年付折算价格,需一次性支付一年费用,不能与月付套餐直接比较。',
      },
      claims: {
        streaming: 'vendor-claim',
        aiTools: 'vendor-claim',
        ownClient: true,
        thirdPartyClient: true,
      },
      highlights: ['企业级内网专线', 'VLESS 协议', '自研客户端'],
    },
    measured: notYetMeasured(),
    commercial: {
      relationship: 'affiliate',
      promoCode: 'AMM',
      promoText: '新人注册 8 折',
      affiliateUrl: 'https://sahude.gsyvipaff.com/#/?code=keqgvT5Y',
      payments: ['支付宝', '微信', 'USDT'],
      featured: {
        order: 1,
        reason:
          '收录品牌里运营时间最长的一档(2020 年至今),线路同时标注 IEPL 与内网专线,厂商声明覆盖 AI 工具与流媒体。年付折算后每 GB 约 0.127 元,是 16 家里最低的。适合已经确定长期使用、且主要用途就是 AI 工具和流媒体的人。',
        caution:
          '7.5 元是年付折算价,要一次性付一整年。如果你还没验证过它在你本地网络的表现,先买最短周期实测,不要直接上年付——运营时间长不等于明年也在。AI 与流媒体的覆盖是厂商声明,本站尚未实测。',
      },
    },
    editorial: {
      positioning: '老牌综合型 · IEPL 专线 · 年付低价',
      bestFor: '已经确定会长期使用、注重专线稳定性,同时有 AI 工具与流媒体需求的用户',
      pros: [
        '运营时间较长,2020 年起持续运营',
        '主打企业级内网专线,晚高峰表现是其核心卖点',
        '提供自研客户端,新手上手成本低',
        '年付折算后单位流量成本处在本站收录品牌的最低一档',
      ],
      cons: [
        '59GB 入门流量偏低,重度视频用户会很快用完',
        '低价建立在一次性支付一年费用的基础上,不适合还在试水的新用户',
        '第三方客户端订阅导入方式需联系客服获取',
      ],
      tags: ['老牌', 'IEPL', 'VLESS', '年付', '小流量'],
      comparableWith: ['feimaoyun', 'xingdaomeng', 'yuzhouyun'],
      caveat: '7.5 元/月属于年付折算价格,与月付套餐不具备直接可比性。',
    },
  },
  {
    slug: 'xingdaomeng',
    name: '星岛梦',
    alias: 'Xingdaomeng',
    vendor: {
      since: 2020,
      // 品牌清单只写了线路特点,未提协议
      protocols: [],
      lines: ['内网专线'],
      pricing: {
        entryPriceCNY: 8,
        basis: 'annual-equivalent',
        trafficGB: 60,
        note: '8 元/月为年付折算价格,需一次性支付一年费用,不能与月付价直接比较。',
      },
      claims: {
        streaming: 'unknown',
        aiTools: 'unknown',
        ownClient: false,
        thirdPartyClient: true,
      },
      highlights: ['套餐类型丰富', '提供不限时套餐', '企业级内网专线'],
    },
    measured: notYetMeasured(),
    commercial: {
      relationship: 'affiliate',
      promoCode: 'nmw888',
      promoText: '新人注册 9 折',
      affiliateUrl: 'https://guangs.xingdaomeng.com/#/?code=1TynBYnR',
      payments: ['支付宝', '微信', 'USDT'],
    },
    editorial: {
      positioning: '低价年付 · 套餐丰富 · 不限时套餐',
      bestFor: '预算有限的小流量用户,以及希望购买长期或不限时套餐的用户',
      pros: [
        '年付折算价格是本站收录品牌中最低档之一',
        '除月付/季付/年付外还提供不限时套餐',
        '运营时间较长',
      ],
      cons: ['60GB 入门流量偏低,不适合高频看视频', '低价依赖年付,前期一次性支出较高'],
      tags: ['低价', '年付', '不限时', '小流量'],
      comparableWith: ['feimaoyun', 'weituyun', 'yuzhouyun'],
      caveat: '8 元/月属于年付折算价格,与月付套餐不具备直接可比性。',
    },
  },
  {
    slug: 'lingmao',
    name: '灵猫网络',
    alias: 'Civet Network',
    vendor: {
      since: 2024,
      // 品牌清单只写了线路特点,未提协议
      protocols: [],
      lines: ['内网专线'],
      pricing: { entryPriceCNY: 19, basis: 'monthly', trafficGB: 150 },
      claims: {
        streaming: 'unknown',
        aiTools: 'unknown',
        ownClient: false,
        thirdPartyClient: true,
      },
      highlights: ['月付 150GB', '套餐类型丰富', '提供不限时套餐'],
    },
    measured: notYetMeasured(),
    commercial: {
      relationship: 'affiliate',
      promoCode: 'lmao888',
      promoText: '新人注册 9 折',
      affiliateUrl: 'https://vip01.civetnet.com/#/?code=8MIAyxak',
      payments: ['支付宝', '微信', 'USDT'],
    },
    editorial: {
      positioning: '月付大流量 · 150GB · 套餐种类丰富',
      bestFor: '不愿一次性购买长期套餐,但每月流量需求较高的月付用户',
      pros: [
        '19 元月付即提供 150GB,是月付档流量性价比较突出的一档',
        '套餐种类丰富,含不限时选项',
        '适合多设备同时使用',
      ],
      cons: ['2024 年开业,运营时间短于老牌品牌', '公开资料未明确统一的 AI 与流媒体支持说明'],
      tags: ['月付', '大流量', '150GB', '性价比'],
      comparableWith: ['yifanyun', 'ermaoyun', 'u1s1'],
    },
  },
  {
    slug: 'feimaoyun',
    name: '飞猫云',
    alias: 'Flycat Cloud',
    vendor: {
      since: 2023,
      // 品牌清单只写了线路特点,未提协议
      protocols: [],
      lines: ['IEPL'],
      pricing: {
        entryPriceCNY: 7,
        basis: 'annual-equivalent',
        trafficGB: 50,
        note: '7 元/月为年付折算价格,适合能接受较长付款周期的用户。',
      },
      claims: {
        streaming: 'vendor-claim',
        aiTools: 'vendor-claim',
        ownClient: true,
        thirdPartyClient: true,
      },
      highlights: ['IEPL 专线', '小流量低门槛套餐', '自研客户端'],
    },
    measured: notYetMeasured(),
    commercial: {
      relationship: 'affiliate',
      promoCode: 'flycat888',
      promoText: '新用户季付及以上 8 折',
      affiliateUrl: 'https://guangs.flycataff.com/#/?code=6uq0Xe9y',
      payments: ['支付宝', '微信', 'USDT'],
    },
    editorial: {
      positioning: '低价小流量 · 年付 · IEPL · 轻度用户',
      bestFor: '日常流量不大、预算较低,只需要保证基本可用性的轻度用户',
      pros: [
        '年付折算约 7 元/月,是本站收录品牌中的最低档',
        '入门即为 IEPL 专线,而非纯中转',
        '提供自研客户端',
      ],
      cons: ['50GB 是本站收录品牌中入门流量最低的一档', '优惠需季付及以上才能触发'],
      tags: ['低价', '年付', 'IEPL', '轻度使用'],
      comparableWith: ['xingdaomeng', 'yuzhouyun', 'weituyun'],
      caveat: '7 元/月属于年付折算价格,与月付套餐不具备直接可比性。',
    },
  },
  {
    slug: 'weituyun',
    name: '唯兔云',
    alias: 'Rabbit Cloud',
    vendor: {
      since: 2023,
      protocols: ['VLESS'],
      // 品牌清单写的是「60+ 节点、三网优化、智能负载均衡」——那是网络配置描述,不是线路类型。
      // 站上曾据此推断为「中转/直连」,属于把未标明写成了具体值,已更正为未标明。
      lines: [],
      pricing: { entryPriceCNY: 14.9, basis: 'monthly', trafficGB: 100 },
      claims: {
        streaming: 'unknown',
        aiTools: 'unknown',
        ownClient: false,
        thirdPartyClient: true,
      },
      highlights: ['60+ 节点', '三网优化', '智能负载均衡', 'VLESS 协议'],
    },
    measured: notYetMeasured(),
    commercial: {
      relationship: 'affiliate',
      promoCode: 'rabbit',
      promoText: '新用户 9 折',
      affiliateUrl: 'https://guangs.v2yunvipaff.com/#/?code=xIutqOBA',
      payments: ['支付宝', '微信', 'USDT'],
    },
    editorial: {
      positioning: '节点丰富 · VLESS · 三网优化 · 智能负载均衡',
      bestFor: '在意节点数量与地区覆盖广度,需要频繁切换地区的用户',
      pros: [
        '公开卖点集中在节点覆盖与线路调度,而非单纯堆参数',
        '14.9 元档提供 100GB,价格与流量较均衡',
        '三网优化对不同运营商用户更友好',
      ],
      cons: ['公开资料未提供统一的 AI 与流媒体实测结果', '主打中转与直连,未强调 IEPL 专线'],
      tags: ['节点多', '三网优化', '负载均衡', '15 元档'],
      comparableWith: ['yuzhouyun', 'jilianyun', 'guangnianti'],
      caveat: 'AI 与流媒体可用性当前无统一实测数据,建议以实际节点测试为准。',
    },
  },
  {
    slug: 'yuzhouyun',
    name: '宇宙云',
    alias: 'Yuzhou Cloud',
    vendor: {
      since: 2023,
      protocols: ['VLESS'],
      lines: ['IEPL'],
      pricing: { entryPriceCNY: 14.9, basis: 'monthly', trafficGB: 100 },
      claims: {
        streaming: 'vendor-claim',
        aiTools: 'unknown',
        ownClient: true,
        thirdPartyClient: true,
      },
      highlights: ['VLESS 协议', 'IEPL 专线', '低价专线档'],
    },
    measured: notYetMeasured(),
    commercial: {
      relationship: 'affiliate',
      promoCode: 'YUZHOU553',
      promoText: null,
      affiliateUrl: 'https://guangs.yuzoucloud.cc/#/register?code=yrThwMP1',
      payments: ['支付宝', '微信', 'USDT'],
    },
    editorial: {
      positioning: '15 元档 · VLESS · IEPL · 性价比',
      bestFor: '希望把月预算控制在 15 元左右,同时不愿放弃专线线路的用户',
      pros: [
        '14.9 元即进入 IEPL 专线档,价格门槛较低',
        '提供自研客户端',
        '协议与线路组合适合日常稳定使用',
      ],
      cons: ['100GB 流量对重度视频用户偏紧', 'AI 工具支持未见明确公开说明'],
      tags: ['15 元档', 'IEPL', 'VLESS', '性价比'],
      // 光速云已转为年付折算口径,不再适合作为月付档的同价位对照
      comparableWith: ['weituyun', 'jilianyun', 'guangnianti'],
    },
  },
  {
    slug: 'u1s1',
    name: 'U1S1',
    alias: 'U1S1',
    vendor: {
      since: 2023,
      protocols: ['VLESS'],
      lines: ['IEPL'],
      pricing: { entryPriceCNY: 20, basis: 'monthly', trafficGB: 120 },
      // 品牌清单原文:「可用于常见海外网络及 AI 使用场景」——属于声明
      claims: {
        streaming: 'vendor-claim',
        aiTools: 'vendor-claim',
        ownClient: true,
        thirdPartyClient: true,
      },
      highlights: ['VLESS 协议', 'IEPL 专线', '自研客户端'],
    },
    measured: notYetMeasured(),
    commercial: {
      relationship: 'affiliate',
      promoCode: 'akaka',
      promoText: null,
      affiliateUrl: 'https://guangs.vipaff.cc/#/?code=xhX5X22f',
      payments: ['支付宝', '微信', 'USDT'],
    },
    editorial: {
      positioning: '20 元档 · 120GB · VLESS · IEPL',
      bestFor: '习惯月付、把专线稳定性放在流量数量之前的普通用户',
      pros: [
        '20 元档提供 IEPL 专线,线路定位清晰',
        '提供自研客户端与第三方订阅导入',
        '流量规格适配日常网页与视频',
      ],
      cons: ['同为 20 元档,流量规格低于一翻云与二猫云', 'AI 工具支持未见明确公开说明'],
      tags: ['20 元档', 'IEPL', 'VLESS', '月付'],
      comparableWith: ['quanqiuyun', 'ermaoyun', 'yifanyun'],
    },
  },
  {
    slug: 'jilianyun',
    name: '极连云',
    alias: 'Jilian Cloud',
    vendor: {
      since: 2024,
      // 品牌清单只写了线路特点,未提协议
      protocols: [],
      lines: ['IEPL'],
      pricing: { entryPriceCNY: 18, basis: 'monthly', trafficGB: 100 },
      claims: {
        streaming: 'vendor-claim',
        aiTools: 'vendor-claim',
        ownClient: true,
        thirdPartyClient: true,
      },
      highlights: ['IEPL 专线', '自研客户端', '综合使用场景'],
    },
    measured: notYetMeasured(),
    commercial: {
      relationship: 'affiliate',
      promoCode: 'ji8888',
      promoText: null,
      affiliateUrl: 'https://guangs.jlyvipaff.com/#/?code=VM1rKGUu',
      payments: ['支付宝', '微信', 'USDT'],
    },
    editorial: {
      positioning: '18 元档 · IEPL · 综合使用',
      bestFor: 'AI、流媒体与日常代理需求比较均衡,希望把预算控制在 20 元以内的用户',
      pros: [
        '18 元档同时覆盖 AI 与流媒体场景声明',
        'IEPL 专线定位明确',
        '提供自研客户端降低上手门槛',
      ],
      cons: ['100GB 流量在 18 元档中不算突出', '2024 年开业,运营历史相对较短'],
      tags: ['18 元档', 'IEPL', 'AI 工具', '综合型'],
      comparableWith: ['guangnianti', 'yuzhouyun', 'lingmao'],
    },
  },
  {
    slug: 'guangnianti',
    name: '光年梯',
    alias: 'Guangnian',
    vendor: {
      since: 2025,
      protocols: ['VLESS'],
      lines: ['IEPL'],
      pricing: { entryPriceCNY: 18, basis: 'monthly', trafficGB: 110 },
      claims: {
        streaming: 'vendor-claim',
        aiTools: 'vendor-claim',
        ownClient: true,
        thirdPartyClient: true,
      },
      highlights: ['VLESS 协议', 'IEPL 专线', 'AI 工具场景'],
    },
    measured: notYetMeasured(),
    commercial: {
      relationship: 'affiliate',
      promoCode: 'gnt6666',
      promoText: null,
      affiliateUrl: 'https://guangs.gntaff.com/#/?code=X1FoxjGE',
      payments: ['支付宝', '微信', 'USDT'],
    },
    editorial: {
      positioning: '18 元档 · 110GB · VLESS · IEPL',
      bestFor: '想在中低价位拿到专线套餐,同时有 AI 与流媒体需求的用户',
      pros: [
        '18 元档中流量规格略高于极连云',
        'VLESS + IEPL 组合完整',
        '公开资料同时覆盖 AI 与主流流媒体场景',
      ],
      cons: ['2025 年开业,是本站收录品牌中较新的一批', '缺少长期运营记录可供参考'],
      tags: ['18 元档', 'IEPL', 'VLESS', 'AI 工具'],
      comparableWith: ['jilianyun', 'u1s1', 'yuzhouyun'],
    },
  },
  {
    slug: 'yifanyun',
    name: '一翻云',
    alias: 'Yifan Cloud',
    vendor: {
      since: 2024,
      protocols: ['VLESS'],
      lines: ['IEPL'],
      pricing: { entryPriceCNY: 20, basis: 'monthly', trafficGB: 150 },
      claims: {
        streaming: 'vendor-claim',
        aiTools: 'vendor-claim',
        ownClient: false,
        thirdPartyClient: true,
      },
      highlights: ['20 元 150GB', 'VLESS 协议', 'IEPL 专线'],
    },
    measured: notYetMeasured(),
    commercial: {
      relationship: 'affiliate',
      promoCode: 'yfy6666',
      promoText: null,
      affiliateUrl: 'https://guangs.1flyunaff.cc/#/register?code=Yr7FhB7r',
      payments: ['支付宝', '微信', 'USDT'],
    },
    editorial: {
      positioning: '20 元档大流量 · 150GB · VLESS · IEPL',
      bestFor: '每月流量需求超过 100GB,希望提高单位流量性价比的用户',
      pros: [
        '20 元档提供 150GB,是同价位中流量规格最高的一档',
        'IEPL 专线 + VLESS 组合',
        '兼顾流媒体与 AI 工具场景声明',
      ],
      cons: ['未见自研客户端,新手需自行配置第三方客户端', '2024 年开业,运营历史较短'],
      tags: ['20 元档', '大流量', '150GB', 'IEPL'],
      comparableWith: ['ermaoyun', 'u1s1', 'lingmao'],
    },
  },
  {
    slug: 'ermaoyun',
    name: '二猫云',
    alias: 'Ermao Cloud',
    vendor: {
      since: 2023,
      protocols: ['VLESS'],
      lines: ['IEPL'],
      pricing: { entryPriceCNY: 20, basis: 'monthly', trafficGB: 130 },
      // 品牌清单原文:AI 与流媒体均「显示支持相关使用场景」——属于声明
      claims: {
        streaming: 'vendor-claim',
        aiTools: 'vendor-claim',
        ownClient: false,
        thirdPartyClient: true,
      },
      highlights: ['VLESS 协议', 'IEPL 专线', '20 元中等流量档'],
    },
    measured: notYetMeasured(),
    commercial: {
      relationship: 'affiliate',
      promoCode: 'ermao5555',
      promoText: null,
      affiliateUrl: 'https://guangs.2maoyunaff.cc/#/?code=7mjvgGbW',
      payments: ['支付宝', '微信', 'USDT'],
    },
    editorial: {
      positioning: '20 元档 · 130GB · VLESS · IEPL',
      bestFor: '每月中等流量需求,希望在 20 元档同时兼顾流量与专线的用户',
      pros: [
        '130GB 流量介于 U1S1/全球云与一翻云之间,梯度清晰',
        'IEPL 专线定位明确',
        '2023 年起运营,有一定时间积累',
      ],
      cons: ['公开资料未提供统一的 AI 与流媒体实测结论', '未见自研客户端'],
      tags: ['20 元档', '130GB', 'IEPL', 'VLESS'],
      comparableWith: ['yifanyun', 'u1s1', 'quanqiuyun'],
      caveat: 'AI 与流媒体能力建议结合具体节点实际测试判断。',
    },
  },
  {
    slug: 'sogoyun',
    name: 'SOGO 云',
    alias: 'SOGO Cloud',
    vendor: {
      since: 2026,
      protocols: ['VLESS'],
      lines: ['IEPL'],
      pricing: { entryPriceCNY: 25, basis: 'monthly', trafficGB: 150 },
      claims: {
        streaming: 'vendor-claim',
        aiTools: 'vendor-claim',
        ownClient: true,
        thirdPartyClient: true,
      },
      highlights: ['VLESS 协议', 'IEPL 专线', '自研客户端'],
    },
    measured: notYetMeasured(),
    commercial: {
      relationship: 'affiliate',
      promoCode: 'sss777',
      promoText: null,
      affiliateUrl: 'https://guangs.sogoyunaff.cc/#/?code=327Vs0w7',
      payments: ['支付宝', '微信', 'USDT'],
    },
    editorial: {
      positioning: '25 元档 · 150GB · VLESS · IEPL · 综合型',
      bestFor: '需要约 150GB 月流量,同时兼顾视频、AI 与日常代理的综合用户',
      pros: ['25 元档流量与线路配置完整', '提供自研客户端', '公开资料覆盖流媒体与 AI 工具场景'],
      cons: [
        '2026 年开业,是本站收录品牌中最新的一批,缺少长期口碑',
        '25 元价格高于同流量规格的一翻云',
      ],
      tags: ['25 元档', '150GB', 'IEPL', '综合型'],
      comparableWith: ['kexinyun', 'sujie', 'kuaili'],
    },
  },
  {
    slug: 'kexinyun',
    name: '可信云',
    alias: 'Kosing Cloud',
    vendor: {
      since: 2024,
      protocols: ['VLESS'],
      lines: ['IEPL'],
      pricing: { entryPriceCNY: 25, basis: 'monthly', trafficGB: 150 },
      claims: {
        streaming: 'unknown',
        aiTools: 'unknown',
        ownClient: false,
        thirdPartyClient: true,
      },
      highlights: ['VLESS 协议', 'IEPL 专线', '150GB 大流量'],
    },
    measured: notYetMeasured(),
    commercial: {
      relationship: 'affiliate',
      promoCode: 'kkk333',
      promoText: null,
      affiliateUrl: 'https://guangs.kosingaff.com/#/register?code=UYDtNlCY',
      payments: ['支付宝', '微信', 'USDT'],
    },
    editorial: {
      positioning: '25 元档 · 150GB · VLESS · IEPL',
      bestFor: '每月需要约 150GB 流量,并明确偏好专线线路的用户',
      pros: [
        '专线 + 大流量组合适合日常网页、视频与多设备使用',
        '2024 年起运营',
        '协议与线路定位清晰',
      ],
      cons: ['缺少统一的流媒体与 AI 解锁公开说明', '同价位中未见差异化卖点'],
      tags: ['25 元档', '150GB', 'IEPL', '专线'],
      comparableWith: ['sogoyun', 'kuaili', 'sujie'],
      caveat: '当前没有统一实测数据,不应写成"全部解锁"。',
    },
  },
  {
    slug: 'sujie',
    name: '速界',
    alias: 'SpeedWorld',
    vendor: {
      since: 2024,
      protocols: ['VLESS'],
      lines: ['IEPL'],
      pricing: { entryPriceCNY: 25, basis: 'monthly', trafficGB: 150 },
      // 品牌清单原文:「流媒体支持:当前资料重点不在流媒体」——那不是声明覆盖,是明确表示没主打
      claims: {
        streaming: 'unknown',
        aiTools: 'vendor-claim',
        ownClient: true,
        thirdPartyClient: true,
      },
      highlights: ['AI 工具场景', 'VLESS 协议', 'IEPL 专线', '自研客户端'],
    },
    measured: notYetMeasured(),
    commercial: {
      relationship: 'affiliate',
      promoCode: 'sss1111',
      promoText: null,
      affiliateUrl: 'https://guangs.speedworldaff.cc/#/register?code=xgXzEfZB',
      payments: ['支付宝', '微信', 'USDT'],
    },
    editorial: {
      positioning: 'AI 场景 · 25 元档 · 150GB · VLESS · IEPL',
      bestFor: '经常使用 ChatGPT、Claude、Gemini 等 AI 工具,同时需要稳定线路的用户',
      pros: [
        '品牌资料把 AI 工具访问作为核心卖点,定位最明确',
        'IEPL 专线 + 150GB 配置完整',
        '提供自研客户端',
      ],
      cons: ['AI 可用性目前仍属品牌声明,尚未经本站实测验证', '25 元档价格不占优势'],
      tags: ['AI 工具', '25 元档', '150GB', 'IEPL'],
      // 换成同为 150GB 的一翻云:同流量不同价,比与年付档比较更有参考价值
      comparableWith: ['kuaili', 'sogoyun', 'yifanyun'],
      caveat: 'ChatGPT / Claude / Gemini 可用性以品牌声明展示,具体以实际检测为准。',
    },
  },
  {
    slug: 'kuaili',
    name: '快狸',
    alias: 'Kuaili Cloud',
    vendor: {
      since: 2023,
      protocols: ['VLESS'],
      lines: ['IEPL'],
      pricing: { entryPriceCNY: 25, basis: 'monthly', trafficGB: 150 },
      claims: {
        streaming: 'vendor-claim',
        aiTools: 'vendor-claim',
        ownClient: true,
        thirdPartyClient: true,
      },
      highlights: ['VLESS 协议', 'IEPL 专线节点', '自研客户端'],
    },
    measured: notYetMeasured(),
    commercial: {
      relationship: 'affiliate',
      promoCode: 'kkk2222',
      promoText: null,
      affiliateUrl: 'https://guangs.kuailicloud.cc/#/register?code=AiqyM8oG',
      payments: ['支付宝', '微信', 'USDT'],
    },
    editorial: {
      positioning: '25 元档 · 150GB · 综合型 · VLESS · IEPL',
      bestFor: '视频、AI 与日常代理需求比较均衡的中等流量用户',
      pros: [
        '2023 年起运营,在 25 元档中运营时间较长',
        '公开资料同时覆盖流媒体与 AI 场景',
        '提供自研客户端',
      ],
      cons: [
        '与同价位的 SOGO 云、可信云、速界规格接近,差异化不明显',
        '25 元档需要明确的实测数据才能拉开差距',
      ],
      tags: ['25 元档', '150GB', '综合型', 'IEPL'],
      comparableWith: ['sujie', 'sogoyun', 'kexinyun'],
    },
  },
  {
    slug: 'quanqiuyun',
    name: '全球云',
    alias: 'Global Cloud',
    vendor: {
      since: 2026,
      protocols: ['VLESS'],
      lines: ['IEPL'],
      pricing: { entryPriceCNY: 20, basis: 'monthly', trafficGB: 120 },
      claims: {
        streaming: 'vendor-claim',
        aiTools: 'vendor-claim',
        ownClient: false,
        thirdPartyClient: true,
      },
      highlights: ['VLESS 协议', 'IEPL 专线', '20 元档'],
    },
    measured: notYetMeasured(),
    commercial: {
      relationship: 'affiliate',
      promoCode: 'qqy7777',
      promoText: null,
      affiliateUrl: 'https://guangs.gcvipaff.com/#/?code=Ov2nvU9C',
      payments: ['支付宝', '微信', 'USDT'],
    },
    editorial: {
      positioning: '20 元档 · 120GB · VLESS · IEPL',
      bestFor: '预算控制在 20 元左右,月流量需求 100GB 上下的用户',
      pros: [
        '20 元档提供 IEPL 专线,线路规格不缩水',
        '覆盖网页、视频与 AI 工具访问场景声明',
        '流量规格适配大多数日常用途',
      ],
      cons: ['2026 年开业,运营时间最短,缺少长期稳定性记录', '同价位下流量规格低于一翻云与二猫云'],
      tags: ['20 元档', '120GB', 'IEPL', 'VLESS'],
      comparableWith: ['u1s1', 'ermaoyun', 'yifanyun'],
    },
  },
];

/* ---------- 派生查询工具 ---------- */

export const getBrand = (slug: string): Brand | undefined => BRANDS.find((b) => b.slug === slug);

/** 月付口径的品牌(可直接按价格排名) */
export const monthlyBrands = (): Brand[] =>
  BRANDS.filter((b) => b.vendor.pricing.basis === 'monthly');

/** 年付折算口径的品牌(必须单独成组,不与月付混排) */
export const annualEquivalentBrands = (): Brand[] =>
  BRANDS.filter((b) => b.vendor.pricing.basis === 'annual-equivalent');

/**
 * 主推品牌,按 order 排列。
 *
 * 这个函数**只应该被主推位组件调用**。任何排序、评分、榜单选取都不得读它——
 * 读了就等于让商业关系影响排名,而那是这个站从第一天就排除掉的做法。
 * `src/lib/featured.test.ts` 会扫描调用点,把这条约束变成会失败的测试而不是一句注释。
 */
export const featuredBrands = (): Brand[] =>
  BRANDS.filter((b) => b.commercial.featured).sort(
    (a, b) => a.commercial.featured!.order - b.commercial.featured!.order
  );

/**
 * 单位流量成本(元/GB)。返回完整精度——四舍五入必须留到展示层做。
 * 提前取整会把 0.1267 与 0.1333 压成同一个 0.13,制造出假并列,
 * 让「哪家最便宜」变成排序稳定性的偶然结果,而不是真实的比较结果。
 */
export const costPerGB = (brand: Brand): number =>
  brand.vendor.pricing.entryPriceCNY / brand.vendor.pricing.trafficGB;

/** 展示用格式:三位小数足以区分本站收录品牌之间的差距 */
export const formatCostPerGB = (brand: Brand): string => costPerGB(brand).toFixed(3);

export const brandsByTag = (tag: string): Brand[] =>
  BRANDS.filter((b) => b.editorial.tags.includes(tag));

export const brandsWithLine = (line: LineType): Brand[] =>
  BRANDS.filter((b) => b.vendor.lines.includes(line));

/** 是否已有可展示的本站实测数据 */
export const hasMeasuredData = (brand: Brand): boolean =>
  brand.measured.status === 'done' && brand.measured.samples.length > 0;
