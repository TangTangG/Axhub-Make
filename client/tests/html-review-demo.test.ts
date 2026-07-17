import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const clientRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(clientRoot, 'src/resources/examples/html-review-demo.html');
const drawioPath = path.join(
  clientRoot,
  'src/resources/examples/html-review-demo.assets/diagrams/system-architecture.drawio.svg',
);
const htmlAgentCapabilitiesPath = path.join(clientRoot, 'rules/html-agent-capabilities.md');

describe('plain HTML review demo', () => {
  it('turns choices into ordinary comments through the optional plain-HTML protocol', () => {
    expect(fs.existsSync(htmlPath)).toBe(true);
    expect(fs.existsSync(drawioPath)).toBe(true);

    const html = fs.readFileSync(htmlPath, 'utf8');
    expect(html).toContain('class="mermaid"');
    expect(html).toContain('html-review-demo.assets/diagrams/system-architecture.drawio.svg');
    expect(html).toContain('type="radio"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('window.axhubReview?.setComment?.({ element, comment })');
    expect(html).toContain('window.axhubReview?.clearComment?.({ element })');
    expect(html).toContain("document.querySelector('#layout-review')");
    expect(html).toContain("document.querySelector('#scope-review')");
    expect(html).not.toContain('setFeedback');
    expect(html).not.toContain('clearFeedback');
    expect(html).not.toMatch(/from\s+['"]react['"]/u);
    expect(html).not.toContain('ReactDOM');
    expect(html).not.toContain('<Axhub');
    expect(html).not.toMatch(/(?:\/Users\/|\/Volumes\/|[A-Z]:\\)/u);
    expect(html).not.toContain('data:image/');
  });

  it('keeps the Draw.io fixture editable and self-contained', () => {
    const svg = fs.readFileSync(drawioPath, 'utf8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('data-drawio="true"');
    expect(svg).toContain('<metadata id="drawio-source">');
    expect(svg).toContain('&lt;mxGraphModel');
    expect(svg).not.toContain('data:image/');
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org\/2000\/svg)/u);
  });

  it('documents the HTML capability contract in the agent rules', () => {
    const guide = fs.readFileSync(htmlAgentCapabilitiesPath, 'utf8');
    expect(guide).toContain('同名的 `.assets`');
    expect(guide).toContain('diagram-manifest.json');
    expect(guide).toContain('.excalidraw');
    expect(guide).toContain('.drawio.svg');
    expect(guide).toContain('window.axhubReview');
  });
});
