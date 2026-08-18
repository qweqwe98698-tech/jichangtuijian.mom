import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 埋点的隐私与安全约束。
 *
 * 分析代码有两个典型的翻车方式,都不会让构建失败:
 * 一是没配 token 时仍然加载了第三方脚本(本地开发污染线上数据,或者上线前就在偷偷发请求);
 * 二是追踪逻辑抛异常把推广链接的跳转打断——那是直接的收入损失。
 *
 * 这两条都用测试盯住,因为它们只在特定条件下才显现,人工点一遍看不出来。
 */

const src = readFileSync(path.resolve('src/components/Analytics.astro'), 'utf8');
const cfg = readFileSync(path.resolve('src/config/analytics.ts'), 'utf8');

describe('埋点的加载条件', () => {
  it('每个第三方脚本都由对应的 token 条件包裹', () => {
    // 三段脚本(CF / Plausible / Umami)必须各自带条件,不能无条件渲染
    expect(src).toContain('CF_BEACON_TOKEN &&');
    expect(src).toContain("EVENT_PROVIDER === 'plausible' && hasEventProvider");
    expect(src).toContain("EVENT_PROVIDER === 'umami' && hasEventProvider");
  });

  it('配置项全部来自环境变量,没有硬编码的 token', () => {
    expect(cfg).toContain('import.meta.env.PUBLIC_');
    // 形如 32 位以上的十六进制串通常是误提交的真实 token
    expect(/[0-9a-f]{32,}/i.test(cfg), 'analytics.ts 里疑似出现硬编码 token').toBe(false);
  });

  it('三个事件类变量必须齐全才启用,避免半配状态发出坏请求', () => {
    expect(cfg).toContain(
      'export const hasEventProvider = Boolean(EVENT_PROVIDER && EVENT_HOST && EVENT_SITE_ID)'
    );
  });
});

describe('点击追踪不得影响跳转', () => {
  it('追踪逻辑包在 try/catch 里', () => {
    const block = src.slice(
      src.indexOf('affiliate_click') - 600,
      src.indexOf('affiliate_click') + 400
    );
    expect(block).toContain('try {');
    expect(block).toContain('catch');
  });

  it('监听器是 passive 的,不会阻塞或改变默认跳转行为', () => {
    expect(src).toContain('{ passive: true }');
    // 绝不能出现阻止默认行为的调用 —— 那会拦住推广链接
    expect(/preventDefault|return false/.test(src), '点击追踪不得阻止默认跳转').toBe(false);
  });

  it('用事件委托覆盖全站品牌外链,而不是逐个挂监听', () => {
    expect(src).toContain('a[data-brand]');
  });
});

describe('隐私口径', () => {
  it('只上报品牌、来源路径与位置,不采集个人信息', () => {
    const payload = src.slice(src.indexOf('var payload'), src.indexOf('var payload') + 300);
    for (const forbidden of [
      'email',
      'userId',
      'user_id',
      'ip',
      'document.cookie',
      'localStorage',
    ]) {
      expect(payload.includes(forbidden), `点击事件不应上报 ${forbidden}`).toBe(false);
    }
    expect(payload).toContain('brand');
    expect(payload).toContain('from');
  });

  it('不引入需要同意横幅的跟踪器', () => {
    for (const banned of [
      'googletagmanager',
      'google-analytics',
      'gtag(',
      'facebook.net',
      'hotjar',
      'doubleclick',
    ]) {
      expect(src.includes(banned), `不应引入 ${banned}`).toBe(false);
    }
  });
});
