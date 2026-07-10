export const MAKE_CLIENT_TEMPLATE_ZIP_NAME = 'axhub-make-client-template.zip';
export const MAKE_CLIENT_TEMPLATE_LATEST_MANIFEST_NAME = 'axhub-make-client-template.latest.json';
export const DEFAULT_MAKE_CLIENT_TEMPLATE_VERSION = '0.1.13';
export const DEFAULT_MAKE_CLIENT_TEMPLATE_RELEASE_NOTES = "# Axhub Make Client 0.1.13\n\n- 局域网访问更安全\n- 工作规则和协作流程已更新\n- 标注评审流程更清晰\n- 客户端依赖安装体积更小，标注动画不再依赖 Motion\n- 发布模板改用 pnpm 独立锁文件，并移除测试与字体裁剪工具";
export const PRIMARY_MAKE_CLIENT_TEMPLATE_RELEASE_REPOSITORY = 'lintendo/Axhub-Make';
export const GITEE_MAKE_CLIENT_TEMPLATE_RELEASE_BASE_URL = 'https://gitee.com/axhub/Axhub-Make/releases/download';
export const GITEE_MAKE_CLIENT_TEMPLATE_LATEST_RELEASE_TAG = 'make-client-template-latest';

export function makeClientTemplateReleaseTag(version = DEFAULT_MAKE_CLIENT_TEMPLATE_VERSION): string {
  return `make-client-template-v${version}`;
}

export function makeClientTemplatePrimaryDownloadUrl(version = DEFAULT_MAKE_CLIENT_TEMPLATE_VERSION): string {
  return `https://github.com/${PRIMARY_MAKE_CLIENT_TEMPLATE_RELEASE_REPOSITORY}/releases/download/${makeClientTemplateReleaseTag(version)}/${MAKE_CLIENT_TEMPLATE_ZIP_NAME}`;
}

export function makeClientTemplateMirrorDownloadUrl(version = DEFAULT_MAKE_CLIENT_TEMPLATE_VERSION): string {
  return `${GITEE_MAKE_CLIENT_TEMPLATE_RELEASE_BASE_URL}/${makeClientTemplateReleaseTag(version)}/${MAKE_CLIENT_TEMPLATE_ZIP_NAME}`;
}

export function makeClientTemplatePrimaryManifestUrl(): string {
  return `https://github.com/${PRIMARY_MAKE_CLIENT_TEMPLATE_RELEASE_REPOSITORY}/releases/latest/download/${MAKE_CLIENT_TEMPLATE_LATEST_MANIFEST_NAME}`;
}

export function makeClientTemplateMirrorManifestUrl(): string {
  return `${GITEE_MAKE_CLIENT_TEMPLATE_RELEASE_BASE_URL}/${GITEE_MAKE_CLIENT_TEMPLATE_LATEST_RELEASE_TAG}/${MAKE_CLIENT_TEMPLATE_LATEST_MANIFEST_NAME}`;
}
