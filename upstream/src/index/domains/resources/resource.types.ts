export interface ThemeResourceItem {
    name: string;
    displayName: string;
    projectId?: string;
    clientUrl?: string;
    previewUrl?: string;
    description?: string;
    hasDoc?: boolean;
    hasIndexTsx?: boolean;
    path?: string;
    absoluteFilePath?: string;
}

export interface DataTableResourceItem {
    fileName: string;
    tableName: string;
    path?: string;
    absoluteFilePath?: string;
}

export interface TemplateResourceItem {
    name: string;
    displayName: string;
    description?: string;
    path?: string;
    absoluteFilePath?: string;
}

export type TemplateAssetOption = TemplateResourceItem;

export type ResourceSection = 'themes' | 'data' | 'templates';
