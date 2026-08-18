/**
 * 分析与转化追踪配置。
 *
 * 全部走环境变量,token 不进版本库。没配就整段不渲染——
 * 本地开发和预览不会产生任何请求,也不会污染线上数据。
 *
 * 隐私口径:这里选的两种方案都**不使用 Cookie、不做跨站跟踪、不采集个人身份信息**,
 * 因此站上不需要弹同意横幅。这不只是省事:一个讲「不要把厂商声明当实测」的站,
 * 自己在读者身上装第三方追踪器会很难看。
 */

/**
 * Cloudflare Web Analytics 的 beacon token。
 * 在 Cloudflare 控制台 → Web Analytics → 添加站点后获得。
 *
 * 它只统计浏览量、来源、国家、Core Web Vitals,**不支持自定义事件**——
 * 所以推广链接的点击要另配一个支持事件的провайдер,见下。
 */
export const CF_BEACON_TOKEN = import.meta.env.PUBLIC_CF_BEACON_TOKEN ?? '';

/**
 * 支持自定义事件的分析服务,用于统计推广链接点击(也就是转化漏斗的最后一跳)。
 *
 * 支持 Plausible 与 Umami 两种,二选一:
 *   PUBLIC_ANALYTICS_PROVIDER = 'plausible' | 'umami'
 *   PUBLIC_ANALYTICS_HOST     = 自托管地址或官方地址
 *   PUBLIC_ANALYTICS_SITE_ID  = 站点标识(Plausible 用域名,Umami 用 website-id)
 *
 * 不配的话,推广链接点击追踪会自动降级为「什么也不做」,页面功能不受影响。
 */
export const EVENT_PROVIDER = (import.meta.env.PUBLIC_ANALYTICS_PROVIDER ?? '') as
  '' | 'plausible' | 'umami';

export const EVENT_HOST = import.meta.env.PUBLIC_ANALYTICS_HOST ?? '';
export const EVENT_SITE_ID = import.meta.env.PUBLIC_ANALYTICS_SITE_ID ?? '';

export const hasEventProvider = Boolean(EVENT_PROVIDER && EVENT_HOST && EVENT_SITE_ID);
export const hasAnyAnalytics = Boolean(CF_BEACON_TOKEN) || hasEventProvider;
