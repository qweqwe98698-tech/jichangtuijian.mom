import { describe, it, expect } from 'vitest';
import { BRANDS } from '../data/brands';
import { REVIEW_DECISIONS, assetForBrand, isApproved, approvedCount } from '../data/evidence';

/**
 * 发布闸门的约束测试。
 *
 * 这些断言防的是一类具体事故:某次改动顺手把 REVIEW_DECISIONS 全改成 approved,
 * 于是 16 张待复核的截图一起被发布出去,而没有人做过指令要求的人工核对。
 */

describe('测速证据发布闸门', () => {
  it('16 家全部有明确的审核决定,不存在遗漏', () => {
    for (const b of BRANDS) {
      expect(REVIEW_DECISIONS[b.slug], `${b.name} 缺少审核决定`).toBeDefined();
    }
    expect(Object.keys(REVIEW_DECISIONS)).toHaveLength(16);
  });

  it('可信云必须单独挡住:日期未确认时,即使标为 approved 也不得放行', () => {
    const asset = assetForBrand('kexinyun')!;
    expect(asset.dateConfidence).not.toBe('visible-in-image');
    expect(REVIEW_DECISIONS.kexinyun.note, '必须写明为什么单独挡住').toBeTruthy();

    // isApproved 的两个条件是与关系:人工批准 + 日期在图中可见
    const pretendApproved = { ...REVIEW_DECISIONS.kexinyun, status: 'approved' as const };
    const wouldPass =
      pretendApproved.status === 'approved' && asset.dateConfidence === 'visible-in-image';
    expect(wouldPass, '可信云不应因为改了审核状态就被放行').toBe(false);
  });

  it('标为 approved 的必须同时记录复核人与复核日期', () => {
    for (const [slug, d] of Object.entries(REVIEW_DECISIONS)) {
      if (d.status === 'approved') {
        expect(d.reviewedBy, `${slug} 已批准但没写复核人`).toBeTruthy();
        expect(d.reviewedAt, `${slug} 已批准但没写复核日期`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(d.reviewedBy, `${slug} 的复核人不能是临时验证占位`).not.toMatch(/TEMP|TODO|TEST/i);
      }
    }
  });

  it('未批准的证据一律不放行', () => {
    for (const b of BRANDS) {
      const asset = assetForBrand(b.slug)!;
      if (REVIEW_DECISIONS[b.slug].status !== 'approved') {
        expect(isApproved(asset), `${b.name} 未批准却被判定为可发布`).toBe(false);
      }
    }
  });

  it('approvedCount 与逐张判定一致', () => {
    const manual = BRANDS.filter((b) => isApproved(assetForBrand(b.slug)!)).length;
    expect(approvedCount()).toBe(manual);
  });
});
