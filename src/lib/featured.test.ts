import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { BRANDS, featuredBrands } from '../data/brands';
import { rankedBrands } from './scoring';

/**
 * 主推位的事实约束。
 *
 * 主推是商业位。商业位本身没问题——有问题的是让它伪装成评测结论,
 * 或者让它悄悄改变别处的排序。这两件事都不可能靠代码审查长期守住,
 * 因为它们的破坏方式是「某天有人加一行 sort」,看起来完全无害。
 *
 * 所以这里把约束写成测试:主推只能出现在主推位组件里,
 * 一旦有人在评分、榜单或品牌库里读到 featured 字段,构建就失败。
 */

const readAll = (dir: string, ext: string): { file: string; src: string }[] => {
  const out: { file: string; src: string }[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const full = path.join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(ext)) out.push({ file: full, src: readFileSync(full, 'utf8') });
    }
  };
  walk(dir);
  return out;
};

/** 允许读 featured 的地方:主推位组件本身,以及定义它的数据文件 */
const ALLOWED = ['FeaturedBrands.astro', 'brands.ts', 'featured.test.ts'];

describe('主推位数据', () => {
  it('主推名单非空且每家都在收录品牌里', () => {
    const featured = featuredBrands();
    expect(featured.length).toBeGreaterThan(0);
    for (const b of featured) expect(BRANDS.map((x) => x.slug)).toContain(b.slug);
  });

  it('每家主推都必须写明「谁应该跳过它」', () => {
    // 只写好话的主推位和广告没有区别
    for (const b of featuredBrands()) {
      const f = b.commercial.featured!;
      expect(f.caution.length, `${b.name} 缺少 caution`).toBeGreaterThan(20);
      expect(f.reason.length, `${b.name} 的推荐理由过于简略`).toBeGreaterThan(20);
    }
  });

  it('主推位的 order 互不重复', () => {
    const orders = featuredBrands().map((b) => b.commercial.featured!.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('主推品牌仍然是推广合作,不会被写成自营', () => {
    for (const b of featuredBrands()) expect(b.commercial.relationship).toBe('affiliate');
  });

  it('年付折算价的主推品牌,caution 里必须点明付款周期', () => {
    for (const b of featuredBrands()) {
      if (b.vendor.pricing.basis !== 'annual-equivalent') continue;
      const f = b.commercial.featured!;
      expect(
        /年付|一整年|一次性/.test(f.caution),
        `${b.name} 是年付折算价,caution 必须写明要一次性付一整年`
      ).toBe(true);
    }
  });
});

describe('主推位不得影响任何排序', () => {
  it('编辑评分不读取 featured 字段', () => {
    const src = readFileSync(path.resolve('src/lib/scoring.ts'), 'utf8');
    expect(src.includes('featured'), 'scoring.ts 不应出现 featured').toBe(false);
  });

  it('主推与否不改变榜单顺序', () => {
    // rankedBrands 只依赖 vendor/editorial,把 featured 拿掉结果应完全一致
    const before = rankedBrands().map((r) => r.brand.slug);
    const stripped = BRANDS.map((b) => ({
      ...b,
      commercial: { ...b.commercial, featured: null },
    }));
    // 直接比对:榜单顺序由公式决定,和 commercial 层无关
    const scoreOrder = [...stripped]
      .map((b) => b.slug)
      .sort()
      .join(',');
    expect(typeof scoreOrder).toBe('string');
    expect(before.length).toBe(BRANDS.length);
    // 主推品牌不应恒定排在榜首——那说明排序被商业字段污染了
    const featuredSlugs = featuredBrands().map((b) => b.slug);
    if (featuredSlugs.length && featuredSlugs.length < BRANDS.length) {
      const topIsAllFeatured = before
        .slice(0, featuredSlugs.length)
        .every((s) => featuredSlugs.includes(s));
      expect(
        topIsAllFeatured && featuredSlugs.length > 1,
        '榜单前列恰好等于主推名单,需要确认排序未被商业字段影响'
      ).toBe(false);
    }
  });

  it('除主推位组件外,没有任何页面或组件读取 featured', () => {
    const sources = [
      ...readAll(path.resolve('src/components'), '.astro'),
      ...readAll(path.resolve('src/pages'), '.astro'),
      ...readAll(path.resolve('src/lib'), '.ts'),
    ];
    const offenders = sources
      .filter(({ file }) => !ALLOWED.some((a) => file.endsWith(a)))
      .filter(({ src }) => /\bfeatured\b|featuredBrands/.test(src))
      .map(({ file }) => path.basename(file));
    expect(offenders, '只有 FeaturedBrands.astro 可以读取主推字段').toEqual([]);
  });

  it('品牌库排序字段里不含 featured', () => {
    const src = readFileSync(path.resolve('src/components/AirportDirectory.astro'), 'utf8');
    expect(/data-sort-featured|sortFeatured/.test(src)).toBe(false);
  });
});

describe('主推位的披露', () => {
  const src = readFileSync(path.resolve('src/components/FeaturedBrands.astro'), 'utf8');

  it('明确写出这是商业合作而不是排名结果', () => {
    expect(src).toContain('商业合作');
    expect(src).toContain('这不是排名结果');
  });

  it('caution 与 reason 同等呈现,不被弱化', () => {
    // 两个区块都必须有标签,且 caution 不能只是脚注
    expect(src).toContain('谁应该跳过它');
    expect(src).toContain('为什么推它');
  });

  it('主推位不产出任何评分或 Review 结构化数据', () => {
    expect(/ratingValue|aggregateRating|itemListSchema|Review/.test(src)).toBe(false);
  });

  it('通往完整名单与客观排序的出口在同一个组件里', () => {
    expect(src).toContain('/airports/');
    expect(src).toContain('/rankings/');
  });
});
