import { getCollection, type CollectionEntry } from 'astro:content';
import type { Category } from '../content.config';

/**
 * 内容查询工具。所有页面从这里取数据,保证 draft 过滤、排序与 URL 规则只有一处实现。
 */

export type Post = CollectionEntry<'posts'>;
export type Pillar = CollectionEntry<'pillars'>;

/* 刻意不把过滤条件作为 getCollection 的第二参数传入:那个重载期望类型谓词,
   传普通布尔函数会让集合的元素类型退化成 any,后续所有推断跟着失效。 */

export async function allPosts(): Promise<Post[]> {
  const posts = await getCollection('posts');
  return posts
    .filter((p) => !p.data.draft)
    .sort((a, b) => b.data.updatedDate.getTime() - a.data.updatedDate.getTime());
}

export async function allPillars(): Promise<Pillar[]> {
  const pillars = await getCollection('pillars');
  return pillars.filter((p) => !p.data.draft).sort((a, b) => a.data.order - b.data.order);
}

/**
 * 文章 URL。有 pillar 时为 /[category]/[pillar]/[slug]/,否则为 /[category]/[slug]/。
 * 这是 URL 契约的唯一实现处,任何页面都不得自己拼接文章路径。
 */
export function postUrl(post: Post): string {
  const slug = post.id.split('/').pop()!;
  return post.data.pillar
    ? `/${post.data.category}/${post.data.pillar}/${slug}/`
    : `/${post.data.category}/${slug}/`;
}

export function pillarUrl(pillar: Pillar): string {
  return `/${pillar.data.category}/${pillar.id}/`;
}

export const postSlug = (post: Post): string => post.id.split('/').pop()!;

export async function postsByCategory(category: Category): Promise<Post[]> {
  return (await allPosts()).filter((p) => p.data.category === category);
}

export async function pillarsByCategory(category: Category): Promise<Pillar[]> {
  return (await allPillars()).filter((p) => p.data.category === category);
}

export async function postsInPillar(pillarId: string): Promise<Post[]> {
  return (await allPosts()).filter((p) => p.data.pillar === pillarId);
}

/**
 * 专题内的阅读顺序:先按 pillar 显式指定的 readingOrder 排,未列出的按更新时间追加。
 * 这样新增文章不会打乱既定的学习路径,但也不会漏掉。
 */
export async function orderedPillarPosts(pillar: Pillar): Promise<Post[]> {
  const posts = await postsInPillar(pillar.id);
  const order = pillar.data.readingOrder;
  const bySlug = new Map(posts.map((p) => [postSlug(p), p]));

  const ordered = order.map((s) => bySlug.get(s)).filter(Boolean) as Post[];
  const listed = new Set(ordered.map(postSlug));
  return [...ordered, ...posts.filter((p) => !listed.has(postSlug(p)))];
}

/**
 * 解析 relatedSlugs 为实际文章。
 *
 * 裸 slug 在全站并不唯一——三个客户端专题都会出现 import-subscription、download-and-install
 * 这类同名文章。因此解析必须按作用域从窄到宽:同专题 → 同栏目 → 全站,
 * 否则 Clash 的「导入订阅」会串到 Shadowrocket 的同名文章上。
 *
 * relatedSlugs 也支持写成 `pillar/slug` 的完整形式来显式消歧。
 */
export async function resolveRelated(post: Post): Promise<Post[]> {
  const posts = (await allPosts()).filter((p) => p.id !== post.id);

  const resolveOne = (ref: string): Post | undefined => {
    if (ref.includes('/')) return posts.find((p) => p.id === ref || p.id.endsWith(`/${ref}`));

    const samePillar = post.data.pillar
      ? posts.find((p) => p.data.pillar === post.data.pillar && postSlug(p) === ref)
      : undefined;
    if (samePillar) return samePillar;

    const sameCategory = posts.find(
      (p) => p.data.category === post.data.category && postSlug(p) === ref
    );
    if (sameCategory) return sameCategory;

    return posts.find((p) => postSlug(p) === ref);
  };

  const seen = new Set<string>();
  const out: Post[] = [];
  for (const ref of post.data.relatedSlugs) {
    const found = resolveOne(ref);
    if (found && !seen.has(found.id)) {
      seen.add(found.id);
      out.push(found);
    }
  }
  return out;
}

/** 全站标签及其文章数,用于标签索引页 */
export async function tagIndex(): Promise<{ tag: string; count: number }[]> {
  const posts = await allPosts();
  const counts = new Map<string, number>();
  for (const p of posts) {
    for (const t of p.data.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-Hans-CN'));
}
