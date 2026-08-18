/**
 * 主题覆盖度审计:三大核心主题 vs 现有内容。
 *
 * 目的不是"看起来覆盖了多少",而是回答一个具体问题:
 * 用户搜「机场导航」「机场大全」「2026 最新机场导航」这类词,
 * 本站有没有一个页面在正面承接它?还是只在别的文章里顺带提过?
 *
 * 判定标准分三档:
 *   owned    有页面把它作为 primaryKeyword —— 真正在承接
 *   partial  只出现在某页的 secondaryKeywords —— 蹭到了,但没有专属落点
 *   missing  全站没有任何页面认领 —— 缺口
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/* ---------- 目标关键词宇宙:按三大核心主题分组 ---------- */

const UNIVERSE = {
  '机场推荐(核心)': [
    '机场推荐',
    '2026机场推荐',
    '机场推荐网站',
    '稳定机场推荐',
    '2026稳定机场推荐',
    '高性价比机场',
    '便宜机场推荐',
    '机场排行榜',
    '代理机场推荐',
    '网络代理推荐',
    '2026年值得关注的稳定机场',
    '机场推荐2026',
  ],
  '机场导航(核心)': [
    '机场导航',
    '机场导航网站',
    '机场大全',
    '机场官网',
    '机场官网大全',
    '2026最新机场导航',
    '机场收录',
    '机场索引',
    '机场汇总',
  ],
  '机场代理(核心)': [
    '机场代理',
    '代理机场',
    '科学上网机场',
    '翻墙机场',
    'VPN机场',
    '机场是什么',
    '机场节点',
    '机场订阅',
    '机场怎么用',
  ],
  机场评测: [
    '机场评测',
    '机场测评网站',
    '2026年稳定机场评测',
    '机场实测',
    '机场测速',
    '机场对比',
    '机场哪个好',
  ],
  选择与决策: [
    '机场怎么选',
    '新手怎么选机场',
    '机场值得买吗',
    '机场多少钱一个月',
    'IEPL机场推荐',
    'IPLC机场推荐',
    '不限时机场推荐',
  ],
  场景需求: [
    'ChatGPT机场推荐',
    'AI工具机场推荐',
    '流媒体机场推荐',
    'Netflix机场推荐',
    '游戏机场推荐',
    '大流量机场推荐',
    '新手机场推荐',
    '老牌机场推荐',
  ],
  风险与避坑: ['机场跑路', '机场避坑指南', '机场安全吗', '机场靠谱吗', '免费节点'],
};

/* ---------- 收集现有关键词归属 ---------- */

const primaryOwner = new Map(); // keyword -> 文件
const secondaryOwner = new Map(); // keyword -> [文件]

function walk(dir, fn) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, fn);
    else if (name.endsWith('.md')) fn(full);
  }
}

walk(path.resolve('src/content'), (file) => {
  const src = readFileSync(file, 'utf8');
  const base = path.basename(file, '.md');
  const p = src.match(/^primaryKeyword:\s*"?([^"\r\n]+?)"?\s*$/m);
  if (p) primaryOwner.set(p[1].trim(), base);

  const block = src.match(/^secondaryKeywords:\s*\n((?:\s+-\s+.+\n)+)/m);
  if (block) {
    for (const line of block[1].split('\n')) {
      const m = line.match(/^\s+-\s+"?(.+?)"?\s*$/);
      if (m) {
        const k = m[1].trim();
        secondaryOwner.set(k, [...(secondaryOwner.get(k) ?? []), base]);
      }
    }
  }
  const inline = src.match(/^secondaryKeywords:\s*\[(.+)\]\s*$/m);
  if (inline) {
    for (const raw of inline[1].split(',')) {
      const k = raw.trim().replace(/^["']|["']$/g, '');
      if (k) secondaryOwner.set(k, [...(secondaryOwner.get(k) ?? []), base]);
    }
  }
});

/* 数据驱动页面承接的词。从 page-keywords.ts 读取,不再手工维护第二份清单 */
const pkSrc = readFileSync(path.resolve('src/data/page-keywords.ts'), 'utf8');
const DATA_DRIVEN = new Map();
for (const block of pkSrc.split(/\{\s*\n\s*path:/).slice(1)) {
  const p = block.match(/^\s*'([^']+)'/)?.[1];
  const primary = block.match(/primary:\s*'([^']+)'/)?.[1];
  const secondary = block.match(/secondary:\s*\[([^\]]*)\]/s)?.[1] ?? '';
  if (!p) continue;
  if (primary) DATA_DRIVEN.set(primary, p);
  for (const m of secondary.matchAll(/'([^']+)'/g)) DATA_DRIVEN.set(m[1], p);
}

/* ---------- 判定 ---------- */

const norm = (s) => s.replace(/\s+/g, '').toLowerCase();
const primaryNorm = new Map([...primaryOwner].map(([k, v]) => [norm(k), v]));
const secondaryNorm = new Map([...secondaryOwner].map(([k, v]) => [norm(k), v]));
const dataNorm = new Map([...DATA_DRIVEN].map(([k, v]) => [norm(k), v]));

const rows = [];
let owned = 0;
let partial = 0;
let missing = 0;

for (const [group, keywords] of Object.entries(UNIVERSE)) {
  for (const kw of keywords) {
    const n = norm(kw);
    let status;
    let where;
    if (dataNorm.has(n)) {
      status = 'owned';
      where = dataNorm.get(n);
      owned++;
    } else if (primaryNorm.has(n)) {
      status = 'owned';
      where = primaryNorm.get(n);
      owned++;
    } else if (secondaryNorm.has(n)) {
      status = 'partial';
      where = secondaryNorm.get(n).slice(0, 2).join(', ');
      partial++;
    } else {
      status = 'missing';
      where = '—';
      missing++;
    }
    rows.push({ group, kw, status, where });
  }
}

/* ---------- 输出 ---------- */

const line = '─'.repeat(76);
console.log(line);
console.log('三大核心主题覆盖度审计');
console.log(line);

for (const [group] of Object.entries(UNIVERSE)) {
  const g = rows.filter((r) => r.group === group);
  const o = g.filter((r) => r.status === 'owned').length;
  const p = g.filter((r) => r.status === 'partial').length;
  const m = g.filter((r) => r.status === 'missing').length;
  const bar = '█'.repeat(o) + '▒'.repeat(p) + '░'.repeat(m);
  console.log(`\n${group}  ${bar}  专属 ${o} / 蹭到 ${p} / 缺 ${m}`);
  for (const r of g) {
    const mark = r.status === 'owned' ? '✓' : r.status === 'partial' ? '~' : '✗';
    console.log(`  ${mark} ${r.kw.padEnd(24)} ${r.where}`);
  }
}

console.log('\n' + line);
console.log(`合计:专属承接 ${owned} · 仅作次词 ${partial} · 完全缺失 ${missing}`);
console.log(line);

const gaps = rows.filter((r) => r.status !== 'owned');
if (gaps.length) {
  console.log('\n需要补的落点:');
  for (const [group] of Object.entries(UNIVERSE)) {
    const g = gaps.filter((r) => r.group === group);
    if (g.length) console.log(`  ${group}: ${g.map((r) => r.kw).join('、')}`);
  }
}

/* ---------- 现有内容的主题分布 ---------- */

console.log('\n' + line);
console.log('现有内容的栏目分布(看重心是否偏离三大主题)');
console.log(line);
const byCat = new Map();
walk(path.resolve('src/content/posts'), (file) => {
  const src = readFileSync(file, 'utf8');
  const c = src.match(/^category:\s*"?([^"\r\n]+?)"?\s*$/m)?.[1]?.trim();
  if (c) byCat.set(c, (byCat.get(c) ?? 0) + 1);
});
const total = [...byCat.values()].reduce((a, b) => a + b, 0);
for (const [c, n] of [...byCat].sort((a, b) => b[1] - a[1])) {
  const pct = Math.round((n / total) * 100);
  console.log(
    `  ${c.padEnd(18)} ${String(n).padStart(3)} 篇  ${'█'.repeat(Math.round(pct / 2))} ${pct}%`
  );
}
console.log(`  ${'合计'.padEnd(17)} ${String(total).padStart(3)} 篇`);
