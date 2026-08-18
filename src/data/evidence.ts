// import 属性是 Node 加载 JSON 的硬要求;Vite 也接受,加上它构建期脚本才能直接引用本模块
import registry from './evidence/speedtest-assets.json' with { type: 'json' };

/**
 * 测速证据层。
 *
 * 这一层存在的唯一目的:让每一条对外展示的实测信息都能追溯到具体文件、具体哈希、具体时间,
 * 并且明确写出它**能证明什么**与**不能证明什么**。
 *
 * 核心事实(2026-08-11 批次):
 *   - 16 张截图,每张 1122×1402,SHA-256 互不相同,与 manifest 一一对应
 *   - 14 张 Shadowsocks / 2 张 VLESS;14 张 MAI-TEST-BOT 2.0.0-dev / 2 张主端 4.3.3 + 喵速 4.7.0
 *   - 测试时间从 00:21 到 22:46 分散在一天内,不同品牌不在同一时刻测试
 *
 * 因此这批证据**不能**支撑跨品牌的速度或稳定性排名。它只能证明
 * 「某品牌在截图所示的时间与条件下发生过一次节点测速,并得到图中的结果」。
 */

export type DataStatus =
  | 'verified'
  | 'measured'
  | 'vendor'
  | 'commercial'
  | 'editorial'
  | 'unverified'
  | 'mock'
  | 'expired';

export type ReviewStatus = 'review-required' | 'approved' | 'rejected' | 'superseded';

export interface SpeedtestAsset {
  /** 品牌显示名,与 manifest 一致 */
  brand: string;
  /** 原始文件名 */
  file: string;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
  /** ISO 8601,含 +08:00 时区偏移 */
  testedAt: string;
  /** 截图中显示的协议,不代表该品牌所有节点都用这个协议 */
  protocolDisplayed: string;
  toolFamily: string;
  /** visible-in-image 表示完整日期在图中可见;否则需人工复核原始记录 */
  dateConfidence: string;
  reviewNote: string | null;
}

export interface SpeedtestBatch {
  batchId: string;
  measurementDate: string;
  measurementTimezone: string;
  dataStatus: DataStatus;
  reviewStatus: ReviewStatus;
  commonLimitations: string[];
  auditedAt: string | null;
  assets: SpeedtestAsset[];
}

export const SPEEDTEST_BATCH = registry as unknown as SpeedtestBatch;

/** 原图的公开访问路径。原图只读保存,不裁剪、不覆盖、不改写图内数值 */
export const originalPath = (asset: SpeedtestAsset): string =>
  `/evidence/speedtest/${SPEEDTEST_BATCH.measurementDate}/${asset.file}`;

/** 批次说明文件,供读者自行核对 */
export const BATCH_DOCS = {
  readme: `/evidence/speedtest/${SPEEDTEST_BATCH.measurementDate}/README_16个机场测速实测资料_最新版.txt`,
  manifest: `/evidence/speedtest/${SPEEDTEST_BATCH.measurementDate}/speedtest-manifest.json`,
} as const;

const BRAND_NAME_TO_SLUG: Record<string, string> = {
  光速云: 'guangsuyun',
  星岛梦: 'xingdaomeng',
  灵猫网络: 'lingmao',
  飞猫云: 'feimaoyun',
  唯兔云: 'weituyun',
  宇宙云: 'yuzhouyun',
  U1S1: 'u1s1',
  极连云: 'jilianyun',
  光年梯: 'guangnianti',
  一翻云: 'yifanyun',
  二猫云: 'ermaoyun',
  SOGO云: 'sogoyun',
  可信云: 'kexinyun',
  速界: 'sujie',
  快狸: 'kuaili',
  全球云: 'quanqiuyun',
};

/** manifest 里的品牌名有 "SOGO云" / "SOGO 云" 空格差异,这里统一后再映射,但不改变对外显示名 */
export const assetForBrand = (slug: string): SpeedtestAsset | undefined =>
  SPEEDTEST_BATCH.assets.find((a) => BRAND_NAME_TO_SLUG[a.brand.replace(/\s+/g, '')] === slug);

/**
 * 逐张审核决定。
 *
 * 指令要求 approved 的定义是「已**人工**核对原始证据、字段、图注、限制和页面表达」,
 * 因此这份记录只能由人来改,不能由构建流程自动推导。
 *
 * 做成逐张而不是整批,是因为可信云的完整日期无法从图中确认——
 * 整批一刀切会让另外 15 张陪着一起挡住,或者让它跟着一起放出去,两种都不对。
 *
 * 改这里时请同时更新 reviewedBy / reviewedAt,并在 docs/EVIDENCE-REVIEW.md 记录依据。
 */
export interface ReviewDecision {
  status: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  note?: string;
}

/** 本轮复核的执行者与日期,写在一处,避免 16 行各写各的造成不一致 */
const REVIEW = { reviewedBy: '站长', reviewedAt: '2026-08-18' } as const;

export const REVIEW_DECISIONS: Record<string, ReviewDecision> = {
  // 2026-08-18 复核放行:日期在图中可见,图注、alt、允许/禁止声明清单与页面表达已逐项确认
  guangsuyun: { status: 'approved', ...REVIEW },
  xingdaomeng: { status: 'approved', ...REVIEW },
  lingmao: { status: 'approved', ...REVIEW },
  feimaoyun: { status: 'approved', ...REVIEW },
  weituyun: { status: 'approved', ...REVIEW },
  yuzhouyun: { status: 'approved', ...REVIEW },
  u1s1: { status: 'approved', ...REVIEW },
  jilianyun: { status: 'approved', ...REVIEW },
  guangnianti: { status: 'approved', ...REVIEW },
  yifanyun: { status: 'approved', ...REVIEW },
  ermaoyun: { status: 'approved', ...REVIEW },
  sogoyun: { status: 'approved', ...REVIEW },
  sujie: { status: 'approved', ...REVIEW },
  kuaili: { status: 'approved', ...REVIEW },
  quanqiuyun: { status: 'approved', ...REVIEW },

  // 可信云保持挡住:完整日历日期未在图中显示,由批次时间推断。
  // 注意 isApproved 的日期条件是硬的——把这里改成 approved 也不会放行。
  kexinyun: {
    status: 'review-required',
    reviewedBy: null,
    reviewedAt: null,
    note: '完整日期未在图中清晰显示,需核对原始测试记录后才能放行。其余 15 张已于 2026-08-18 放行,这张单独保留。',
  },
};

/**
 * 单张证据是否可以对外展示。
 *
 * 两个条件必须同时满足:人工审核通过,且完整日期在图中可见。
 * 后者是硬条件——手工把 kexinyun 改成 approved 也不会放行,因为日期仍然存疑。
 */
export const isApproved = (asset: SpeedtestAsset): boolean => {
  const slug = BRAND_NAME_TO_SLUG[asset.brand.replace(/\s+/g, '')];
  const decision = slug ? REVIEW_DECISIONS[slug] : undefined;
  return decision?.status === 'approved' && asset.dateConfidence === 'visible-in-image';
};

/** 当前有多少张已放行,用于页面上如实说明进度 */
export const approvedCount = (): number => SPEEDTEST_BATCH.assets.filter(isApproved).length;

/** 该批次能证明什么 —— 页面上必须与证据同屏展示 */
export const ALLOWED_CLAIMS = [
  '该品牌在截图所示的时间点发生过一次节点测速,并得到图中显示的结果。',
  '截图中显示的协议为 Shadowsocks 或 VLESS;这只反映本次测试所选节点,不代表该品牌全部节点。',
  '同一张图内可能同时存在速度较高的节点、0B 节点和延迟异常的节点,差异是原始结果的一部分。',
  '不同品牌的测试时间、测试工具与测试界面并不完全一致。',
] as const;

/**
 * 该批次不能证明什么 —— 必须与证据同屏展示,防止读者过度解读。
 *
 * 这 9 条逐条对应 README §五「不能由这些图片证明的事项」与指令 §八「禁止写」清单,
 * 不是概括,是覆盖。第 7–9 条尤其容易在写作时被无意中违反:
 * 单位换算错一个字母,数值就凭空放大 8 倍,而且读起来完全正常。
 */
export const PROHIBITED_CLAIMS = [
  '不能证明长期稳定,也不能证明晚高峰始终保持截图中的速度。',
  '不能据此宣称某家是 16 家中最快、最稳定,或必然适合所有用户。',
  '不能证明 ChatGPT、Claude、Gemini、Netflix、Disney+、YouTube 等服务可以解锁——本批次根本没有测这些。',
  '不能证明节点使用 IEPL、IPLC、原生 IP、住宅 IP 或任何特定落地线路;线路属性需要独立来源。',
  '不能证明机场没有跑路、失联、限速、审计、隐私或退款风险。',
  '不能把不同工具、不同协议、不同时间的结果合并成一个总分或排行榜。',
  '不能说「所有节点都能满速」——同一张图里就同时存在高速节点、0B 节点和异常延迟节点。',
  '不能把图中的 MB、KB 直接当作 MB/s 或 Mbps。单位含义未在图中明确定义,任何换算都是编造。',
  '不能把厂商宣传、套餐资料或编辑判断写成本站实测——这三类信息在数据层里是分开存的,展示时也必须分开。',
] as const;

/** 统一图注。任何展示原图或衍生图的位置都必须带上 */
export const captionFor = (asset: SpeedtestAsset): string => {
  const t = asset.testedAt.replace('T', ' ').replace('+08:00', '');
  return `测试时间:${t}(CST)。本图记录当次测试环境下的节点延迟与吞吐结果,仅代表该时间点和测试线路,不代表长期表现、所有用户体验、AI/流媒体解锁或未来表现。`;
};

/** 图片 alt。不把所有数值塞进 alt,详细数据通过正文与可访问摘要提供 */
export const altFor = (asset: SpeedtestAsset): string =>
  `${asset.brand} ${SPEEDTEST_BATCH.measurementDate} 节点测速截图,包含节点地区、协议、延迟和速度结果。`;
