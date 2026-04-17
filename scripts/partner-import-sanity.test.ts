import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const prototypeRoot = path.resolve('src/prototypes/partner');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(prototypeRoot, relativePath), 'utf8');
}

describe('partner prototype import sanity', () => {
  it('keeps imports local to the partner prototype or shared app utilities', () => {
    const sources = [
      ['src/layout/PartnerChrome.tsx', readSource('src/layout/PartnerChrome.tsx')],
      ['src/pages/PartnerLoginPage.tsx', readSource('src/pages/PartnerLoginPage.tsx')],
      ['src/pages/PartnerAccountPage.tsx', readSource('src/pages/PartnerAccountPage.tsx')],
      ['src/lib/utils.ts', readSource('src/lib/utils.ts')],
    ] as const;

    const violations = sources.flatMap(([relativePath, source]) => {
      const fileViolations: string[] = [];

      if (source.includes('../../../../../assets/media/')) {
        fileViolations.push(`${relativePath}: external assets/media import`);
      }

      if (source.includes('../../../pc/src/lib/utils')) {
        fileViolations.push(`${relativePath}: cross-prototype utils import`);
      }

      if (source.includes("'clsx'") || source.includes('"clsx"')) {
        fileViolations.push(`${relativePath}: undeclared clsx dependency`);
      }

      if (source.includes("'tailwind-merge'") || source.includes('"tailwind-merge"')) {
        fileViolations.push(`${relativePath}: undeclared tailwind-merge dependency`);
      }

      return fileViolations;
    });

    expect(violations).toEqual([]);
  });
});
