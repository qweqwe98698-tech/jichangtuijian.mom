/**
 * 清单一致性校验。
 *
 * 批量扩展时结构由 build-manifest.mjs 预先算定并冻结,写作智能体只应产出正文。
 * 这个脚本逐篇比对落盘文件与清单,任何结构字段被改动都会被抓出来——
 * 结构漂移不会让构建失败,但会静默产出错误 URL 与断裂内链,必须主动检测。
 *
 * 用法:node scripts/check-manifest.mjs <manifest.json>
 */
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

const MANIFEST_PATH = process.argv[2];
if (!MANIFEST_PATH) {
  console.error('用法: node scripts/check-manifest.mjs <manifest.json>');
  process.exit(1);
}

// PowerShell 的 Out-File -Encoding utf8 会写入 BOM,JSON.parse 不接受;用转义写法避免源码里出现不可见字符
const stripBom = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

const manifest = JSON.parse(stripBom(await readFile(MANIFEST_PATH, 'utf8')));

/** 只取需要比对的标量与字符串数组,不引 YAML 依赖 */
function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  const lines = m[1].split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([a-zA-Z]\w*):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const raw = kv[2].trim();

    if (raw === '') {
      const items = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        const item = lines[j].match(/^\s+-\s+(.+)$/);
        if (!item) break;
        items.push(item[1].trim().replace(/^["']|["']$/g, ''));
      }
      out[key] = items.length ? items : '';
      if (items.length) i = j - 1;
      continue;
    }

    if (raw.startsWith('[') && raw.endsWith(']')) {
      out[key] = raw
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
      continue;
    }

    out[key] = raw.replace(/^["']|["']$/g, '');
  }
  return out;
}

const cjk = (s) => (s.match(/[一-鿿]/g) ?? []).length;

const errors = [];
const warnings = [];
let present = 0;
let missing = 0;

for (const spec of manifest) {
  const file = path.resolve(spec.file);

  try {
    await access(file);
  } catch {
    missing++;
    continue;
  }
  present++;

  const src = await readFile(file, 'utf8');
  const fm = parseFrontmatter(src);
  if (!fm) {
    errors.push(`${spec.slug}  frontmatter 无法解析`);
    continue;
  }

  const tag = `${spec.slug}`;

  /* ---- 结构字段必须与清单完全一致 ---- */
  if (fm.category !== spec.category)
    errors.push(`${tag}  category 被改动:清单「${spec.category}」→ 实际「${fm.category}」`);

  const specPillar = spec.pillar ?? 'null';
  const filePillar = fm.pillar ?? 'null';
  if (filePillar !== specPillar)
    errors.push(`${tag}  pillar 被改动:清单「${specPillar}」→ 实际「${filePillar}」`);

  if (fm.primaryKeyword !== spec.primaryKeyword)
    errors.push(
      `${tag}  primaryKeyword 被改动:清单「${spec.primaryKeyword}」→ 实际「${fm.primaryKeyword}」`
    );

  if (fm.intent !== spec.intent)
    warnings.push(`${tag}  intent 被改动:清单「${spec.intent}」→ 实际「${fm.intent}」`);

  const nextHref = src.match(/nextStep:\s*\n(?:.*\n)*?\s+href:\s*["']?([^"'\n]+)/)?.[1]?.trim();
  if (nextHref !== spec.nextStep.href)
    errors.push(`${tag}  nextStep.href 被改动:清单「${spec.nextStep.href}」→ 实际「${nextHref}」`);

  const related = Array.isArray(fm.relatedSlugs) ? fm.relatedSlugs : [];
  const expected = spec.relatedSlugs;
  if (related.length !== expected.length || related.some((r, i) => r !== expected[i]))
    errors.push(`${tag}  relatedSlugs 被改动:清单 [${expected}] → 实际 [${related}]`);

  const brands = Array.isArray(fm.brands) ? fm.brands : [];
  if (brands.length !== spec.brands.length)
    errors.push(`${tag}  brands 被改动:清单 [${spec.brands}] → 实际 [${brands}]`);

  /* ---- Zod 长度约束提前拦截 ---- */
  if (fm.title && (fm.title.length < 6 || fm.title.length > 60))
    errors.push(`${tag}  title 长度 ${fm.title.length},超出 Zod 的 6-60 限制`);
  if (fm.description && (fm.description.length < 40 || fm.description.length > 160))
    errors.push(`${tag}  description 长度 ${fm.description.length},超出 Zod 的 40-160 限制`);
  if (fm.answer && (fm.answer.length < 30 || fm.answer.length > 300))
    errors.push(`${tag}  answer 长度 ${fm.answer.length},超出 Zod 的 30-300 限制`);

  /* ---- 正文质量下限 ---- */
  const body = src.replace(/^---[\s\S]*?---/, '');
  const words = cjk(body);
  if (words < 1400) errors.push(`${tag}  正文仅 ${words} 中文字,低于 1800 目标值过多`);
  else if (words < 1800) warnings.push(`${tag}  正文 ${words} 中文字,略低于 1800 目标值`);
  else if (words > 3600) warnings.push(`${tag}  正文 ${words} 中文字,超出 3200 目标值`);

  /* ---- outline 覆盖度 ---- */
  const h2s = [...body.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
  if (h2s.length < Math.max(3, spec.outline.length - 3))
    warnings.push(
      `${tag}  只有 ${h2s.length} 个 H2,清单 outline 有 ${spec.outline.length} 条,可能覆盖不全`
    );

  /* ---- 表格与内链 ---- */
  if (!/^\|.+\|$/m.test(body)) warnings.push(`${tag}  正文没有任何 Markdown 表格`);
  if (!/\]\(\/[^)]*\)/.test(body)) errors.push(`${tag}  正文没有任何站内内链(会成为死胡同)`);

  /* ---- 红线 ---- */
  if (['free-nodes', 'risk'].includes(spec.category)) {
    const hit = body.match(/\b(ss|ssr|vmess|vless|trojan|hysteria2?|clash|sub):\/\//i);
    if (hit) errors.push(`${tag}  ${spec.category} 栏目出现节点协议前缀「${hit[0]}」(R09)`);
  }
  // 只拦「声称自营」,不拦「没有自营 / 非自营」——后者正是应该有的合作关系披露
  const selfOperated = [...body.matchAll(/(.{0,6})自营/g)].filter(
    ([, before]) => !/(没有|不是|非|无|并非|而非|均无|全部为推广|不存在)\s*$/.test(before)
  );
  if (selfOperated.length)
    errors.push(`${tag}  正文声称「自营」(上文:…${selfOperated[0][1]}自营),16 家均为推广合作`);
  if (/(已实测|本站实测).{0,12}(全部解锁|均可用|都能用)/.test(body))
    errors.push(`${tag}  正文把厂商声明写成了本站实测结论`);
}

const line = '─'.repeat(66);
console.log(line);
console.log(`清单一致性:清单 ${manifest.length} 篇 · 已落盘 ${present} 篇 · 未写 ${missing} 篇`);
console.log(line);

if (warnings.length) {
  console.log(`\n⚠  ${warnings.length} 条警告:`);
  for (const w of warnings.slice(0, 50)) console.log(`   ${w}`);
  if (warnings.length > 50) console.log(`   …还有 ${warnings.length - 50} 条`);
}

if (errors.length) {
  console.error(`\n✗  ${errors.length} 条错误:`);
  for (const e of errors.slice(0, 60)) console.error(`   ${e}`);
  if (errors.length > 60) console.error(`   …还有 ${errors.length - 60} 条`);
  process.exit(1);
}

console.log(`\n✓  已落盘的 ${present} 篇全部与冻结清单一致(${warnings.length} 条警告)`);
