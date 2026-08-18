/**
 * 内容模型完整性检查。在构建之前直接读 Markdown frontmatter,
 * 因为这类错误(pillar 跨栏目、slug 冲突)会静默产出错误 URL 而不是报错,
 * 等构建完成再发现就已经污染了 sitemap。
 *
 * 覆盖内链规则:
 *   R01 relatedSlugs 下限与同 pillar 约束
 *   R05 pillar 双向完整性(pillar 必须存在,且与文章同栏目)
 *   R14 slug 命名规范与冲突
 *   关键词唯一归属(primaryKeyword 全站不得重复)
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const POSTS_DIR = path.resolve('src/content/posts');
const PILLARS_DIR = path.resolve('src/content/pillars');

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CATEGORIES = [
  'reviews',
  'compare',
  'guides',
  'protocols',
  'troubleshooting',
  'free-nodes',
  'unlock',
  'risk',
  'basics',
];

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.name.endsWith('.md') || e.name.endsWith('.mdx')) yield full;
  }
}

/** 极简 frontmatter 解析:只取我们校验需要的标量与字符串数组,不引入 YAML 依赖 */
function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  const lines = m[1].split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([a-zA-Z]\w*):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let value = kv[2].trim();

    if (value === '' || value === '[]') {
      // 可能是块级数组
      const items = [];
      for (let j = i + 1; j < lines.length; j++) {
        const item = lines[j].match(/^\s+-\s+(.+)$/);
        if (!item) break;
        items.push(item[1].trim().replace(/^["']|["']$/g, ''));
        i = j;
      }
      out[key] = items;
      continue;
    }

    if (value.startsWith('[') && value.endsWith(']')) {
      out[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
      continue;
    }

    out[key] = value.replace(/^["']|["']$/g, '');
  }
  return out;
}

const errors = [];
const warnings = [];

const pillars = new Map();
for await (const file of walk(PILLARS_DIR)) {
  const fm = parseFrontmatter(await readFile(file, 'utf8'));
  const slug = path.basename(file).replace(/\.mdx?$/, '');
  if (!fm) {
    errors.push(`pillar ${slug}  frontmatter 无法解析`);
    continue;
  }
  if (!SLUG_RE.test(slug))
    errors.push(`pillar ${slug}  slug 不符合 /^[a-z0-9]+(-[a-z0-9]+)*$/(R14)`);
  pillars.set(slug, { ...fm, slug, file });
}

const posts = [];
for await (const file of walk(POSTS_DIR)) {
  const fm = parseFrontmatter(await readFile(file, 'utf8'));
  const slug = path.basename(file).replace(/\.mdx?$/, '');
  if (!fm) {
    errors.push(`post ${slug}  frontmatter 无法解析`);
    continue;
  }
  posts.push({ ...fm, slug, file });
}

/* ---- R14 slug 规范 ---- */
for (const p of posts) {
  if (!SLUG_RE.test(p.slug)) errors.push(`post ${p.slug}  slug 不符合命名规范(R14)`);
  if (!CATEGORIES.includes(p.category))
    errors.push(`post ${p.slug}  category「${p.category}」不在允许集合内`);
}

/* ---- R14 同栏目内 slug 冲突 ---- */
const byCategorySlug = new Map();
for (const p of posts) {
  const key = `${p.category}|${p.pillar || ''}|${p.slug}`;
  if (byCategorySlug.has(key)) {
    errors.push(`post ${p.slug}  与 ${byCategorySlug.get(key)} 产生相同 URL(R14)`);
  }
  byCategorySlug.set(key, p.file);
}

/* ---- R05 pillar 必须存在且同栏目 ---- */
for (const p of posts) {
  const ref = p.pillar;
  if (!ref || ref === 'null') continue;
  const pillar = pillars.get(ref);
  if (!pillar) {
    errors.push(`post ${p.slug}  引用了不存在的 pillar「${ref}」,会产生指向 404 的面包屑(R05)`);
  } else if (pillar.category !== p.category) {
    errors.push(
      `post ${p.slug}  category=${p.category} 但 pillar「${ref}」属于 ${pillar.category},` +
        `会产出 /${p.category}/${ref}/${p.slug}/ 这样无法访问的 URL(R05)`
    );
  }
}

/* ---- R05 每个 pillar 至少要有文章 ---- */
for (const [slug, pillar] of pillars) {
  const count = posts.filter((p) => p.pillar === slug && p.category === pillar.category).length;
  if (count === 0) errors.push(`pillar ${slug}  没有任何同栏目文章挂载,会成为空专题页(R05)`);
  else if (count < 3)
    warnings.push(`pillar ${slug}  仅 ${count} 篇文章,建议扩充到 5 篇以上(R05 目标值)`);
}

/* ---- R01 relatedSlugs ---- */
const allSlugs = new Set(posts.map((p) => p.slug));
for (const p of posts) {
  const related = Array.isArray(p.relatedSlugs) ? p.relatedSlugs : [];
  if (related.length < 2) errors.push(`post ${p.slug}  relatedSlugs 少于 2 条(R01)`);
  for (const r of related) {
    const bare = r.split('/').pop();
    if (!allSlugs.has(bare)) warnings.push(`post ${p.slug}  relatedSlugs 指向尚不存在的「${r}」`);
    if (bare === p.slug) errors.push(`post ${p.slug}  relatedSlugs 指向了自己(R01)`);
  }
}

/* ---- 关键词唯一归属 ---- */
const kw = new Map();
for (const p of [...posts, ...pillars.values()]) {
  const k = (p.primaryKeyword || '').trim();
  if (!k) {
    errors.push(`${p.slug}  缺少 primaryKeyword`);
    continue;
  }
  if (kw.has(k)) errors.push(`主关键词冲突「${k}」:${kw.get(k)} 与 ${p.slug} 争抢同一个词`);
  kw.set(k, p.slug);
}

const line = '─'.repeat(64);
console.log(line);
console.log(`内容模型检查:${posts.length} 篇文章 · ${pillars.size} 个专题 · ${kw.size} 个主关键词`);
console.log(line);

if (warnings.length) {
  console.log(`\n⚠  ${warnings.length} 条警告:`);
  for (const w of warnings) console.log(`   ${w}`);
}

if (errors.length) {
  console.error(`\n✗  ${errors.length} 条错误:`);
  for (const e of errors) console.error(`   ${e}`);
  process.exit(1);
}

console.log(`\n✓  内容模型完整(${warnings.length} 条警告)`);
