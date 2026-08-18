import { describe, it, expect } from 'vitest';
import { BRANDS, costPerGB, getBrand } from '../data/brands';
import { scoreBrand } from './scoring';

/**
 * 编辑与评测规范页(/editorial-policy/)在正文中写死了几个具体数字:
 * 单位流量成本的区间端点、以及一个完整的复算示例。
 * 这些数字必须与代码算出来的结果一致,否则读者按页面复算会对不上,
 * 而「可复算」正是本站可信度的核心承诺。
 *
 * 品牌数据一旦调价,这里会失败 —— 那正是提醒去同步更新那一页的信号。
 */

describe('/editorial-policy/ 页面中写死的数字必须与算法一致', () => {
  const sorted = [...BRANDS].sort((a, b) => costPerGB(a) - costPerGB(b));
  const cheapest = sorted[0];
  const priciest = sorted[sorted.length - 1];

  it('单位流量成本的最低端是灵猫网络', () => {
    expect(cheapest.name).toBe('灵猫网络');
    expect(costPerGB(cheapest)).toBeCloseTo(0.13, 2);
  });

  it('单位流量成本的最高端是极连云', () => {
    expect(priciest.name).toBe('极连云');
    expect(costPerGB(priciest)).toBeCloseTo(0.18, 2);
  });

  it('规范页给出的光速云复算示例结果为 9.7', () => {
    const s = scoreBrand(getBrand('guangsuyun')!);
    expect(s.value).toBe(9.9);
    expect(s.line).toBe(9.5);
    expect(s.track).toBe(10);
    expect(s.client).toBe(9.5);
    expect(s.coverage).toBe(9.2);
    expect(s.overall).toBe(9.7);
  });

  it('单位成本最低的品牌性价比维度应得满分 10', () => {
    expect(scoreBrand(cheapest).value).toBe(10);
  });

  it('单位成本最高的品牌性价比维度应得下限 4', () => {
    expect(scoreBrand(priciest).value).toBe(4);
  });
});
