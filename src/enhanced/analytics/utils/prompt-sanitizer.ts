/**
 * Prompt 脱敏工具
 * 对 prompt_text 做哈希 + 截断，防止原始用户输入直接上报
 * @version 1.0.0
 */

const MAX_PROMPT_LENGTH = 50;
const HASH_PREFIX_LENGTH = 8;

/**
 * 简单 SHA-256 前 8 位哈希（浏览器兼容）
 * 非密码学安全，仅用于脱敏标识
 */
function simpleHash(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  return hex.slice(0, HASH_PREFIX_LENGTH);
}

/**
 * 对 prompt 文本做脱敏处理
 * 规则：SHA-256 前 8 位哈希 + 长度截断到 50 字符
 * @param prompt 原始 prompt 文本
 * @returns 脱敏后的字符串，格式：`[hash:xxxxxxx]...截断文本`
 */
export function sanitizePrompt(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') {
    return '';
  }
  const hash = simpleHash(prompt);
  const truncated = prompt.length > MAX_PROMPT_LENGTH
    ? prompt.slice(0, MAX_PROMPT_LENGTH) + '…'
    : prompt;
  return `[hash:${hash}]${truncated}`;
}

/**
 * 判断字符串是否已脱敏（防止重复处理）
 */
export function isSanitizedPrompt(value: string): boolean {
  return typeof value === 'string' && /^\[hash:[0-9a-f]{8}\]/.test(value);
}
