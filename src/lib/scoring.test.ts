import { describe, it, expect } from 'vitest';
import { BRANDS, getBrand } from '../data/brands';
import { scoreBrand, rankedBrands, topDimension, SCORING_RUBRIC } from './scoring';

describe('编辑评分体系', () => {
  it('所有分数落在 0-10 区间', () => {
    for (const b of BRANDS) {
      const s = scoreBrand(b);
      for (const [dim, value] of Object.entries(s)) {
        expect(value, `${b.name}.${dim}`).toBeGreaterThanOrEqual(0);
        expect(value, `${b.name}.${dim}`).toBeLessThanOrEqual(10);
      }
    }
  });

  it('评分可复现:同一输入必得同一输出', () => {
    const b = getBrand('guangsuyun')!;
    expect(scoreBrand(b)).toEqual(scoreBrand(b));
  });

  it('权重之和为 1', () => {
    const total = SCORING_RUBRIC.reduce((sum, r) => sum + parseInt(r.weight, 10), 0);
    expect(total).toBe(100);
  });

  it('单位流量更便宜的品牌性价比分更高', () => {
    const cheap = scoreBrand(getBrand('yifanyun')!); // 20元/150GB
    const pricey = scoreBrand(getBrand('jilianyun')!); // 18元/100GB
    expect(cheap.value).toBeGreaterThan(pricey.value);
  });

  it('专线品牌线路分高于纯中转/直连品牌', () => {
    const iepl = scoreBrand(getBrand('guangsuyun')!);
    const relay = scoreBrand(getBrand('weituyun')!);
    expect(iepl.line).toBeGreaterThan(relay.line);
  });

  it('运营时长维度只看开业年份,不受价格口径变动影响', () => {
    // 光速云 2020 年开业,已满 5 年,应取满分
    expect(scoreBrand(getBrand('guangsuyun')!).track).toBe(10);
  });

  it('运营更久的品牌运营时长分更高', () => {
    expect(scoreBrand(getBrand('guangsuyun')!).track).toBeGreaterThan(
      scoreBrand(getBrand('quanqiuyun')!).track
    );
  });

  it('未声明场景的品牌不被过度惩罚,下限为 7 分', () => {
    expect(scoreBrand(getBrand('kexinyun')!).coverage).toBeGreaterThanOrEqual(7);
  });

  it('排行按总分降序,且可按计价口径分组', () => {
    const monthly = rankedBrands({ basis: 'monthly' });
    const annual = rankedBrands({ basis: 'annual-equivalent' });
    // 飞猫云、星岛梦、光速云三家为年付折算口径,其余 13 家为月付
    expect(monthly.length).toBe(13);
    expect(annual.length).toBe(3);
    expect(monthly.length + annual.length).toBe(16);
    for (let i = 1; i < monthly.length; i++) {
      expect(monthly[i - 1].score.overall).toBeGreaterThanOrEqual(monthly[i].score.overall);
    }
  });

  it('topDimension 返回该品牌得分最高的维度', () => {
    const score = { value: 5, line: 9, track: 6, client: 7, coverage: 8, overall: 7 };
    expect(topDimension(score)).toEqual({ label: '线路等级', value: 9 });
  });
});
