# Default Prototype HTML Specs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Create detailed, evidence-backed HTML main specifications for the three default Make Client prototypes without changing their implementations.

**Architecture:** Each prototype receives one standalone .spec/spec.html built from the repository HTML spec template. All three documents share navigation, search, evidence disclosure, Mermaid fallback, acceptance-checklist persistence, accessibility, responsive, and print contracts, while factual content is derived independently from the corresponding prototype source and local documents.

**Tech Stack:** Standalone HTML5, CSS, browser JavaScript, Mermaid source blocks, React/TypeScript source inspection, Node.js validation, Make prototype-spec preview.

## Global Constraints

- Scope is exactly annotation-demo, beginner-guide, and touch-and-talk-annotation-demo.
- Treat the documents as reverse-engineered current-state baselines; do not add recommendations, future behavior, inferred product requirements, or unresolved questions.
- Every functional statement must be traceable to current prototype source, prototype-local documents/assets, or current repository rules.
- Use exactly these active HTML main specs: client/src/prototypes/annotation-demo/.spec/spec.html, client/src/prototypes/beginner-guide/.spec/spec.html, and client/src/prototypes/touch-and-talk-annotation-demo/.spec/spec.html; do not create spec.md, dated spec copies, or spec-state.json.
- Do not modify prototype code, styles, assets, local documents, runtime configuration, or repository templates.
- Start from the structure and intent of client/src/resources/templates/规格文档 HTML 模板.html, then expand it for detailed current-state documentation.
- Do not implement Make comment writeback, window.axhubReview, or data-axhub-review-interactive integration.
- Acceptance checkboxes may persist only in browser localStorage under a key namespaced by prototype ID; they must not affect prototype or Make state.
- Mermaid flow containers must retain readable source/fallback text when Mermaid cannot load; do not create Excalidraw or diagram-manifest files.
- HTML must work independently, remain keyboard usable, adapt below 720 px, support print, and avoid machine-absolute resource URLs.
- Preserve all unrelated user changes in the dirty worktree; stage and commit only the file owned by the current task.

---

### Task 1: Annotation Demo Main Specification

**Files:**
- Create/replace: client/src/prototypes/annotation-demo/.spec/spec.html
- Read: client/src/prototypes/annotation-demo/index.tsx
- Read: client/src/prototypes/annotation-demo/style.css
- Read: client/src/prototypes/annotation-demo/annotation-source.json
- Read: client/src/prototypes/annotation-demo/docs/*.md
- Read: client/src/common/useHashPage.ts

**Interfaces:**
- Consumes: the approved design in docs/superpowers/specs/2026-07-13-default-prototype-html-specs-design.md and the Global Constraints above.
- Produces: one standalone HTML document with page keys overview, information-architecture, flows-states, content-design, evidence-acceptance and localStorage namespace axhub-spec:annotation-demo:acceptance.

- [ ] **Step 1: Inventory implementation evidence**

Read all listed files. Record exact chapter IDs, page-routing behavior, role definitions, result/list/metric states, host notifications, asset paths, responsive breakpoints, and interactive controls before writing the spec.

- [ ] **Step 2: Replace the placeholder spec with factual HTML**

Build a complete document with this content map:

~~~text
overview: status, source hierarchy, purpose, users, scope, non-goals
information-architecture: chapter/page map, Hash routes, directory hierarchy, relationships
flows-states: primary workflow, control behavior, state matrices, host route notification
content-design: per-section content, document/assets, observed design, responsive/accessibility
evidence-acceptance: limitations, acceptance checklist, traceability, decision record
~~~

Use exact current identifiers and material copy. Describe absent behavior only as a demonstrable current boundary.

- [ ] **Step 3: Add the shared document interaction contract**

Use this stable DOM contract:

~~~html
<input id="spec-search" type="search" aria-label="搜索规格内容">
<output id="search-status" aria-live="polite"></output>
<button type="button" data-page-target="overview" aria-current="page">当前方案</button>
<article class="spec-page" data-spec-page="overview"><h1>标注演示规格</h1></article>
<pre class="mermaid" data-mermaid-source>flowchart LR; A[提交需求] --> B[生成结果]</pre>
<input type="checkbox" data-acceptance-id="annotation-demo-navigation">
~~~

The script must derive active page from location.hash, update Hash navigation, search all spec pages and reveal matches, persist checklist IDs in axhub-spec:annotation-demo:acceptance, expose a reset action, and retain readable Mermaid source when rendering is unavailable.

- [ ] **Step 4: Validate the document**

Run:

~~~bash
node -e "const fs=require('fs');const p='client/src/prototypes/annotation-demo/.spec/spec.html';const s=fs.readFileSync(p,'utf8');for(const x of ['<!doctype html>','data-spec-page=\"overview\"','data-spec-page=\"information-architecture\"','data-spec-page=\"flows-states\"','data-spec-page=\"content-design\"','data-spec-page=\"evidence-acceptance\"','id=\"spec-search\"','class=\"mermaid\"','axhub-spec:annotation-demo:acceptance'])if(!s.includes(x))throw new Error('missing '+x);if(/TBD|TODO|YYYY-MM-DD|扩展页面[一二]|window\\.axhubReview|data-axhub-review-interactive/.test(s))throw new Error('placeholder or forbidden integration');console.log('annotation spec structure: PASS')"
git diff --check -- client/src/prototypes/annotation-demo/.spec/spec.html
~~~

Expected: annotation spec structure: PASS; diff check has no output.

- [ ] **Step 5: Commit only the owned spec**

~~~bash
git add -- client/src/prototypes/annotation-demo/.spec/spec.html
git commit -m "docs(client): detail annotation demo spec" -- client/src/prototypes/annotation-demo/.spec/spec.html
~~~

### Task 2: Beginner Guide Main Specification

**Files:**
- Create: client/src/prototypes/beginner-guide/.spec/spec.html
- Read: client/src/prototypes/beginner-guide/index.tsx
- Read: client/src/prototypes/beginner-guide/style.css
- Read: client/src/prototypes/beginner-guide/clipboard.ts
- Read: client/src/prototypes/beginner-guide/.spec/2026-07-11-ai-uncertainty-design.md
- Read: client/src/prototypes/beginner-guide/.spec/2026-07-11-ai-uncertainty-implementation.md
- Read: client/src/common/useHashPage.ts

**Interfaces:**
- Consumes: approved design, Global Constraints, repository HTML spec template, and Task 1 output only as a presentation-consistency reference.
- Produces: one standalone document with page keys overview, learning-journey, chapter-specs, interactions-content, evidence-acceptance and localStorage namespace axhub-spec:beginner-guide:acceptance.

- [ ] **Step 1: Inventory implementation evidence**

Inventory exact chapter IDs/order, titles, goals, durations, checklists, Agent/model tables, generated prompts, path injection, copy success/failure/timer behavior, external links, imported screenshot purposes, previous/next navigation, responsive breakpoints, and accessibility attributes.

- [ ] **Step 2: Create the factual main spec**

Build this content map:

~~~text
overview: baseline, sources, audience, purpose, scope, non-goals
learning-journey: sequence, Hash routes, prerequisites, progression, completion
chapter-specs: detailed matrix for every implemented chapter and section
interactions-content: navigation, copy states, path injection, links, screenshots, visual/accessibility
evidence-acceptance: boundaries, checklist, source/asset/component traceability, decision record
~~~

Capture current working-tree facts, including current Agent/model wording and AI uncertainty content. Do not revive superseded copy from history.

- [ ] **Step 3: Add the shared document interaction contract**

Match Task 1 search, Hash navigation, Mermaid fallback, collapsible evidence, acceptance persistence, reset, responsive, focus, and print behavior. Use axhub-spec:beginner-guide:acceptance and IDs prefixed beginner-guide-.

- [ ] **Step 4: Validate the document**

Run:

~~~bash
node -e "const fs=require('fs');const p='client/src/prototypes/beginner-guide/.spec/spec.html';const s=fs.readFileSync(p,'utf8');for(const x of ['<!doctype html>','data-spec-page=\"overview\"','data-spec-page=\"learning-journey\"','data-spec-page=\"chapter-specs\"','data-spec-page=\"interactions-content\"','data-spec-page=\"evidence-acceptance\"','id=\"spec-search\"','class=\"mermaid\"','axhub-spec:beginner-guide:acceptance'])if(!s.includes(x))throw new Error('missing '+x);if(/TBD|TODO|YYYY-MM-DD|扩展页面[一二]|window\\.axhubReview|data-axhub-review-interactive/.test(s))throw new Error('placeholder or forbidden integration');console.log('beginner spec structure: PASS')"
git diff --check -- client/src/prototypes/beginner-guide/.spec/spec.html
~~~

Expected: beginner spec structure: PASS; diff check has no output.

- [ ] **Step 5: Commit only the owned spec**

~~~bash
git add -- client/src/prototypes/beginner-guide/.spec/spec.html
git commit -m "docs(client): detail beginner guide spec" -- client/src/prototypes/beginner-guide/.spec/spec.html
~~~

### Task 3: Touch And Talk Main Specification

**Files:**
- Create: client/src/prototypes/touch-and-talk-annotation-demo/.spec/spec.html
- Read: client/src/prototypes/touch-and-talk-annotation-demo/index.tsx
- Read: client/src/prototypes/touch-and-talk-annotation-demo/style.css
- Read: client/src/common/useHashPage.ts

**Interfaces:**
- Consumes: approved design, Global Constraints, repository HTML spec template, and Task 1 output only as a presentation-consistency reference.
- Produces: one standalone document with page keys overview, learning-flow, chapter-specs, interaction-media, evidence-acceptance and localStorage namespace axhub-spec:touch-and-talk-annotation-demo:acceptance.

- [ ] **Step 1: Inventory implementation evidence**

Inventory exact chapter IDs/order, titles, summaries, labels, screenshot assets/captions, quick-flow steps, voice instructions, tips, prompt/skill execution content, scenarios, navigation behavior, responsive breakpoints, and accessibility attributes.

- [ ] **Step 2: Create the factual main spec**

Build this content map:

~~~text
overview: baseline, evidence, audience, purpose, scope, non-goals
learning-flow: sequence, Hash routes, teaching flow, previous/next relationships
chapter-specs: detailed visible content and structure for every chapter
interaction-media: navigation, disabled boundaries, screenshot mapping, visual/accessibility
evidence-acceptance: boundaries, checklist, asset/component traceability, decision record
~~~

Do not describe microphone, speech recognition, prompt execution, or skill execution as executable capability unless current code invokes it; distinguish tutorial content from live UI.

- [ ] **Step 3: Add the shared document interaction contract**

Match Task 1 search, Hash navigation, Mermaid fallback, collapsible evidence, acceptance persistence, reset, responsive, focus, and print behavior. Use axhub-spec:touch-and-talk-annotation-demo:acceptance and IDs prefixed touch-and-talk-annotation-demo-.

- [ ] **Step 4: Validate the document**

Run:

~~~bash
node -e "const fs=require('fs');const p='client/src/prototypes/touch-and-talk-annotation-demo/.spec/spec.html';const s=fs.readFileSync(p,'utf8');for(const x of ['<!doctype html>','data-spec-page=\"overview\"','data-spec-page=\"learning-flow\"','data-spec-page=\"chapter-specs\"','data-spec-page=\"interaction-media\"','data-spec-page=\"evidence-acceptance\"','id=\"spec-search\"','class=\"mermaid\"','axhub-spec:touch-and-talk-annotation-demo:acceptance'])if(!s.includes(x))throw new Error('missing '+x);if(/TBD|TODO|YYYY-MM-DD|扩展页面[一二]|window\\.axhubReview|data-axhub-review-interactive/.test(s))throw new Error('placeholder or forbidden integration');console.log('touch-and-talk spec structure: PASS')"
git diff --check -- client/src/prototypes/touch-and-talk-annotation-demo/.spec/spec.html
~~~

Expected: touch-and-talk spec structure: PASS; diff check has no output.

- [ ] **Step 5: Commit only the owned spec**

~~~bash
git add -- client/src/prototypes/touch-and-talk-annotation-demo/.spec/spec.html
git commit -m "docs(client): detail touch and talk spec" -- client/src/prototypes/touch-and-talk-annotation-demo/.spec/spec.html
~~~

### Task 4: Cross-Spec Integration and Visual Verification

**Files:**
- Verify and modify only when a defect is proven: client/src/prototypes/annotation-demo/.spec/spec.html
- Verify and modify only when a defect is proven: client/src/prototypes/beginner-guide/.spec/spec.html
- Verify and modify only when a defect is proven: client/src/prototypes/touch-and-talk-annotation-demo/.spec/spec.html
- Create ignored audit script when repeated structural checks are required: .local/test-scripts/validate-default-prototype-specs.mjs

**Interfaces:**
- Consumes: the three standalone documents from Tasks 1–3.
- Produces: consistent validated specs and READY evidence for annotation-demo, beginner-guide, and touch-and-talk-annotation-demo.

- [ ] **Step 1: Run a cross-document structural audit**

Validate unique IDs; complete navigation targets; unique stable acceptance IDs; correct localStorage namespaces; no placeholders or forbidden integration; valid relative local paths; and readable five-page content without JavaScript. Put reusable ad hoc validation only under .local/test-scripts/ and do not commit it.

- [ ] **Step 2: Verify browser interactions and presentation**

At desktop and narrow viewport, verify:

~~~text
navigation updates current state and Hash; reload restores page
search reports matches and exposes matching content
details work by keyboard
acceptance checks persist; reset clears them
Mermaid is graphical when available and readable otherwise
tables remain contained at narrow width
print hides controls and shows all content
~~~

- [ ] **Step 3: Confirm prototype readiness**

Run from apps/axhub-make:

~~~bash
node client/scripts/check-app-ready.mjs /prototypes/annotation-demo
node client/scripts/check-app-ready.mjs /prototypes/beginner-guide
node client/scripts/check-app-ready.mjs /prototypes/touch-and-talk-annotation-demo
~~~

Expected: each status is READY and errors is empty.

- [ ] **Step 4: Run final static checks**

~~~bash
rg -n "TBD|TODO|YYYY-MM-DD|扩展页面[一二]|window\\.axhubReview|data-axhub-review-interactive" client/src/prototypes/{annotation-demo,beginner-guide,touch-and-talk-annotation-demo}/.spec/spec.html
git diff --check -- client/src/prototypes/annotation-demo/.spec/spec.html client/src/prototypes/beginner-guide/.spec/spec.html client/src/prototypes/touch-and-talk-annotation-demo/.spec/spec.html
git diff --stat -- client/src/prototypes/annotation-demo/.spec/spec.html client/src/prototypes/beginner-guide/.spec/spec.html client/src/prototypes/touch-and-talk-annotation-demo/.spec/spec.html
~~~

Expected: the first two commands have no output; the stat lists exactly the three main spec files.

- [ ] **Step 5: Commit integration fixes only when needed**

~~~bash
git add -- client/src/prototypes/annotation-demo/.spec/spec.html client/src/prototypes/beginner-guide/.spec/spec.html client/src/prototypes/touch-and-talk-annotation-demo/.spec/spec.html
git commit -m "docs(client): align default prototype specs"
~~~

Skip this commit when verification requires no changes.
