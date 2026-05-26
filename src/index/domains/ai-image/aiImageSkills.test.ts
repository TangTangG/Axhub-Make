import { describe, expect, it } from 'vitest';

import { AI_IMAGE_SKILLS, appendAiImageSkillPrompt } from './aiImageSkills';

describe('AI image skills', () => {
  it('defines the two fixed canvas image skills', () => {
    expect(AI_IMAGE_SKILLS).toHaveLength(2);
    expect(AI_IMAGE_SKILLS.map((skill) => skill.label)).toEqual(['提取图标', '生成草图']);
    expect(AI_IMAGE_SKILLS[0]?.prompt).toBe('提取该 UI 设计稿中的图标，按矩阵格式返回。');
    expect(AI_IMAGE_SKILLS[1]?.prompt).toBe('把该 UI 设计稿中的图标和图片替换为同尺寸灰色占位图，保留文字、布局和其它视觉信息，不要整张图片变灰。');
  });

  it('uses the skill prompt as the full composer text when the input is empty', () => {
    expect(appendAiImageSkillPrompt('', AI_IMAGE_SKILLS[0]!.prompt)).toBe(AI_IMAGE_SKILLS[0]!.prompt);
  });

  it('appends skill prompts after existing user text', () => {
    expect(appendAiImageSkillPrompt('参考这张图处理', AI_IMAGE_SKILLS[0]!.prompt)).toBe(
      `参考这张图处理\n\n${AI_IMAGE_SKILLS[0]!.prompt}`,
    );
  });

  it('removes a trailing slash trigger fragment before appending the skill prompt', () => {
    expect(appendAiImageSkillPrompt('/', AI_IMAGE_SKILLS[1]!.prompt)).toBe(AI_IMAGE_SKILLS[1]!.prompt);
    expect(appendAiImageSkillPrompt('/提取', AI_IMAGE_SKILLS[1]!.prompt)).toBe(AI_IMAGE_SKILLS[1]!.prompt);
    expect(appendAiImageSkillPrompt('参考图 /提取', AI_IMAGE_SKILLS[1]!.prompt)).toBe(
      `参考图\n\n${AI_IMAGE_SKILLS[1]!.prompt}`,
    );
  });
});
