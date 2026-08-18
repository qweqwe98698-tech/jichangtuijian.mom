/**
 * 数据驱动页面的关键词归属登记。
 *
 * 文章的关键词写在 frontmatter 里,由 check-model 校验唯一性;
 * 但首页、栏目页、榜单页、目录页这些由数据生成的页面没有 frontmatter,
 * 于是它们承接的词一直游离在关键词账本之外——审计脚本看不见,也无法防止和文章互抢。
 *
 * 这份登记表把它们纳入同一套账本。新增数据驱动页面时必须在这里登记,
 * 否则 `check-model` 无法发现它与文章之间的关键词冲突。
 */

export interface PageKeywordEntry {
  /** 页面路径,必须以 / 开头结尾 */
  path: string;
  /** 唯一主词 */
  primary: string;
  /** 同意图次词。这些词不另建页面,由本页一并承接 */
  secondary: string[];
  /** 为什么这些词归这一页,而不是拆成多个页面 */
  rationale: string;
}

export const PAGE_KEYWORDS: PageKeywordEntry[] = [
  {
    path: '/',
    primary: '机场推荐',
    secondary: [
      '2026机场推荐',
      '机场推荐2026',
      '机场推荐排行',
      '好用的机场推荐',
      '代理机场推荐',
      '网络代理推荐',
    ],
    rationale:
      '「机场推荐」与带年份的变体是同一个意图:给我一份可信的推荐名单。首页就是这个意图的落点,拆成多页只会互抢。',
  },
  {
    path: '/airports/',
    primary: '机场导航',
    secondary: [
      '机场大全',
      '机场导航网站',
      '机场推荐网站',
      '机场收录',
      '机场索引',
      '机场汇总',
      '2026最新机场导航',
      '机场官网',
      '机场官网大全',
    ],
    rationale:
      '导航、大全、索引、汇总指的是同一种页面形态——一份可筛选的全量清单。「机场推荐网站」也归这里:用户搜它是想找一个收录站,而不是找单条推荐。',
  },
  {
    path: '/reviews/',
    primary: '机场评测',
    secondary: ['机场测评网站', '机场评测网站', '机场靠谱吗', '机场值得买吗'],
    rationale: '评测索引页承接「哪里能看到评测」这类意图,与单家品牌页的「<品牌>怎么样」不冲突。',
  },
  {
    path: '/compare/',
    primary: '机场对比',
    secondary: ['机场哪个好', '机场对比表', '机场横向对比'],
    rationale: '「哪个好」在没有指定品牌时就是要一张对照表,与两两对比页的「A和B哪个好」层级不同。',
  },
  {
    path: '/rankings/',
    primary: '机场排行榜',
    secondary: ['机场榜单', '机场排名'],
    rationale: '榜单索引页,下分场景榜。',
  },
  {
    path: '/rankings/cheap/',
    primary: '便宜机场推荐',
    secondary: ['低价机场', '机场多少钱', '最便宜的机场'],
    rationale: '预算优先意图的唯一落点。',
  },
  {
    path: '/rankings/value/',
    primary: '高性价比机场推荐',
    secondary: ['高性价比机场', '性价比机场', '机场性价比排行'],
    rationale: '「高性价比机场」与带「推荐」后缀的是同一意图。',
  },
  {
    path: '/rankings/stable/',
    primary: '稳定机场推荐',
    secondary: [
      '2026稳定机场推荐',
      '2026年值得关注的稳定机场',
      '2026年稳定机场评测',
      '晚高峰稳定机场',
    ],
    rationale:
      '带年份的稳定机场系列词全部指向同一份名单。单独建「2026 稳定机场评测」页会与本页争同一批查询。',
  },
  {
    path: '/rankings/iepl/',
    primary: 'IEPL机场推荐',
    secondary: ['IPLC机场推荐', '专线机场推荐', 'IEPL专线机场'],
    rationale:
      '本站收录的品牌中没有纯 IPLC 线路的服务,单独建 IPLC 榜会是一个空页面。两者同属企业专线意图,合并承接并在页内说明差别。',
  },
  {
    path: '/rankings/beginner/',
    primary: '新手机场推荐',
    secondary: ['小白机场推荐', '第一次买机场'],
    rationale: '新手意图的商业落点;概念解释在 /basics/,两者分工不同。',
  },
  {
    path: '/rankings/big-traffic/',
    primary: '大流量机场推荐',
    secondary: ['不限流量机场', '大流量套餐机场'],
    rationale: '流量优先意图的唯一落点。',
  },
  {
    path: '/rankings/chatgpt/',
    primary: 'ChatGPT机场推荐',
    secondary: ['AI工具机场推荐', 'Claude机场推荐', 'AI机场推荐', 'ChatGPT用什么机场'],
    rationale:
      '各家 AI 工具的选购意图高度重合——用户要的是"能用来跑 AI 的线路",不是逐个工具的独立名单。',
  },
  {
    path: '/rankings/streaming/',
    primary: '流媒体机场推荐',
    secondary: ['Netflix机场推荐', '奈飞机场推荐', '看剧机场推荐', 'Disney+机场推荐'],
    rationale: '同上:流媒体平台的选购意图重合,合并成一份名单并在页内按平台说明差异。',
  },
  {
    path: '/rankings/long-running/',
    primary: '老牌机场推荐',
    secondary: ['运营时间长的机场', '老机场推荐'],
    rationale: '运营历史优先意图。',
  },
  {
    path: '/rankings/unlimited-time/',
    primary: '不限时机场推荐',
    secondary: ['不限时套餐机场', '机场不限时套餐', '一次性付费机场', '不限时流量包'],
    rationale: '不限时套餐是一种独立的计费形态,与月付/年付的决策逻辑完全不同,值得单独一份名单。',
  },
  {
    path: '/guides/',
    primary: '客户端教程',
    secondary: ['机场客户端', '代理客户端教程'],
    rationale: '教程索引页。',
  },
  {
    path: '/protocols/',
    primary: '代理协议',
    secondary: ['机场协议', '代理协议对比'],
    rationale: '协议知识索引页。',
  },
  {
    path: '/troubleshooting/',
    primary: '机场故障排查',
    secondary: ['机场连不上怎么办', '代理连不上'],
    rationale: '排障索引页。',
  },
  {
    path: '/free-nodes/',
    primary: '免费节点',
    secondary: ['免费机场', '免费节点安全吗', '白嫖节点'],
    rationale: '本栏目只做风险教育、不做节点分发,因此这些词的落点是同一组安全说明,不需要分页。',
  },
  {
    path: '/unlock/',
    primary: '流媒体解锁',
    secondary: ['AI工具访问', '地区限制解锁'],
    rationale: '解锁知识索引页。',
  },
  {
    path: '/risk/',
    primary: '机场避坑指南',
    secondary: ['机场跑路', '机场风险', '机场避雷'],
    rationale:
      '「机场跑路」这个泛词的意图是"怎么避免踩坑",落点就是本栏目;具体的征兆识别由 /risk/exit-scam-signs/ 承接。',
  },
  {
    path: '/basics/',
    primary: '机场代理',
    secondary: ['代理机场', '机场代理是什么', '机场代理怎么用'],
    rationale:
      '「机场代理」与「代理机场」只是词序变体,是同一个查询。本栏目作为机场代理入门的总入口承接它,下分概念、协议、订阅等 cluster。',
  },
];

export const pageKeywords = (path: string): PageKeywordEntry | undefined =>
  PAGE_KEYWORDS.find((p) => p.path === path);

/** 全部数据驱动页面认领的词,供关键词账本去重 */
export const allPageKeywords = (): string[] =>
  PAGE_KEYWORDS.flatMap((p) => [p.primary, ...p.secondary]);
