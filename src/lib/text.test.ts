import { describe, it, expect } from 'vitest';
import { readingTime, wordCount, slugify, truncate, extractHeadings } from './text';

describe('readingTime', () => {
  it('至少返回 1 分钟', () => {
    expect(readingTime('短')).toBe(1);
  });

  it('按 400 字/分钟折算中文', () => {
    expect(readingTime('机'.repeat(1200))).toBe(3);
  });

  it('忽略代码块与 HTML 标签', () => {
    const withCode = '中'.repeat(400) + '\n```\n' + 'x'.repeat(5000) + '\n```\n';
    expect(readingTime(withCode)).toBe(1);
  });

  it('合并中英混排', () => {
    expect(readingTime('机'.repeat(400) + ' ' + 'word '.repeat(200))).toBe(2);
  });
});

describe('wordCount', () => {
  it('中文按字、英文按词计数', () => {
    expect(wordCount('机场推荐 Clash Verge')).toBe(6);
  });
});

describe('slugify', () => {
  it('规范化英文标题', () => {
    expect(slugify('Clash Verge Rev 教程')).toBe('clash-verge-rev');
    expect(slugify('  Shadowrocket__Setup  ')).toBe('shadowrocket-setup');
  });

  it('纯中文标题应抛错而不是产出空 slug', () => {
    expect(() => slugify('机场推荐')).toThrow(/显式指定英文 slug/);
  });
});

describe('truncate', () => {
  it('不超长时原样返回', () => {
    expect(truncate('机场推荐', 10)).toBe('机场推荐');
  });

  it('超长时截断并补省略号', () => {
    expect(truncate('机'.repeat(20), 10)).toBe('机'.repeat(9) + '…');
  });
});

describe('extractHeadings', () => {
  it('抽取 H2/H3 并忽略代码块内的井号', () => {
    const md = [
      '## 机场是什么',
      '正文',
      '### 如何选择',
      '```',
      '# 注释',
      '```',
      '## 常见问题',
    ].join('\n');
    expect(extractHeadings(md)).toEqual([
      { depth: 2, text: '机场是什么' },
      { depth: 3, text: '如何选择' },
      { depth: 2, text: '常见问题' },
    ]);
  });
});
