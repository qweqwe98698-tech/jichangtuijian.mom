/** 中文内容常用的文本工具。被 Vitest 覆盖,改动需同步更新 src/lib/text.test.ts */

/** 中文成年读者的平均阅读速度(字/分钟);英文单词按 200 词/分钟折算 */
const CJK_CHARS_PER_MINUTE = 400;
const LATIN_WORDS_PER_MINUTE = 200;

const CJK_RANGE = /[㐀-䶿一-鿿豈-﫿]/g;
const LATIN_WORDS = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;

/** 估算阅读时长(分钟),中英混排分别计算后合并,最小值为 1 */
export function readingTime(source: string): number {
  const text = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, ' ');

  const cjk = text.match(CJK_RANGE)?.length ?? 0;
  const latin = text.match(LATIN_WORDS)?.length ?? 0;

  const minutes = cjk / CJK_CHARS_PER_MINUTE + latin / LATIN_WORDS_PER_MINUTE;
  return Math.max(1, Math.round(minutes));
}

/** 正文字数(中文按字,英文按词) */
export function wordCount(source: string): number {
  const cjk = source.match(CJK_RANGE)?.length ?? 0;
  const latin = source.match(LATIN_WORDS)?.length ?? 0;
  return cjk + latin;
}

/**
 * 生成 URL slug。中文不做音译,调用方必须为中文标题显式提供英文 slug,
 * 因此这里遇到无法转换的字符会抛错,而不是静默产出空 slug 导致路由塌缩。
 */
export function slugify(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  if (!slug) {
    throw new Error(`无法从 "${input}" 生成 slug,请为该条目显式指定英文 slug`);
  }
  return slug;
}

/** 截断描述文本到指定长度,中文按字计,末尾补省略号 */
export function truncate(input: string, max = 155): string {
  const text = input.replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** 从 Markdown 正文抽取 H2 标题,用于生成目录 */
export function extractHeadings(markdown: string): { depth: number; text: string }[] {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, '');
  const matches = withoutCode.matchAll(/^(#{2,3})\s+(.+?)\s*$/gm);
  return [...matches].map((m) => ({ depth: m[1].length, text: m[2].replace(/[#*`]/g, '').trim() }));
}
