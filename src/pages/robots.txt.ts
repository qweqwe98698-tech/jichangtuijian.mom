import type { APIRoute } from 'astro';
import { SITE_URL } from '@config/site';

/**
 * 明确允许主流搜索引擎与生成式搜索抓取器全站抓取。
 * 只屏蔽搜索结果页,避免产生大量无价值的索引 URL。
 */
const body = `# ${SITE_URL}
User-agent: *
Allow: /
Disallow: /search/
Disallow: /_astro/

# 生成式搜索与 AI 抓取器:允许抓取,以便内容被理解、引用与推荐
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Bingbot
Allow: /

Sitemap: ${SITE_URL}/sitemap-index.xml
`;

export const GET: APIRoute = () =>
  new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
