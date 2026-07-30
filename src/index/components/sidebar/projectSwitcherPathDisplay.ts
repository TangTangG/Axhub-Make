const MAX_DISPLAY_LENGTH = 44;

function splitProjectRootPath(value: string): { prefix: string; segments: string[] } {
  const normalized = value.replace(/\\/g, '/');

  const driveMatch = normalized.match(/^([A-Za-z]:)\/(.*)$/u);
  if (driveMatch) {
    return {
      prefix: `${driveMatch[1]}/`,
      segments: driveMatch[2].split('/').filter(Boolean),
    };
  }

  if (normalized.startsWith('/')) {
    return {
      prefix: '/',
      segments: normalized.slice(1).split('/').filter(Boolean),
    };
  }

  return {
    prefix: '',
    segments: normalized.split('/').filter(Boolean),
  };
}

function buildSegmentDisplayPath(prefix: string, segments: string[], headCount: number, tailCount: number): string {
  if (segments.length <= headCount + tailCount) {
    return `${prefix}${segments.join('/')}`;
  }

  const head = segments.slice(0, headCount).join('/');
  const tail = segments.slice(-tailCount).join('/');
  return `${prefix}${head}/.../${tail}`;
}

function buildCharacterDisplayPath(path: string): string {
  const tailLength = Math.min(40, Math.max(24, Math.floor(MAX_DISPLAY_LENGTH * 0.62)));
  const headLength = Math.max(0, MAX_DISPLAY_LENGTH - tailLength - 5);
  const head = path.slice(0, headLength).replace(/\/*$/u, '');
  const tail = path.slice(-tailLength);
  return `${head}/.../${tail}`;
}

export function formatProjectRootDisplayPath(rootPath: string): string {
  const path = String(rootPath || '').trim();
  if (!path) {
    return '';
  }
  if (path.length <= MAX_DISPLAY_LENGTH) {
    return path;
  }

  const { prefix, segments } = splitProjectRootPath(path);
  if (segments.length >= 4) {
    const attempts: Array<[number, number]> = [
      [2, 4],
      [1, 4],
      [2, 3],
      [1, 3],
      [1, 2],
    ];

    for (const [headCount, tailCount] of attempts) {
      const formatted = buildSegmentDisplayPath(prefix, segments, headCount, tailCount);
      if (formatted.length <= MAX_DISPLAY_LENGTH) {
        return formatted;
      }
    }
  }

  return buildCharacterDisplayPath(path);
}
