#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  findWorkspaceRoot,
  normalizeViewport,
  resolveChromiumLaunchOptions,
} from './capture-theme-homepage.mjs';

const PLAYWRIGHT_CACHE_DIR = path.join(os.homedir(), '.cache', 'axure-extractor');

const DEFAULT_SOURCE_CAPTURE_OPTIONS = {
  viewport: { width: 1440, height: 900 },
  responsiveViewports: [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
  ],
  deviceScaleFactor: 1,
  waitUntil: 'domcontentloaded',
  timeoutMs: 60000,
  waitAfterLoadMs: 3000,
  settleTimeoutMs: 8000,
  scrollWarmup: true,
  maxScrollSteps: 60,
  headless: true,
  responsive: true,
  screenshot: true,
  tokens: true,
  hideScrollbar: true,
};

function readRequiredValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parseInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return parsed;
}

function normalizeSelectorList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return [String(value)];
}

function parseHeader(value) {
  const separatorIndex = value.includes('=') ? value.indexOf('=') : value.indexOf(':');
  if (separatorIndex <= 0) {
    throw new Error(`Invalid header, expected Name=Value: ${value}`);
  }
  const name = value.slice(0, separatorIndex).trim();
  const headerValue = value.slice(separatorIndex + 1).trim();
  if (!name) throw new Error(`Invalid header, expected Name=Value: ${value}`);
  return [name, headerValue];
}

function parseNamedViewport(value, fallbackName) {
  const [maybeName, maybeViewport] = value.includes(':')
    ? value.split(':', 2)
    : [fallbackName, value];
  const viewport = normalizeViewport(maybeViewport);
  return { name: maybeName || fallbackName, ...viewport };
}

export function parseResponsiveViewports(value) {
  if (!value) return DEFAULT_SOURCE_CAPTURE_OPTIONS.responsiveViewports;
  return String(value)
    .split(',')
    .map((item, index) => parseNamedViewport(item.trim(), `viewport-${index + 1}`));
}

export function inferThemeFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').split('.')[0] || 'homepage';
  } catch {
    return 'homepage';
  }
}

export function parseSourceCaptureArgs(argv = process.argv) {
  const args = {
    headers: {},
    waitForSelectors: [],
    dismissSelectors: [],
    removeSelectors: [],
    help: false,
    dryRun: false,
  };

  const rawArgs = argv.slice(2);
  for (let i = 0; i < rawArgs.length; i += 1) {
    const flag = rawArgs[i];

    if (flag === '--') {
      continue;
    } else if (flag === '--help' || flag === '-h') {
      args.help = true;
    } else if (flag === '--dry-run') {
      args.dryRun = true;
    } else if (flag === '--theme') {
      args.theme = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--url') {
      args.url = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--output' || flag === '-o') {
      args.output = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--viewport') {
      args.viewport = normalizeViewport(readRequiredValue(rawArgs, i, flag));
      i += 1;
    } else if (flag === '--responsive-viewports') {
      args.responsiveViewports = parseResponsiveViewports(readRequiredValue(rawArgs, i, flag));
      i += 1;
    } else if (flag === '--wait-until') {
      args.waitUntil = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--timeout') {
      args.timeoutMs = parseInteger(readRequiredValue(rawArgs, i, flag), flag);
      i += 1;
    } else if (flag === '--wait') {
      args.waitAfterLoadMs = parseInteger(readRequiredValue(rawArgs, i, flag), flag);
      i += 1;
    } else if (flag === '--settle-timeout') {
      args.settleTimeoutMs = parseInteger(readRequiredValue(rawArgs, i, flag), flag);
      i += 1;
    } else if (flag === '--max-scroll-steps') {
      args.maxScrollSteps = parseInteger(readRequiredValue(rawArgs, i, flag), flag);
      i += 1;
    } else if (flag === '--selector') {
      args.selector = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--wait-for-selector') {
      args.waitForSelectors.push(readRequiredValue(rawArgs, i, flag));
      i += 1;
    } else if (flag === '--dismiss-selector') {
      args.dismissSelectors.push(readRequiredValue(rawArgs, i, flag));
      i += 1;
    } else if (flag === '--remove-selector') {
      args.removeSelectors.push(readRequiredValue(rawArgs, i, flag));
      i += 1;
    } else if (flag === '--header') {
      const [name, value] = parseHeader(readRequiredValue(rawArgs, i, flag));
      args.headers[name] = value;
      i += 1;
    } else if (flag === '--connect-cdp') {
      args.connectCdp = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--browser-executable') {
      args.browserExecutable = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--storage-state') {
      args.storageState = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--headless') {
      args.headless = true;
    } else if (flag === '--no-headless') {
      args.headless = false;
    } else if (flag === '--scroll-warmup') {
      args.scrollWarmup = true;
    } else if (flag === '--no-scroll-warmup') {
      args.scrollWarmup = false;
    } else if (flag === '--responsive') {
      args.responsive = true;
    } else if (flag === '--no-responsive') {
      args.responsive = false;
    } else if (flag === '--screenshot') {
      args.screenshot = true;
    } else if (flag === '--no-screenshot') {
      args.screenshot = false;
    } else if (flag === '--tokens') {
      args.tokens = true;
    } else if (flag === '--no-tokens') {
      args.tokens = false;
    } else if (flag === '--hide-scrollbar') {
      args.hideScrollbar = true;
    } else if (flag === '--show-scrollbar') {
      args.hideScrollbar = false;
    } else if (flag.startsWith('--')) {
      throw new Error(`Unknown option: ${flag}`);
    } else if (!args.url) {
      args.url = flag;
    } else if (!args.theme) {
      args.theme = flag;
    } else {
      throw new Error(`Unexpected argument: ${flag}`);
    }
  }

  return args;
}

function resolveMaybePath(value, baseDir) {
  if (!value) return value;
  return path.isAbsolute(value) ? value : path.resolve(baseDir, value);
}

export function resolveSourceCaptureJob(args, options = {}) {
  const appRoot = path.resolve(options.appRoot || process.cwd());
  const workspaceRoot = path.resolve(options.workspaceRoot || findWorkspaceRoot(appRoot));
  const url = args.url;
  if (!url) throw new Error('A URL is required. Pass <url> or --url <url>.');

  const theme = args.theme || inferThemeFromUrl(url);
  const outputDir = resolveMaybePath(
    args.output || path.join(appRoot, '.local', `theme-capture-${theme}`),
    appRoot,
  );
  const storageState = resolveMaybePath(args.storageState, appRoot);

  return {
    ...DEFAULT_SOURCE_CAPTURE_OPTIONS,
    ...Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined)),
    theme,
    url,
    appRoot,
    workspaceRoot,
    outputDir,
    storageState,
    waitForSelectors: normalizeSelectorList(args.waitForSelectors),
    dismissSelectors: normalizeSelectorList(args.dismissSelectors),
    removeSelectors: normalizeSelectorList(args.removeSelectors),
    headers: args.headers || {},
  };
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const cachedPath = path.join(PLAYWRIGHT_CACHE_DIR, 'node_modules', 'playwright', 'index.mjs');
    if (fs.existsSync(cachedPath)) {
      return import(pathToFileURL(cachedPath).href);
    }
  }

  throw new Error(
    'Playwright is not available. Install dependencies with pnpm install, or run an existing capture tool once to populate the shared cache.',
  );
}

async function openPage(playwright, job, viewport) {
  let browser;
  let context;
  let page;
  let ownsContext = true;

  if (job.connectCdp) {
    browser = await playwright.chromium.connectOverCDP(job.connectCdp);
    context = browser.contexts()[0] || await browser.newContext();
    ownsContext = browser.contexts()[0] !== context;
    page = await context.newPage();
    await page.setViewportSize(viewport);
    await context.setExtraHTTPHeaders(job.headers || {});
  } else {
    browser = await playwright.chromium.launch(resolveChromiumLaunchOptions(job));
    context = await browser.newContext({
      viewport,
      deviceScaleFactor: job.deviceScaleFactor,
      storageState: job.storageState && fs.existsSync(job.storageState) ? job.storageState : undefined,
      extraHTTPHeaders: job.headers,
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();
  }

  return { browser, context, page, ownsContext };
}

async function closePageSession(session, job) {
  await session.page.close().catch(() => {});
  if (!job.connectCdp && session.ownsContext) {
    await session.context.close().catch(() => {});
  }
  if (!job.connectCdp) {
    await session.browser.close().catch(() => {});
  }
}

async function injectCaptureCss(page, job) {
  const scrollbarCss = job.hideScrollbar
    ? `
html, body {
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}
html::-webkit-scrollbar,
body::-webkit-scrollbar,
*::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
  display: none !important;
}
`
    : '';
  const removeCss = (job.removeSelectors || [])
    .map((selector) => `${selector} { display: none !important; visibility: hidden !important; }`)
    .join('\n');

  await page.addStyleTag({
    content: `
${scrollbarCss}
* {
  caret-color: transparent !important;
}
${removeCss}
`,
  });
}

async function dismissOverlays(page, selectors) {
  for (const selector of selectors || []) {
    try {
      await page.locator(selector).first().click({ timeout: 1500 });
      await page.waitForTimeout(300);
    } catch {
      // Optional dismiss selectors should never fail a source capture.
    }
  }
}

async function waitForSelectors(page, selectors, timeoutMs) {
  for (const selector of selectors || []) {
    await page.waitForSelector(selector, { timeout: timeoutMs, state: 'attached' });
  }
}

async function waitForFontsAndImages(page, timeoutMs) {
  await page.evaluate(async (timeout) => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const withTimeout = (promise) => Promise.race([promise, delay(timeout)]);

    if (document.fonts?.ready) {
      await withTimeout(document.fonts.ready);
    }

    const pendingImages = Array.from(document.images).filter((image) => !image.complete);
    await withTimeout(Promise.all(pendingImages.map((image) => new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    }))));
  }, Math.min(timeoutMs, 8000));
}

async function scrollWarmup(page, job) {
  return page.evaluate(async ({ maxScrollSteps }) => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const scrollingElement = document.scrollingElement || document.documentElement;
    const step = Math.max(600, Math.floor(window.innerHeight * 0.85));
    let previousHeight = 0;
    let stableHeightPasses = 0;
    let steps = 0;

    while (steps < maxScrollSteps) {
      const scrollHeight = scrollingElement.scrollHeight;
      if (scrollHeight === previousHeight) stableHeightPasses += 1;
      else stableHeightPasses = 0;
      previousHeight = scrollHeight;

      const nextY = Math.min(window.scrollY + step, scrollHeight - window.innerHeight);
      window.scrollTo(0, nextY);
      steps += 1;
      await delay(220);

      if (nextY >= scrollHeight - window.innerHeight && stableHeightPasses >= 2) {
        break;
      }
    }

    window.scrollTo(0, 0);
    await delay(500);
    return { steps, scrollHeight: scrollingElement.scrollHeight };
  }, { maxScrollSteps: job.maxScrollSteps });
}

async function preparePage(page, job) {
  await page.goto(job.url, { waitUntil: job.waitUntil, timeout: job.timeoutMs });
  await injectCaptureCss(page, job);
  await waitForSelectors(page, job.waitForSelectors, job.timeoutMs);
  await dismissOverlays(page, job.dismissSelectors);
  if (job.waitAfterLoadMs > 0) {
    await page.waitForTimeout(job.waitAfterLoadMs);
  }
  await waitForFontsAndImages(page, job.settleTimeoutMs);
  const warmup = job.scrollWarmup ? await scrollWarmup(page, job) : null;
  await waitForFontsAndImages(page, job.settleTimeoutMs);
  await injectCaptureCss(page, job);
  return warmup;
}

export function summarizeTheme(theme) {
  const summary = {
    colors: theme.colors || {},
    typography: theme.typography || {},
    spacing: theme.spacing || [],
    radius: theme.radius || [],
    lineWidth: theme.lineWidth || [],
    shadow: theme.shadow || {},
    transitions: theme.transitions || [],
    animations: theme.animations || [],
    cssVariables: theme.cssVariables || {},
  };
  return summary;
}

async function extractThemeTokens(page, job) {
  return page.evaluate((selector) => {
    const makeBucket = () => new Map();
    const add = (bucket, value, tag) => {
      if (!value) return;
      const trimmed = String(value).trim();
      if (!trimmed) return;
      if (!bucket.has(trimmed)) bucket.set(trimmed, { count: 0, tags: new Set() });
      const item = bucket.get(trimmed);
      item.count += 1;
      if (tag) item.tags.add(tag);
    };
    const isZeroish = (value) => {
      if (!value) return false;
      const trimmed = value.trim();
      if (trimmed === '0' || trimmed === '0px' || trimmed === '0%') return true;
      const parts = trimmed.split(/\s+/);
      return parts.length > 1 && parts.every((part) => part === '0' || part === '0px' || part === '0%');
    };
    const isTransparentColor = (value) => {
      if (!value) return false;
      const normalized = value.trim().toLowerCase();
      return normalized === 'transparent'
        || normalized === 'rgba(0, 0, 0, 0)'
        || normalized === 'rgba(0,0,0,0)';
    };
    const normalizeTags = (tags) => (tags.has('body') ? ['body'] : [...tags]);
    const sortTopInPage = (bucket, limit = 10) =>
      [...bucket.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, limit)
        .map(([value, obj]) => ({ value, count: obj.count, tags: normalizeTags(obj.tags) }));
    const sortTextStyles = (bucket, limit = 10) =>
      [...bucket.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, limit)
        .map(([value, obj]) => {
          const [size, lineHeight, weight, letterSpacing] = value.split('||');
          return { size, lineHeight, weight, letterSpacing, count: obj.count, tags: normalizeTags(obj.tags) };
        });

    const root = selector ? document.querySelector(selector) : document.documentElement;
    if (!root) throw new Error(`Selector "${selector}" not found`);
    const walkRoot = root.tagName === 'HTML' ? document.body : root;
    const walker = document.createTreeWalker(walkRoot, NodeFilter.SHOW_ELEMENT);

    const spacingBucket = makeBucket();
    const colorBuckets = { background: makeBucket(), text: makeBucket(), border: makeBucket() };
    const typographyBuckets = { family: makeBucket(), textStyle: makeBucket() };
    const radiusBucket = makeBucket();
    const lineWidthBucket = makeBucket();
    const shadowBuckets = { box: makeBucket(), text: makeBucket() };
    const animationBucket = makeBucket();
    const transitionBucket = makeBucket();
    const bgImageBucket = makeBucket();
    let el = walker.currentNode;

    while (el) {
      const tag = el.tagName?.toLowerCase() || '';
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const isVisible = rect.width > 0
        && rect.height > 0
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || 1) !== 0;

      if (isVisible) {
        if (style.backgroundColor && !isTransparentColor(style.backgroundColor)) {
          add(colorBuckets.background, style.backgroundColor, tag);
        }
        if (style.color && !isTransparentColor(style.color)) {
          add(colorBuckets.text, style.color, tag);
        }
        [style.borderColor, style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor]
          .forEach((color) => {
            if (color && !isTransparentColor(color)) add(colorBuckets.border, color, tag);
          });
        add(typographyBuckets.family, style.fontFamily, tag);
        if (style.fontSize && style.fontWeight && style.lineHeight) {
          add(typographyBuckets.textStyle, `${style.fontSize}||${style.lineHeight}||${style.fontWeight}||${style.letterSpacing}`, tag);
        }
        const addSpacingParts = (value) => {
          if (!value) return;
          value.trim().split(/\s+/).filter(Boolean).forEach((part) => {
            if (!isZeroish(part)) add(spacingBucket, part, tag);
          });
        };
        addSpacingParts(style.margin);
        addSpacingParts(style.padding);
        if (style.gap && style.gap !== 'normal') addSpacingParts(style.gap);
        if (style.borderRadius && !isZeroish(style.borderRadius)) add(radiusBucket, style.borderRadius, tag);
        ['borderWidth', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'].forEach((widthProp) => {
          const value = style[widthProp];
          if (value && !isZeroish(value)) add(lineWidthBucket, value, tag);
        });
        if (style.boxShadow && style.boxShadow !== 'none') add(shadowBuckets.box, style.boxShadow, tag);
        if (style.textShadow && style.textShadow !== 'none') add(shadowBuckets.text, style.textShadow, tag);
        if (style.animationName && style.animationName !== 'none') {
          add(animationBucket, `${style.animationName}|${style.animationDuration}|${style.animationTimingFunction}`, tag);
        }
        if (style.transition && style.transition !== 'none' && !style.transition.startsWith('all 0s')) {
          add(transitionBucket, style.transition, tag);
        }
        if (style.backgroundImage && style.backgroundImage !== 'none') add(bgImageBucket, style.backgroundImage, tag);
      }

      el = walker.nextNode();
    }

    const cssVariables = {};
    const rootStyle = getComputedStyle(document.documentElement);
    for (const sheet of [...document.styleSheets]) {
      try {
        for (const rule of [...(sheet.cssRules || [])]) {
          if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
            for (const prop of [...rule.style]) {
              if (prop.startsWith('--')) cssVariables[prop] = rootStyle.getPropertyValue(prop).trim();
            }
          }
        }
      } catch {
        // Ignore cross-origin stylesheets.
      }
    }

    const images = [...document.querySelectorAll('img')].map((img) => {
      const imgStyle = getComputedStyle(img);
      return {
        src: img.currentSrc || img.src,
        alt: img.alt,
        width: img.naturalWidth || null,
        height: img.naturalHeight || null,
        position: imgStyle.position,
        zIndex: imgStyle.zIndex,
        siblingImgCount: img.parentElement ? img.parentElement.querySelectorAll('img').length : 0,
      };
    });

    return {
      colors: {
        background: sortTopInPage(colorBuckets.background, 10),
        text: sortTopInPage(colorBuckets.text, 10),
        border: sortTopInPage(colorBuckets.border, 8),
      },
      typography: {
        families: sortTopInPage(typographyBuckets.family, 8),
        textStyles: sortTextStyles(typographyBuckets.textStyle, 12),
      },
      spacing: sortTopInPage(spacingBucket, 18),
      radius: sortTopInPage(radiusBucket, 8),
      lineWidth: sortTopInPage(lineWidthBucket, 6),
      shadow: {
        box: sortTopInPage(shadowBuckets.box, 8),
        text: sortTopInPage(shadowBuckets.text, 4),
      },
      animations: sortTopInPage(animationBucket, 8),
      transitions: sortTopInPage(transitionBucket, 8),
      cssVariables,
      assets: {
        backgroundImages: sortTopInPage(bgImageBucket, 12),
        images,
        svgCount: document.querySelectorAll('svg').length,
      },
    };
  }, job.selector || null);
}

async function extractSamples(page) {
  return page.evaluate(() => {
    const rgbaToHex = (value) => {
      const match = String(value || '').match(/rgba?\(([^)]+)\)/);
      if (!match) return value;
      const parts = match[1].split(',').map((part) => part.trim());
      const [r, g, b] = parts.slice(0, 3).map(Number);
      const alpha = parts[3] === undefined ? 1 : Number(parts[3]);
      const hex = [r, g, b]
        .map((num) => Math.max(0, Math.min(255, Math.round(num))).toString(16).padStart(2, '0'))
        .join('');
      return alpha === 1 ? `#${hex}` : `#${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
    };
    const sampleSelectors = ['header', 'nav', 'h1', 'h2', 'h3', 'button', 'a[href]', 'input', 'textarea', 'main section', 'footer'];
    return sampleSelectors.flatMap((selector) => [...document.querySelectorAll(selector)].slice(0, 10).map((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        selector,
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 180),
        color: rgbaToHex(style.color),
        background: rgbaToHex(style.backgroundColor),
        border: `${style.borderTopWidth} ${style.borderTopStyle} ${rgbaToHex(style.borderTopColor)}`,
        radius: style.borderTopLeftRadius,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        fontWeight: style.fontWeight,
        letterSpacing: style.letterSpacing,
        padding: `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
        margin: `${style.marginTop} ${style.marginRight} ${style.marginBottom} ${style.marginLeft}`,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    }));
  });
}

async function captureViewport(playwright, job, viewport, outputPath, { includeTokens = false } = {}) {
  const session = await openPage(playwright, job, { width: viewport.width, height: viewport.height });
  const startedAt = Date.now();
  try {
    const warmup = await preparePage(session.page, job);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    if (job.screenshot) {
      await session.page.screenshot({
        path: outputPath,
        fullPage: true,
        type: 'png',
        animations: 'disabled',
        caret: 'hide',
        timeout: job.timeoutMs,
      });
    }

    const state = await session.page.evaluate(() => {
      const scrollingElement = document.scrollingElement || document.documentElement;
      return {
        url: window.location.href,
        title: document.title,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        scrollHeight: scrollingElement.scrollHeight,
        nodeCount: document.querySelectorAll('*').length,
      };
    });

    let theme = null;
    let samples = [];
    if (includeTokens && job.tokens) {
      theme = await extractThemeTokens(session.page, job);
      samples = await extractSamples(session.page);
    }

    return {
      ...state,
      name: viewport.name,
      screenshot: job.screenshot ? outputPath : null,
      warmup,
      durationMs: Date.now() - startedAt,
      theme,
      samples,
    };
  } finally {
    await closePageSession(session, job);
  }
}

async function captureSourceJob(playwright, job) {
  fs.mkdirSync(job.outputDir, { recursive: true });
  const responsiveDir = path.join(job.outputDir, 'responsive');
  const viewport = { name: 'desktop', ...job.viewport };
  const mainScreenshotPath = path.join(job.outputDir, 'screenshot.png');

  const main = await captureViewport(playwright, job, viewport, mainScreenshotPath, { includeTokens: true });
  const responsive = {};

  if (job.responsive) {
    fs.mkdirSync(responsiveDir, { recursive: true });
    for (const item of job.responsiveViewports) {
      const screenshotPath = path.join(responsiveDir, `${item.name}.png`);
      responsive[item.name] = await captureViewport(playwright, job, item, screenshotPath, {
        includeTokens: false,
      });
    }
  }

  const metadata = {
    tool: 'capture-theme-source',
    theme: job.theme,
    requestedUrl: job.url,
    finalUrl: main.url,
    title: main.title,
    viewport: job.viewport,
    responsiveViewports: job.responsiveViewports,
    outputDir: job.outputDir,
    files: {
      screenshot: job.screenshot ? 'screenshot.png' : null,
      responsive: job.responsive ? Object.fromEntries(Object.keys(responsive).map((name) => [name, `responsive/${name}.png`])) : {},
      theme: job.tokens ? 'theme.json' : null,
      computedTokens: job.tokens ? 'computed-tokens.json' : null,
    },
    page: {
      scrollHeight: main.scrollHeight,
      nodeCount: main.nodeCount,
    },
    responsive: Object.fromEntries(Object.entries(responsive).map(([name, value]) => [
      name,
      {
        url: value.url,
        title: value.title,
        viewport: value.viewport,
        scrollHeight: value.scrollHeight,
        nodeCount: value.nodeCount,
        screenshot: path.relative(job.outputDir, value.screenshot),
      },
    ])),
    captureOptions: {
      waitUntil: job.waitUntil,
      waitAfterLoadMs: job.waitAfterLoadMs,
      scrollWarmup: job.scrollWarmup,
      selector: job.selector || null,
      waitForSelectors: job.waitForSelectors,
      dismissSelectors: job.dismissSelectors,
      removeSelectors: job.removeSelectors,
      connectCdp: Boolean(job.connectCdp),
      browserExecutable: Boolean(job.browserExecutable),
      storageState: Boolean(job.storageState),
    },
    capturedAt: new Date().toISOString(),
  };

  if (job.tokens && main.theme) {
    fs.writeFileSync(path.join(job.outputDir, 'theme.json'), JSON.stringify(main.theme, null, 2));
    fs.writeFileSync(path.join(job.outputDir, 'computed-tokens.json'), JSON.stringify({
      page: {
        url: main.url,
        title: main.title,
        viewport: main.viewport,
        scrollHeight: main.scrollHeight,
        nodeCount: main.nodeCount,
      },
      responsive: metadata.responsive,
      tokens: summarizeTheme(main.theme),
      samples: main.samples,
    }, null, 2));
  }

  fs.writeFileSync(path.join(job.outputDir, 'meta.json'), JSON.stringify(metadata, null, 2));
  return metadata;
}

function showHelp() {
  console.log(`
Capture source evidence for building an Axhub Make theme.

Usage:
  pnpm exec node scripts/capture-theme-source.mjs https://example.com --theme example
  pnpm exec node scripts/capture-theme-source.mjs --url https://example.com --theme example -o .local/theme-capture-example

Outputs:
  .local/theme-capture-<theme>/
    screenshot.png
    responsive/desktop.png
    responsive/tablet.png
    responsive/mobile.png
    theme.json
    computed-tokens.json
    meta.json

Options:
  --theme NAME                         Theme key used for the default output path
  --url URL                            Source URL
  -o, --output DIR                     Output directory. Default: .local/theme-capture-<theme>
  --viewport WxH                       Desktop viewport. Default: 1440x900
  --responsive-viewports LIST          Comma list: desktop:1440x900,tablet:768x1024,mobile:390x844
  --selector SEL                       Scope token extraction to a selector
  --wait MS                            Extra wait after load. Default: 3000
  --wait-until STATE                   load, domcontentloaded, or networkidle. Default: domcontentloaded
  --wait-for-selector SEL              Wait for selector before capture. Repeatable
  --dismiss-selector SEL               Click optional overlay accept/close selector. Repeatable
  --remove-selector SEL                Hide noisy selector before capture. Repeatable
  --connect-cdp URL                    Reuse a running Chrome, for example http://localhost:9222
  --browser-executable PATH            Use a specific Chrome/Chromium executable
  --storage-state FILE                 Playwright storageState JSON
  --no-responsive                      Skip responsive screenshots
  --no-screenshot                      Skip screenshot files
  --no-tokens                          Skip theme.json and computed-tokens.json
  --dry-run                            Print resolved job without opening a browser
`);
}

async function runCli() {
  const args = parseSourceCaptureArgs(process.argv);
  if (args.help) {
    showHelp();
    return;
  }

  const job = resolveSourceCaptureJob(args);
  if (args.dryRun) {
    console.log(JSON.stringify(job, null, 2));
    return;
  }

  const playwright = await loadPlaywright();
  console.log(`[theme-source] ${job.theme} ${job.url}`);
  const metadata = await captureSourceJob(playwright, job);
  console.log(`[theme-source] wrote ${metadata.outputDir}`);
  console.log('[theme-source] files: screenshot.png, responsive/, theme.json, computed-tokens.json, meta.json');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(`[theme-source] ${error.stack || error.message || error}`);
    process.exitCode = 1;
  });
}
