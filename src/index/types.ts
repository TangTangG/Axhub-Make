import { MainIDEPreference } from '../common/ide';
import type { GenieCurrentFileValueV1 } from '../common/genie/types';

export interface DeviceConfig {
    id: string;
    name: string;
    width: number;
    height: number;
    type: 'mobile' | 'tablet' | 'desktop';
    sizeInch?: number;
    ratio?: string;
    userAgent?: string;
}

export interface ItemData {
    name: string;
    displayName: string;
    jsUrl: string;
    specUrl: string;
    filePath?: string;
    absoluteFilePath?: string;
    specFilePath?: string;
    specAbsoluteFilePath?: string;
    specTitle?: string;
    artifacts?: Record<string, unknown>;
    previewUrl?: string;
    clientUrl?: string;
    projectId?: string;
    resourceId?: string;
    previewDisabled?: boolean;
    placeholder?: boolean;
    placeholderGuide?: PrototypePlaceholderGuide;
    isReference?: boolean;
    pages?: { id: string; title: string }[];
    defaultPageId?: string;
}

export interface PrototypePlaceholderGuide {
    kind: string;
    title: string;
    description: string;
    steps: string[];
    tips: string[];
}

export interface DataType {
    components: ItemData[];
    prototypes: ItemData[];
}

export type GeniePromptClient =
    | 'genie:claude'
    | 'genie:cursor'
    | 'genie:codex'
    | 'genie:gemini'
    | 'genie:opencode';
export type LocalPromptClient = 'local:cursor' | 'local:qoder';
export type PromptClient = GeniePromptClient | LocalPromptClient;
export type PromptClientPreference = PromptClient | null;

export interface AutomationConfig {
    defaultPromptClient?: PromptClientPreference;
    defaultIDE?: MainIDEPreference;
}

export type ViewMode = 'demo' | 'canvas';
export type TabType = 'prototypes';
export type SidebarTreeTab = TabType | 'docs' | 'canvas' | 'themes';
export type SidebarTreeNodeKind = 'folder' | 'item';

export interface SidebarTreeNode {
    id: string;
    kind: SidebarTreeNodeKind;
    title: string;
    itemKey?: string;
    path?: string;
    folderPath?: string;
    children?: SidebarTreeNode[];
}

export interface CanvasItem {
    name: string;
    displayName: string;
}

export interface ImageConfig {
    width: number;
    height: number;
    includeConfig: 'none' | 'code';
    contentType: 'title' | 'screenshot';
    isFullScreen?: boolean;
    rawScreenshotUrl: string;
    screenshotWidth: number;
    screenshotHeight: number;
    previewUrl: string;
}

export interface AxureCopyOptions {
    preserveHierarchy: boolean;
    preserveSvgIcons: boolean;
}

export interface ThemeOption {
    name: string;
    displayName: string;
    clientUrl?: string;
    previewUrl?: string;
    hasDesignToken?: boolean;
    hasGlobals?: boolean;
    hasDesignSpec?: boolean;
    hasIndexTsx?: boolean;
}

export interface DocOption {
    name: string;
    displayName: string;
}

export interface DataAssetOption {
    name: string;
    displayName: string;
}

export interface TemplateAssetOption {
    name: string;
    displayName: string;
    description?: string;
}

export interface SelectedOption {
    name: string;
    displayName: string;
}

export interface AssistantContextElementV1 {
    tag: string;
    selector: string;
    label: string;
}

export interface AssistantContextV1 {
    version: '1';
    systemContext: string;
    currentFile: GenieCurrentFileValueV1;
    selectedElements: AssistantContextElementV1[];
    extensions?: Record<string, unknown>;
}

export interface AssistantUpdateContextMessage {
    type: 'update_context';
    mode?: 'replace' | 'append';
    context: AssistantContextV1;
}
