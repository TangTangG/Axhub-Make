import { describe, expect, it } from 'vitest';

import type { ItemData } from '../../types';
import {
    buildIndexDeepLinkUrl,
    buildResourceDeepLinkUrl,
    parseIndexDeepLink,
    parseResourceDeepLink,
    resolveIndexDeepLinkSelection,
    resolveResourceDeepLinkSelection,
    shouldSyncIndexDeepLinkUrl,
} from './resourceDeepLink';

function createItem(name: string): ItemData {
    return {
        name,
        displayName: name,
        jsUrl: '',
        specUrl: '',
    };
}

describe('resource deep links', () => {
    it('builds and parses short prototype links with encoded resource ids and project id', () => {
        const url = buildResourceDeepLinkUrl({
            resourceType: 'prototype',
            resourceId: '移动 首页/详情',
            view: 'demo',
            projectId: 'client-a',
            collapseSidebar: true,
        }, 'http://localhost:51720/current/path?ignored=1');

        expect(url).toBe('http://localhost:51720/?projectId=client-a&p=%E7%A7%BB%E5%8A%A8+%E9%A6%96%E9%A1%B5%2F%E8%AF%A6%E6%83%85');
        expect(parseResourceDeepLink(url)).toEqual({
            resourceType: 'prototype',
            resourceId: '移动 首页/详情',
            view: 'demo',
            projectId: 'client-a',
            collapseSidebar: false,
        });
    });

    it('does not preserve removed prototype canvas deep links', () => {
        const url = buildIndexDeepLinkUrl({
            resourceType: 'prototype',
            resourceId: 'express-home',
            view: 'canvas',
            projectId: 'client-a',
        }, 'http://localhost:51720/?doc=ignored');

        expect(url).toBe('http://localhost:51720/?projectId=client-a&p=express-home');
        expect(parseIndexDeepLink('http://localhost:51720/?projectId=client-a&p=express-home&v=canvas')).toEqual({
            resourceType: 'prototype',
            resourceId: 'express-home',
            view: 'demo',
            projectId: 'client-a',
            collapseSidebar: false,
        });
    });

    it('builds and parses short document, template, and theme links', () => {
        expect(buildIndexDeepLinkUrl({
            resourceType: 'doc',
            resourceId: 'product-spec.md',
            projectId: 'client-a',
        }, 'http://localhost:51720/old/path?ignored=1')).toBe('http://localhost:51720/?projectId=client-a&doc=product-spec.md');

        expect(parseIndexDeepLink('/?projectId=client-a&doc=product-spec.md')).toEqual({
            resourceType: 'doc',
            resourceId: 'product-spec.md',
            projectId: 'client-a',
            collapseSidebar: false,
        });

        expect(buildIndexDeepLinkUrl({
            resourceType: 'project-doc',
            resourceId: 'src/prototypes/annotation-demo/docs/prd-03-states.md',
            projectId: 'client-a',
        }, 'http://localhost:51720/old/path?ignored=1')).toBe('http://localhost:51720/?projectId=client-a&docPath=src%2Fprototypes%2Fannotation-demo%2Fdocs%2Fprd-03-states.md');

        expect(parseIndexDeepLink('/?projectId=client-a&docPath=src%2Fprototypes%2Fannotation-demo%2Fdocs%2Fprd-03-states.md')).toEqual({
            resourceType: 'project-doc',
            resourceId: 'src/prototypes/annotation-demo/docs/prd-03-states.md',
            projectId: 'client-a',
            collapseSidebar: true,
        });

        expect(buildIndexDeepLinkUrl({
            resourceType: 'template',
            resourceId: 'write-prd.md',
            projectId: 'client-a',
        }, 'http://localhost:51720/old/path?ignored=1')).toBe('http://localhost:51720/?projectId=client-a&doc=templates%2Fwrite-prd.md');

        expect(parseIndexDeepLink('/?projectId=client-a&doc=templates%2Fwrite-prd.md')).toEqual({
            resourceType: 'template',
            resourceId: 'write-prd.md',
            projectId: 'client-a',
            collapseSidebar: false,
        });

        expect(buildIndexDeepLinkUrl({
            resourceType: 'theme',
            resourceId: 'june',
            projectId: 'client-a',
        }, 'http://localhost:51720/?p=ignored')).toBe('http://localhost:51720/?projectId=client-a&theme=june');

        expect(parseIndexDeepLink('/?projectId=client-a&theme=june')).toEqual({
            resourceType: 'theme',
            resourceId: 'june',
            projectId: 'client-a',
            collapseSidebar: false,
        });
    });

    it('omits redundant canvas view from resource document short links', () => {
        const url = buildIndexDeepLinkUrl({
            resourceType: 'doc',
            resourceId: '资源演示/demo-canvas.excalidraw',
            view: 'canvas',
            projectId: 'make-project',
        }, 'http://localhost:53817/?projectId=make-project&doc=%E8%B5%84%E6%BA%90%E6%BC%94%E7%A4%BA%2Fdemo-flow.drawio.svg');

        expect(url).toBe('http://localhost:53817/?projectId=make-project&doc=%E8%B5%84%E6%BA%90%E6%BC%94%E7%A4%BA%2Fdemo-canvas.excalidraw');
        expect(parseIndexDeepLink(url)).toEqual({
            resourceType: 'doc',
            resourceId: '资源演示/demo-canvas.excalidraw',
            projectId: 'make-project',
            collapseSidebar: false,
        });
    });

    it('keeps parsing legacy resource document canvas view links', () => {
        expect(parseIndexDeepLink('http://localhost:53817/?projectId=make-project&doc=%E8%B5%84%E6%BA%90%E6%BC%94%E7%A4%BA%2Fdemo-canvas.excalidraw&view=canvas')).toEqual({
            resourceType: 'doc',
            resourceId: '资源演示/demo-canvas.excalidraw',
            view: 'canvas',
            projectId: 'make-project',
            collapseSidebar: false,
        });
    });

    it('keeps parsing legacy document and theme links', () => {
        expect(parseResourceDeepLink('/?resourceType=doc&resourceId=product-spec.md&sidebar=collapsed')).toEqual({
            resourceType: 'doc',
            resourceId: 'product-spec.md',
            collapseSidebar: true,
        });

        expect(parseResourceDeepLink('/?resourceType=theme&resourceId=brand')).toEqual({
            resourceType: 'theme',
            resourceId: 'brand',
            collapseSidebar: false,
        });
    });

    it('ignores invalid or incomplete resource links without throwing', () => {
        expect(parseResourceDeepLink('/?resourceType=prototype')).toBeNull();
        expect(parseResourceDeepLink('/?resourceType=doc&resourceId=')).toBeNull();
        expect(parseIndexDeepLink('/?projectId=client-a')).toBeNull();
        expect(parseIndexDeepLink('/?p=')).toBeNull();
    });

    it('holds URL sync until the initial deep link has been handled', () => {
        const initialTarget = {
            resourceType: 'prototype' as const,
            resourceId: 'beginner-guide',
            view: 'demo' as const,
            projectId: 'client-a',
            collapseSidebar: false,
        };
        const currentTarget = {
            resourceType: 'prototype' as const,
            resourceId: 'first-prototype',
            view: 'demo' as const,
            projectId: 'client-a',
        };

        expect(shouldSyncIndexDeepLinkUrl({
            currentTarget,
            initialTarget,
            initialTargetHandled: false,
        })).toBe(false);

        expect(shouldSyncIndexDeepLinkUrl({
            currentTarget,
            initialTarget,
            initialTargetHandled: true,
        })).toBe(true);

        expect(shouldSyncIndexDeepLinkUrl({
            currentTarget,
            initialTarget: null,
            initialTargetHandled: false,
        })).toBe(true);

        expect(shouldSyncIndexDeepLinkUrl({
            currentTarget: null,
            initialTarget,
            initialTargetHandled: true,
        })).toBe(false);
    });

    it('resolves prototype links to demo mode selection and collapsed sidebar state', () => {
        const first = createItem('first');
        const target = createItem('express-home');

        expect(resolveResourceDeepLinkSelection({
            resourceType: 'prototype',
            resourceId: 'express-home',
            view: 'demo',
            collapseSidebar: true,
        }, {
            prototypes: [first, target],
            docs: [],
        })).toEqual({
            kind: 'prototype',
            item: target,
            sidebarTab: 'prototype',
            viewMode: 'demo',
            collapseSidebar: true,
        });
    });

    it('resolves document links and returns null when the resource is missing', () => {
        const doc = createItem('product-spec.md');

        expect(resolveResourceDeepLinkSelection({
            resourceType: 'doc',
            resourceId: 'product-spec.md',
            collapseSidebar: true,
        }, {
            prototypes: [],
            docs: [doc],
        })).toEqual({
            kind: 'doc',
            item: doc,
            sidebarTab: 'document',
            viewMode: 'demo',
            collapseSidebar: true,
        });

        expect(resolveResourceDeepLinkSelection({
            resourceType: 'doc',
            resourceId: 'missing.md',
            collapseSidebar: true,
        }, {
            prototypes: [],
            docs: [doc],
        })).toBeNull();
    });

    it('resolves project document path links to temporary document items outside the resource directory', () => {
        expect(resolveIndexDeepLinkSelection({
            resourceType: 'project-doc',
            resourceId: 'src/prototypes/annotation-demo/docs/prd-03-states.md',
            projectId: 'client-a',
            collapseSidebar: false,
        }, {
            prototypes: [],
            docs: [],
        })).toEqual({
            kind: 'doc',
            item: {
                name: 'src/prototypes/annotation-demo/docs/prd-03-states.md',
                displayName: 'prd-03-states.md',
                jsUrl: '',
                specUrl: '/api/projects/client-a/document-content?path=src%2Fprototypes%2Fannotation-demo%2Fdocs%2Fprd-03-states.md',
                previewUrl: '/spec-template.html?url=%2Fapi%2Fprojects%2Fclient-a%2Fdocument-content%3Fpath%3Dsrc%252Fprototypes%252Fannotation-demo%252Fdocs%252Fprd-03-states.md',
                filePath: 'src/prototypes/annotation-demo/docs/prd-03-states.md',
                projectId: 'client-a',
                resourceId: 'src/prototypes/annotation-demo/docs/prd-03-states.md',
                projectDocumentPath: 'src/prototypes/annotation-demo/docs/prd-03-states.md',
            },
            sidebarTab: 'document',
            viewMode: 'demo',
            collapseSidebar: false,
        });
    });

    it('resolves document canvas links back to canvas view mode', () => {
        const canvasDoc = createItem('资源演示/demo-canvas.excalidraw');

        expect(resolveIndexDeepLinkSelection({
            resourceType: 'doc',
            resourceId: '资源演示/demo-canvas.excalidraw',
            view: 'canvas',
            projectId: 'make-project',
            collapseSidebar: false,
        }, {
            prototypes: [],
            docs: [canvasDoc],
        })).toEqual({
            kind: 'doc',
            item: canvasDoc,
            sidebarTab: 'document',
            viewMode: 'canvas',
            collapseSidebar: false,
        });
    });

    it('resolves short links for prototypes, documents, templates, and themes', () => {
        const prototype = createItem('express-home');
        const doc = createItem('product-spec.md');
        const templateDoc = createItem('templates/prd-template');
        const template = createItem('write-prd.md');
        const theme = { name: 'june', displayName: 'June' };

        expect(resolveIndexDeepLinkSelection({
            resourceType: 'prototype',
            resourceId: 'express-home',
            view: 'demo',
            projectId: 'client-a',
            collapseSidebar: false,
        }, {
            prototypes: [prototype],
            docs: [doc],
            themes: [theme],
        })).toEqual({
            kind: 'prototype',
            item: prototype,
            sidebarTab: 'prototype',
            viewMode: 'demo',
            collapseSidebar: false,
        });

        expect(resolveIndexDeepLinkSelection({
            resourceType: 'doc',
            resourceId: 'product-spec.md',
            projectId: 'client-a',
            collapseSidebar: false,
        }, {
            prototypes: [prototype],
            docs: [doc],
            themes: [theme],
        })).toEqual({
            kind: 'doc',
            item: doc,
            sidebarTab: 'document',
            viewMode: 'demo',
            collapseSidebar: false,
        });

        expect(resolveIndexDeepLinkSelection({
            resourceType: 'template',
            resourceId: 'write-prd.md',
            projectId: 'client-a',
            collapseSidebar: false,
        }, {
            prototypes: [prototype],
            docs: [doc],
            templates: [template],
            themes: [theme],
        })).toEqual({
            kind: 'template',
            item: template,
            sidebarTab: 'assets',
            resourceSection: 'templates',
            collapseSidebar: false,
        });

        expect(resolveIndexDeepLinkSelection({
            resourceType: 'template',
            resourceId: 'prd-template.md',
            projectId: 'client-a',
            collapseSidebar: false,
        }, {
            prototypes: [prototype],
            docs: [doc, templateDoc],
            templates: [],
            themes: [theme],
        })).toEqual({
            kind: 'doc',
            item: templateDoc,
            sidebarTab: 'document',
            viewMode: 'demo',
            collapseSidebar: false,
        });

        expect(resolveIndexDeepLinkSelection({
            resourceType: 'theme',
            resourceId: 'june',
            projectId: 'client-a',
            collapseSidebar: false,
        }, {
            prototypes: [prototype],
            docs: [doc],
            themes: [theme],
        })).toEqual({
            kind: 'theme',
            theme,
            sidebarTab: 'assets',
            resourceSection: 'themes',
            collapseSidebar: false,
        });
    });
});
