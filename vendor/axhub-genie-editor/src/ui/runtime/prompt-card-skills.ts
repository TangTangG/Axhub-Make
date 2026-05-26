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
    prompt: '请结合当前原型标注理解修改意图，优先处理标注对应区域。',
  },
] as const;

const TRAILING_SKILL_TRIGGER_PATTERN = /(?:^|\s)\/([\p{Script=Han}\p{Letter}\p{Number}_-]*)$/u;

function normalizeSkillQuery(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function findPromptCardSkillTrigger(text: string): PromptCardSkillTrigger | null {
  const value = String(text ?? '');
  const match = value.match(TRAILING_SKILL_TRIGGER_PATTERN);
  if (!match || match.index === undefined) return null;
  const query = match[1] ?? '';
  const slashOffset = match[0].lastIndexOf('/');
  if (slashOffset < 0) return null;
  const start = match.index + slashOffset;
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
