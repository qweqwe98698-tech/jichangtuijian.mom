/**
 * 全站统一状态语言(第三阶段 T6)。
 *
 * 指令要求所有图表与证据组件使用同一套状态词汇,并且**视觉不得扩大证据含义**。
 * 这份表是唯一定义处:任何组件想表达"这条信息可靠到什么程度",都必须从这里取值,
 * 不能自己发明一个绿色对勾。
 *
 * 最关键的一条:**没有绿色的 Operational**。
 * 指令 §T6 红线第 7 条明确禁止「用绿色 Operational/Stable Badge 代替真实测试结论」——
 * 本站尚未做过任何可用性测试,给不出"正常运行"这种结论。
 * 因此 measured 是本表里唯一的成功色,而它只用于本站真实测过的东西。
 */

export type StatusKey =
  | 'measured'
  | 'vendor'
  | 'editorial'
  | 'commercial'
  | 'not-tested'
  | 'review-required'
  | 'partial'
  | 'unavailable'
  | 'expired'
  | 'unstated';

export interface StatusMeta {
  /** 展示文字,中文优先 */
  label: string;
  /** 英文短标,用于等宽小标签 */
  code: string;
  /** 悬停解释:这个状态到底意味着什么 */
  title: string;
  /** 视觉色槽,对应 CSS 里的 --status-* */
  tone: 'ok' | 'claim' | 'neutral' | 'hold' | 'warn' | 'bad';
}

export const STATUS: Record<StatusKey, StatusMeta> = {
  measured: {
    label: '本站实测',
    code: 'MEASURED',
    title: '本站在真实网络环境中测试并可复现的结果,附测试时间与条件',
    tone: 'ok',
  },
  vendor: {
    label: '厂商声明',
    code: 'VENDOR',
    title: '来自品牌公开资料的说法,本站未验证。声明不等于事实',
    tone: 'claim',
  },
  editorial: {
    label: '编辑判断',
    code: 'EDITORIAL',
    title: '本站基于公开字段推导的判断,依据与算法公开在编辑与评测规范',
    tone: 'neutral',
  },
  commercial: {
    label: '商业信息',
    code: 'SPONSORED',
    title: '优惠、推广链接与合作关系,已按要求披露',
    tone: 'neutral',
  },
  'not-tested': {
    label: '未测试',
    code: 'NOT TESTED',
    title: '本站没有对这一项做过测试,因此既不能说支持,也不能说不支持',
    tone: 'neutral',
  },
  'review-required': {
    label: '待复核',
    code: 'REVIEW',
    title: '素材已采集但尚未通过发布审核,页面上暂不展示具体内容',
    tone: 'hold',
  },
  partial: {
    label: '部分可用',
    code: 'PARTIAL',
    title: '仅在部分条件下成立,适用范围有限制',
    tone: 'warn',
  },
  unavailable: {
    label: '不可用',
    code: 'UNAVAILABLE',
    title: '经测试确认在当前条件下不可用',
    tone: 'bad',
  },
  expired: {
    label: '已过期',
    code: 'EXPIRED',
    title: '超过复查周期,不能继续作为当前结论',
    tone: 'warn',
  },
  unstated: {
    label: '未标明',
    code: 'UNSTATED',
    title: '厂商公开资料没有提及这一项。未标明是信息缺口,不代表不支持',
    tone: 'neutral',
  },
};

/**
 * AI 与流媒体可用性矩阵的服务清单。
 *
 * 红线第 1 条:本批测速证据**根本没有测过解锁**,因此本站实测状态一律 not-tested。
 * 厂商是否声明覆盖某个场景,是另一层信息,必须分开展示 —— 合并就会变成
 * 「厂商说能用」被读成「测过能用」。
 */
export const AVAILABILITY_SERVICES = [
  { key: 'chatgpt', name: 'ChatGPT', group: 'AI 工具' },
  { key: 'claude', name: 'Claude', group: 'AI 工具' },
  { key: 'gemini', name: 'Gemini', group: 'AI 工具' },
  { key: 'netflix', name: 'Netflix', group: '流媒体' },
  { key: 'disney', name: 'Disney+', group: '流媒体' },
  { key: 'youtube', name: 'YouTube', group: '流媒体' },
] as const;

export type ServiceKey = (typeof AVAILABILITY_SERVICES)[number]['key'];

/** 这些标签必须有独立技术证据才能出现;本站没有,因此全站禁用(红线第 4 条) */
export const FORBIDDEN_TOPOLOGY_LABELS = [
  '不经公网 GFW',
  '隐藏真实 IP',
  '防 QoS',
  '原生 IP 解锁',
  '抗封锁',
  '永不掉线',
] as const;
