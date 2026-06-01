import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('useWorkspaceNavigationController source', () => {
  it('uses the project APIs for switching and adding local projects', () => {
    const source = readFileSync(resolve(__dirname, './useWorkspaceNavigationController.ts'), 'utf8');

    expect(source).toContain("fetch('/api/projects')");
    expect(source).toContain("fetch('/api/projects/active'");
    expect(source).toContain("fetch('/api/projects/make/register-existing'");
    expect(source).toContain("fetch('/api/projects/make/create'");
    expect(source).toContain("fetch(`/api/projects/${encodeURIComponent(projectId)}/dev/ensure`");
    expect(source).not.toContain('/api/projects/select-root');
    expect(source).not.toContain('selectMakeProjectParentFolder');
    expect(source).toContain('const MAKE_CLIENT_DEV_START_TIMEOUT_MS = 60_000;');
    expect(source).toContain('body: JSON.stringify({ timeoutMs: MAKE_CLIENT_DEV_START_TIMEOUT_MS })');
    expect(source).toContain('addProjectFromLocalPath');
    expect(source).toContain('createBlankMakeProject');
    expect(source).toContain('switchProject');
  });

  it('loads a URL-selected project without writing server active project state', () => {
    const source = readFileSync(resolve(__dirname, './useWorkspaceNavigationController.ts'), 'utf8');
    const loadProjectResourcesStart = source.indexOf('const loadProjectResources = useCallback');
    const loadDataStart = source.indexOf('const loadData = useCallback', loadProjectResourcesStart);
    const loadProjectResourcesSource = source.slice(loadProjectResourcesStart, loadDataStart);

    expect(source).toContain('readInitialProjectIdFromUrl');
    expect(source).toContain('initialProjectIdRef');
    expect(loadProjectResourcesSource).toContain('initialProjectIdRef.current');
    expect(loadProjectResourcesSource).toContain('loadProjectResourcesFor(requestedProjectId)');
    expect(loadProjectResourcesSource).not.toContain("fetch('/api/projects/active'");
  });

  it('switches active projects through the project API before reloading resources', () => {
    const source = readFileSync(resolve(__dirname, './useWorkspaceNavigationController.ts'), 'utf8');
    const switchProjectStart = source.indexOf('const switchProject = useCallback');
    const addProjectStart = source.indexOf('const addProjectFromLocalPath = useCallback', switchProjectStart);
    const switchProjectSource = source.slice(switchProjectStart, addProjectStart);

    expect(switchProjectSource).toContain('const alreadyActiveProject = normalizedProjectId === activeProjectId;');
    expect(switchProjectSource).toContain('if (!normalizedProjectId || (alreadyActiveProject && projectResourcesLoadedRef.current)) {');
    expect(switchProjectSource).toContain('if (!alreadyActiveProject) {');
    expect(switchProjectSource).toContain("fetch('/api/projects/active'");
    expect(switchProjectSource).toContain('await loadProjectResourcesFor(normalizedProjectId);');
    expect(switchProjectSource).not.toContain('await ensureProjectDevServer(normalizedProjectId);');
  });

  it('deletes projects through the project API and reloads the next active project when needed', () => {
    const source = readFileSync(resolve(__dirname, './useWorkspaceNavigationController.ts'), 'utf8');
    const deleteProjectStart = source.indexOf('const deleteProject = useCallback');
    const addProjectStart = source.indexOf('const addProjectFromLocalPath = useCallback', deleteProjectStart);
    const deleteProjectSource = source.slice(deleteProjectStart, addProjectStart);

    expect(deleteProjectSource).toContain('fetch(`/api/projects/${encodeURIComponent(normalizedProjectId)}`');
    expect(deleteProjectSource).toContain("method: 'DELETE'");
    expect(deleteProjectSource).toContain('const wasActiveProject = normalizedProjectId === activeProjectId;');
    expect(deleteProjectSource).toContain('const projectList = await loadProjects();');
    expect(deleteProjectSource).toContain('if (wasActiveProject) {');
    expect(deleteProjectSource).toContain('resetProjectScopedState();');
    expect(deleteProjectSource).toContain('await loadProjectResourcesFor(projectList.activeProjectId);');
    expect(source).toContain('deleteProject,');
  });

  it('returns false when existing project folder selection is cancelled', () => {
    const source = readFileSync(resolve(__dirname, './useWorkspaceNavigationController.ts'), 'utf8');
    const addProjectStart = source.indexOf('const addProjectFromLocalPath = useCallback');
    const createBlankStart = source.indexOf('const createBlankMakeProject = useCallback', addProjectStart);
    const addProjectSource = source.slice(addProjectStart, createBlankStart);

    expect(addProjectSource).toContain('if (!normalizedRoot) {');
    expect(addProjectSource).toContain('return false;');
    expect(addProjectSource).toContain('return true;');
    expect(addProjectSource).toContain('async (root: string)');
  });

  it('activates a newly created blank project even if its first resource load fails', () => {
    const source = readFileSync(resolve(__dirname, './useWorkspaceNavigationController.ts'), 'utf8');
    const createBlankStart = source.indexOf('const createBlankMakeProject = useCallback');
    const reloadStart = source.indexOf('const reloadSidebarAssets = useCallback', createBlankStart);
    const createBlankSource = source.slice(createBlankStart, reloadStart);

    expect(createBlankSource).toContain('setActiveProjectId(projectId);');
    expect(createBlankSource).toContain("setProjectTitle(typeof payload?.project?.name === 'string'");
    expect(createBlankSource).toContain('const loaded = await loadProjectResourcesFor(projectId);');
    expect(createBlankSource).toContain("messageApi.error('项目已创建，但加载资源失败，请刷新或重新切换项目');");
    expect(createBlankSource).not.toContain("throw new Error('加载项目资源失败');");
  });

  it('requires project setup instead of falling back to legacy entries when no projects exist', () => {
    const source = readFileSync(resolve(__dirname, './useWorkspaceNavigationController.ts'), 'utf8');
    const loadProjectsStart = source.indexOf('const loadProjects = useCallback');
    const probeStatusStart = source.indexOf('const probeProjectRuntimeStatus = useCallback', loadProjectsStart);
    const loadProjectsSource = source.slice(loadProjectsStart, probeStatusStart);
    const loadDataStart = source.indexOf('const loadData = useCallback');
    const resetStart = source.indexOf('const resetProjectScopedState = useCallback', loadDataStart);
    const loadDataSource = source.slice(loadDataStart, resetStart);
    const reloadStart = source.indexOf('const reloadSidebarAssets = useCallback');
    const reloadDocsStart = source.indexOf('const reloadDocsItems = useCallback', reloadStart);
    const reloadSidebarAssetsSource = source.slice(reloadStart, reloadDocsStart);

    expect(source).toContain('const [projectSetupRequired, setProjectSetupRequired]');
    expect(loadProjectsSource).toContain('setProjectSetupRequired(payload.projects.length === 0);');
    expect(loadDataSource).toContain('if (projectSetupRequiredRef.current) {');
    expect(loadDataSource).toContain('return;');
    expect(loadDataSource).toContain("fetch('/api/entries.json')");
    expect(loadDataSource.indexOf('if (projectSetupRequiredRef.current) {')).toBeLessThan(loadDataSource.indexOf("fetch('/api/entries.json')"));
    expect(reloadSidebarAssetsSource).toContain('if (projectSetupRequiredRef.current) {');
    expect(reloadSidebarAssetsSource).toContain('return;');
    expect(source).toContain('projectSetupRequired,');
  });

  it('exposes an action to start the active project server without switching projects', () => {
    const source = readFileSync(resolve(__dirname, './useWorkspaceNavigationController.ts'), 'utf8');

    expect(source).toContain('const startActiveProjectServer = useCallback');
    expect(source).toContain("throw new Error('请先选择项目')");
    expect(source).toContain('await ensureProjectDevServer(activeProjectId);');
    expect(source).toContain('startActiveProjectServer,');
  });

  it('maps make client project setup errors to user-friendly messages', () => {
    const source = readFileSync(resolve(__dirname, '../../../utils/projectSetupErrors.ts'), 'utf8');

    expect(source).toContain('NOT_MAKE_CLIENT_PROJECT');
    expect(source).toContain('MAKE_PROJECT_ID_CONFLICT');
    expect(source).toContain('MAKE_CLIENT_SOURCE_UNAVAILABLE');
    expect(source).toContain('MAKE_CLIENT_TEMPLATE_UNAVAILABLE');
    expect(source).toContain('无法下载 Make 客户端模板包');
    expect(source).toContain('MAKE_CLIENT_INSTALL_FAILED');
    expect(source).not.toContain('npm install');
    expect(source).toContain('依赖安装失败');
    expect(source).toContain('MAKE_CLIENT_METADATA_SYNC_FAILED');
    expect(source).toContain('MAKE_CLIENT_DEV_TIMEOUT');
    expect(source).toContain('PNPM_NOT_FOUND');
    expect(source).toContain('MAKE_CLIENT_DEV_FAILED');
    expect(source).toContain("template: '下载模板包'");
    expect(source).toContain('formatMakeClientProjectError');
  });

  it('shows blank make client project creation as a single pending request', () => {
    const source = readFileSync(resolve(__dirname, '../../../components/sidebar/ContentPanel.tsx'), 'utf8');

    expect(source).toContain("{ key: 'template', label: '下载模板包' }");
    expect(source).toContain("const MAKE_CLIENT_SETUP_PENDING_LABEL = '创建并启动项目';");
    expect(source).toContain("setRunningPhase('creating')");
    expect(source).not.toContain("setRunningPhase('template')");
    expect(source).not.toContain("{ key: 'clone', label: '获取源码' }");
  });

  it('stores active project capabilities for preview and export gating', () => {
    const source = readFileSync(resolve(__dirname, './useWorkspaceNavigationController.ts'), 'utf8');

    expect(source).toContain('const [projectCapabilities, setProjectCapabilities]');
    expect(source).toContain('setProjectCapabilities(bundle.capabilities)');
    expect(source).toContain('projectCapabilities,');
  });

  it('keeps resource write capabilities defaulted through the project resource bundle', () => {
    const source = readFileSync(resolve(__dirname, './useWorkspaceNavigationController.ts'), 'utf8');

    expect(source).toContain('bundle.capabilities.resourceWrites');
    expect(source).toContain('setProjectCapabilities(bundle.capabilities)');
  });

  it('blocks project resource application when LAN hostname access targets a LAN-disabled project', () => {
    const source = readFileSync(resolve(__dirname, './useWorkspaceNavigationController.ts'), 'utf8');
    const loadProjectResourcesStart = source.indexOf('const loadProjectResourcesFor = useCallback');
    const loadDataStart = source.indexOf('const loadData = useCallback', loadProjectResourcesStart);
    const loadProjectResourcesSource = source.slice(loadProjectResourcesStart, loadDataStart);

    expect(source).toContain('function isLANHostname');
    expect(source).toContain('const [projectAccessDeniedReason, setProjectAccessDeniedReason]');
    expect(loadProjectResourcesSource).toContain('const bundle = normalizeProjectResourcesPayload(payload, projectId);');
    expect(loadProjectResourcesSource).toContain("isLANHostname(window.location.hostname)");
    expect(loadProjectResourcesSource).toContain('bundle.capabilities.lanAccessAllowed === false');
    expect(loadProjectResourcesSource).toContain("setProjectAccessDeniedReason('当前项目未开启局域网访问');");
    expect(loadProjectResourcesSource).toContain('return false;');
    expect(loadProjectResourcesSource.indexOf('setProjectAccessDeniedReason(')).toBeLessThan(loadProjectResourcesSource.indexOf('applyProjectResourceBundle(bundle)'));
    expect(source).toContain('projectAccessDeniedReason,');
  });

  it('seeds prototype and doc sidebar trees from project metadata resources without marking persisted trees loaded', () => {
    const source = readFileSync(resolve(__dirname, './useWorkspaceNavigationController.ts'), 'utf8');

    const applyBundleStart = source.indexOf('const applyProjectResourceBundle = useCallback');
    const loadProjectsStart = source.indexOf('const loadProjects = useCallback', applyBundleStart);
    const applyBundleSource = source.slice(applyBundleStart, loadProjectsStart);

    expect(applyBundleSource).toContain('sanitizeSidebarTree(\'prototypes\'');
    expect(applyBundleSource).toContain('sanitizeSidebarTree(\'docs\'');
    expect(applyBundleSource).not.toContain('loadedSidebarTreeTabsRef.current.add(\'prototypes\')');
    expect(applyBundleSource).not.toContain('loadedSidebarTreeTabsRef.current.add(\'docs\')');
  });

  it('applies explicit empty project names from project resource bundles', () => {
    const source = readFileSync(resolve(__dirname, './useWorkspaceNavigationController.ts'), 'utf8');
    const applyBundleStart = source.indexOf('const applyProjectResourceBundle = useCallback');
    const loadProjectsStart = source.indexOf('const loadProjects = useCallback', applyBundleStart);
    const applyBundleSource = source.slice(applyBundleStart, loadProjectsStart);

    expect(applyBundleSource).toContain("if (typeof bundle.projectName === 'string') {");
    expect(applyBundleSource).toContain('setProjectTitle(bundle.projectName || UNTITLED_PROJECT_LABEL);');
    expect(applyBundleSource).not.toContain('if (bundle.projectName) {');
  });

  it('resets the title fallback when the active project has an empty display name', () => {
    const source = readFileSync(resolve(__dirname, './useWorkspaceNavigationController.ts'), 'utf8');
    const applyBundleStart = source.indexOf('const applyProjectResourceBundle = useCallback');
    const loadProjectsStart = source.indexOf('const loadProjects = useCallback', applyBundleStart);
    const applyBundleSource = source.slice(applyBundleStart, loadProjectsStart);

    expect(source).toContain("const UNTITLED_PROJECT_LABEL = '未命名项目';");
    expect(source).toContain("const [projectTitle, setProjectTitle] = useState(UNTITLED_PROJECT_LABEL);");
    expect(applyBundleSource).toContain("setProjectTitle(bundle.projectName || UNTITLED_PROJECT_LABEL);");
  });

  it('guards sidebar tree loading against duplicate in-flight requests per tab', () => {
    const source = readFileSync(resolve(__dirname, './useWorkspaceNavigationController.ts'), 'utf8');
    const loadTreeStart = source.indexOf('const loadSidebarTree = useCallback');
    const effectsStart = source.indexOf('useEffect(() => {', loadTreeStart);
    const loadTreeSource = source.slice(loadTreeStart, effectsStart);

    expect(source).toContain('loadingSidebarTreeTabsRef');
    expect(loadTreeSource).toContain('loadingSidebarTreeTabsRef.current.has(tab)');
    expect(loadTreeSource).toContain('loadingSidebarTreeTabsRef.current.add(tab)');
    expect(loadTreeSource).toContain('loadingSidebarTreeTabsRef.current.delete(tab)');
  });

  it('does not actively load or sanitize the legacy standalone canvas tree for the main sidebar', () => {
    const source = readFileSync(resolve(__dirname, './useWorkspaceNavigationController.ts'), 'utf8');
    const reloadStart = source.indexOf('const reloadSidebarAssets = useCallback');
    const reloadDocsStart = source.indexOf('const reloadDocsItems = useCallback', reloadStart);
    const reloadSource = source.slice(reloadStart, reloadDocsStart);
    const sanitizeEffectStart = source.indexOf('setSidebarTrees((previous) => {', source.indexOf('useEffect(() => {', reloadDocsStart));
    const ensureStart = source.indexOf('const ensureSidebarTreeLoaded = useCallback', sanitizeEffectStart);
    const sanitizeEffectSource = source.slice(sanitizeEffectStart, ensureStart);

    expect(reloadSource).not.toContain("fetch('/api/canvas')");
    expect(sanitizeEffectSource).toContain("const treeTabs: SidebarTreeTab[] = ['prototypes', 'docs', 'themes'];");
    expect(sanitizeEffectSource).not.toContain("['prototypes', 'docs', 'canvas']");
  });

  it('does not repeat the active project resource bundle request from the idle sidebar asset load', () => {
    const source = readFileSync(resolve(__dirname, './useWorkspaceNavigationController.ts'), 'utf8');
    const loadProjectResourcesStart = source.indexOf('const loadProjectResourcesFor = useCallback');
    const loadDataStart = source.indexOf('const loadData = useCallback', loadProjectResourcesStart);
    const projectResourcesSource = source.slice(loadProjectResourcesStart, loadDataStart);
    const resetStart = source.indexOf('const resetProjectScopedState = useCallback');
    const resetEnd = source.indexOf('const ensureProjectDevServer = useCallback', resetStart);
    const resetSource = source.slice(resetStart, resetEnd);
    const idleEffectStart = source.indexOf('useEffect(() => {', source.indexOf('document.title'));
    const nextEffectStart = source.indexOf('useEffect(() => {', idleEffectStart + 1);
    const idleEffectSource = source.slice(idleEffectStart, nextEffectStart);

    expect(source).toContain('projectResourcesLoadedRef');
    expect(projectResourcesSource).toContain('projectResourcesLoadedRef.current = true;');
    expect(resetSource).toContain('projectResourcesLoadedRef.current = false;');
    expect(idleEffectSource).toContain('sidebarAssetsLoaded');
    expect(idleEffectSource).toContain('projectResourcesLoadedRef.current');
    expect(idleEffectSource).toContain('return;');
  });
});
