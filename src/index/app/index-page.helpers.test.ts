import { describe, expect, it } from 'vitest';

import {
    buildAssistantAutoOpenDismissedStorageKey,
    getAssistantAutoOpenDismissed,
    isMarkdownEditableResource,
    normalizeDocItem,
    normalizeTemplateItem,
    resolveMobileItemOpenUrl,
    setAssistantAutoOpenDismissed,
} from './index-page.helpers';

describe('index page helpers', () => {
    it('keeps assistant auto-open dismissed by default and project-wide across prototype switches', () => {
        const storage = new Map<string, string>();
        const fakeStorage = {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => {
                storage.set(key, value);
            },
        };
        const guideKey = buildAssistantAutoOpenDismissedStorageKey('make-project', 'src/prototypes/beginner-guide/index.tsx');
        const otherPrototypeKey = buildAssistantAutoOpenDismissedStorageKey('make-project', 'src/prototypes/other/index.tsx');
        const otherProjectKey = buildAssistantAutoOpenDismissedStorageKey('other-project', 'src/prototypes/beginner-guide/index.tsx');

        expect(getAssistantAutoOpenDismissed(guideKey, fakeStorage)).toBe(true);
        expect(getAssistantAutoOpenDismissed(otherProjectKey, fakeStorage)).toBe(true);

        setAssistantAutoOpenDismissed(guideKey, false, fakeStorage);

        expect(getAssistantAutoOpenDismissed(guideKey, fakeStorage)).toBe(false);
        expect(getAssistantAutoOpenDismissed(otherPrototypeKey, fakeStorage)).toBe(false);
        expect(getAssistantAutoOpenDismissed(otherProjectKey, fakeStorage)).toBe(true);

        setAssistantAutoOpenDismissed(guideKey, true, fakeStorage);

        expect(getAssistantAutoOpenDismissed(guideKey, fakeStorage)).toBe(true);
        expect(getAssistantAutoOpenDismissed(otherPrototypeKey, fakeStorage)).toBe(true);
    });

    it('opens metadata clientUrl values directly from the mobile prototype list', () => {
	        expect(resolveMobileItemOpenUrl({
	            name: 'home',
	            displayName: 'Home',
	            clientUrl: 'http://localhost:51720/prototypes/home',
	            previewUrl: 'http://localhost:51720/prototypes/home',
	            jsUrl: '',
	        }, 'http://localhost:5174')).toBe('http://localhost:51720/prototypes/home');
	    });

	    it('opens relative preview paths from the mobile prototype list', () => {
	        expect(resolveMobileItemOpenUrl({
	            name: 'home',
	            displayName: 'Home',
	            previewUrl: '/prototypes/home',
	            jsUrl: '',
	        }, 'http://localhost:5174')).toBe('http://localhost:5174/prototypes/home');
    });

    it('normalizes templates without inventing a local docs template path', () => {
        const metadataOnlyTemplate = normalizeTemplateItem({
            name: 'prd-template.md',
            displayName: 'PRD Template',
        });
        expect(metadataOnlyTemplate.filePath).toBeUndefined();
        expect(metadataOnlyTemplate.absoluteFilePath).toBeUndefined();

        const sourceBackedTemplate = normalizeTemplateItem({
            name: 'prd-template.md',
            displayName: 'PRD Template',
            path: 'content/templates/prd-template.md',
            absoluteFilePath: '/workspace/content/templates/prd-template.md',
        });
        expect(sourceBackedTemplate.filePath).toBe('content/templates/prd-template.md');
        expect(sourceBackedTemplate.absoluteFilePath).toBe('/workspace/content/templates/prd-template.md');
    });

    it('builds spec-template preview URLs for local docs and templates', () => {
        const doc = normalizeDocItem({
            name: 'guide.md',
            displayName: 'Guide',
            path: 'content/docs/guide.md',
            absoluteFilePath: '/workspace/content/docs/guide.md',
        });
        const template = normalizeTemplateItem({
            name: 'prd-template.md',
            displayName: 'PRD Template',
            path: 'content/templates/prd-template.md',
            absoluteFilePath: '/workspace/content/templates/prd-template.md',
        });

        expect(doc.specUrl).toBe('/api/markdown-file?path=%2Fworkspace%2Fcontent%2Fdocs%2Fguide.md');
        expect(doc.previewUrl).toBe('/spec-template.html?url=%2Fapi%2Fmarkdown-file%3Fpath%3D%252Fworkspace%252Fcontent%252Fdocs%252Fguide.md');
        expect(template.specUrl).toBe('/api/markdown-file?path=%2Fworkspace%2Fcontent%2Ftemplates%2Fprd-template.md');
        expect(template.previewUrl).toBe('/spec-template.html?url=%2Fapi%2Fmarkdown-file%3Fpath%3D%252Fworkspace%252Fcontent%252Ftemplates%252Fprd-template.md');
    });

    it('builds direct file preview URLs for non-markdown resources', () => {
        const image = normalizeDocItem({
            name: 'assets/logo.png',
            displayName: 'assets/logo',
            path: 'content/docs/assets/logo.png',
            absoluteFilePath: '/workspace/content/docs/assets/logo.png',
        });

        expect(image.name).toBe('assets/logo.png');
        expect(image.displayName).toBe('assets/logo');
        expect(image.specUrl).toBe('/api/markdown-file?path=%2Fworkspace%2Fcontent%2Fdocs%2Fassets%2Flogo.png');
        expect(image.previewUrl).toBe('/api/markdown-file?path=%2Fworkspace%2Fcontent%2Fdocs%2Fassets%2Flogo.png');
    });

    it('recognizes editable Markdown resources even when the display name has no .md extension', () => {
        expect(isMarkdownEditableResource({
            name: 'api-doc',
            displayName: 'API Doc',
            filePath: 'content/docs/api-doc.md',
            absoluteFilePath: '/workspace/content/docs/api-doc.md',
	            specUrl: '',
	            previewUrl: '',
	            jsUrl: '',
	        })).toBe(true);
	        expect(isMarkdownEditableResource({
	            name: 'api-doc',
            displayName: 'API Doc',
	            specUrl: '/api/markdown-file?path=%2Fworkspace%2Fcontent%2Fdocs%2Fapi-doc.md',
	            previewUrl: '/spec-template.html?url=%2Fapi%2Fmarkdown-file%3Fpath%3D%252Fworkspace%252Fcontent%252Fdocs%252Fapi-doc.md',
	            jsUrl: '',
	        })).toBe(true);
	        expect(isMarkdownEditableResource({
	            name: 'plain-note',
            displayName: 'Plain Note',
            filePath: 'content/docs/plain-note.txt',
	            specUrl: '',
	            previewUrl: '',
	            jsUrl: '',
	        })).toBe(false);
    });
});
