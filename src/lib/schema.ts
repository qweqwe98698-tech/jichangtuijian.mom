import { SITE, SITE_URL } from '@config/site';

/**
 * JSON-LD 构造器。按页面类型分配结构化数据类型,不做全站堆砌。
 * 所有 @id 使用绝对 URL 并保持稳定,便于搜索引擎与生成式系统建立实体关系图。
 */

type Json = Record<string, unknown>;

export const abs = (path: string): string => new URL(path, SITE_URL).href;

const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;

/** 全站唯一的发布主体。所有 Article.publisher 指向此 @id 而非重复内联 */
export function organizationSchema(): Json {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE.name,
    alternateName: SITE.altName,
    url: `${SITE_URL}/`,
    description: SITE.description,
    foundingDate: String(SITE.foundingYear),
    logo: {
      '@type': 'ImageObject',
      url: abs('/brand/logo.svg'),
      width: 512,
      height: 512,
    },
    knowsAbout: [
      '机场推荐',
      '机场评测',
      '代理协议',
      'Clash',
      'Shadowrocket',
      'v2rayN',
      'VLESS',
      'Trojan',
      'Hysteria2',
      'IEPL 专线',
      'IPLC 专线',
      '流媒体解锁',
      'AI 工具网络访问',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'editorial feedback',
      url: abs(SITE.contactPath),
      availableLanguage: ['zh-CN'],
    },
  };
}

/** 含站内搜索动作,让搜索引擎有机会展示站内搜索框 */
export function websiteSchema(): Json {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: `${SITE_URL}/`,
    name: SITE.name,
    description: SITE.description,
    inLanguage: SITE.lang,
    publisher: { '@id': ORG_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/search/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export interface Crumb {
  name: string;
  href: string;
}

export function breadcrumbSchema(crumbs: Crumb[]): Json {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: abs(c.href),
    })),
  };
}

export interface ArticleSchemaInput {
  title: string;
  description: string;
  path: string;
  pubDate: Date;
  updatedDate: Date;
  authorName: string;
  authorPath: string;
  image?: { src: string; width: number; height: number };
  section: string;
  keywords: string[];
  wordCount?: number;
}

export function articleSchema(input: ArticleSchemaInput): Json {
  const url = abs(input.path);
  return {
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: input.title,
    description: input.description,
    inLanguage: SITE.lang,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: input.pubDate.toISOString(),
    dateModified: input.updatedDate.toISOString(),
    author: {
      '@type': 'Person',
      name: input.authorName,
      url: abs(input.authorPath),
    },
    publisher: { '@id': ORG_ID },
    articleSection: input.section,
    keywords: input.keywords.join(', '),
    ...(input.wordCount ? { wordCount: input.wordCount } : {}),
    ...(input.image
      ? {
          image: {
            '@type': 'ImageObject',
            url: abs(input.image.src),
            width: input.image.width,
            height: input.image.height,
          },
        }
      : {}),
  };
}

export function faqSchema(faq: { question: string; answer: string }[]): Json {
  return {
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export interface ItemListEntry {
  name: string;
  href: string;
  description?: string;
}

export function itemListSchema(name: string, items: ItemListEntry[]): Json {
  return {
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: abs(item.href),
      ...(item.description ? { description: item.description } : {}),
    })),
  };
}

export interface HowToInput {
  name: string;
  description: string;
  totalTime?: string;
  supply?: string[];
  steps: { name: string; text: string; anchor?: string }[];
  path: string;
}

export function howToSchema(input: HowToInput): Json {
  return {
    '@type': 'HowTo',
    name: input.name,
    description: input.description,
    inLanguage: SITE.lang,
    ...(input.totalTime ? { totalTime: input.totalTime } : {}),
    ...(input.supply?.length
      ? { supply: input.supply.map((s) => ({ '@type': 'HowToSupply', name: s })) }
      : {}),
    step: input.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
      ...(s.anchor ? { url: `${abs(input.path)}#${s.anchor}` } : {}),
    })),
  };
}

/** 品牌评测页使用。刻意不输出 aggregateRating —— 没有真实用户评分数据,不得伪造 */
export function brandReviewSchema(input: {
  brandName: string;
  path: string;
  description: string;
  priceCNY: number;
  authorName: string;
  updatedDate: Date;
}): Json {
  const url = abs(input.path);
  return {
    '@type': 'Product',
    '@id': `${url}#product`,
    name: input.brandName,
    description: input.description,
    category: '网络代理订阅服务',
    brand: { '@type': 'Brand', name: input.brandName },
    offers: {
      '@type': 'Offer',
      price: input.priceCNY,
      priceCurrency: 'CNY',
      availability: 'https://schema.org/InStock',
      url,
    },
    subjectOf: {
      '@type': 'Review',
      author: { '@type': 'Organization', name: SITE.name, '@id': ORG_ID },
      datePublished: input.updatedDate.toISOString(),
      url,
    },
  };
}

/** 把若干 schema 片段包成一个 @graph,减少页面内 script 标签数量 */
export function graph(...nodes: (Json | null | undefined)[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': nodes.filter(Boolean),
  });
}
