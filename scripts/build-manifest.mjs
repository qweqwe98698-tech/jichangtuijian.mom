/**
 * 批量扩展前的结构冻结器。
 *
 * 上一轮并行写作暴露的问题:子智能体各自决定 slug 与 pillar,导致
 *   1) 三个客户端专题产出同名文件,并行写入时互相覆盖(有内容永久丢失)
 *   2) 文章 category 与 pillar 不同栏目,产出无法访问的 URL
 *   3) nextStep 指向尚未存在的路由,构建后才发现是死链
 *
 * 因此这一轮先把结构算死:每篇文章的文件路径、slug、栏目、专题、最终 URL、
 * 下一步去向、相关文章全部在这里确定并校验通过,写作智能体只负责写正文。
 *
 * 用法:node scripts/build-manifest.mjs <clusters.json> <输出路径>
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [, , CLUSTERS_PATH, OUT_PATH] = process.argv;
if (!CLUSTERS_PATH || !OUT_PATH) {
  console.error('用法: node scripts/build-manifest.mjs <clusters.json> <out.json>');
  process.exit(1);
}

const POSTS_DIR = path.resolve('src/content/posts');
const PILLARS_DIR = path.resolve('src/content/pillars');

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
const INTENTS = ['informational', 'tutorial', 'problem', 'comparison', 'commercial'];

const BRAND_SLUGS = [
  'guangsuyun',
  'xingdaomeng',
  'lingmao',
  'feimaoyun',
  'weituyun',
  'yuzhouyun',
  'u1s1',
  'jilianyun',
  'guangnianti',
  'yifanyun',
  'ermaoyun',
  'sogoyun',
  'kexinyun',
  'sujie',
  'kuaili',
  'quanqiuyun',
];
const RANKING_SLUGS = [
  'cheap',
  'value',
  'stable',
  'iepl',
  'beginner',
  'big-traffic',
  'chatgpt',
  'streaming',
  'long-running',
];

/**
 * 客户端专题的文章一律留在 guides 栏目,即使它讲的是排障。
 * 理由:这三个 pillar 的正文都把「排障」写成使用链路的第六步,
 * 把故障篇踢到 troubleshooting 会让学习路径断掉,而 URL 由 category+pillar 决定,
 * 跨栏目会直接产出 /troubleshooting/clash/ 这种不存在的中间层。
 */
const CLIENT_PILLARS = new Set(['clash', 'shadowrocket', 'v2rayn']);

/** 审计判定必须删除的选题(与其他篇主词冲突且信息增量不足) */
const DROP = new Set(['real-dedicated-line-check', 'iepl-or-iplc-for-you']);

/** 审计判定需要改写主关键词的选题,避免与其他篇争同一个词 */
const KEYWORD_OVERRIDE = {
  'annual-plan-risk': '机场付款方式与退款追索',
  'single-vs-backup-airport': '主备机场怎么搭配',
  'backup-plan': '机场备用方案怎么留',
  'speed-slow-at-peak-hours': '机场晚高峰变慢怎么办',
  'stability-metrics': '机场稳定性怎么衡量',
  'native-ip-unlock-truth': '原生IP到底能解锁什么',
  'traffic-used-up': '机场流量用完了怎么办',
  'marketing-red-flags': '机场宣传话术怎么识别',
};

const slugRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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
    else if (e.name.endsWith('.md')) yield full;
  }
}

const fmValue = (src, key) => {
  const m = src.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
};

/* ---------- 1. 盘点已经写好的内容 ---------- */

const existingPosts = [];
for await (const f of walk(POSTS_DIR)) {
  const src = await readFile(f, 'utf8');
  const slug = path.basename(f, '.md');
  existingPosts.push({
    slug,
    category: fmValue(src, 'category'),
    pillar: fmValue(src, 'pillar'),
    primaryKeyword: fmValue(src, 'primaryKeyword'),
    title: fmValue(src, 'title'),
  });
}

const existingPillars = [];
for await (const f of walk(PILLARS_DIR)) {
  const src = await readFile(f, 'utf8');
  existingPillars.push({
    slug: path.basename(f, '.md'),
    category: fmValue(src, 'category'),
    primaryKeyword: fmValue(src, 'primaryKeyword'),
  });
}

const pillarBySlug = new Map(existingPillars.map((p) => [p.slug, p]));

/* ---------- 2. 逐簇规范化 ---------- */

// PowerShell 的 Out-File -Encoding utf8 会写入 BOM,JSON.parse 不接受
const stripBom = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);
const clusters = JSON.parse(stripBom(await readFile(CLUSTERS_PATH, 'utf8')));

const takenSlugs = new Set(existingPosts.map((p) => p.slug));
const takenKeywords = new Map(
  [...existingPosts, ...existingPillars].map((p) => [p.primaryKeyword, p.slug])
);

const manifest = [];
const dropped = [];
const renames = [];

for (const cluster of clusters) {
  const pillarSlug = cluster.pillar.slug;
  const pillar = pillarBySlug.get(pillarSlug);
  if (!pillar) {
    console.error(`✗ 专题 ${pillarSlug} 尚未落盘,跳过整簇 ${cluster.clusterKey}`);
    continue;
  }

  /** 簇内 slug 重映射表:原 slug -> 最终 slug,用于修正 relatedSlugs */
  const remap = new Map();

  const normalized = [];
  for (const a of cluster.articles) {
    if (DROP.has(a.slug)) {
      dropped.push({ slug: a.slug, reason: '审计判定与其他篇主词冲突且信息增量不足' });
      continue;
    }

    /* 栏目与专题归属 */
    let category = a.category;
    let articlePillar = pillarSlug;

    if (CLIENT_PILLARS.has(pillarSlug)) {
      // 客户端专题:全部留在 guides,保住六步学习路径
      category = 'guides';
    } else if (category !== pillar.category) {
      // 其余跨栏目文章脱离专题,走 /[category]/[slug]/ 两级 URL
      articlePillar = null;
    }

    if (!CATEGORIES.includes(category)) {
      console.error(`✗ ${a.slug} 的 category「${a.category}」非法,跳过`);
      continue;
    }

    /* slug 唯一化:同名文件会互相覆盖,必须全站唯一 */
    let slug = a.slug;
    if (!slugRe.test(slug)) {
      console.error(`✗ ${slug} 不符合命名规范,跳过`);
      continue;
    }
    if (takenSlugs.has(slug)) {
      const prefix = CLIENT_PILLARS.has(pillarSlug) ? pillarSlug : category;
      const candidate = slug.startsWith(`${prefix}-`)
        ? `${prefix}-post-${slug}`
        : `${prefix}-${slug}`;
      if (takenSlugs.has(candidate)) {
        console.error(`✗ ${slug} 无法唯一化(${candidate} 也已占用),跳过`);
        continue;
      }
      renames.push({ from: slug, to: candidate, why: '与已有文章同名,同名文件会互相覆盖' });
      slug = candidate;
    }
    takenSlugs.add(slug);
    remap.set(a.slug, slug);

    /* 主关键词唯一归属 */
    let primaryKeyword = KEYWORD_OVERRIDE[a.slug] ?? a.primaryKeyword;
    if (takenKeywords.has(primaryKeyword)) {
      const owner = takenKeywords.get(primaryKeyword);
      console.error(`✗ 主词「${primaryKeyword}」已归属 ${owner},${slug} 需要改词 —— 跳过`);
      takenSlugs.delete(slug);
      remap.delete(a.slug);
      dropped.push({ slug: a.slug, reason: `主关键词与 ${owner} 冲突` });
      continue;
    }
    takenKeywords.set(primaryKeyword, slug);

    const url = articlePillar ? `/${category}/${articlePillar}/${slug}/` : `/${category}/${slug}/`;

    normalized.push({
      clusterKey: cluster.clusterKey,
      originalSlug: a.slug,
      slug,
      file: `src/content/posts/${category}/${slug}.md`,
      url,
      category,
      pillar: articlePillar,
      pillarUrl: `/${pillar.category}/${pillarSlug}/`,
      title: a.title,
      description: a.description,
      primaryKeyword,
      secondaryKeywords: a.secondaryKeywords ?? [],
      intent: INTENTS.includes(a.intent) ? a.intent : 'informational',
      answer: a.answer,
      outline: a.outline ?? [],
      brands: (a.brands ?? []).filter((b) => BRAND_SLUGS.includes(b)),
      differentiator: a.differentiator,
      _plannedRelated: a.relatedSlugs ?? [],
      _plannedNext: a.nextStep,
    });
  }

  manifest.push(...normalized);
  cluster._remap = remap;
}

/* ---------- 3. 解析内链与下一步 ---------- */

const bySlug = new Map(manifest.map((m) => [m.slug, m]));
const urlSet = new Set([
  '/',
  '/reviews/',
  '/compare/',
  '/guides/',
  '/protocols/',
  '/troubleshooting/',
  '/free-nodes/',
  '/unlock/',
  '/risk/',
  '/basics/',
  '/rankings/',
  ...RANKING_SLUGS.map((s) => `/rankings/${s}/`),
  ...BRAND_SLUGS.map((s) => `/reviews/${s}/`),
  ...existingPillars.map((p) => `/${p.category}/${p.slug}/`),
  ...manifest.map((m) => m.url),
]);

// 已写好的文章 URL 也是合法目标
for (const p of existingPosts) {
  urlSet.add(
    p.pillar && p.pillar !== 'null'
      ? `/${p.category}/${p.pillar}/${p.slug}/`
      : `/${p.category}/${p.slug}/`
  );
}

/** 各栏目的兜底下一步,保证任何一篇都不会变成死胡同 */
const FALLBACK_NEXT = {
  guides: {
    label: '按需求筛选支持该客户端的机场',
    href: '/compare/',
    reason: '教程解决了怎么配,但还需要一个订阅源。对照表里的协议列可以确认兼容性。',
  },
  protocols: {
    label: '把协议知识用到实际选购上',
    href: '/compare/',
    reason: '搞懂线路与协议的差别之后,对照表里的那两列才真正读得懂。',
  },
  troubleshooting: {
    label: '排查完仍然不行?看看是不是线路本身的问题',
    href: '/risk/',
    reason: '客户端、系统代理、订阅都排查过还不行,问题可能出在服务方。',
  },
  'free-nodes': {
    label: '了解免费与付费的实际差别',
    href: '/basics/',
    reason: '看完风险之后,下一个问题通常是付费的到底好在哪。',
  },
  unlock: {
    label: '按解锁需求筛选机场',
    href: '/compare/',
    reason: '知道需要什么样的网络条件之后,就能把条件翻译成规格来筛选。',
  },
  risk: {
    label: '用这些标准重新审视候选机场',
    href: '/reviews/',
    reason: '知道有哪些坑之后,再看评测页会有不同的关注点。',
  },
  basics: {
    label: '把学到的标准用起来',
    href: '/compare/',
    reason: '概念清楚之后,拿一张真实规格表练手最有效。',
  },
  compare: {
    label: '看单家的完整评测',
    href: '/reviews/',
    reason: '对比页放不下每家的适合人群与口径注意事项,下单前值得逐页看完。',
  },
  reviews: {
    label: '把候选放在一张表里横向对照',
    href: '/compare/',
    reason: '单看每家的评测容易被各自的卖点带走,对照表更容易看出差异。',
  },
};

for (const cluster of clusters) {
  const remap = cluster._remap;
  if (!remap) continue;
  for (const m of manifest.filter((x) => x.clusterKey === cluster.clusterKey)) {
    /* relatedSlugs:原计划的簇内引用重映射到最终 slug,丢弃已被删除的 */
    const related = m._plannedRelated
      .map((r) => remap.get(r))
      .filter((r) => r && r !== m.slug && bySlug.has(r));

    /* 不足 2 条时,用同簇同栏目的其他文章补齐,保证不产生孤儿页 */
    if (related.length < 2) {
      const pool = manifest.filter(
        (x) =>
          x.clusterKey === m.clusterKey &&
          x.category === m.category &&
          x.slug !== m.slug &&
          !related.includes(x.slug)
      );
      for (const cand of pool) {
        related.push(cand.slug);
        if (related.length >= 3) break;
      }
    }
    m.relatedSlugs = related.slice(0, 4);

    /* nextStep:计划值若不可达就换成栏目兜底 */
    const planned = m._plannedNext;
    const remapped =
      planned?.href && remap.has(planned.href.split('/').filter(Boolean).pop())
        ? bySlug.get(remap.get(planned.href.split('/').filter(Boolean).pop()))?.url
        : planned?.href;

    m.nextStep =
      remapped && urlSet.has(remapped) && remapped !== m.url
        ? { label: planned.label, href: remapped, reason: planned.reason }
        : FALLBACK_NEXT[m.category];

    delete m._plannedRelated;
    delete m._plannedNext;
  }
}

/* ---------- 4. 校验 ---------- */

const errors = [];

for (const m of manifest) {
  if (!slugRe.test(m.slug)) errors.push(`${m.slug} slug 非法`);
  if (!CATEGORIES.includes(m.category)) errors.push(`${m.slug} category 非法`);
  if (m.pillar && pillarBySlug.get(m.pillar)?.category !== m.category)
    errors.push(`${m.slug} pillar 跨栏目(会产出无法访问的 URL)`);
  if (!urlSet.has(m.nextStep.href))
    errors.push(`${m.slug} nextStep 指向不存在的 ${m.nextStep.href}`);
  if (m.nextStep.href === m.url) errors.push(`${m.slug} nextStep 指向自身`);
  if (m.relatedSlugs.length < 2)
    errors.push(`${m.slug} relatedSlugs 不足 2 条(实际 ${m.relatedSlugs.length})`);
  for (const r of m.relatedSlugs) {
    if (!bySlug.has(r) && !existingPosts.some((p) => p.slug === r))
      errors.push(`${m.slug} relatedSlugs 指向不存在的 ${r}`);
  }
  if (['basics', 'protocols', 'risk', 'free-nodes'].includes(m.category) && m.brands.length)
    errors.push(`${m.slug} 属于知识型栏目,brands 必须为空(R11)`);
}

const slugCount = new Map();
for (const m of manifest) slugCount.set(m.slug, (slugCount.get(m.slug) ?? 0) + 1);
for (const [s, n] of slugCount) if (n > 1) errors.push(`slug ${s} 重复 ${n} 次`);

/* ---------- 5. 输出 ---------- */

const line = '─'.repeat(66);
console.log(line);
console.log(
  `清单构建:待写 ${manifest.length} 篇 · 已有 ${existingPosts.length} 篇 · ${existingPillars.length} 个专题`
);
console.log(line);

if (renames.length) {
  console.log(`\n↻ ${renames.length} 处 slug 唯一化:`);
  for (const r of renames) console.log(`   ${r.from} → ${r.to}`);
}
if (dropped.length) {
  console.log(`\n✂ ${dropped.length} 篇按审计意见移除:`);
  for (const d of dropped) console.log(`   ${d.slug} —— ${d.reason}`);
}

const byCat = new Map();
for (const m of manifest) byCat.set(m.category, (byCat.get(m.category) ?? 0) + 1);
console.log('\n栏目分布:');
for (const [c, n] of [...byCat].sort((a, b) => b[1] - a[1]))
  console.log(`   ${c.padEnd(18)} ${n} 篇`);

if (errors.length) {
  console.error(`\n✗ ${errors.length} 条结构错误:`);
  for (const e of errors) console.error(`   ${e}`);
  process.exit(1);
}

await writeFile(OUT_PATH, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`\n✓ 结构校验通过,清单已写入 ${OUT_PATH}`);
