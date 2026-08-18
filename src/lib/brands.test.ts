import { describe, it, expect } from 'vitest';
import {
  BRANDS,
  costPerGB,
  monthlyBrands,
  annualEquivalentBrands,
  getBrand,
  protocolLabel,
  lineLabel,
  UNSTATED,
} from '../data/brands';

describe('品牌数据层完整性', () => {
  it('收录 16 家品牌且 slug 唯一', () => {
    expect(BRANDS).toHaveLength(16);
    expect(new Set(BRANDS.map((b) => b.slug)).size).toBe(16);
  });

  it('slug 必须是 URL 安全的小写英文', () => {
    for (const b of BRANDS) {
      expect(b.slug, b.name).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('全部为推广合作关系,不存在自营', () => {
    for (const b of BRANDS) {
      expect(b.commercial.relationship, b.name).toBe('affiliate');
    }
  });

  it('每家都有可用的推广链接与价格数据', () => {
    for (const b of BRANDS) {
      expect(b.commercial.affiliateUrl, b.name).toMatch(/^https:\/\//);
      expect(b.vendor.pricing.entryPriceCNY, b.name).toBeGreaterThan(0);
      expect(b.vendor.pricing.trafficGB, b.name).toBeGreaterThan(0);
    }
  });

  it('年付折算口径必须附带价格说明与编辑提示,避免与月付混淆', () => {
    for (const b of annualEquivalentBrands()) {
      expect(b.vendor.pricing.note, b.name).toBeTruthy();
      expect(b.editorial.caveat, b.name).toBeTruthy();
    }
  });

  it('未实测的品牌不得携带实测样本或解锁结论', () => {
    for (const b of BRANDS) {
      if (b.measured.status !== 'done') {
        expect(b.measured.samples, b.name).toHaveLength(0);
        expect(Object.keys(b.measured.unlock), b.name).toHaveLength(0);
        expect(b.measured.lastTestedAt, b.name).toBeNull();
      }
    }
  });

  it('公开资料未标明协议的品牌,协议数组必须为空而不是填一个猜测值', () => {
    // 这四家的品牌清单原文只写了线路特点,没提协议。
    // 站上曾经填过 VLESS,是凭空补的——2026-08-18 按新版清单更正。
    // 这条断言存在的意义:防止将来有人为了"页面好看"再把它填回去。
    for (const slug of ['xingdaomeng', 'feimaoyun', 'lingmao', 'jilianyun']) {
      const b = getBrand(slug)!;
      expect(b.vendor.protocols, `${b.name} 的协议应为未标明`).toHaveLength(0);
    }
  });

  it('唯兔云的线路类型为未标明,不得推断成中转或直连', () => {
    // 清单原文是「60+ 节点、三网优化、智能负载均衡」——网络配置描述,不是线路类型
    expect(getBrand('weituyun')!.vendor.lines).toHaveLength(0);
  });

  it('未标明的字段在页面上必须显示为未标明,不能显示成空白', () => {
    expect(protocolLabel(getBrand('lingmao')!)).toBe(UNSTATED);
    expect(lineLabel(getBrand('weituyun')!)).toBe(UNSTATED);
    // 有值的品牌照常显示真实值
    expect(protocolLabel(getBrand('guangsuyun')!)).toBe('VLESS');
    expect(lineLabel(getBrand('guangsuyun')!)).toContain('IEPL');
  });

  it('厂商声明不得被标记为已实测', () => {
    for (const b of BRANDS) {
      if (b.measured.status !== 'done') {
        expect(b.vendor.claims.streaming, b.name).not.toBe('measured');
        expect(b.vendor.claims.aiTools, b.name).not.toBe('measured');
      }
    }
  });

  it('comparableWith 只能指向存在的品牌,且不能指向自己', () => {
    for (const b of BRANDS) {
      for (const slug of b.editorial.comparableWith) {
        expect(slug, `${b.name} -> ${slug}`).not.toBe(b.slug);
        expect(getBrand(slug), `${b.name} -> ${slug}`).toBeDefined();
      }
    }
  });

  it('每家都有对比对象,保证对比页与内链不产生孤儿节点', () => {
    for (const b of BRANDS) {
      expect(b.editorial.comparableWith.length, b.name).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('派生计算', () => {
  it('月付与年付折算分组互斥且覆盖全部品牌', () => {
    expect(monthlyBrands().length + annualEquivalentBrands().length).toBe(BRANDS.length);
  });

  it('单位流量成本计算正确', () => {
    // 用入门价除以入门流量,不做任何取整;取整留给展示层
    const u1s1 = getBrand('u1s1')!;
    expect(costPerGB(u1s1)).toBeCloseTo(20 / 120, 6);
  });

  it('单位流量成本保留完整精度,不提前取整造成假并列', () => {
    const lingmao = getBrand('lingmao')!; // 19 / 150 = 0.12667
    const xingdao = getBrand('xingdaomeng')!; // 8 / 60  = 0.13333
    expect(costPerGB(lingmao)).toBeLessThan(costPerGB(xingdao));
  });
});
