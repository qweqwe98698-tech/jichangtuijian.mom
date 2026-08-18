import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { STATUS, AVAILABILITY_SERVICES, FORBIDDEN_TOPOLOGY_LABELS } from '../data/status';
import { BRANDS } from '../data/brands';

/**
 * T6 图表事实红线的机器实现。
 *
 * 这些不是风格约束,是事实约束:一个绿色对勾能把「厂商说支持」变成「已验证支持」,
 * 而读者分辨不出差别。所以红线必须由测试守住,不能只写在设计文档里。
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

describe('T6 状态语言', () => {
  it('只有 measured 使用成功色', () => {
    // 红线第 7 条:不得用绿色 Badge 代替真实测试结论
    const okStatuses = Object.entries(STATUS).filter(([, m]) => m.tone === 'ok');
    expect(okStatuses).toHaveLength(1);
    expect(okStatuses[0][0]).toBe('measured');
  });

  it('不存在 Operational / Stable 这类会被读成「已验证正常」的状态', () => {
    const labels = Object.values(STATUS)
      .map((m) => `${m.label}${m.code}`)
      .join(' ');
    for (const banned of ['Operational', 'Stable', '正常运行', '运行正常']) {
      expect(labels, `状态表不应包含 ${banned}`).not.toContain(banned);
    }
  });

  it('厂商声明用警示色而不是中性色,避免被当成事实', () => {
    expect(STATUS.vendor.tone).toBe('claim');
  });

  it('每个状态都有解释文案,不能只给一个词', () => {
    for (const [key, m] of Object.entries(STATUS)) {
      expect(m.title.length, `${key} 的解释过短`).toBeGreaterThan(10);
      expect(m.label.length, `${key} 缺少中文标签`).toBeGreaterThan(1);
    }
  });
});

describe('T6 可用性矩阵红线', () => {
  it('矩阵覆盖 AI 与流媒体两组常见服务', () => {
    const groups = new Set(AVAILABILITY_SERVICES.map((s) => s.group));
    expect(groups).toContain('AI 工具');
    expect(groups).toContain('流媒体');
    expect(AVAILABILITY_SERVICES.length).toBeGreaterThanOrEqual(6);
  });

  it('组件里本站实测状态硬编码为 not-tested,不接受任何其他取值', () => {
    // 红线第 1 条:本批证据没测过解锁,矩阵默认 Not Tested
    const src = readFileSync(
      path.resolve('src/components/ServiceAvailabilityMatrix.astro'),
      'utf8'
    );
    expect(src).toContain('status="not-tested"');
    // 实测列不得出现 measured —— 出现即意味着有人把未测的写成了已测
    const measuredInMatrix = /status="measured"/.test(src);
    expect(measuredInMatrix, '可用性矩阵不应出现 measured 状态').toBe(false);
  });

  it('没有任何品牌的解锁能力被标成已实测', () => {
    for (const b of BRANDS) {
      expect(b.vendor.claims.streaming, `${b.name} 流媒体`).not.toBe('measured');
      expect(b.vendor.claims.aiTools, `${b.name} AI`).not.toBe('measured');
      expect(Object.keys(b.measured.unlock), `${b.name} 不应有解锁实测结论`).toHaveLength(0);
    }
  });
});

describe('T6 拓扑图红线', () => {
  it('全站不出现需要独立技术证据的营销标签', () => {
    const sources = [
      ...readAll(path.resolve('src/components'), '.astro'),
      ...readAll(path.resolve('src/pages'), '.astro'),
    ];
    for (const { file, src } of sources) {
      // 只看非注释内容:注释里说明"禁止这些标签"是合理的
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const label of FORBIDDEN_TOPOLOGY_LABELS) {
        expect(code.includes(label), `${path.basename(file)} 出现禁用标签「${label}」`).toBe(false);
      }
    }
  });

  it('拓扑组件明确声明它不是真实拓扑', () => {
    const src = readFileSync(path.resolve('src/components/NetworkPathDiagram.astro'), 'utf8');
    expect(src).toContain('不是这家机场的真实拓扑');
    expect(src).toContain('本站无法验证');
  });

  it('未标明线路的品牌不会被画成专线', () => {
    const src = readFileSync(path.resolve('src/components/NetworkPathDiagram.astro'), 'utf8');
    // unstated 分支必须存在且用虚线,不能落到专线的粗实线上
    expect(src).toContain("kind === 'unstated'");
    expect(src).toContain('未标明线路类型');
  });
});

describe('T6 禁止的视觉手法', () => {
  it('状态标记不使用 emoji', () => {
    const src = readFileSync(path.resolve('src/components/StatusBadge.astro'), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
    // 指令禁止大量 ✅❌ emoji。用 u 标志正确处理代理对与组合字符
    expect(/[✅❌⚠\u{1F7E2}\u{1F534}\u{1F7E1}]/u.test(code), 'StatusBadge 不应使用 emoji').toBe(
      false
    );
  });

  it('不用进度条制造「满速」印象', () => {
    // 红线第 6 条。评分刻度条是编辑评分的可视化,不是速度;
    // 这里确认速度相关组件里没有任何进度条
    const evidence = readFileSync(path.resolve('src/components/SpeedtestEvidence.astro'), 'utf8');
    expect(/progress|<meter/i.test(evidence), '测速证据区不应出现进度条').toBe(false);
  });
});
