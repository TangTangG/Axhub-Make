export interface AiImageSkill {
  id: string;
  label: string;
  description: string;
  prompt: string;
}

export const AI_IMAGE_SKILLS: readonly AiImageSkill[] = [
  {
    id: 'extract-icons',
    label: '提取图标',
    description: '按矩阵整理设计稿里的图标',
    prompt: '提取该 UI 设计稿中的图标，按矩阵格式返回。',
  },
  {
    id: 'generate-wireframe',
    label: '生成草图',
    description: '保留布局，把图标和图片转为灰色占位',
    prompt: '把该 UI 设计稿中的图标和图片替换为同尺寸灰色占位图，保留文字、布局和其它视觉信息，不要整张图片变灰。',
  },
] as const;

export function appendAiImageSkillPrompt(currentText: string, skillPrompt: string): string {
  const textWithoutSlashTrigger = currentText.trimEnd().replace(/(?:^|\s)\/[^\s/]*$/u, '').trimEnd();
  return textWithoutSlashTrigger ? `${textWithoutSlashTrigger}\n\n${skillPrompt}` : skillPrompt;
}
