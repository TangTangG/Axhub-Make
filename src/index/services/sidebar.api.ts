import type { SidebarTreeNode, SidebarTreeTab } from '../types';

const WORKSPACE_API_ROUTES = {
    project: '/api/workspace/project',
    navigation: '/api/workspace/navigation',
    navigationFolders: '/api/workspace/navigation/folders',
    openResourceInSystem: '/api/workspace/resources/open-system',
    resourcesOrder: '/api/workspace/resources/order',
} as const;

interface SidebarTreeResponse {
    tab: SidebarTreeTab;
    version: number;
    tree: SidebarTreeNode[];
}

interface UpdateProjectTitleResponse {
    success: boolean;
    title: string;
}

interface SaveSidebarTreeResponse extends SidebarTreeResponse {
    success: boolean;
}

interface CreateSidebarFolderResponse extends SidebarTreeResponse {
    success: boolean;
    createdFolderId: string;
}

interface OpenResourceInSystemResponse {
    success: boolean;
    type?: 'docs' | 'themes';
    path: string;
    kind: 'file' | 'directory';
}

type ResourceOrderType = 'themes' | 'data' | 'templates';

interface ResourceOrderResponse {
    type: ResourceOrderType;
    version: number;
    order: string[];
}

interface SaveResourceOrderResponse extends ResourceOrderResponse {
    success: boolean;
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as any)?.error || fallbackMessage);
    }
    return response.json() as Promise<T>;
}

function getCurrentProjectIdFromUrl(): string {
    if (typeof window === 'undefined') {
        return '';
    }
    return new URLSearchParams(window.location.search).get('projectId')?.trim() || '';
}

function withWorkspaceProject(url: string): string {
    const projectId = getCurrentProjectIdFromUrl();
    if (!projectId) {
        return url;
    }
    const [path, query = ''] = url.split('?');
    const params = new URLSearchParams(query);
    params.set('projectId', projectId);
    const nextQuery = params.toString();
    return nextQuery ? `${path}?${nextQuery}` : path;
}

export const sidebarApi = {
    async getProjectTitle(): Promise<string> {
        const response = await fetch(withWorkspaceProject(WORKSPACE_API_ROUTES.project));
        const data = await parseJsonResponse<{ title?: string }>(response, '加载项目标题失败');
        return typeof data.title === 'string' ? data.title.trim() : '';
    },

    async updateProjectTitle(title: string): Promise<UpdateProjectTitleResponse> {
        const response = await fetch(withWorkspaceProject(WORKSPACE_API_ROUTES.project), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
        });
        return parseJsonResponse<UpdateProjectTitleResponse>(response, '保存项目标题失败');
    },

    async getSidebarTree(tab: SidebarTreeTab): Promise<SidebarTreeResponse> {
        const response = await fetch(withWorkspaceProject(`${WORKSPACE_API_ROUTES.navigation}?tab=${encodeURIComponent(tab)}`));
        return parseJsonResponse<SidebarTreeResponse>(response, '加载侧边栏树失败');
    },

    async saveSidebarTree(tab: SidebarTreeTab, tree: SidebarTreeNode[]): Promise<SaveSidebarTreeResponse> {
        const response = await fetch(withWorkspaceProject(`${WORKSPACE_API_ROUTES.navigation}?tab=${encodeURIComponent(tab)}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tree }),
        });
        return parseJsonResponse<SaveSidebarTreeResponse>(response, '保存侧边栏树失败');
    },

    async createSidebarFolder(tab: SidebarTreeTab): Promise<CreateSidebarFolderResponse> {
        const response = await fetch(withWorkspaceProject(`${WORKSPACE_API_ROUTES.navigationFolders}?tab=${encodeURIComponent(tab)}`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        return parseJsonResponse<CreateSidebarFolderResponse>(response, '新建文件夹失败');
    },

    async openResourceInSystem(
        resourcePath: string,
        type: 'docs' | 'themes' = 'docs',
        kind?: 'file' | 'folder',
    ): Promise<OpenResourceInSystemResponse> {
        const response = await fetch(withWorkspaceProject(WORKSPACE_API_ROUTES.openResourceInSystem), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: resourcePath,
                ...(type !== 'docs' ? { type } : {}),
                ...(kind ? { kind } : {}),
            }),
        });
        return parseJsonResponse<OpenResourceInSystemResponse>(response, '打开本地文件系统失败');
    },

    async getResourceOrder(type: ResourceOrderType): Promise<ResourceOrderResponse> {
        const response = await fetch(withWorkspaceProject(`${WORKSPACE_API_ROUTES.resourcesOrder}?type=${encodeURIComponent(type)}`));
        return parseJsonResponse<ResourceOrderResponse>(response, '加载资源排序失败');
    },

    async saveResourceOrder(type: ResourceOrderType, order: string[]): Promise<SaveResourceOrderResponse> {
        const response = await fetch(withWorkspaceProject(`${WORKSPACE_API_ROUTES.resourcesOrder}?type=${encodeURIComponent(type)}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order }),
        });
        return parseJsonResponse<SaveResourceOrderResponse>(response, '保存资源排序失败');
    },
};
