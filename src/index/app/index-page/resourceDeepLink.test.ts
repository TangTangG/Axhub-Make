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

    it('builds and parses short prototype canvas links', () => {
        const url = buildIndexDeepLinkUrl({
            resourceType: 'prototype',
            resourceId: 'express-home',
            view: 'canvas',
            projectId: 'client-a',
        }, 'http://localhost:51720/?doc=ignored');

        expect(url).toBe('http://localhost:51720/?projectId=client-a&p=express-home&v=canvas');
        expect(parseIndexDeepLink(url)).toEqual({
            resourceType: 'prototype',
            resourceId: 'express-home',
            view: 'canvas',
            projectId: 'client-a',
            collapseSidebar: false,
        });
    });

    it('builds and parses short document and theme links', () => {
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

    it('resolves short links for prototypes, documents, and themes', () => {
        const prototype = createItem('express-home');
        const doc = createItem('product-spec.md');
        const theme = { name: 'june', displayName: 'June' };

        expect(resolveIndexDeepLinkSelection({
            resourceType: 'prototype',
            resourceId: 'express-home',
            view: 'canvas',
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
            viewMode: 'canvas',
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
