/**
 * 生成社交分享封面图(Open Graph / Twitter Card)。
 *
 * 起因是一个发布级 bug:`site.ts` 里 ogImage 指向 `/og/default.png`,
 * 但那个文件从来没存在过。构建不会报错,`astro check` 不会报错,
 * 页面在浏览器里看也完全正常——只有把链接发到微信或 Telegram 才会发现没有预览图。
 * 一个内容站最主要的传播路径就是分享,这等于把入口关掉了一半。
 *
 * 用 SVG 画再交给 sharp 栅格化,而不是找一张图片放进去:
 * 版式跟着设计系统走(轨道线 + 菱形节点 + 切角面板),改品牌名时不需要重开设计工具。
 *
 * 用法:node scripts/gen-og-image.mjs
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const W = 1200;
const H = 630;

/* 取自 tokens.css 的浅色主题,保持与站点一致 */
const C = {
  bg: '#FBFCFD',
  surface: '#FFFFFF',
  border: '#DDE3E9',
  borderStrong: '#C3CCD5',
  text: '#12191F',
  muted: '#4A5865',
  faint: '#7A8896',
  accent: '#0E6FA3',
};

/** 切角面板路径:右上角削掉一块,和站上的 .notch 一致 */
const notchPanel = (x, y, w, h, notch) =>
  `M${x} ${y} H${x + w - notch} L${x + w} ${y + notch} V${y + h} H${x} Z`;

/** 菱形节点标记 */
const diamond = (cx, cy, r, fill, stroke) =>
  `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" rx="1"
     transform="rotate(45 ${cx} ${cy})" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>

  <!-- 背景发丝网格,弱到只在大图上可见 -->
  <g stroke="${C.border}" stroke-width="1" opacity="0.5">
    ${Array.from({ length: 11 }, (_, i) => `<line x1="0" y1="${i * 63}" x2="${W}" y2="${i * 63}"/>`).join('')}
  </g>

  <!-- 左侧轨道主干 + 节点 -->
  <line x1="96" y1="120" x2="96" y2="510" stroke="${C.borderStrong}" stroke-width="1.5"/>
  ${diamond(96, 168, 7, C.accent, C.accent)}
  ${diamond(96, 315, 5, C.surface, C.borderStrong)}
  ${diamond(96, 462, 5, C.surface, C.borderStrong)}

  <!-- 主面板 -->
  <path d="${notchPanel(148, 120, 956, 390, 26)}" fill="${C.surface}" stroke="${C.border}" stroke-width="1.5"/>

  <text x="188" y="182" font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
        font-size="19" letter-spacing="4.5" fill="${C.faint}">JICHANGTUIJIAN.MOM</text>

  <text x="188" y="268" font-family="'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif"
        font-size="66" font-weight="700" fill="${C.text}">机场实测室</text>

  <text x="188" y="336" font-family="'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif"
        font-size="30" fill="${C.muted}">2026 机场推荐 · 机场代理导航 · 16 家横向对比</text>

  <line x1="188" y1="384" x2="1064" y2="384" stroke="${C.border}" stroke-width="1"/>

  <text x="188" y="432" font-family="'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif"
        font-size="23" fill="${C.faint}">厂商声明与本站实测分开标注 · 评分公式公开可复算</text>

  <!-- 右下角强调刻度,与站上的 rail 呼应 -->
  <g stroke="${C.accent}" stroke-width="3" stroke-linecap="round">
    <line x1="188" y1="470" x2="236" y2="470"/>
  </g>
  <text x="252" y="477" font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
        font-size="17" letter-spacing="2" fill="${C.accent}">SIGNAL &amp; ROUTE</text>
</svg>`;

const outDir = path.resolve('public/og');
await mkdir(outDir, { recursive: true });
const out = path.join(outDir, 'default.png');

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);

const meta = await sharp(out).metadata();
console.log(`✓ 已生成 ${path.relative(process.cwd(), out)}  ${meta.width}×${meta.height}`);
