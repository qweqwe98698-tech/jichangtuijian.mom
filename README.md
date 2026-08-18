# 机场实测室 · jichangtuijian.mom

中文垂直内容站:机场(代理服务)推荐与评测、客户端教程、代理协议知识、流媒体与 AI 工具访问、免费节点安全教育、机场风险预警。

全站静态生成,默认零 JavaScript,面向 SEO 与生成式搜索(GEO)设计。

---

## 快速开始

本机的 Node 与 pnpm 装在 `C:\Program Files\nodejs\` 与 `%APPDATA%\npm\`,但新开的 PowerShell 进程 PATH 里没有它们。每个新终端先执行一次:

```bash
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
```

之后:

```bash
pnpm install
```

开发服务器(pnpm 的 shim 有时不稳,直接调 astro 入口最可靠):

```bash
node node_modules/astro/bin/astro.mjs dev
```

生产构建(含 Pagefind 搜索索引):

```bash
pnpm build
```

---

## 全站检查

提交前跑一遍完整链路。任何一项失败都会以非零退出码中断。

```bash
pnpm check:all
```

它依次执行:

| 命令                                  | 作用                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm check:model`                    | 内容模型完整性:pillar 跨栏目、slug 冲突、relatedSlugs 下限、主关键词唯一归属       |
| `pnpm check:manifest <manifest.json>` | 批量扩展专用:逐篇比对落盘文件与冻结清单,抓结构漂移(见下)                           |
| `pnpm typecheck`                      | `astro check`,覆盖 `.astro` 与 `.ts`                                               |
| `pnpm lint`                           | ESLint                                                                             |
| `pnpm test`                           | Vitest 单元测试                                                                    |
| `pnpm build`                          | 静态构建 + Pagefind 索引                                                           |
| `pnpm check:links`                    | 死链、死胡同、孤儿页(扫 `dist`)                                                    |
| `pnpm check:content`                  | 推广链接 rel 合规、免费节点栏目净化、知识栏目禁品牌卡、noindex 隔离、每页 SEO 底线 |

**`astro check` 需要 TypeScript 6.x。** TypeScript 7(原生编译器)尚未提供 `astro check` 依赖的程序化 API,升级会导致 typecheck 直接失败。

---

## 目录结构

```
src/
├─ config/site.ts          站点元数据唯一来源(canonical / JSON-LD / OG / sitemap 都从这里取)
├─ content.config.ts       Zod 内容模型 + 栏目定义 + 栏目文案
├─ data/
│  ├─ brands.ts            16 家品牌四层数据(见下)
│  └─ rankings.ts          9 个场景榜单的筛选口径与 counterpoint
├─ lib/
│  ├─ schema.ts            JSON-LD 构造器(按页面类型分配,不全站堆砌)
│  ├─ scoring.ts           编辑评分算法
│  ├─ compare.ts           两两对比的逐项判定与场景判定
│  ├─ content.ts           内容查询 + URL 规则(URL 契约的唯一实现处)
│  └─ text.ts              阅读时长、字数、slug 等
├─ components/             组件库,默认零 JS
├─ layouts/BaseLayout.astro
├─ pages/                  路由
└─ styles/
   ├─ tokens.css           设计 token(浅色/深色/跟随系统三态)
   ├─ components.css       组件样式
   └─ global.css           入口,接入 Tailwind 并把 token 暴露给工具类
```

---

## 品牌数据的四层结构

`src/data/brands.ts` 把每家机场的信息严格分四层存放。这是全站可信度的结构性保障:

| 层           | 内容                                          | 页面上的呈现                                                |
| ------------ | --------------------------------------------- | ----------------------------------------------------------- |
| `vendor`     | 厂商公开资料:价格、流量、协议、线路、能力声明 | 标注「厂商声明」                                            |
| `measured`   | 本站实测结果                                  | 标注「本站实测」;`status !== 'done'` 时页面显式说明尚未实测 |
| `commercial` | 优惠码、活动、推广链接、支付方式              | 附合作披露                                                  |
| `editorial`  | 适合人群、优缺点、定位、可比品牌              | 编辑判断                                                    |

**关键约束:`vendor.claims` 的取值只能是 `vendor-claim` / `unknown`,永远不会自动变成 `measured`。** 这样「厂商说支持 AI」不会在任何环节被升级成「本站实测支持」。单元测试对此有断言。

**补充真实实测数据时,只需要更新 `measured` 层**,所有页面自动生效,不需要改动任何文章。

当前状态:16 家的 `measured.status` 全部为 `pending`,流媒体与 AI 能力全部是厂商声明。

---

## 评分算法

`src/lib/scoring.ts`。五个维度加权:流量性价比 30%、线路等级 25%、运营时长 15%、客户端友好度 15%、场景覆盖 15%。

全部输入都是公开字段,没有人工调分入口——任何人拿同一份数据都能算出同一个分。完整口径公开在 `/editorial-policy/`,那一页的数字由代码实时算出,不会与算法脱节。

`src/lib/rubric-examples.test.ts` 锁定了规范页正文中提到的具体数值。**品牌调价会让这个测试失败,那是提醒去同步更新那一页的信号,不是 bug。**

---

## 内容模型

文章与专题的 Frontmatter 由 `src/content.config.ts` 的 Zod schema 强校验。几个非显然的字段:

- `answer` — 结论先行段,30–300 字,必须不依赖上下文即可独立成立(供生成式搜索摘录)
- `nextStep` — **必填**。全站最高原则是「每个页面既解决一个问题,也为用户准备好最合理的下一步」,该字段把这条原则变成 schema 级约束
- `pillar` — 专题归属。**必须与 `category` 同栏目**,否则会产出无法访问的 URL,`check:model` 会拦下
- `primaryKeyword` — 全站唯一,防止同类页面自相蚕食

URL 规则只在 `src/lib/content.ts` 的 `postUrl` / `pillarUrl` 实现一次,页面不得自行拼接。

---

## JavaScript 边界

默认零 JS。只有四处允许水合,且都在未执行 JS 时保持可用:

1. 站内搜索(Pagefind,`/search/`)
2. 深浅色切换(`ThemeToggle.astro`,未水合时按系统配色渲染)
3. 移动端导航(原生 `<details>`,本身就不需要 JS)
4. 对比表排序(`CompareTable.astro`,未水合时表格仍是完整可读的静态 HTML)

新增交互前先确认它是否真的需要 JS。FAQ 折叠用原生 `<details>`,主题切换的首帧套用用 `<head>` 里一段 4 行的内联脚本。

---

## 部署到 Cloudflare Pages

静态输出,无需适配器。

**构建设置**

| 项                     | 值                                 |
| ---------------------- | ---------------------------------- |
| Framework preset       | Astro                              |
| Build command          | `pnpm build`                       |
| Build output directory | `dist`                             |
| Node version           | 20 或更高(环境变量 `NODE_VERSION`) |

**注意事项**

- `public/_headers` 已配置缓存与安全头:`/_astro/*` 永久缓存,HTML 走 `s-maxage=3600` + `stale-while-revalidate`,便于价格更新较快对外可见。
- 首次部署后在 Cloudflare 控制台把自定义域绑到 `jichangtuijian.mom`,并确认 `src/config/site.ts` 里的 `SITE_URL` 与之一致——它是 canonical、sitemap、JSON-LD 的基准,改动会影响已收录 URL。
- 部署完成后向 Google Search Console 与 Bing Webmaster Tools 提交 `https://jichangtuijian.mom/sitemap-index.xml`。

---

## 后续维护入口

| 场景          | 改哪里                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------- |
| 价格/套餐变动 | `src/data/brands.ts` 的 `vendor.pricing`。会连带影响评分与所有榜单排序                   |
| 补充实测数据  | `src/data/brands.ts` 的 `measured`,把 `status` 改为 `done`                               |
| 新增榜单      | `src/data/rankings.ts` 追加一项,`counterpoint` 必填                                      |
| 新增文章      | `src/content/posts/<category>/<slug>.md`,跑 `pnpm check:model` 验证                      |
| 调整评分权重  | `src/lib/scoring.ts` 的 `WEIGHTS` 与 `SCORING_RUBRIC`,并在 `/editorial-policy/` 记录变更 |
| 改导航        | `src/config/site.ts` 的 `NAV`                                                            |

规模化扩展内容前先读 `docs/IA-CONTRACT.json` —— 里面是 URL 契约、页面模板规范与 R01–R16 内链规则的完整定义。

---

## 批量扩展内容的正确姿势

多个写作者(人或智能体)并行产出文章时,**不要让他们各自决定 slug、栏目与专题归属**。实践中这会造成两类难以事后发现的损坏:

- 不同专题撞出同名文件,后写的直接覆盖先写的(内容永久丢失)
- 文章的 `category` 与 `pillar` 不在同一栏目,产出 `/basics/connection-failed/xxx/` 这种无法访问的 URL

正确流程是**先冻结结构,再写正文**:

```bash
# 1. 由选题规划生成冻结清单:slug 唯一化、栏目/专题归属校正、
#    主关键词去重、nextStep 可达性校验,全部在这一步完成
node scripts/build-manifest.mjs <选题规划.json> <清单.json>

# 2. 写作者只按清单里的 file 路径写正文,frontmatter 的结构字段原样照抄

# 3. 逐篇比对落盘文件与清单,任何结构字段被改动都会报错
node scripts/check-manifest.mjs <清单.json>
```

`build-manifest.mjs` 里的几个常量需要按当轮情况调整:`CLIENT_PILLARS`(哪些专题的文章一律留在本栏目)、`DROP`(审计判定要删的选题)、`KEYWORD_OVERRIDE`(需要改写主词以解自相蚕食的选题)。
