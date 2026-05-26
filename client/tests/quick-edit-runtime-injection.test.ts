import { describe, expect, it } from 'vitest';

import {
  createDevTemplateBootstrapScriptTag,
  createQuickEditRuntimeScriptTag,
  injectDevTemplateBootstrapScript,
  injectQuickEditRuntimeScript,
} from '../vite-plugins/clientPreviewPlugin';

describe('quick edit runtime injection', () => {
  it('injects the make-server runtime script from a discovered origin', () => {
    const html = '<!doctype html><html><head></head><body><div id="root"></div></body></html>';
    const nextHtml = injectQuickEditRuntimeScript(html, 'http://localhost:5174');

    expect(nextHtml).toContain('data-axhub-quick-edit-runtime');
    expect(nextHtml).toContain('src="http://localhost:5174/runtime/quick-edit.js"');
    expect(nextHtml.match(/data-axhub-quick-edit-runtime/g)).toHaveLength(1);
    expect(injectQuickEditRuntimeScript(nextHtml, 'http://localhost:5174')).toBe(nextHtml);
  });

  it('does not hardcode a fallback server port when no origin is available', () => {
    expect(createQuickEditRuntimeScriptTag(null)).toBe('');
    expect(createQuickEditRuntimeScriptTag('')).toBe('');
  });

  it('injects the make-server dev-template bootstrap before the preview loader', () => {
    const html = [
      '<!doctype html>',
      '<html>',
      '<head></head>',
      '<body>',
      '  <div id="root"></div>',
      '  <script type="module">',
      '{{PREVIEW_LOADER}}',
      '  </script>',
      '</body>',
      '</html>',
    ].join('\n');
    const nextHtml = injectDevTemplateBootstrapScript(html, 'http://localhost:5174');

    expect(nextHtml).toContain('data-axhub-dev-template-bootstrap');
    expect(nextHtml).toContain('src="http://localhost:5174/assets/dev-template-bootstrap.js"');
    expect(nextHtml.indexOf('data-axhub-dev-template-bootstrap')).toBeLessThan(nextHtml.indexOf('{{PREVIEW_LOADER}}'));
    expect(nextHtml.match(/data-axhub-dev-template-bootstrap/g)).toHaveLength(1);
    expect(injectDevTemplateBootstrapScript(nextHtml, 'http://localhost:5174')).toBe(nextHtml);
  });

  it('does not inject the dev-template bootstrap when no make-server origin is available', () => {
    expect(createDevTemplateBootstrapScriptTag(null)).toBe('');
    expect(createDevTemplateBootstrapScriptTag('')).toBe('');
  });
});
