import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(__dirname, './SettingsDialog.tsx'), 'utf8');
}

describe('SettingsDialog source', () => {
  it('uses the tab switcher as the drawer title control', () => {
    const source = readSource();

    expect(source).toContain("from '@/components/ui/tabs'");
    expect(source).toContain('<Tabs defaultValue="project" className="flex h-full flex-col"');
    expect(source).toContain('<SheetTitle className="sr-only">项目设置 / AI 设置</SheetTitle>');
    expect(source).toContain('<SheetHeader className="border-b px-5 py-3.5">');
    expect(source).toContain('<div className="flex items-center justify-between gap-3">');
    expect(source).toContain('<TabsTrigger value="project"');
    expect(source).toContain('项目设置');
    expect(source).toContain('<TabsTrigger value="ai"');
    expect(source).toContain('AI 设置');
    expect(source).not.toContain('<SheetTitle className="m-0 text-[14px] font-medium leading-none">项目设置</SheetTitle>');
    expect(source).not.toContain('<div className="border-b px-5 py-3">');
  });

  it('does not expose automation execution preferences in project settings', () => {
    const source = readSource();

    expect(source).not.toContain('自动化执行');
    expect(source).not.toContain('默认 Genie 供应商');
    expect(source).not.toContain('默认 IDE');
  });

  it('exposes local AI execution agent preferences above image settings', () => {
    const source = readSource();
    const localAiIndex = source.indexOf('本地 AI');
    const imageGenerationIndex = source.indexOf('AI 图片生成');

    expect(localAiIndex).toBeGreaterThan(-1);
    expect(imageGenerationIndex).toBeGreaterThan(-1);
    expect(localAiIndex).toBeLessThan(imageGenerationIndex);
    expect(source).toContain('执行 agent');
    expect(source).toContain('LOCAL_AI_AGENT_OPTIONS');
    expect(source).toContain("defaultPromptClient: formState.defaultPromptClient");
    expect(source).toContain("normalizePromptClientPreference(config.automation?.defaultPromptClient)");
  });

  it('checks agent versions only when the local AI select opens and reuses a short cache', () => {
    const source = readSource();
    const agentVersionCacheSource = readFileSync(resolve(__dirname, '../utils/agentVersionCache.ts'), 'utf8');

    expect(source).toContain('AGENT_VERSION_CACHE_TTL_MS');
    expect(source).toContain('handleLocalAiSelectOpenChange');
    expect(source).toContain('apiService.getAgentVersions');
    expect(source).toContain('agentVersionCacheRef');
    expect(source).toContain('formatAgentVersionMeta');
    expect(agentVersionCacheSource).toContain('未安装');
  });

  it('saves AI image generation config through /api/config', () => {
    const source = readSource();

    expect(source).toContain("fetch('/api/config'");
    expect(source).toContain('ai: {');
    expect(source).toContain('imageGeneration: {');
    expect(source).toContain('baseUrl: formState.aiBaseUrl.trim()');
    expect(source).toContain('apiKey: formState.aiApiKey.trim() || null');
    expect(source).toContain('codexCli: formState.aiCodexCli');
    expect(source).toContain('responseFormatB64Json: formState.aiResponseFormatB64Json');
  });

  it('can import AI image generation settings from local Codex config', () => {
    const source = readSource();

    expect(source).toContain('handleImportCodexConfig');
    expect(source).toContain("fetch('/api/config/ai-image/codex-local'");
    expect(source).toContain("toast.success('已读取本地 Codex 配置')");
    expect(source).toContain('读取本地 Codex 配置');
    expect(source).toContain("updateField('aiBaseUrl', imported.baseUrl || DEFAULT_FORM_STATE.aiBaseUrl)");
    expect(source).toContain("updateField('aiApiKey', imported.apiKey || '')");
    expect(source).toContain("updateField('aiModel', imported.model || 'gpt-image-2')");
    expect(source).toContain("updateField('aiApiMode', imported.apiMode === 'responses' ? 'responses' : 'images')");
    expect(source).toContain("updateField('aiCodexCli', imported.codexCli === true)");
    expect(source).toContain("updateField('aiResponseFormatB64Json', imported.responseFormatB64Json !== false)");
  });

  it('exposes Codex CLI compatibility mode in AI image settings', () => {
    const source = readSource();

    expect(source).toContain('Codex CLI 兼容');
    expect(source).toContain('checked={formState.aiCodexCli}');
    expect(source).toContain("onCheckedChange={(checked) => updateField('aiCodexCli', checked === true)}");
    expect(source).toContain('开启后应用 Codex CLI 实际支持的参数');
    expect(source).not.toContain('Codex CLI 兼容模式');
  });

  it('does not expose advanced AI image generation defaults in AI settings', () => {
    const source = readSource();

    expect(source).not.toContain('默认尺寸');
    expect(source).not.toContain('默认质量');
    expect(source).not.toContain('默认格式');
    expect(source).not.toContain('默认数量');
    expect(source).not.toContain('formState.aiDefaultSize');
    expect(source).not.toContain('formState.aiDefaultQuality');
    expect(source).not.toContain('formState.aiDefaultOutputFormat');
    expect(source).not.toContain('formState.aiDefaultCount');
  });

  it('labels project default theme selection as the default design', () => {
    const source = readSource();

    expect(source).toContain('默认设计');
    expect(source).toContain('从“资产管理-设计”中选择一个作为项目默认设计');
    expect(source).not.toContain('默认主题');
  });

  it('syncs the default design file after saving project defaults', () => {
    const source = readSource();

    expect(source).toContain("fetch('/api/themes/sync-design'");
    expect(source).toContain("body: JSON.stringify({ themeName: formState.defaultTheme || '' })");
    expect(source).toContain("throw new Error((syncError as any)?.error || '同步默认设计失败');");
  });
});
