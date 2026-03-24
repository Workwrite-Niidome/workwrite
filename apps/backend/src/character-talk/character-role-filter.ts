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
export function isCharacterMatchSafe(role: string): boolean {
  if (!isMainCharacterRole(role)) return false;
  if (SPOILER_ROLES.some((sr) => role.includes(sr))) return false;
  return true;
}
