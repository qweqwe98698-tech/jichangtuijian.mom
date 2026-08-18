import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * frontmatter 排版不变量。
 *
 * 起因是一次真实故障:prettier 把过长的单行 flow 序列(`relatedSlugs: ['a','b','c']`)
 * 折成多行 flow,而按行扫描 frontmatter 的门禁脚本读到 0 条,
 * 于是 32 篇文章被判成「内链少于 2 条」——内容其实一个字没动。
 *
 * 块状序列 prettier 不会重排,是唯一稳定的写法。用测试钉住它,
 * 比在每个脚本里各写一套 flow 解析分支便宜,也不会漏掉下一个新脚本。
 */

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.md') ? [full] : [];
  });

const FILES = walk(path.resolve('src/content'));

const frontmatterOf = (file: string): string | null => {
  const m = readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
};

describe('frontmatter 排版', () => {
  it('内容目录下有可观数量的 markdown 供检查', () => {
    expect(FILES.length).toBeGreaterThan(100);
  });

  it('所有 frontmatter 都能取到', () => {
    const missing = FILES.filter((f) => frontmatterOf(f) === null);
    expect(missing.map((f) => path.basename(f))).toEqual([]);
  });

  it('列表一律用块状序列,不用 flow 序列', () => {
    const bad: string[] = [];
    for (const f of FILES) {
      const fm = frontmatterOf(f);
      if (!fm) continue;
      // 单行 flow:key: [a, b]      多行 flow:key: 换行后跟 [
      // 空数组 `key: []` 是唯一允许的 flow 写法,prettier 不会动它
      const single = /^\s*[A-Za-z_][\w-]*:\s*\[\s*\S[\s\S]*?\]\s*$/m.test(fm);
      const multi = /^\s*[A-Za-z_][\w-]*:\s*\r?\n\s*\[/m.test(fm);
      if (single || multi) bad.push(path.relative(path.resolve('src/content'), f));
    }
    expect(
      bad,
      `这些文件的 frontmatter 含 flow 序列,请跑 node scripts/normalize-frontmatter.mjs`
    ).toEqual([]);
  });

  it('每篇 relatedSlugs 都能被按行扫描的脚本正确读出条数', () => {
    // 直接复刻门禁脚本的读法,确保它和真实排版一致
    const countBlock = (fm: string, key: string): number => {
      const lines = fm.split(/\r?\n/);
      const i = lines.findIndex((l) => new RegExp(`^${key}:\\s*$`).test(l));
      if (i === -1) return 0;
      let n = 0;
      for (let j = i + 1; j < lines.length && /^\s+-\s/.test(lines[j]); j++) n++;
      return n;
    };
    const under: string[] = [];
    for (const f of FILES) {
      if (!f.includes(`${path.sep}posts${path.sep}`)) continue;
      const fm = frontmatterOf(f);
      if (!fm || !/^relatedSlugs:/m.test(fm)) continue;
      if (countBlock(fm, 'relatedSlugs') < 2)
        under.push(path.relative(path.resolve('src/content'), f));
    }
    expect(under, 'R01 要求每篇至少 2 条相关文章').toEqual([]);
  });
});
