/**
 * 把 frontmatter 里的 flow 序列(`key: [a, b]`)统一成块状序列。
 *
 * 两种写法都是合法 YAML,Astro 都能读。统一的理由是稳定性:
 * prettier 会把过长的单行 flow 折成多行 flow,于是同一个字段在 143 个文件里
 * 出现了三种排版。任何按行扫描 frontmatter 的脚本都要为此写三套分支,
 * 而块状序列 prettier 不会重排,写一次就不会再变。
 *
 * 只动 frontmatter,不碰正文。用法:node scripts/normalize-frontmatter.mjs [--dry]
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const ROOT = path.resolve('src/content');

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.name.endsWith('.md')) out.push(full);
  }
  return out;
}

/** 拆 flow 序列的元素:按逗号切,但不能切断引号里的逗号 */
function splitItems(inner) {
  const items = [];
  let cur = '';
  let quote = null;
  for (const ch of inner) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      cur += ch;
      quote = ch;
    } else if (ch === ',') {
      items.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) items.push(cur.trim());
  return items.filter(Boolean);
}

function normalize(fm) {
  const lines = fm.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 情况一:key: [a, b, c] 全在一行
    const single = line.match(/^(\s*)([A-Za-z_][\w-]*):\s*\[(.*)\]\s*$/);
    if (single) {
      const [, indent, key, inner] = single;
      const items = splitItems(inner);
      if (items.length === 0) out.push(`${indent}${key}: []`);
      else {
        out.push(`${indent}${key}:`);
        for (const it of items) out.push(`${indent}  - ${it}`);
      }
      continue;
    }
    // 情况二:key: 换行后跟 [ ... ] 跨多行
    const opener = line.match(/^(\s*)([A-Za-z_][\w-]*):\s*$/);
    if (opener && /^\s*\[/.test(lines[i + 1] ?? '')) {
      const [, indent, key] = opener;
      let buf = '';
      let j = i + 1;
      let depth = 0;
      for (; j < lines.length; j++) {
        buf += lines[j];
        depth += (lines[j].match(/\[/g) ?? []).length - (lines[j].match(/\]/g) ?? []).length;
        if (depth === 0) break;
      }
      const inner = buf.trim().replace(/^\[/, '').replace(/\]$/, '');
      const items = splitItems(inner);
      if (items.length === 0) out.push(`${indent}${key}: []`);
      else {
        out.push(`${indent}${key}:`);
        for (const it of items) out.push(`${indent}  - ${it}`);
      }
      i = j;
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

const files = await walk(ROOT);
let changed = 0;
for (const f of files) {
  const src = await readFile(f, 'utf8');
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) continue;
  const fixed = normalize(m[1]);
  if (fixed === m[1]) continue;
  changed++;
  if (!DRY) {
    await writeFile(f, src.replace(m[1], fixed), 'utf8');
  }
  console.log(`  ${changed.toString().padStart(3)} ${path.relative(ROOT, f)}`);
}
console.log('');
console.log(
  changed
    ? `${DRY ? '将改写' : '已改写'} ${changed} / ${files.length} 个文件的 frontmatter 为块状序列`
    : `${files.length} 个文件的 frontmatter 已全部是块状序列`
);
