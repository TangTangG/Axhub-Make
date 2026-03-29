const PROJECT_BLOCK_SPLIT_REGEX = /(?=\[\[projects\]\])/;
const PROJECT_NAME_REGEX = /name\s*=\s*"([^"]+)"/;
const WEIXIN_OPTIONS_SECTION_REGEX = /(\[projects\.platforms\.options\]\s*\n)([\s\S]*?)(?=\n\[\[|\n\[[^\[]|$)/;

export const BLOCKED_USER_ID = 'blocked@im.wechat';

function getProjectName(block: string): string | null {
  const match = block.match(PROJECT_NAME_REGEX);
  return match?.[1] || null;
}

function replaceWeixinOptionsSection(block: string, nextOptionsBody: string): string {
  const nextBody = `${nextOptionsBody.trim()}\n`;
  return block.replace(WEIXIN_OPTIONS_SECTION_REGEX, (_match, header) => `${header}${nextBody}`);
}

export function synchronizeAxhubWeixinCredentials(params: {
  content: string;
  primaryProjectName: string;
  managedProjectNames: string[];
  blockedUserId?: string;
}): { content: string; updated: boolean } {
  const {
    content,
    primaryProjectName,
    managedProjectNames,
    blockedUserId = BLOCKED_USER_ID,
  } = params;

  const managedProjectNameSet = new Set(managedProjectNames);
  const projectBlocks = content.split(PROJECT_BLOCK_SPLIT_REGEX);
  const primaryBlock = projectBlocks.find((block) => getProjectName(block) === primaryProjectName);
  const primaryOptionsMatch = primaryBlock?.match(WEIXIN_OPTIONS_SECTION_REGEX);
  const primaryOptionsBody = primaryOptionsMatch?.[2]?.trim();

  if (!primaryBlock || !primaryOptionsBody || !primaryOptionsBody.includes('token')) {
    return { content, updated: false };
  }

  const tokenMatch = primaryOptionsBody.match(/token\s*=\s*"([^"]*?)"/);
  if (!tokenMatch || !tokenMatch[1]) {
    return { content, updated: false };
  }

  const blockedOptionsBody = `${primaryOptionsBody.replace(
    /allow_from\s*=\s*"[^"]*"/,
    `allow_from = "${blockedUserId}"`,
  )}${primaryOptionsBody.includes('allow_from') ? '' : `\nallow_from = "${blockedUserId}"`}`;

  const nextContent = projectBlocks
    .map((block) => {
      const projectName = getProjectName(block);
      if (!projectName || projectName === primaryProjectName || !managedProjectNameSet.has(projectName)) {
        return block;
      }
      if (!WEIXIN_OPTIONS_SECTION_REGEX.test(block)) {
        return block;
      }
      return replaceWeixinOptionsSection(block, blockedOptionsBody);
    })
    .join('');

  return {
    content: nextContent,
    updated: nextContent !== content,
  };
}
