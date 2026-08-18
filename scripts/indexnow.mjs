/**
 * IndexNow 增量提交。
 *
 * IndexNow 的价值在于"改了就通知",而不是"每次构建把全站再喊一遍"——
 * 后者不会让收录更快,只会让站长平台里堆满重复提交记录,
 * 而且掩盖掉真正的新增页面。所以这里只提交**相对上次提交的差异**。
 *
 * 差异来自 sitemap 快照 `.indexnow-state.json`:
 *   新增 = 这次有、上次没有
 *   更新 = 两次都有,但 lastmod 变了
 *   删除 = 上次有、这次没有(IndexNow 也接受,让引擎尽早回收)
 *
 * 密钥走环境变量,不进版本库。密钥文件必须能在域名根目录取到,
 * 否则 IndexNow 会拒绝提交——这一步由 `--write-key` 生成到 public/。
 *
 * 用法:
 *   node scripts/indexnow.mjs --write-key   生成 public/<key>.txt(部署前做一次)
 *   node scripts/indexnow.mjs --dry         只算差异,不提交
 *   node scripts/indexnow.mjs               算差异并提交
 */
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { SITE_URL } from '../src/config/site.ts';

const DIST = path.resolve('dist');
const STATE = path.resolve('.indexnow-state.json');
const KEY = process.env.INDEXNOW_KEY ?? '';
const DRY = process.argv.includes('--dry');
const WRITE_KEY = process.argv.includes('--write-key');

/** 单次提交的 URL 上限。IndexNow 官方限制 10000,这里留足余量并分批 */
const BATCH = 1000;

const host = new URL(SITE_URL).host;

if (WRITE_KEY) {
  if (!KEY) {
    console.error('\n✗ 未设置 INDEXNOW_KEY。先生成一个 8–128 位的十六进制字符串,写进 .env:\n');
    console.error(
      '   INDEXNOW_KEY=' + 'a'.repeat(32).replace(/a/g, () => '0123456789abcdef'[0]) + '…\n'
    );
    process.exit(1);
  }
  const file = path.resolve('public', `${KEY}.txt`);
  await writeFile(file, KEY, 'utf8');
  console.log(`✓ 已生成密钥文件 public/${KEY}.txt`);
  console.log(`  部署后必须能访问到 ${SITE_URL}/${KEY}.txt,否则提交会被拒绝。\n`);
  process.exit(0);
}

/* ── 读取当前 sitemap ─────────────────────────────────────── */
async function currentEntries() {
  const idx = await readFile(path.join(DIST, 'sitemap-index.xml'), 'utf8');
  const files = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].split('/').pop());
  const map = new Map();
  for (const f of files) {
    const xml = await readFile(path.join(DIST, f), 'utf8');
    for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
      const loc = (m[1].match(/<loc>([^<]+)<\/loc>/) || [])[1];
      const mod = (m[1].match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1] ?? '';
      if (loc) map.set(loc, mod);
    }
  }
  return map;
}

let current;
try {
  current = await currentEntries();
} catch {
  console.error('\n✗ 读不到 dist/sitemap-index.xml。先跑 pnpm build。\n');
  process.exit(1);
}

let previous = new Map();
try {
  await stat(STATE);
  previous = new Map(Object.entries(JSON.parse(await readFile(STATE, 'utf8')).entries ?? {}));
} catch {
  /* 首次运行 */
}

const added = [...current.keys()].filter((u) => !previous.has(u));
const updated = [...current.keys()].filter(
  (u) => previous.has(u) && previous.get(u) !== current.get(u)
);
const removed = [...previous.keys()].filter((u) => !current.has(u));
const firstRun = previous.size === 0;

console.log('');
console.log('─'.repeat(66));
console.log('  IndexNow 增量提交');
console.log('─'.repeat(66));
if (firstRun) {
  console.log(`  首次运行:sitemap 共 ${current.size} 条,将全量提交一次并建立基线`);
} else {
  console.log(`  新增 ${added.length} · 更新 ${updated.length} · 删除 ${removed.length}`);
}

const urls = firstRun ? [...current.keys()] : [...new Set([...added, ...updated, ...removed])];

if (!urls.length) {
  console.log('  没有变化,不提交。\n');
  process.exit(0);
}

for (const u of urls.slice(0, 12)) {
  const tag = added.includes(u)
    ? '新增'
    : updated.includes(u)
      ? '更新'
      : removed.includes(u)
        ? '删除'
        : '全量';
  console.log(`    ${tag}  ${u.replace(SITE_URL, '')}`);
}
if (urls.length > 12) console.log(`    … 其余 ${urls.length - 12} 条`);
console.log('');

if (DRY) {
  console.log('  --dry:仅计算差异,未提交,基线未更新。\n');
  process.exit(0);
}

if (!KEY) {
  console.error('✗ 未设置 INDEXNOW_KEY,无法提交。见 .env.example。\n');
  process.exit(1);
}

/* ── 提交 ─────────────────────────────────────────────────── */
let ok = true;
for (let i = 0; i < urls.length; i += BATCH) {
  const batch = urls.slice(i, i + BATCH);
  const res = await fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host,
      key: KEY,
      keyLocation: `${SITE_URL}/${KEY}.txt`,
      urlList: batch,
    }),
  });
  // 200 已接收,202 已接受待验证;其余都算失败
  const good = res.status === 200 || res.status === 202;
  console.log(
    `  第 ${Math.floor(i / BATCH) + 1} 批 ${batch.length} 条 → HTTP ${res.status} ${good ? '✓' : '✗'}`
  );
  if (!good) {
    ok = false;
    console.log(`    ${(await res.text()).slice(0, 200)}`);
  }
}

if (!ok) {
  console.error('\n✗ 有批次提交失败,基线不更新,下次会重试同样的 URL。\n');
  process.exit(1);
}

await writeFile(
  STATE,
  JSON.stringify(
    { submittedAt: new Date().toISOString(), entries: Object.fromEntries(current) },
    null,
    2
  ) + '\n',
  'utf8'
);
console.log(`\n✓ 已提交 ${urls.length} 条,基线已更新。\n`);
