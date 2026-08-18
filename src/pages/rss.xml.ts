import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE } from '@config/site';
import { allPosts, postUrl } from '@lib/content';

export async function GET(context: APIContext) {
  const posts = await allPosts();

  return rss({
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    site: context.site ?? SITE.url,
    trailingSlash: true,
    customData: `<language>zh-CN</language><copyright>© ${new Date().getFullYear()} ${SITE.name}</copyright>`,
    items: posts.slice(0, 50).map((post) => ({
      title: post.data.title,
      description: post.data.description,
      link: postUrl(post),
      pubDate: post.data.pubDate,
      categories: post.data.tags,
      // 结论先行段放进 content,让订阅者在阅读器里就能拿到核心答案
      content: `<p>${post.data.answer}</p>`,
    })),
  });
}
