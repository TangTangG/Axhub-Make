export interface PromptCardSkill {
  id: string;
  label: string;
  description: string;
  prompt: string;
}

export interface PromptCardSkillTrigger {
  query: string;
  start: number;
  end: number;
}

export interface PromptCardSkillSavePayload {
  note: string;
  skillIds: string[];
}

export const PROMPT_CARD_SKILLS: readonly PromptCardSkill[] = [
  {
    id: 'compare-options',
    label: '多方案对比',
    description: '先比较多个修改方案，再选最合适的执行',
    prompt: '请对比 2-3 个可行修改方案，选择最适合当前页面的一种后再执行。',
  },
  {
    id: 'prototype-annotation',
    label: '原型标注',
    description: '结合当前原型标注理解修改意图',
    prompt: '请结合当前原型标注理解修改意图，优先处理批注对应区域。',
  },
] as const;

const SKILL_TRIGGER_QUERY_PATTERN = /^[\p{Script=Han}\p{Letter}\p{Number}_-]*$/u;
const SKILL_BY_ID = new Map(PROMPT_CARD_SKILLS.map((skill) => [skill.id, skill]));

function normalizeSkillQuery(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function findPromptCardSkillTrigger(text: string): PromptCardSkillTrigger | null {
  const value = String(text ?? '');
  const start = value.lastIndexOf('/');
  if (start < 0) return null;
  const query = value.slice(start + 1);
  if (!SKILL_TRIGGER_QUERY_PATTERN.test(query)) return null;
  const previousChar = start > 0 ? value[start - 1] : '';
  const previousWhitespaceIndex = Math.max(
    value.lastIndexOf(' ', start - 1),
    value.lastIndexOf('\n', start - 1),
    value.lastIndexOf('\t', start - 1),
  );
  const currentTokenPrefix = value.slice(previousWhitespaceIndex + 1, start);
  if (previousChar === '/') {
    return null;
  }
  if (currentTokenPrefix.includes('/')) return null;
  return {
    query,
    start,
    end: value.length,
  };
}

export function clearPromptCardSkillTrigger(text: string): string {
  const value = String(text ?? '');
  const trigger = findPromptCardSkillTrigger(value);
  if (!trigger) return value;
  return value.slice(0, trigger.start).trimEnd();
}

export function filterPromptCardSkills(query: string): PromptCardSkill[] {
  const normalizedQuery = normalizeSkillQuery(query);
  if (!normalizedQuery) return [...PROMPT_CARD_SKILLS];

  return PROMPT_CARD_SKILLS.filter((skill) => {
    const searchableText = `${skill.label} ${skill.description}`.toLocaleLowerCase();
    return searchableText.includes(normalizedQuery);
  });
}

export function addPromptCardSkillSelection(
  selectedSkills: readonly PromptCardSkill[],
  skill: PromptCardSkill,
): PromptCardSkill[] {
  if (selectedSkills.some((selected) => selected.id === skill.id)) {
    return [...selectedSkills];
  }
  return [...selectedSkills, skill];
}

export function buildPromptCardSkillPrefix(selectedSkills: readonly PromptCardSkill[]): string {
  if (selectedSkills.length === 0) return '';
  return [
    '技能:',
    ...selectedSkills.map((skill) => `- ${skill.label}: ${skill.prompt}`),
  ].join('\n');
}

export function normalizePromptCardSkillIds(skillIds: readonly unknown[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const skillId of skillIds) {
    const normalizedId = String(skillId ?? '').trim();
    if (!normalizedId || seen.has(normalizedId) || !SKILL_BY_ID.has(normalizedId)) continue;
    seen.add(normalizedId);
    result.push(normalizedId);
  }

  return result;
}

export function buildPromptCardSkillSavePayload(
  note: string,
  selectedSkills: readonly PromptCardSkill[],
): PromptCardSkillSavePayload {
  return {
    note: String(note ?? '').replace(/\r\n/g, '\n').trim(),
    skillIds: selectedSkills.map((skill) => skill.id),
  };
}

export function serializePromptCardSkillSelection(skillIds: readonly string[]): string {
  return JSON.stringify({ skillIds: normalizePromptCardSkillIds(skillIds) });
}

export function deserializePromptCardSkillSelection(
  payload: { skillIds?: readonly unknown[] | null } | null | undefined,
): PromptCardSkill[] {
  return normalizePromptCardSkillIds(payload?.skillIds ?? [])
    .map((skillId) => SKILL_BY_ID.get(skillId))
    .filter((skill): skill is PromptCardSkill => Boolean(skill));
}

export function mergePromptCardSkillsIntoPromptNote(
  note: string,
  selectedSkills: readonly PromptCardSkill[],
): string {
  const prefix = buildPromptCardSkillPrefix(selectedSkills);
  const normalizedNote = String(note ?? '').replace(/\r\n/g, '\n').trim();
  if (!prefix) return normalizedNote;
  if (!normalizedNote) return prefix;
  return `${prefix}\n\n${normalizedNote}`;
}
