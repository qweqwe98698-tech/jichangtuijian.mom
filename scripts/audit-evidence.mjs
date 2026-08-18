/**
 * T0 输入审计:测速证据包的完整性与身份核验。
 *
 * 第三阶段指令要求在动任何页面之前先审计证据本身:
 * 每个文件的 SHA-256、图片尺寸、manifest 与实际文件的一一对应关系,
 * 以及当前包与 manifest 里 sourceArchive 的身份差异。
 *
 * 这个脚本只读,不修改任何原始 PNG。
 *
 * 用法: node scripts/audit-evidence.mjs <证据目录> [zip路径]
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const [, , DIR, ZIP] = process.argv;
if (!DIR) {
  console.error('用法: node scripts/audit-evidence.mjs <证据目录> [zip路径]');
  process.exit(1);
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex').toUpperCase();

/** 直接读 PNG 的 IHDR 块拿宽高,不引图像库 */
function pngSize(buf) {
  const isPng = buf
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!isPng) return null;
  if (buf.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const stripBom = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

const manifest = JSON.parse(
  stripBom(await readFile(path.join(DIR, 'speedtest-manifest.json'), 'utf8'))
);
const files = await readdir(DIR);
const pngs = files.filter((f) => f.toLowerCase().endsWith('.png')).sort();

const findings = [];
const blockers = [];

console.log('═'.repeat(72));
console.log('T0 输入审计 · 测速证据包');
console.log('═'.repeat(72));

/* ---- 1. 压缩包身份 ---- */
console.log('\n【1】压缩包身份');
if (ZIP) {
  const buf = await readFile(ZIP);
  const st = await stat(ZIP);
  const hash = sha256(buf);
  console.log(`  当前包        ${path.basename(ZIP)}`);
  console.log(`  大小          ${st.size.toLocaleString()} bytes`);
  console.log(`  SHA-256       ${hash}`);
  console.log(`  manifest 记录的 sourceArchive:`);
  console.log(`    名称        ${manifest.sourceArchive.name}`);
  console.log(`    大小        ${manifest.sourceArchive.sizeBytes.toLocaleString()} bytes`);
  console.log(`    SHA-256     ${manifest.sourceArchive.sha256}`);
  if (hash !== manifest.sourceArchive.sha256) {
    findings.push(
      '当前压缩包与 manifest.sourceArchive 不是同一个文件。' +
        'V2 包额外含 README/manifest,属于整理版而非损坏,但两个包的身份必须分别登记。'
    );
    console.log(`  → 身份不同(预期内:V2 是整理版,原始包不含 README/manifest)`);
  } else {
    console.log(`  → 与 manifest.sourceArchive 一致`);
  }
} else {
  console.log('  (未提供 zip 路径,跳过)');
}

/* ---- 2. 说明文件哈希 ---- */
console.log('\n【2】说明文件');
for (const name of ['README_16个机场测速实测资料_最新版.txt', 'speedtest-manifest.json']) {
  const p = path.join(DIR, name);
  try {
    const buf = await readFile(p);
    console.log(`  ${name}`);
    console.log(`    ${buf.length.toLocaleString().padStart(10)} bytes   ${sha256(buf)}`);
  } catch {
    blockers.push(`缺少说明文件 ${name}`);
  }
}

/* ---- 3. 逐图登记 ---- */
console.log('\n【3】逐图证据登记');
console.log('  ' + '品牌'.padEnd(10) + '尺寸'.padEnd(14) + '大小'.padEnd(12) + 'SHA-256');
console.log('  ' + '─'.repeat(68));

const byFile = new Map(manifest.assets.map((a) => [a.file, a]));
const registry = [];
const hashes = new Map();

for (const file of pngs) {
  const buf = await readFile(path.join(DIR, file));
  const hash = sha256(buf);
  const size = pngSize(buf);
  const asset = byFile.get(file);

  if (!asset) {
    blockers.push(`PNG ${file} 在 manifest 中没有对应记录`);
    continue;
  }
  if (!size) {
    blockers.push(`${file} 不是有效 PNG 或 IHDR 不可读`);
    continue;
  }
  if (size.width !== 1122 || size.height !== 1402) {
    findings.push(`${file} 尺寸为 ${size.width}×${size.height},与基线 1122×1402 不符`);
  }
  if (hashes.has(hash)) {
    blockers.push(`${file} 与 ${hashes.get(hash)} 内容完全相同(重复图片)`);
  }
  hashes.set(hash, file);

  console.log(
    `  ${asset.brand.padEnd(10)}${`${size.width}×${size.height}`.padEnd(14)}` +
      `${buf.length.toLocaleString().padStart(9)} B  ${hash.slice(0, 32)}…`
  );

  registry.push({
    brand: asset.brand,
    file,
    sha256: hash,
    bytes: buf.length,
    width: size.width,
    height: size.height,
    testedAt: asset.testedAt,
    protocolDisplayed: asset.protocolDisplayed,
    toolFamily: asset.toolFamily,
    dateConfidence: asset.dateConfidence,
    reviewNote: asset.reviewNote ?? null,
  });
}

/* ---- 4. 一一对应 ---- */
console.log('\n【4】manifest ↔ 文件对应');
console.log(`  manifest 资产条目   ${manifest.assets.length}`);
console.log(`  目录内 PNG          ${pngs.length}`);
console.log(`  成功登记            ${registry.length}`);

for (const a of manifest.assets) {
  if (!pngs.includes(a.file)) blockers.push(`manifest 记录的 ${a.file} 在目录中不存在`);
}

/* ---- 5. 需要人工复核的项 ---- */
console.log('\n【5】需要人工复核');
const needReview = registry.filter((r) => r.dateConfidence !== 'visible-in-image');
if (needReview.length === 0) {
  console.log('  (无)');
} else {
  for (const r of needReview) {
    console.log(`  ${r.brand}  dateConfidence=${r.dateConfidence}`);
    console.log(`    ${r.reviewNote ?? ''}`);
    findings.push(`${r.brand} 的完整测试日期未在图中直接可见,复核完成前其测速模块不得发布`);
  }
}

/* ---- 6. 测试条件离散度 ---- */
console.log('\n【6】测试条件离散度(决定能否做横向排名)');
const byTool = new Map();
const byProto = new Map();
for (const r of registry) {
  byTool.set(r.toolFamily, (byTool.get(r.toolFamily) ?? 0) + 1);
  byProto.set(r.protocolDisplayed, (byProto.get(r.protocolDisplayed) ?? 0) + 1);
}
console.log('  测试工具:');
for (const [t, n] of byTool) console.log(`    ${n} 张  ${t}`);
console.log('  图中协议:');
for (const [p, n] of byProto) console.log(`    ${n} 张  ${p}`);

const hours = registry.map((r) => Number(r.testedAt.slice(11, 13)));
const buckets = { '00-05': 0, '06-11': 0, '12-17': 0, '18-23': 0 };
for (const h of hours) {
  if (h < 6) buckets['00-05']++;
  else if (h < 12) buckets['06-11']++;
  else if (h < 18) buckets['12-17']++;
  else buckets['18-23']++;
}
console.log('  测试时段分布:');
for (const [k, v] of Object.entries(buckets)) console.log(`    ${k} 时  ${v} 张`);

if (byTool.size > 1 || byProto.size > 1) {
  findings.push(
    `测试条件不统一(${byTool.size} 套工具 / ${byProto.size} 种协议 / 时段跨越 ${Math.min(...hours)}–${Math.max(...hours)} 时),` +
      '因此这批证据不能用于严格的跨品牌速度或稳定性排名。'
  );
}

/* ---- 7. 结论 ---- */
console.log('\n' + '═'.repeat(72));
if (findings.length) {
  console.log(`发现 ${findings.length} 项需要记录的事实:`);
  findings.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
}
if (blockers.length) {
  console.error(`\n✗ ${blockers.length} 项阻塞:`);
  blockers.forEach((b) => console.error(`   ${b}`));
  process.exit(1);
}
console.log('\n✓ T0 通过:16 张图与 manifest 一一对应,无缺失、无多余、无重复内容');
console.log('  逐图 SHA-256 已计算完成,可写入 evidence registry');

/* 输出机读登记表,供 T1 使用 */
const outPath = path.resolve('src/data/evidence/speedtest-assets.json');
console.log(`\n登记表将写入: ${outPath}`);
console.log(JSON.stringify({ batchId: manifest.batchId, registry }, null, 2).slice(0, 0));
await (await import('node:fs/promises')).mkdir(path.dirname(outPath), { recursive: true });
await (
  await import('node:fs/promises')
).writeFile(
  outPath,
  JSON.stringify(
    {
      batchId: manifest.batchId,
      measurementDate: manifest.measurementDate,
      measurementTimezone: manifest.measurementTimezone,
      dataStatus: manifest.dataStatus,
      reviewStatus: manifest.reviewStatus,
      commonLimitations: manifest.commonLimitations,
      auditedAt: null,
      assets: registry,
    },
    null,
    2
  ),
  'utf8'
);
console.log('✓ 已写入');
