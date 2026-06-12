import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('useIndexPagePreferences source', () => {
  it('uses lightweight bootstrap config initially without probing local IDE or agent availability', () => {
    const source = readFileSync(resolve(__dirname, './useIndexPagePreferences.ts'), 'utf8');
    const initialEffectStart = source.indexOf('useEffect(() => {');
    const handleSettingsStart = source.indexOf('const handleSettingsSaved = useCallback', initialEffectStart);
    const initialEffectSource = source.slice(initialEffectStart, handleSettingsStart);

    expect(source).toContain('activeProjectId?: string | null;');
    expect(source).toContain('enabled?: boolean;');
    expect(source).toContain('activeProjectId,');
    expect(source).toContain('enabled = true,');
    expect(initialEffectSource).toContain('if (!enabled) {');
    expect(initialEffectSource).toContain('setInitialPreferencesLoaded(false);');
    expect(initialEffectSource).toContain('apiService.getBootstrapConfig({ projectId: activeProjectId })');
    expect(initialEffectSource).not.toContain('apiService.getConfigAvailability()');
    expect(initialEffectSource).not.toContain('apiService.getConfig()');
    expect(initialEffectSource).toContain('[activeProjectId, enabled,');
    expect(source).not.toContain('refreshAvailability');
    expect(source).not.toContain('getConfigAvailability');
  });

  it('exposes when the initial bootstrap preferences have loaded', () => {
    const source = readFileSync(resolve(__dirname, './useIndexPagePreferences.ts'), 'utf8');

    expect(source).toContain('initialPreferencesLoaded: boolean;');
    expect(source).toContain('const [initialPreferencesLoaded, setInitialPreferencesLoaded] = useState(false);');
    expect(source).toContain('setInitialPreferencesLoaded(true);');
    expect(source).toContain('initialPreferencesLoaded,');
  });

  it('keeps settings save refresh on the full config endpoint', () => {
    const source = readFileSync(resolve(__dirname, './useIndexPagePreferences.ts'), 'utf8');
    const handleSettingsStart = source.indexOf('const handleSettingsSaved = useCallback');
    const returnStart = source.indexOf('return {', handleSettingsStart);
    const handleSettingsSource = source.slice(handleSettingsStart, returnStart);

    expect(handleSettingsSource).toContain('if (!enabled) {');
    expect(handleSettingsSource).toContain('apiService.getConfig({ projectId: activeProjectId })');
    expect(handleSettingsSource).not.toContain('apiService.getBootstrapConfig()');
    expect(handleSettingsSource).toContain('[activeProjectId, enabled, onExcalidrawPropertyPanelModeLoaded,');
  });

  it('caches assistant image generation config from bootstrap and settings refresh', () => {
    const source = readFileSync(resolve(__dirname, './useIndexPagePreferences.ts'), 'utf8');
    const initialEffectStart = source.indexOf('useEffect(() => {');
    const handleSettingsStart = source.indexOf('const handleSettingsSaved = useCallback', initialEffectStart);
    const initialEffectSource = source.slice(initialEffectStart, handleSettingsStart);
    const returnStart = source.indexOf('return {', handleSettingsStart);
    const handleSettingsSource = source.slice(handleSettingsStart, returnStart);

    expect(source).toContain('assistantImageGenerationConfig: AssistantImageGenerationConfig | null;');
    expect(source).toContain('const [assistantImageGenerationConfig, setAssistantImageGenerationConfig] = useState<AssistantImageGenerationConfig | null>(null);');
    expect(initialEffectSource).toContain('setAssistantImageGenerationConfig(config?.ai?.imageGeneration || null);');
    expect(handleSettingsSource).toContain('setAssistantImageGenerationConfig(config?.ai?.imageGeneration || null);');
    expect(source).toContain('assistantImageGenerationConfig,');
  });

  it('restores default design state from project defaults', () => {
    const source = readFileSync(resolve(__dirname, './useIndexPagePreferences.ts'), 'utf8');
    const initialEffectStart = source.indexOf('useEffect(() => {');
    const handleSettingsStart = source.indexOf('const handleSettingsSaved = useCallback', initialEffectStart);
    const initialEffectSource = source.slice(initialEffectStart, handleSettingsStart);
    const returnStart = source.indexOf('return {', handleSettingsStart);
    const handleSettingsSource = source.slice(handleSettingsStart, returnStart);

    expect(source).toContain('setDefaultThemeName: (name: string | null) => void;');
    expect(source).toContain('setDefaultThemeName,');
    expect(initialEffectSource).toContain('setDefaultThemeName((config as any)?.projectDefaults?.defaultTheme || null);');
    expect(handleSettingsSource).toContain('setDefaultThemeName((config as any)?.projectDefaults?.defaultTheme || null);');
    expect(source).toContain('setDefaultThemeName(null);');
  });

  it('does not expose the removed welcome guide dialog or prompt document', () => {
    const source = readFileSync(resolve(__dirname, './useIndexPagePreferences.ts'), 'utf8');
    const constantsSource = readFileSync(resolve(__dirname, '../../constants.ts'), 'utf8');
    const dialogsSource = readFileSync(resolve(__dirname, '../../components/app/IndexDialogs.tsx'), 'utf8');
    const projectGuidePath = resolve(__dirname, '../../../../client/rules/project-guide.md');

    expect(source).not.toContain('welcomeGuide');
    expect(constantsSource).not.toContain('WELCOME_GUIDE');
    expect(dialogsSource).not.toContain('WelcomeGuideDialog');
    expect(existsSync(projectGuidePath)).toBe(false);
  });
});
