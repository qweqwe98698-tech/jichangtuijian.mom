import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * 全站内容模型。所有文章从第一篇起就必须满足同一套 Schema,
 * 保证后续规模化扩展时结构统一、SEO 字段不缺失。
 *
 * category 与 pillar 是两套独立体系:
 *   category 决定导航归属(一篇文章只能属于一个栏目)
 *   pillar   决定主题权威建设(Pillar-Cluster 内链模型)
 */

/** 栏目取值集合,与 URL 契约和主导航严格对应 */
export const CATEGORIES = [
  'airports', // 机场导航与大全 —— 三大核心主题之一
  'reviews', // 机场评测
  'compare', // 机场对比
  'guides', // 客户端教程
  'protocols', // 代理协议知识
  'troubleshooting', // 故障排查
  'free-nodes', // 免费节点(安全教育)
  'unlock', // 流媒体与 AI 访问
  'risk', // 风险预警
  'basics', // 机场代理入门 —— 三大核心主题之一
] as const;

/** 搜索意图,决定页面模板的 CTA 强度与内链去向 */
export const INTENTS = [
  'informational', // 信息型:先解答,弱商业引导
  'tutorial', // 教程型:先完成任务,再引导选服务
  'problem', // 问题型:先排障,失败路径才引导换服务
  'comparison', // 对比型:可直接引导品牌详情
  'commercial', // 商业型:可直接引导注册转化
] as const;

const faqSchema = z
  .array(
    z.object({
      question: z.string().min(4),
      answer: z.string().min(10),
    })
  )
  .optional();

const coverSchema = z
  .object({
    src: z.string(),
    alt: z.string().min(4, '封面 alt 必须是描述性文本,不能留空或填文件名'),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .optional();

/** HowTo 结构化数据来源;仅教程型文章填写 */
const howToSchema = z
  .object({
    totalTime: z.string().optional(),
    supply: z.array(z.string()).optional(),
    steps: z
      .array(
        z.object({
          name: z.string(),
          text: z.string(),
          anchor: z.string().optional(),
        })
      )
      .min(2),
  })
  .optional();

const postSchema = z.object({
  title: z.string().min(6).max(60),
  description: z.string().min(40).max(160),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date(),
  category: z.enum(CATEGORIES),
  tags: z.array(z.string()).min(1).max(8),
  cover: coverSchema,
  author: z.string().default('editorial-team'),
  faq: faqSchema,
  relatedSlugs: z.array(z.string()).default([]),
  pillar: z.string().nullable().default(null),
  draft: z.boolean().default(false),

  /** 本页主攻关键词,用于关键词归属审计,防止同类页面自相蚕食 */
  primaryKeyword: z.string().min(2),
  /** 次要关键词,不参与唯一归属校验 */
  secondaryKeywords: z.array(z.string()).default([]),
  intent: z.enum(INTENTS),
  /**
   * 用户读完本页后最合理的下一步。全站最高原则要求任何页面都不能是死胡同,
   * 因此该字段必填,构建期会校验链接可达。
   */
  nextStep: z.object({
    label: z.string(),
    href: z.string().startsWith('/'),
    reason: z.string(),
  }),
  /** 结论先行:文章开头 2-3 句直接回答标题问题,同时供生成式搜索摘录 */
  answer: z.string().min(30).max(300),
  /** 关联品牌 slug,驱动品牌内链与转化组件 */
  brands: z.array(z.string()).default([]),
  howTo: howToSchema,
});

const pillarSchema = z.object({
  title: z.string().min(6).max(60),
  description: z.string().min(40).max(160),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date(),
  primaryKeyword: z.string().min(2),
  /** 该专题在导航与首页的展示顺序,数字越小越靠前 */
  order: z.number().int().default(50),
  /** 专题所属栏目,用于面包屑 */
  category: z.enum(CATEGORIES),
  answer: z.string().min(30).max(300),
  cover: coverSchema,
  faq: faqSchema,
  /** 专题内的推荐阅读顺序;未列出的同 pillar 文章会自动追加 */
  readingOrder: z.array(z.string()).default([]),
  brands: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
});

const authorSchema = z.object({
  name: z.string(),
  role: z.string(),
  bio: z.string().min(30),
  /** 该作者负责的领域,支撑 E-E-A-T 的专业性信号 */
  expertise: z.array(z.string()).min(1),
  avatar: z.string().optional(),
  /** 内容审核方式说明 */
  reviewProcess: z.string().optional(),
});

const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
  schema: postSchema,
});

const pillars = defineCollection({
  loader: glob({ base: './src/content/pillars', pattern: '**/*.{md,mdx}' }),
  schema: pillarSchema,
});

const authors = defineCollection({
  loader: glob({ base: './src/content/authors', pattern: '**/*.{md,mdx}' }),
  schema: authorSchema,
});

/**
 * 品牌档案:每家机场评测页的**独立分析正文**。
 *
 * 为什么单独建一个集合而不是塞进模板:
 * 规格表、评分明细、测速证据、商业披露这些结构块**应该**全站一致——那是合规特性,
 * 变着花样写反而让读者更难比较。但分析部分必须逐家不同,否则就是指令禁止的
 * 「只替换品牌名的模板文章」。
 *
 * 分开之后,模板负责一致的部分,这个集合负责差异的部分,两者互不干扰。
 * 文件名必须是品牌 slug,由构建期校验与 BRANDS 一一对应。
 */
const brandProfileSchema = z.object({
  /** 覆写模板默认标题;不填则用模板生成 */
  title: z.string().min(6).max(60),
  description: z.string().min(40).max(160),
  h1: z.string().min(6).max(60),
  /** 首屏结论,40-300 字,不依赖上下文可独立成立 */
  leadAnswer: z.string().min(30).max(300),
  /** 这一页承接的搜索意图,一句话 */
  searchIntent: z.string().min(10),
  /** 目标用户画像,具体到场景与预算 */
  targetUser: z.string().min(10),
  /** 本页相对其他 15 家的结构差异,用于去模板化审计 */
  differentiator: z.string().min(20),
  faq: z
    .array(z.object({ question: z.string().min(4), answer: z.string().min(10) }))
    .min(3)
    .max(6),
  /** 同价位或同定位的可比品牌 slug */
  peers: z.array(z.string()).min(2).max(4),
  /** 什么情况下应该选别家 —— 强制每页都要有退出通道 */
  whenToPickOthers: z.string().min(20),
  /** 风险与状态提示 */
  riskItems: z.array(z.string()).min(2).max(6),
  /** 客服与退款入口的写法;不得编造具体联系方式 */
  supportEntry: z.string().min(20),
  /** CTA 的条件性表达 */
  ctaCondition: z.string().min(10),
  draft: z.boolean().default(false),
});

const brandProfiles = defineCollection({
  loader: glob({ base: './src/content/brand-profiles', pattern: '**/*.{md,mdx}' }),
  schema: brandProfileSchema,
});

export const collections = { posts, pillars, authors, brandProfiles };

export type Category = (typeof CATEGORIES)[number];
export type Intent = (typeof INTENTS)[number];

/** 栏目的中文名与定位,供导航、面包屑、栏目页复用 */
export const CATEGORY_META: Record<
  Category,
  { name: string; title: string; description: string; intent: Intent }
> = {
  airports: {
    name: '机场导航',
    title: '机场导航与机场大全:16 家收录机场的完整索引',
    description:
      '按价格、流量、线路类型、协议与开业年份索引本站收录的全部机场,说明收录标准与数据来源,并教你怎么辨别机场官网真伪、怎么读懂一个导航站的推荐逻辑。',
    intent: 'commercial',
  },
  reviews: {
    name: '机场评测',
    title: '机场评测:16 家机场逐一实测与深度分析',
    description:
      '逐家拆解机场的套餐规格、线路类型、协议支持与适用人群,标明哪些是厂商声明、哪些是本站实测,帮助你在下单前判断是否值得买。',
    intent: 'comparison',
  },
  compare: {
    name: '机场对比',
    title: '机场对比:按价格、流量、协议与线路横向比较',
    description: '把同价位、同流量档、同线路类型的机场放在一起比较,给出可核对的差异点与选择建议。',
    intent: 'comparison',
  },
  guides: {
    name: '客户端教程',
    title: '客户端教程:Clash、Shadowrocket、v2rayN 全流程配置',
    description:
      '从下载安装、导入订阅、节点选择到规则分流,按平台给出可跟着做完的完整步骤,并附常见报错的处理方法。',
    intent: 'tutorial',
  },
  protocols: {
    name: '协议知识',
    title: '代理协议知识库:VLESS、VMess、Trojan、Hysteria2 与专线原理',
    description:
      '用普通用户能懂的方式解释各代理协议的差别、适用场景与性能特征,以及 IPLC / IEPL 专线和原生 IP 到底意味着什么。',
    intent: 'informational',
  },
  troubleshooting: {
    name: '故障排查',
    title: '故障排查:连不上、节点超时、订阅失效的排查方法',
    description:
      '按现象定位原因:先排查客户端设置,再排查系统代理与 DNS,然后是订阅与节点,最后才怀疑线路本身。给出可照做的分层排查顺序,避免一遇到问题就盲目换机场。',
    intent: 'problem',
  },
  'free-nodes': {
    name: '免费节点',
    title: '免费节点:风险认知与安全使用须知',
    description:
      '说明免费节点的常见来源、隐私与安全风险,以及为什么它不适合承载账号登录和支付等敏感操作。本站不提供节点分发。',
    intent: 'informational',
  },
  unlock: {
    name: '流媒体与 AI',
    title: '流媒体与 AI 工具网络访问指南',
    description:
      '解释 Netflix、Disney+ 等流媒体的地区判定逻辑,以及 ChatGPT、Claude、Gemini 等 AI 工具对网络环境的实际要求。',
    intent: 'informational',
  },
  risk: {
    name: '风险预警',
    title: '机场风险预警与避坑指南',
    description:
      '识别机场跑路的早期征兆、超售套路与常见的虚假宣传话术,并给出可以立刻执行的降损方法:付款周期怎么选、备份方案怎么留、发现异常时按什么顺序处理。',
    intent: 'informational',
  },
  basics: {
    name: '机场代理入门',
    title: '机场代理入门:机场是什么、和 VPN 有什么区别、怎么用',
    description:
      '机场代理、科学上网机场、翻墙机场、VPN 机场这些说法指的是不是同一件事?机场、节点、订阅、客户端怎么配合工作?一个月大概花多少钱?新手最容易踩的坑在哪?',
    intent: 'informational',
  },
};
