# 品牌 URL 映射表(BRAND-URL-MAP)

生成时间:2026-08-18
生成方式:`node scripts/gen-brand-maps.mjs`

---

## 决策:沿用 `/reviews/`,不另建 `/brands/`

指令 T3.2 要求「每家品牌只建立一个主页面,优先沿用 `/brands/<brand-slug>/` 或已确认 URL」。

本站在第一、二阶段已经建立并收录了 `/reviews/<slug>/`,16 个 URL 全部存在且已进入 sitemap 与内链体系。
**另建 `/brands/` 会与之竞争同一批关键词**,违反指令 §十三红线第 13 条(不创建与第二阶段品牌页竞争的新 URL)。

因此:品牌库页面(T4)链接到现有的 `/reviews/<slug>/`,不产生第二套品牌详情 URL。

---

## 16 个品牌主页面

| 品牌     | slug          | URL                     | 主关键词       | 入门价  | 计价口径 |
| -------- | ------------- | ----------------------- | -------------- | ------- | -------- |
| 光速云   | `guangsuyun`  | `/reviews/guangsuyun/`  | 光速云怎么样   | 7.5 元  | 年付折算 |
| 星岛梦   | `xingdaomeng` | `/reviews/xingdaomeng/` | 星岛梦怎么样   | 8 元    | 年付折算 |
| 灵猫网络 | `lingmao`     | `/reviews/lingmao/`     | 灵猫网络怎么样 | 19 元   | 月付     |
| 飞猫云   | `feimaoyun`   | `/reviews/feimaoyun/`   | 飞猫云怎么样   | 7 元    | 年付折算 |
| 唯兔云   | `weituyun`    | `/reviews/weituyun/`    | 唯兔云怎么样   | 14.9 元 | 月付     |
| 宇宙云   | `yuzhouyun`   | `/reviews/yuzhouyun/`   | 宇宙云怎么样   | 14.9 元 | 月付     |
| U1S1     | `u1s1`        | `/reviews/u1s1/`        | U1S1怎么样     | 20 元   | 月付     |
| 极连云   | `jilianyun`   | `/reviews/jilianyun/`   | 极连云怎么样   | 18 元   | 月付     |
| 光年梯   | `guangnianti` | `/reviews/guangnianti/` | 光年梯怎么样   | 18 元   | 月付     |
| 一翻云   | `yifanyun`    | `/reviews/yifanyun/`    | 一翻云怎么样   | 20 元   | 月付     |
| 二猫云   | `ermaoyun`    | `/reviews/ermaoyun/`    | 二猫云怎么样   | 20 元   | 月付     |
| SOGO 云  | `sogoyun`     | `/reviews/sogoyun/`     | SOGO 云怎么样  | 25 元   | 月付     |
| 可信云   | `kexinyun`    | `/reviews/kexinyun/`    | 可信云怎么样   | 25 元   | 月付     |
| 速界     | `sujie`       | `/reviews/sujie/`       | 速界怎么样     | 25 元   | 月付     |
| 快狸     | `kuaili`      | `/reviews/kuaili/`      | 快狸怎么样     | 25 元   | 月付     |
| 全球云   | `quanqiuyun`  | `/reviews/quanqiuyun/`  | 全球云怎么样   | 20 元   | 月付     |

---

## 相关 URL 命名空间

| 命名空间               | 用途                   | 与品牌页的关系                                |
| ---------------------- | ---------------------- | --------------------------------------------- |
| `/reviews/`            | 品牌评测索引           | 品牌页的上游入口                              |
| `/reviews/<slug>/`     | **品牌主页面(唯一)**   | —                                             |
| `/compare/<a>-vs-<b>/` | 两两对比,slug 按字典序 | 下游;每个品牌至少被 2 个对比页链接            |
| `/rankings/<scene>/`   | 场景榜单               | 上游;按客观字段筛选,**不按总分排序**          |
| `/airports/`           | 品牌库(T4 待建)        | 上游;链接到 `/reviews/<slug>/`,不重复建详情页 |

---

## 证据资源路径

| 资源          | 路径                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| 原图(只读)    | `/evidence/speedtest/2026-08-11/<品牌>-节点测速实测.png`                |
| 批次说明      | `/evidence/speedtest/2026-08-11/README_16个机场测速实测资料_最新版.txt` |
| 机读 manifest | `/evidence/speedtest/2026-08-11/speedtest-manifest.json`                |

原图只读保存,不裁剪、不覆盖、不改写图内数值。衍生图由 `astro:assets` 从
`src/assets/evidence/speedtest/` 生成,必须标注 Derived View 并可追溯到原图 SHA-256。
