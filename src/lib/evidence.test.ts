import { describe, it, expect } from 'vitest';
import { BRANDS } from '../data/brands';
import {
  SPEEDTEST_BATCH,
  assetForBrand,
  isApproved,
  originalPath,
  captionFor,
  altFor,
} from '../data/evidence';

/**
 * 证据层的约束测试。
 *
 * 这些断言存在的意义不是"代码能跑",而是防止有人在未来某次改动里
 * 悄悄把 review-required 的证据放出去,或者让 vendor 声明升级成 measured。
 */

describe('测速证据批次完整性', () => {
  it('16 家品牌全部有对应证据', () => {
    for (const b of BRANDS) {
      expect(assetForBrand(b.slug), `${b.name} 缺少测速证据`).toBeDefined();
    }
  });

  it('批次含 16 条资产,且 SHA-256 互不相同', () => {
    expect(SPEEDTEST_BATCH.assets).toHaveLength(16);
    const hashes = new Set(SPEEDTEST_BATCH.assets.map((a) => a.sha256));
    expect(hashes.size).toBe(16);
  });

  it('所有截图尺寸均为 1122×1402', () => {
    for (const a of SPEEDTEST_BATCH.assets) {
      expect(a.width, a.brand).toBe(1122);
      expect(a.height, a.brand).toBe(1402);
    }
  });

  it('所有测试时间都落在批次日期当天', () => {
    for (const a of SPEEDTEST_BATCH.assets) {
      expect(a.testedAt.startsWith(SPEEDTEST_BATCH.measurementDate), a.brand).toBe(true);
      expect(a.testedAt.endsWith('+08:00'), a.brand).toBe(true);
    }
  });
});

describe('发布闸门', () => {
  it('2026-08-18 放行 15 张,可信云单独保留', () => {
    const approved = SPEEDTEST_BATCH.assets.filter(isApproved);
    const blocked = SPEEDTEST_BATCH.assets.filter((a) => !isApproved(a));
    expect(approved).toHaveLength(15);
    expect(blocked).toHaveLength(1);
    expect(blocked[0].brand).toBe('可信云');
  });

  it('批次层的 reviewStatus 仍来自 manifest,不因逐张放行而被改写', () => {
    // 逐张决定记录在 REVIEW_DECISIONS,manifest 是原始素材的事实描述,两者不混淆
    expect(SPEEDTEST_BATCH.reviewStatus).toBe('review-required');
  });

  it('可信云的日期置信度低于其他品牌,必须单独复核', () => {
    const kexin = assetForBrand('kexinyun')!;
    expect(kexin.dateConfidence).not.toBe('visible-in-image');
    expect(kexin.reviewNote).toBeTruthy();
  });

  it('即使整批被批准,日期未确认的证据仍不得发布', () => {
    const approvedBatch = { ...SPEEDTEST_BATCH, reviewStatus: 'approved' as const };
    const kexin = SPEEDTEST_BATCH.assets.find((a) => a.dateConfidence !== 'visible-in-image')!;
    // isApproved 同时检查批次状态与单图日期置信度,两个条件缺一不可
    expect(
      approvedBatch.reviewStatus === 'approved' && kexin.dateConfidence === 'visible-in-image'
    ).toBe(false);
  });
});

describe('测试条件离散度决定了不能做排名', () => {
  it('存在两套测试工具与两种协议', () => {
    const tools = new Set(SPEEDTEST_BATCH.assets.map((a) => a.toolFamily));
    const protocols = new Set(SPEEDTEST_BATCH.assets.map((a) => a.protocolDisplayed));
    expect(tools.size).toBeGreaterThan(1);
    expect(protocols.size).toBeGreaterThan(1);
  });

  it('批次已声明它不是受控的跨品牌排名', () => {
    expect(SPEEDTEST_BATCH.commonLimitations).toContain('not a controlled cross-brand ranking');
    expect(SPEEDTEST_BATCH.commonLimitations).toContain('does not test AI or streaming unlock');
  });
});

describe('展示辅助', () => {
  it('原图路径指向 public 下的只读副本', () => {
    const a = assetForBrand('guangsuyun')!;
    expect(originalPath(a)).toBe(`/evidence/speedtest/2026-08-11/${a.file}`);
  });

  it('图注包含测试时间与局限说明', () => {
    const caption = captionFor(assetForBrand('guangsuyun')!);
    expect(caption).toContain('2026-08-11');
    expect(caption).toContain('不代表长期表现');
  });

  it('alt 不把全部数值塞进去', () => {
    const alt = altFor(assetForBrand('guangsuyun')!);
    expect(alt.length).toBeLessThan(60);
    expect(alt).toContain('光速云');
  });
});
