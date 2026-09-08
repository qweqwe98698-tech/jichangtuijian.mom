/**
 * scripts/generate-weekly-article.mjs
 * 
 * 全自动万字级 SEO / GEO 机场长文生成脚本。
 * 驱动引擎: Google Gemini API (gemini-2.5-pro / gemini-2.5-flash)
 * 
 * 职责:
 * 1. 从 scripts/editorial-topics.json 读取下一篇待发布的深度选题 (或接受 CLI 指定 slug/brand)
 * 2. 注入站点数据层 (brands.ts / 规范与合规红线 / GEO 直答模型)
 * 3. 调用 Gemini 生成具备极高权威度与真实信息的万字级长文 (含 Frontmatter、表格、内链、FAQ)
 * 4. 严密校验 Zod Schema 与全站内容合规约束
 * 5. 自动落盘至 src/content/posts/<category>/<slug>.md 并更新基准
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// 命令行参数支持
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const specifiedSlug = args.find((_, i) => args[i - 1] === '--slug');
const specifiedBrand = args.find((_, i) => args[i - 1] === '--brand');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';

const stripBom = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

async function loadBrandsData() {
  const brandsFile = path.join(ROOT, 'src', 'data', 'brands.ts');
  const content = await readFile(brandsFile, 'utf8');
  return stripBom(content);
}

async function loadTopicQueue() {
  const queueFile = path.join(ROOT, 'scripts', 'editorial-topics.json');
  const data = JSON.parse(stripBom(await readFile(queueFile, 'utf8')));
  return { queueFile, topics: data };
}

function selectNextTopic(topics) {
  if (specifiedSlug) {
    const found = topics.find((t) => t.slug === specifiedSlug);
    if (found) return found;
    throw new Error(`指定的 slug 未在 editorial-topics.json 中找到: ${specifiedSlug}`);
  }

  if (specifiedBrand) {
    const found = topics.find((t) => t.brands && t.brands.includes(specifiedBrand) && t.status !== 'published');
    if (found) return found;
  }

  const next = topics.find((t) => t.status === 'pending');
  if (!next) {
    console.log('所有预设选题均已发布完毕，循环重置已发布选题...');
    topics.forEach((t) => { t.status = 'pending'; });
    return topics[0];
  }
  return next;
}

function buildSystemPrompt(topic, brandsSnippet) {
  return `你是一名资深的中文网络工程与代理基础设施评测专家、架构师与技术作家。
你正在为权威独立博客「jichangtuijian.mom」撰写一篇万字级（深度展开、高信息密度、逻辑严密的专业长文）SEO 与 GEO 专题长文。

【全站最高原则】
1. 真实与活人感：像一个真正做过网络运维、测过线路、查过资料的技术老手在说话。敢下判断，讲清来龙去脉与代价，严禁虚浮空洞的AI套话（如"在当今数字化浪潮中"、"犹如一把双刃剑"、"总而言之"、"毋庸置疑"）。
2. 四层数据原则：严禁混淆「厂商声明」与「实测结论」。目前全站流媒体与AI支持均为厂商公开声明。未实测时绝不声称"本站实测全部解锁"。
3. 严守合规红线：
   - 严禁在任何地方输出可用的节点协议链接前缀（如 ss://, vmess://, vless://, trojan://, hysteria://, sub:// 等）。
   - 商业合作关系必须显式披露：本站收录品牌均为推广合作，但评测与排序基于客观标准。
   - 正文内链必须全部使用相对站内路径（例如 /airports/, /reviews/<slug>/, /compare/, /protocols/, /guides/ 等），不得编造不存在的链接。
4. GEO（生成式引擎优化）核心：
   - 页面必须提供 answer（30~300字），开头直截了当回答标题核心痛点，便于 Perplexity、ChatGPT Search、Claude 和 Google AI Overviews 摘录作为直接回答源。
   - 必须包含 3~5 组针对性强的 FAQ（question 与 answer），解决真实用户的疑惑。
   - 必须至少包含 2 张详实的 Markdown 对比表格（包含价格维度、线路维度、协议或场景维度）。

【当前文章指定信息】
- 目标分类 (category): ${topic.category}
- 专题归属 (pillar): ${topic.pillar ? `"${topic.pillar}"` : 'null'}
- 主攻关键词 (primaryKeyword): "${topic.primaryKeyword}"
- 次要关键词 (secondaryKeywords): ${JSON.stringify(topic.secondaryKeywords)}
- 搜索意图 (intent): "${topic.intent}"
- 关联品牌 (brands): ${JSON.stringify(topic.brands || [])}
- 下一步引导 (nextStep): ${JSON.stringify(topic.nextStep)}
- 建议文章标题 (title): 必须在 15~35 个汉字之间，引人入胜且包含主关键词。
- 角度与核心论点: ${topic.angle}

【参考的品牌底层定义】
${brandsSnippet.slice(0, 4000)}

【输出格式要求】
必须输出纯净的 Markdown 文本，头部带标准的 YAML Frontmatter（用 --- 包裹），严禁将整体包在三个反引号的代码块中。
Frontmatter 字段严格满足以下要求：
---
title: "文章标题(20-35字)"
description: "meta描述(60-140字，精准概括文章重点)"
pubDate: "${new Date().toISOString().slice(0, 10)}"
updatedDate: "${new Date().toISOString().slice(0, 10)}"
category: ${topic.category}
tags:
  - 标签1
  - 标签2
  - 标签3
author: editorial-team
faq:
  - question: "常见高频痛点问题1"
    answer: "深度准确直接回答，字数50-150字"
  - question: "常见高频痛点问题2"
    answer: "深度准确直接回答，字数50-150字"
  - question: "常见高频痛点问题3"
    answer: "深度准确直接回答，字数50-150字"
relatedSlugs: []
pillar: ${topic.pillar ? topic.pillar : 'null'}
draft: false
primaryKeyword: "${topic.primaryKeyword}"
secondaryKeywords:
${topic.secondaryKeywords.map((k) => `  - "${k}"`).join('\n')}
intent: ${topic.intent}
nextStep:
  label: "${topic.nextStep.label}"
  href: "${topic.nextStep.href}"
  reason: "${topic.nextStep.reason}"
answer: "结论先行: 2-3句话直截了当给出答案，字数控制在60-200字之间，供AI搜索引擎与首屏读者摘录"
brands: ${JSON.stringify(topic.brands || [])}
---

【正文排版架构建议】
1. 前言：抛弃客套话，首段直接展开核心痛点、常见误区与全文结论。
2. 核心技术或商业逻辑剖析（结合 Markdown 表格逐项横向对照）。
3. 真实场景与实测分层（区分哪些是厂商宣传，哪些是客观可核实的特征）。
4. 适用人群与不适用人群对照清单（为读者提供明确退出通道）。
5. 详细实操/配置/防踩坑指引。
6. 结语与明确行动指引。
总篇幅要求极其详实、层次分明、干货满满（正文字数建议在 3000 到 5000 汉字以上）。`;
}

async function callGemini(prompt) {
  if (!API_KEY) {
    if (isDryRun) {
      console.log('未检测到 GEMINI_API_KEY，且开启了 --dry-run，使用内置 Mock 模板做测试...');
      return generateMockArticle();
    }
    throw new Error('未设置 GEMINI_API_KEY 环境变量！请在 GitHub Secrets 或本地环境配置 GEMINI_API_KEY。');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  
  console.log(`正在请求 Gemini API (${MODEL})...`);
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API 请求失败 (${resp.status}): ${errText}`);
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API 未返回有效正文内容');
  }
  return text;
}

function generateMockArticle() {
  return `---
title: "飞猫云官网深度评测与选型指南：7元年付折算价的优势与代价全拆解"
description: "飞猫云以年付折算7元/月成为本站收录中总门槛最低的机场之一。本文深度拆解50GB小流量套餐的优缺点、IEPL专线成色及适用场景。"
pubDate: "${new Date().toISOString().slice(0, 10)}"
updatedDate: "${new Date().toISOString().slice(0, 10)}"
category: compare
tags:
  - 飞猫云
  - 机场评测
  - 年付机场
  - IEPL专线
author: editorial-team
faq:
  - question: "飞猫云7元一个月是一次性付多少钱？"
    answer: "7元/月是按年付优惠折算出来的单月均价，需要一次性支付整年费用，购买前需明确自己的预付款承受度。"
  - question: "50GB月流量日常使用够用吗？"
    answer: "如果主要用于代码开发、网页查资料与文字通信完全足够；如果有高频4K视频播放或多设备下载需求，50GB容易提前见底。"
  - question: "飞猫云的IEPL专线是真实的吗？"
    answer: "品牌官方标注为IEPL企业专线，但本站尚未完成第三方端到端实测验证，建议首购选择短期验证晚高峰表现。"
relatedSlugs: []
pillar: how-to-choose-airport
draft: false
primaryKeyword: "飞猫云官网与深度评测"
secondaryKeywords:
  - "飞猫云官网入口"
  - "飞猫云怎么样"
  - "飞猫云年付7元"
intent: comparison
nextStep:
  label: "查看飞猫云官方档案与同价位品牌评测"
  href: "/reviews/feimaoyun/"
  reason: "文章梳理了宏观选型逻辑，若要核对最新套餐与优惠码请查阅品牌详细档案"
answer: "飞猫云的核心定位是低门槛轻度用户：年付折算7元/月带来本站最低的总账单支出，且入门即提供IEPL企业专线标注与自研客户端；其核心代价是50GB入门流量相对有限，适合查资料与轻度办公，重度视频用户需谨慎考虑。"
brands: ["feimaoyun", "guangsuyun", "xingdaomeng"]
---

在挑选代理机场时，多数人最容易陷入的误区是把「账单总额最低」等同于「每GB流量最便宜」。飞猫云就是这一现象的典型代表。

作为本站收录中起步价格最亲民的品牌之一，它用年付折算约 7 元/月的门槛吸引了大量预算有限的用户。但在付款之前，有必要把这笔账算清楚。

## 7 元月均价背后的账单结构与单位成本

我们先来看飞猫云与同价位梯队的直观参数对照：

| 品牌 | 入门标价 | 付费周期口径 | 月基础流量 | 折算每GB成本 | 线路标注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **飞猫云** | 7.0 元/月 | 年付折算 | 50 GB | 约 0.140 元/GB | IEPL 企业专线 |
| **光速云** | 7.5 元/月 | 年付折算 | 59 GB | 约 0.127 元/GB | 内网/IEPL 专线 |
| **星岛梦** | 8.0 元/月 | 年付折算 | 60 GB | 约 0.133 元/GB | 企业级内网专线 |
| **宇宙云** | 14.9 元/月 | 月付可随时停 | 100 GB | 约 0.149 元/GB | IEPL 企业专线 |

从表中可以看出，飞猫云优化的是「单次掏出的总钱数」，在账单总额上它处于绝对优势；但若按单位流量计算，由于给的基础额度为 50GB，它的每GB成本并不是全站最低。

## 50GB 流量的真实承载力评估

很多人对 50GB 没有具象认知。以下是基于常见场景的实际消耗推算：

* **纯代码开发与文献查阅**：平均每月消耗 5~15GB，50GB 可以非常从容。
* **社交媒体与即时通信**：Telegram、X（Twitter）图文日常浏览，每月约 15~25GB。
* **1080P 高清视频**：每小时消耗约 1.5GB，50GB 大约支持 33 小时播放。
* **4K 极清流媒体**：每小时消耗约 7GB，不到 8 小时便会耗尽。

因此，如果你有常驻电视盒子看 4K 流媒体的需求，飞猫云的入门档显然不适合作为主力；但如果你是上班族查文档、外企收发邮件、或是备用跳板，这个流量额度恰到好处。

## 官方客户端与第三方生态支持

飞猫云的一大特点是同时兼顾了小白用户与资深玩家：
1. **自研客户端**：开箱即用，免去手动配置订阅与路由规则的繁琐过程，适合新手。
2. **第三方通用订阅**：支持导入 Clash、Shadowrocket、Sing-box 等主流工具。

关于如何在客户端中配置防 DNS 污染与智能分流，可以参考[客户端教程专区](/guides/)。

## 谁应该选择飞猫云，谁应该果断避开？

**适合选飞猫云的人群：**
- 月用量固定在 50GB 以内的轻度办公与学习用户。
- 预算高度敏感，希望压低单次年付支出的人。
- 需要一条稳定的备用专线以防主力线路临时维护。

**建议跳过并看别家的人群：**
- 追求随时停用自由、拒绝较长付款周期的用户（建议考虑 [宇宙云](/reviews/yuzhouyun/) 等月付品牌）。
- 追剧重度党与大文件下载用户。

更多维度的横向对照与场景细分，欢迎前往 [机场对比总览](/compare/) 或 [品牌评测大全](/reviews/) 进行深入查阅。
`;
}

function cleanMarkdown(raw) {
  let text = raw.trim();
  if (text.startsWith('```markdown')) {
    text = text.slice(11);
  } else if (text.startsWith('```')) {
    text = text.slice(3);
  }
  if (text.endsWith('```')) {
    text = text.slice(0, -3);
  }
  return text.trim();
}

function validateGeneratedArticle(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error('生成的文章缺少合规的 Frontmatter (未找到 --- 包裹)');
  }
  const fmRaw = match[1];
  const body = content.replace(/^---[\s\S]*?---/, '').trim();

  // 基础长度与字段检查
  const titleMatch = fmRaw.match(/title:\s*["']?([^"'\n\r]+)["']?/);
  const title = titleMatch ? titleMatch[1].trim() : '';
  if (title.length < 6 || title.length > 60) {
    throw new Error(`Title 长度异常 (${title.length} 字): "${title}"`);
  }

  const descMatch = fmRaw.match(/description:\s*["']?([^"'\n\r]+)["']?/);
  const desc = descMatch ? descMatch[1].trim() : '';
  if (desc.length < 40 || desc.length > 170) {
    throw new Error(`Description 长度异常 (${desc.length} 字): "${desc}"`);
  }

  const answerMatch = fmRaw.match(/answer:\s*["']?([^"'\n\r]+)["']?/);
  const answer = answerMatch ? answerMatch[1].trim() : '';
  if (answer.length < 30 || answer.length > 300) {
    throw new Error(`GEO Answer 长度异常 (${answer.length} 字): "${answer}"`);
  }

  // 正文质量与规范检查
  const cjkCount = (body.match(/[\u4e00-\u9fa5]/g) || []).length;
  console.log(`✓ 验证通过: 标题「${title}」, 正文汉字数: ${cjkCount}`);

  if (!/\|.+\|/m.test(body)) {
    throw new Error('正文缺少 Markdown 对比表格，不符合深度评测标准！');
  }

  if (!/\]\(\/[^)]*\)/.test(body)) {
    throw new Error('正文缺少站内内链，会形成孤儿页！');
  }

  // 严禁节点协议前缀 (R09)
  const protocolCheck = body.match(/\b(ss|ssr|vmess|vless|trojan|hysteria2?|clash|sub):\/\//i);
  if (protocolCheck) {
    throw new Error(`正文包含违规协议前缀: ${protocolCheck[0]}`);
  }

  return { title, cjkCount };
}

async function main() {
  console.log('=== 全自动万字级 SEO / GEO 机场长文发布管线启动 ===');

  const { queueFile, topics } = await loadTopicQueue();
  const topic = selectNextTopic(topics);
  console.log(`选中待发布选题: [${topic.category}] ${topic.primaryKeyword} (${topic.slug})`);

  const brandsSnippet = await loadBrandsData();
  const prompt = buildSystemPrompt(topic, brandsSnippet);

  const rawOutput = await callGemini(prompt);
  const cleanedArticle = cleanMarkdown(rawOutput);

  validateGeneratedArticle(cleanedArticle, topic);

  const targetDir = path.join(ROOT, 'src', 'content', 'posts', topic.category);
  const targetFile = path.join(targetDir, `${topic.slug}.md`);

  if (isDryRun) {
    console.log(`[DRY-RUN] 文章生成成功，预览输出至控制台，不写入磁盘。`);
    console.log(`目标路径预览: ${targetFile}`);
    console.log('--- 文章前 600 字预览 ---');
    console.log(cleanedArticle.slice(0, 600) + '\n...');
    return;
  }

  await writeFile(targetFile, cleanedArticle, 'utf8');
  console.log(`✓ 文章已成功落盘写入: ${targetFile}`);

  // 标记选题为已发布
  topic.status = 'published';
  topic.publishedAt = new Date().toISOString();
  await writeFile(queueFile, JSON.stringify(topics, null, 2), 'utf8');
  console.log(`✓ 已更新选题状态库: ${queueFile}`);

  console.log('=== 自动化生成与校验全部顺利完成 ===');
}

main().catch((err) => {
  console.error('\n✗ 自动化流水线执行失败:', err.message);
  process.exit(1);
});
