/**
 * 全站唯一的站点元数据来源。canonical、JSON-LD、OG、sitemap、RSS 全部从这里取值。
 * 改动 SITE_URL / TRAILING_SLASH 会影响已收录 URL,非必要不改。
 */

export const SITE_URL = 'https://jichangtuijian.mom';

export const SITE = {
  url: SITE_URL,
  /** 站点品牌名(实体名,全站保持一致以利于搜索引擎与生成式系统建立实体认知) */
  name: '机场实测室',
  /** 与域名语义一致的完整称谓,用于 Organization.alternateName */
  altName: '机场推荐实测室',
  /** 首页 H1 之外的一句话定位 */
  tagline: '机场推荐 · 实测评测 · 代理知识库',
  /** 全站默认描述,单页应各自覆写 */
  description:
    '机场实测室提供 2026 机场推荐与实测评测、机场对比排行、Clash / Shadowrocket / v2rayN 客户端教程、代理协议知识库、流媒体与 AI 工具网络访问指南,以及机场风险预警与避坑方法。',
  lang: 'zh-CN',
  locale: 'zh_CN',
  /** <title> 模板;首页使用 titleDefault */
  titleTemplate: '%s | 机场实测室',
  titleDefault: '2026 机场推荐:16 家机场实测对比与选购指南 | 机场实测室',
  /** 站点建立年份,用于版权与 Organization.foundingDate */
  foundingYear: 2026,
  /** 反馈与核实入口,E-E-A-T 信任信号 */
  contactPath: '/contact/',
  /** 默认社交分享图(构建期生成) */
  ogImage: '/og/default.png',
} as const;

/** 主导航;顺序即商业优先级,同时决定内链权重分配 */
/**
 * 主导航。顺序即商业优先级,同时决定内链权重分配。
 * 前四项对应三大核心主题:机场推荐(首页)、机场导航、机场评测/对比、机场代理入门。
 */
export const NAV = [
  { label: '机场推荐', href: '/', description: '2026 年机场推荐总榜与选购路径' },
  { label: '机场导航', href: '/airports/', description: '16 家收录机场的完整索引与筛选' },
  { label: '机场评测', href: '/reviews/', description: '16 家机场品牌逐一评测' },
  { label: '机场对比', href: '/compare/', description: '按价格、流量、协议、线路横向对比' },
  { label: '机场代理入门', href: '/basics/', description: '机场是什么、和 VPN 有什么区别、怎么用' },
  {
    label: '客户端教程',
    href: '/guides/',
    description: 'Clash / Shadowrocket / v2rayN 全流程教程',
  },
  {
    label: '协议知识',
    href: '/protocols/',
    description: 'VLESS / VMess / Trojan / Hysteria2 / IEPL 原理',
  },
  { label: '风险预警', href: '/risk/', description: '跑路预警、免费节点风险与避坑指南' },
] as const;

/** 页脚信任区链接,E-E-A-T 必备 */
export const TRUST_LINKS = [
  { label: '关于本站', href: '/about/' },
  { label: '编辑与评测规范', href: '/editorial-policy/' },
  { label: '评测团队', href: '/authors/' },
  { label: '数据与免责说明', href: '/disclaimer/' },
  { label: '联系与纠错', href: '/contact/' },
] as const;

export type NavItem = (typeof NAV)[number];
