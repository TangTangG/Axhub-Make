import { htmlToAxure as htmlToAxureImpl } from 'axhub-export-core';

export function htmlToAxure(selector: string | Element = 'body', options?: unknown) {
  return htmlToAxureImpl(selector, options);
}
