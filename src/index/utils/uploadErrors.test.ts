import { describe, expect, it } from 'vitest';

import { getUserFriendlyUploadErrorMessage } from './uploadErrors';

describe('getUserFriendlyUploadErrorMessage', () => {
    it('explains deferred project-side writes without exposing server internals', () => {
        expect(getUserFriendlyUploadErrorMessage({
            code: 'RESOURCE_WRITE_ADAPTER_REQUIRED',
            error: 'Resource write requires project-side save/write capability in make-server',
        })).toBe('当前项目暂不支持由 server 直接创建或上传资源，请通过 AI 或项目自身流程生成后刷新资源。');

        expect(getUserFriendlyUploadErrorMessage(
            new Error('Upload creation requires project-side save/write capability in make-server'),
        )).toBe('当前项目暂不支持由 server 直接创建或上传资源，请通过 AI 或项目自身流程生成后刷新资源。');

        expect(getUserFriendlyUploadErrorMessage({
            code: 'PROTOTYPE_CONVERTER_ADAPTER_REQUIRED',
            error: 'Prototype converter uploads require a dedicated make-server adapter',
        })).toBe('当前项目暂不支持由 server 直接创建或上传资源，请通过 AI 或项目自身流程生成后刷新资源。');
    });
});
