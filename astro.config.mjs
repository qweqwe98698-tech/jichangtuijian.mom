// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import { unified } from '@astrojs/markdown-remark';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeWrapTables from './src/lib/rehype-wrap-tables.mjs';

import { SITE_URL } from './src/config/site.ts';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  image: {
    responsiveStyles: true,
    layout: 'constrained',
  },
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-dimmed' },
      wrap: true,
    },
    processor: unified({
      // 中文正文里的直引号常出现在命令与订阅链接中,弯引号化会导致读者复制后无法使用
      smartypants: false,
      rehypePlugins: [
        rehypeSlug,
        // 表格必须包进滚动容器,否则 min-width:760px 会把手机版整页撑开
        rehypeWrapTables,
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'append',
            properties: { className: ['heading-anchor'], ariaHidden: 'true', tabIndex: -1 },
            content: { type: 'text', value: '#' },
          },
        ],
      ],
    }),
  },
  integrations: [
    mdx(),
    sitemap({
      changefreq: 'weekly',
      lastmod: new Date(),
      filter: (page) => !page.includes('/404'),
      serialize(item) {
        // 商业与枢纽页面优先级更高,便于搜索引擎优先抓取
        const path = new URL(item.url).pathname;
        if (path === '/') item.priority = 1.0;
        else if (/^\/(airports|compare|reviews)\//.test(path)) item.priority = 0.9;
        else if (/^\/(guides|protocols|troubleshooting|free-nodes|unlock)\//.test(path))
          item.priority = 0.7;
        else if (/^\/(about|editorial-policy|contact|disclaimer|authors)\//.test(path))
          item.priority = 0.3;
        else item.priority = 0.6;
        return item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
