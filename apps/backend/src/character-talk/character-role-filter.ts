/**
 * Character role filtering for Character Talk and Character Match.
 * Whitelist + Blacklist approach: whitelist takes priority.
 *
 * - If role matches whitelist → INCLUDE (even if blacklist also matches, e.g. "敵役/母親" → "敵役" hits whitelist)
 * - If role matches blacklist → EXCLUDE
 * - If role matches neither → EXCLUDE (unknown roles are treated as minor)
 */

/** Roles that indicate a major/talkable character (partial match) */
const MAIN_ROLE_WHITELIST = [
  '主人公', '主役',
  'ヒロイン', 'ヒーロー',
  '仲間', '相棒', '幼馴染', '親友', '友人',
  'ライバル', '好敵手',
  'メンター', '師匠', '先輩',
  '恋人', '恋愛対象', '元恋人',
  '語り手', '狂言回し',
  '敵役', 'ラスボス', '黒幕', '悪役',
  '主要', '重要人物',
];

/** Roles that indicate a minor/background character (partial match) */
const MINOR_ROLE_BLACKLIST = [
  '脇役', 'モブ', 'エキストラ',
  '背景', 'NPC',
  'その他', '不明',
];

/**
 * Returns true if the character role is considered "main" enough for talk features.
 */
export function isMainCharacterRole(role: string): boolean {
  // Whitelist check first (takes priority)
  if (MAIN_ROLE_WHITELIST.some((w) => role.includes(w))) {
    return true;
  }
  // Blacklist check
  if (MINOR_ROLE_BLACKLIST.some((b) => role.includes(b))) {
    return false;
  }
  // Neither → exclude (unknown free-text roles like "門番", "母", "ギルドの職員")
  return false;
}

/** Spoiler roles — used by Character Match (未読ユーザー向け) to hide story-revealing characters */
export const SPOILER_ROLES = ['黒幕', '裏切り者', '真犯人', 'ラスボス', '敵役', '悪役'];

/**
 * Filter for Character Match (popup / carousel for potentially unread users).
 * Excludes both minor roles AND spoiler roles.
 */
/**
 * Name patterns that indicate a minor/family character (partial match).
 * Catches cases where role is "仲間" but name is "柊の父" etc.
 */
/** Partial match: name contains these → exclude */
const MINOR_NAME_PATTERNS = [
  'の父', 'の母', 'の父親', 'の母親',
  'の妹', 'の兄', 'の姉', 'の弟',
  'の祖父', 'の祖母',
  'の妻', 'の夫',
  'の息子', 'の娘',
  'の友人', 'の友達', 'の恩師',
  'の両親', 'の親',
  '（複数）', '（名前不明）', '（名前不詳）',
  'たち（',
];

/** Exact match: name is exactly one of these → exclude */
const MINOR_NAME_EXACT = [
  '母さん', '父さん', '姉さん', '兄さん',
  '母', '父', '姉', '妹', '兄', '弟',
  '母親', '父親',
  '友達', '友人', '担任', '担任教師',
  '教師', '校長先生', '教頭先生',
  '門番', '店主', '警備員',
  '少女', '少年', '王', '王子', '神様',
  '私', '主人公', 'わたし',
  '課長', '社長', '会長',
  '読者',
];

/** Partial match for group/concept names → exclude */
const GROUP_NAME_PATTERNS = [
  '友人A', '友人B', '友人C',
  'たち', 'の人々', '（複数', '（集団',
];

/** Returns true if the character name suggests a minor/family/group role */
export function isMinorCharacterName(name: string): boolean {
  if (MINOR_NAME_EXACT.includes(name)) return true;
  if (MINOR_NAME_PATTERNS.some((p) => name.includes(p))) return true;
  // Group names: only match if the ENTIRE name is a group pattern (avoid false positives)
  if (GROUP_NAME_PATTERNS.some((p) => name.includes(p)) && name.length <= 15) return true;
  // Names like "主人公（あたし）", "私（主人公）", "僕（主人公）"
  if (/^(主人公|私|僕|わたし)[（(]/.test(name)) return true;
  if (/[）)]$/.test(name) && /主人公/.test(name) && !/[ァ-ヶぁ-ん]{2,}/.test(name.replace(/主人公|[（()）]/g, ''))) return true;
  return false;
}

/**
 * Filter for Character Match (popup / carousel for potentially unread users).
 * Excludes minor roles, spoiler roles, AND minor-sounding names.
 */
export function isCharacterMatchSafe(role: string, name?: string): boolean {
  if (!isMainCharacterRole(role)) return false;
  if (SPOILER_ROLES.some((sr) => role.includes(sr))) return false;
  if (name && isMinorCharacterName(name)) return false;
  return true;
}
