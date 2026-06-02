export const MAKE_CLIENT_TEMPLATE_ZIP_NAME = 'axhub-make-client-template.zip';
export const DEFAULT_MAKE_CLIENT_TEMPLATE_VERSION = '0.1.3';
export const PRIMARY_MAKE_CLIENT_TEMPLATE_RELEASE_REPOSITORY = 'lintendo/Axhub-Make';
export const GITEE_MAKE_CLIENT_TEMPLATE_RELEASE_BASE_URL = 'https://gitee.com/axhub/Axhub-Make/releases/download';

export function makeClientTemplateReleaseTag(version = DEFAULT_MAKE_CLIENT_TEMPLATE_VERSION): string {
  return `make-client-template-v${version}`;
}

export function makeClientTemplatePrimaryDownloadUrl(version = DEFAULT_MAKE_CLIENT_TEMPLATE_VERSION): string {
  return `https://github.com/${PRIMARY_MAKE_CLIENT_TEMPLATE_RELEASE_REPOSITORY}/releases/download/${makeClientTemplateReleaseTag(version)}/${MAKE_CLIENT_TEMPLATE_ZIP_NAME}`;
}

export function makeClientTemplateMirrorDownloadUrl(version = DEFAULT_MAKE_CLIENT_TEMPLATE_VERSION): string {
  return `${GITEE_MAKE_CLIENT_TEMPLATE_RELEASE_BASE_URL}/${makeClientTemplateReleaseTag(version)}/${MAKE_CLIENT_TEMPLATE_ZIP_NAME}`;
}
