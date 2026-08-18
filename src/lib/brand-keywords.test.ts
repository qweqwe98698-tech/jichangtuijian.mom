import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { BRANDS } from '../data/brands';
import { BRAND_KEYWORDS, allBrandKeywords, brandUrl, keywordsFor } from '../data/brand-keywords';

/**
 * T3 门禁的机器实现:无关键词互抢、无重复 URL、每家都有独立配置。
 *
 * 这些断言比文档更可靠——文档写完就静止了,测试会在每次改动时重新执行。
 */

/** 收集内容集合里已归属的主词与次词 */
function collectContentKeywords(): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.md')) {
        const src = readFileSync(full, 'utf8');
        const p = src.match(/^primaryKeyword:\s*"?([^"\r\n]+?)"?\s*$/m);
        if (p) out.add(p[1].trim());
        const block = src.match(/^secondaryKeywords:\s*\n((?:\s+-\s+.+\n)+)/m);
        if (block) {
          for (const line of block[1].split('\n')) {
            const m = line.match(/^\s+-\s+"?(.+?)"?\s*$/);
            if (m) out.add(m[1].trim());
          }
        }
        const inline = src.match(/^secondaryKeywords:\s*\[(.+)\]\s*$/m);
        if (inline) {
          for (const raw of inline[1].split(',')) out.add(raw.trim().replace(/^["']|["']$/g, ''));
        }
      }
    }
  };
  walk(path.resolve('src/content'));
  return out;
}

describe('T3 品牌关键词映射', () => {
  it('16 家品牌全部有关键词配置', () => {
    expect(BRAND_KEYWORDS).toHaveLength(16);
    for (const b of BRANDS) {
      expect(keywordsFor(b.slug), `${b.name} 缺少配置`).toBeDefined();
    }
  });

  it('主词全站唯一,不互抢', () => {
    const primaries = BRAND_KEYWORDS.map((k) => k.primary);
    expect(new Set(primaries).size).toBe(primaries.length);
  });

  it('主词与次词合起来也不重复', () => {
    const all = allBrandKeywords();
    const dupes = all.filter((k, i) => all.indexOf(k) !== i);
    expect(dupes, `重复关键词: ${[...new Set(dupes)].join(', ')}`).toHaveLength(0);
  });

  it('品牌关键词不与已有文章的关键词冲突', () => {
    const content = collectContentKeywords();
    const clashes = allBrandKeywords().filter((k) => content.has(k));
    expect(clashes, `与文章争词: ${clashes.join(', ')}`).toHaveLength(0);
  });

  it('每家至少 5 个次词、3 个 GEO 问题', () => {
    for (const k of BRAND_KEYWORDS) {
      expect(k.secondary.length, k.slug).toBeGreaterThanOrEqual(5);
      expect(k.geoQuestions.length, k.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it('GEO 问题必须是真问句,且各家不重复', () => {
    const seen = new Set<string>();
    for (const k of BRAND_KEYWORDS) {
      for (const q of k.geoQuestions) {
        expect(q, `${k.slug}: ${q}`).toMatch(/[??]$/);
        expect(seen.has(q), `重复问题: ${q}`).toBe(false);
        seen.add(q);
      }
    }
  });

  it('每家品牌只有一个主页面 URL,且沿用已确认的 /reviews/', () => {
    const urls = BRANDS.map((b) => brandUrl(b.slug));
    expect(new Set(urls).size).toBe(16);
    for (const u of urls) expect(u).toMatch(/^\/reviews\/[a-z0-9]+\/$/);
  });

  it('次词必须带品牌识别词根,否则会和通用词争抢', () => {
    // 认词根而不是完整名称:用户会搜「SOGO机场」而不是「SOGO云机场」,
    // 但「机场推荐」这种不含词根的通用词仍会被拦下
    for (const k of BRAND_KEYWORDS) {
      const full = BRANDS.find((b) => b.slug === k.slug)!.name.replace(/\s+/g, '');
      const root = full.replace(/(云|网络|梯)$/, '');
      for (const s of k.secondary) {
        const flat = s.replace(/\s+/g, '');
        expect(flat.includes(root), `${k.slug} 的次词「${s}」不含品牌词根「${root}」`).toBe(true);
      }
    }
  });

  it('每家都有上游入口与下游去向,不做死胡同', () => {
    for (const k of BRAND_KEYWORDS) {
      expect(k.upstream.length, k.slug).toBeGreaterThan(0);
      expect(k.downstream.length, k.slug).toBeGreaterThan(0);
    }
  });
});
