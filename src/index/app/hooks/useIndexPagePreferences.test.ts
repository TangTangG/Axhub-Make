import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('useIndexPagePreferences source', () => {
  it('uses lightweight bootstrap config initially and refreshes IDE/agent availability separately', () => {
    const source = readFileSync(resolve(__dirname, './useIndexPagePreferences.ts'), 'utf8');
    const initialEffectStart = source.indexOf('useEffect(() => {');
    const handleSettingsStart = source.indexOf('const handleSettingsSaved = useCallback', initialEffectStart);
    const initialEffectSource = source.slice(initialEffectStart, handleSettingsStart);
    const refreshStart = source.indexOf('const refreshAvailability = useCallback');
    const refreshSource = source.slice(refreshStart);

    expect(initialEffectSource).toContain('apiService.getBootstrapConfig()');
    expect(initialEffectSource).toContain('apiService.getConfigAvailability()');
    expect(initialEffectSource).not.toContain('apiService.getConfig()');
    expect(refreshSource).toContain('apiService.getConfigAvailability()');
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
    const refreshStart = source.indexOf('const refreshAvailability = useCallback', handleSettingsStart);
    const handleSettingsSource = source.slice(handleSettingsStart, refreshStart);

    expect(handleSettingsSource).toContain('apiService.getConfig()');
    expect(handleSettingsSource).not.toContain('apiService.getBootstrapConfig()');
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
