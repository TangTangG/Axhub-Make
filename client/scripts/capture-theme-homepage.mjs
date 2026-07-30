#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DEFAULT_CAPTURE_OPTIONS = {
  viewport: { width: 1440, height: 1200 },
  deviceScaleFactor: 1,
  format: 'webp',
  quality: 88,
  timeoutMs: 60000,
  settleTimeoutMs: 10000,
  waitAfterLoadMs: 0,
  waitUntil: 'load',
  hideScrollbar: true,
  scrollWarmup: true,
  maxScrollSteps: 80,
  maxScreenshotHeight: 16383,
  headless: true,
};

const PLAYWRIGHT_CACHE_DIR = path.join(os.homedir(), '.cache', 'axure-extractor');
const CHROMIUM_ARGS = [
  '--allow-file-access-from-files',
  '--disable-web-security',
  '--disable-blink-features=AutomationControlled',
  '--ignore-certificate-errors',
  '--no-sandbox',
];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveMaybePath(value, baseDir) {
  if (!value) return value;
  return path.isAbsolute(value) ? value : path.resolve(baseDir, value);
}

function parseNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return parsed;
}

function parseInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return parsed;
}

export function normalizeViewport(value) {
  if (isObject(value)) {
    const width = parseInteger(value.width, 'viewport width');
    const height = parseInteger(value.height, 'viewport height');
    if (width <= 0 || height <= 0) {
      throw new Error(`Invalid viewport: ${JSON.stringify(value)}`);
    }
    return { width, height };
  }

  if (typeof value !== 'string') {
    throw new Error(`Invalid viewport: ${String(value)}`);
  }

  const match = value.trim().match(/^(\d+)x(\d+)$/i);
  if (!match) {
    throw new Error(`Invalid viewport: ${value}`);
  }

  return {
    width: parseInteger(match[1], 'viewport width'),
    height: parseInteger(match[2], 'viewport height'),
  };
}

function parseHeader(value) {
  const separatorIndex = value.includes('=') ? value.indexOf('=') : value.indexOf(':');
  if (separatorIndex <= 0) {
    throw new Error(`Invalid header, expected Name=Value: ${value}`);
  }

  const name = value.slice(0, separatorIndex).trim();
  const headerValue = value.slice(separatorIndex + 1).trim();
  if (!name) {
    throw new Error(`Invalid header, expected Name=Value: ${value}`);
  }

  return [name, headerValue];
}

function readRequiredValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parseCaptureArgs(argv = process.argv) {
  const args = {
    all: false,
    help: false,
    dryRun: false,
    waitForSelectors: [],
    dismissSelectors: [],
    removeSelectors: [],
    unstickSelectors: [],
    headers: {},
  };

  const rawArgs = argv.slice(2);
  for (let i = 0; i < rawArgs.length; i += 1) {
    const flag = rawArgs[i];

    if (flag === '--') {
      continue;
    } else if (flag === '--help' || flag === '-h') {
      args.help = true;
    } else if (flag === '--all') {
      args.all = true;
    } else if (flag === '--dry-run') {
      args.dryRun = true;
    } else if (flag === '--theme') {
      args.theme = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--url') {
      args.url = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--config') {
      args.config = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--output') {
      args.output = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--capture-root') {
      args.captureRoot = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--viewport') {
      args.viewport = normalizeViewport(readRequiredValue(rawArgs, i, flag));
      i += 1;
    } else if (flag === '--device-scale-factor') {
      args.deviceScaleFactor = parseNumber(readRequiredValue(rawArgs, i, flag), flag);
      i += 1;
    } else if (flag === '--format') {
      args.format = readRequiredValue(rawArgs, i, flag).toLowerCase();
      i += 1;
    } else if (flag === '--quality') {
      args.quality = parseInteger(readRequiredValue(rawArgs, i, flag), flag);
      i += 1;
    } else if (flag === '--timeout') {
      args.timeoutMs = parseInteger(readRequiredValue(rawArgs, i, flag), flag);
      i += 1;
    } else if (flag === '--settle-timeout') {
      args.settleTimeoutMs = parseInteger(readRequiredValue(rawArgs, i, flag), flag);
      i += 1;
    } else if (flag === '--wait') {
      args.waitAfterLoadMs = parseInteger(readRequiredValue(rawArgs, i, flag), flag);
      i += 1;
    } else if (flag === '--wait-until') {
      args.waitUntil = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--max-scroll-steps') {
      args.maxScrollSteps = parseInteger(readRequiredValue(rawArgs, i, flag), flag);
      i += 1;
    } else if (flag === '--max-screenshot-height') {
      args.maxScreenshotHeight = parseInteger(readRequiredValue(rawArgs, i, flag), flag);
      i += 1;
    } else if (flag === '--hide-scrollbar') {
      args.hideScrollbar = true;
    } else if (flag === '--show-scrollbar') {
      args.hideScrollbar = false;
    } else if (flag === '--scroll-warmup') {
      args.scrollWarmup = true;
    } else if (flag === '--no-scroll-warmup') {
      args.scrollWarmup = false;
    } else if (flag === '--headless') {
      args.headless = true;
    } else if (flag === '--no-headless') {
      args.headless = false;
    } else if (flag === '--connect-cdp') {
      args.connectCdp = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--browser-executable') {
      args.browserExecutable = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--storage-state') {
      args.storageState = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--cookie-file') {
      args.cookieFile = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--http-user') {
      args.httpUser = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--http-pass') {
      args.httpPass = readRequiredValue(rawArgs, i, flag);
      i += 1;
    } else if (flag === '--header') {
      const [name, value] = parseHeader(readRequiredValue(rawArgs, i, flag));
      args.headers[name] = value;
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
    } else if (flag === '--unstick-selector') {
      args.unstickSelectors.push(readRequiredValue(rawArgs, i, flag));
      i += 1;
    } else if (flag.startsWith('--')) {
      throw new Error(`Unknown option: ${flag}`);
    } else if (!args.theme) {
      args.theme = flag;
    } else if (!args.url) {
      args.url = flag;
    } else {
      throw new Error(`Unexpected argument: ${flag}`);
    }
  }

  return args;
}

export function findWorkspaceRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startDir);
    }
    current = parent;
  }
}

function normalizeSelectorList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return [String(value)];
}

function normalizeHeaders(value) {
  if (!value) return {};
  if (Array.isArray(value)) {
    return Object.fromEntries(value.map((item) => parseHeader(String(item))));
  }
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, String(val)]));
  }
  throw new Error('headers must be an object or array');
}

function normalizeOptionBag(value = {}) {
  const bag = { ...value };
  if (bag.viewport) bag.viewport = normalizeViewport(bag.viewport);
  if (bag.headers) bag.headers = normalizeHeaders(bag.headers);
  if (bag.waitForSelectors) bag.waitForSelectors = normalizeSelectorList(bag.waitForSelectors);
  if (bag.dismissSelectors) bag.dismissSelectors = normalizeSelectorList(bag.dismissSelectors);
  if (bag.removeSelectors) bag.removeSelectors = normalizeSelectorList(bag.removeSelectors);
  if (bag.unstickSelectors) bag.unstickSelectors = normalizeSelectorList(bag.unstickSelectors);
  if (bag.format) bag.format = String(bag.format).toLowerCase();
  return bag;
}

function normalizeConfigThemes(themes) {
  if (!themes) return [];

  if (Array.isArray(themes)) {
    return themes.map((entry) => {
      if (typeof entry === 'string') {
        return { theme: entry };
      }
      return { ...entry };
    });
  }

  if (isObject(themes)) {
    return Object.entries(themes).map(([theme, entry]) => {
      if (typeof entry === 'string') {
        return { theme, url: entry };
      }
      return { theme, ...entry };
    });
  }

  throw new Error('config.themes must be an object or array');
}

function readThemeSource(theme, appRoot) {
  const themeJsonPath = path.join(appRoot, 'src', 'themes', theme, 'theme.json');
  if (!fs.existsSync(themeJsonPath)) {
    return {};
  }

  const themeJson = readJson(themeJsonPath);
  return themeJson.source || {};
}

function inferThemeFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').split('.')[0] || 'homepage';
  } catch {
    return 'homepage';
  }
}

function firstNonEmpty(...values) {
  return values.find((value) => typeof value === 'string' && value.length > 0);
}

function pickCaptureOptions(args) {
  const optionKeys = [
    'output',
    'captureRoot',
    'viewport',
    'deviceScaleFactor',
    'format',
    'quality',
    'timeoutMs',
    'settleTimeoutMs',
    'waitAfterLoadMs',
    'waitUntil',
    'hideScrollbar',
    'scrollWarmup',
    'maxScrollSteps',
    'maxScreenshotHeight',
    'headless',
    'connectCdp',
    'browserExecutable',
    'storageState',
    'cookieFile',
    'httpUser',
    'httpPass',
    'headers',
    'waitForSelectors',
    'dismissSelectors',
    'removeSelectors',
    'unstickSelectors',
  ];

  return Object.fromEntries(
    optionKeys
      .filter((key) => args[key] !== undefined)
      .map((key) => [key, args[key]]),
  );
}

function mergeJobOptions(...bags) {
  const job = {};
  for (const rawBag of bags) {
    const bag = normalizeOptionBag(rawBag);
    for (const [key, value] of Object.entries(bag)) {
      if (value === undefined) continue;
      if (
        key === 'waitForSelectors'
        || key === 'dismissSelectors'
        || key === 'removeSelectors'
        || key === 'unstickSelectors'
      ) {
        job[key] = [...(job[key] || []), ...normalizeSelectorList(value)];
      } else if (key === 'headers') {
        job.headers = { ...(job.headers || {}), ...normalizeHeaders(value) };
      } else {
        job[key] = value;
      }
    }
  }
  return job;
}

function resolveOutputPath({ output, theme, format, appRoot, multiple }) {
  if (!output) {
    return path.join(appRoot, 'src', 'themes', theme, 'assets', `official-homepage.${format}`);
  }

  const resolved = resolveMaybePath(output, appRoot);
  const extension = path.extname(resolved);
  if (extension && !multiple) {
    return resolved;
  }
  return path.join(resolved, theme, `official-homepage.${format}`);
}

function resolveConfigPath(configPath, appRoot) {
  return resolveMaybePath(configPath, appRoot);
}

export function resolveCaptureJobs(args, options = {}) {
  const appRoot = path.resolve(options.appRoot || process.cwd());
  const workspaceRoot = path.resolve(options.workspaceRoot || findWorkspaceRoot(appRoot));
  const config = args.config ? readJson(resolveConfigPath(args.config, appRoot)) : {};
  const configThemes = normalizeConfigThemes(config.themes);

  let entries = [];
  if (args.all) {
    if (configThemes.length === 0) {
      throw new Error('--all requires a config file with themes');
    }
    entries = configThemes;
  } else {
    const theme = args.theme || config.theme || (args.url ? inferThemeFromUrl(args.url) : null);
    if (!theme) {
      throw new Error('A theme is required. Pass --theme <name> or --all with a config file.');
    }
    const configEntry = configThemes.find((entry) => entry.theme === theme) || {};
    entries = [{ ...configEntry, theme }];
  }

  return entries.map((entry) => {
    const theme = entry.theme || inferThemeFromUrl(entry.url || args.url || '');
    const source = readThemeSource(theme, appRoot);
    const baseOptions = mergeJobOptions(
      DEFAULT_CAPTURE_OPTIONS,
      config.defaults || {},
      entry,
      pickCaptureOptions(args),
    );
    const format = baseOptions.format || DEFAULT_CAPTURE_OPTIONS.format;
    if (!['png', 'jpeg', 'webp'].includes(format)) {
      throw new Error(`Unsupported screenshot format: ${format}`);
    }

    const url = firstNonEmpty(args.url, entry.url, source.websiteUrl, source.originalDetailUrl);
    if (!url) {
      throw new Error(`No URL found for theme "${theme}". Pass --url or add source.websiteUrl to theme.json.`);
    }

    const captureRoot = resolveMaybePath(
      baseOptions.captureRoot || path.join(workspaceRoot, '.local', 'theme-captures'),
      appRoot,
    );
    const reportDir = path.join(captureRoot, theme);
    const outputPath = resolveOutputPath({
      output: baseOptions.output,
      theme,
      format,
      appRoot,
      multiple: entries.length > 1,
    });

    return {
      ...baseOptions,
      theme,
      url,
      format,
      appRoot,
      workspaceRoot,
      captureRoot,
      reportDir,
      reportPath: path.join(reportDir, 'meta.json'),
      outputPath,
      storageState: resolveMaybePath(baseOptions.storageState, appRoot),
      cookieFile: resolveMaybePath(baseOptions.cookieFile, appRoot),
    };
  });
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
    'Playwright is not available. Install it with npm, or run the existing clone-page tool once to populate the shared cache.',
  );
}

function chromiumCandidatePaths(platform = process.platform) {
  if (platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }

  if (platform === 'win32') {
    return [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
  }

  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ];
}

export function resolveChromiumLaunchOptions(job, options = {}) {
  const exists = options.exists || fs.existsSync;
  const candidatePaths = options.candidatePaths || chromiumCandidatePaths();
  const executablePath = job.browserExecutable
    || candidatePaths.find((candidate) => exists(candidate));

  return {
    headless: job.headless,
    args: CHROMIUM_ARGS,
    ...(executablePath ? { executablePath } : {}),
  };
}

export function resolveScreenshotPlan(job) {
  if (job.format === 'webp') {
    return {
      playwrightType: 'png',
      screenshotPath: path.join(job.reportDir, 'official-homepage-source.png'),
      outputPath: job.outputPath,
      needsConversion: true,
    };
  }

  return {
    playwrightType: job.format,
    screenshotPath: job.outputPath,
    outputPath: job.outputPath,
    needsConversion: false,
  };
}

export function resolveScreenshotBox(job, visualState) {
  const sourceHeight = Math.max(
    visualState?.scrollHeight || 0,
    visualState?.bodyHeight || 0,
    job.viewport.height,
  );
  const maxHeight = job.maxScreenshotHeight;
  const shouldClip = job.format === 'webp'
    && Number.isFinite(maxHeight)
    && maxHeight > 0
    && sourceHeight > maxHeight;

  if (shouldClip) {
    return {
      fullPage: false,
      viewport: { width: job.viewport.width, height: maxHeight },
      clipped: true,
      sourceHeight,
      outputHeight: maxHeight,
    };
  }

  return {
    fullPage: true,
    clipped: false,
    sourceHeight,
    outputHeight: sourceHeight,
  };
}

function findExecutable(command, envPath = process.env.PATH || '') {
  const names = process.platform === 'win32' && !command.endsWith('.exe')
    ? [command, `${command}.exe`]
    : [command];

  for (const dir of envPath.split(path.delimiter)) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function convertToWebp(inputPath, outputPath, quality) {
  const cwebp = findExecutable('cwebp');
  if (cwebp) {
    execFileSync(cwebp, ['-quiet', '-q', String(quality), inputPath, '-o', outputPath]);
    return 'cwebp';
  }

  const magick = findExecutable('magick');
  if (magick) {
    execFileSync(magick, [inputPath, '-quality', String(quality), outputPath]);
    return 'magick';
  }

  const convert = findExecutable('convert');
  if (convert) {
    execFileSync(convert, [inputPath, '-quality', String(quality), outputPath]);
    return 'convert';
  }

  throw new Error('WebP output requires cwebp, ImageMagick magick, or ImageMagick convert in PATH.');
}

function identifyImage(imagePath) {
  const magick = findExecutable('magick');
  const identify = magick ? [magick, 'identify'] : [findExecutable('identify') || 'identify'];
  const output = execFileSync(identify[0], [...identify.slice(1), '-format', '%w %h', imagePath], {
    encoding: 'utf8',
  }).trim();
  const [width, height] = output.split(/\s+/).map((value) => Number.parseInt(value, 10));
  return { width, height };
}

export function resolveWidthNormalization(job, image) {
  const width = Math.min(job.viewport.width, image.width);
  return {
    needed: image.width !== job.viewport.width,
    width,
    height: image.height,
    x: 0,
    y: 0,
  };
}

function normalizeImageWidth(imagePath, job) {
  const image = identifyImage(imagePath);
  const normalize = resolveWidthNormalization(job, image);
  if (!normalize.needed) {
    return { ...normalize, originalWidth: image.width, originalHeight: image.height, tool: null };
  }

  const magick = findExecutable('magick');
  if (magick) {
    execFileSync(magick, [
      imagePath,
      '-crop',
      `${normalize.width}x${normalize.height}+${normalize.x}+${normalize.y}`,
      '+repage',
      imagePath,
    ]);
    return { ...normalize, originalWidth: image.width, originalHeight: image.height, tool: 'magick' };
  }

  const convert = findExecutable('convert');
  if (convert) {
    execFileSync(convert, [
      imagePath,
      '-crop',
      `${normalize.width}x${normalize.height}+${normalize.x}+${normalize.y}`,
      '+repage',
      imagePath,
    ]);
    return { ...normalize, originalWidth: image.width, originalHeight: image.height, tool: 'convert' };
  }

  throw new Error('Width normalization requires ImageMagick magick or convert in PATH.');
}

async function openPage(playwright, job) {
  let browser;
  let context;
  let page;
  let ownsContext = true;

  if (job.connectCdp) {
    browser = await playwright.chromium.connectOverCDP(job.connectCdp);
    context = browser.contexts()[0] || await browser.newContext();
    ownsContext = browser.contexts()[0] !== context;
    page = await context.newPage();
    await page.setViewportSize(job.viewport);
    await context.setExtraHTTPHeaders(job.headers || {});
  } else {
    browser = await playwright.chromium.launch(resolveChromiumLaunchOptions(job));
    context = await browser.newContext({
      viewport: job.viewport,
      deviceScaleFactor: job.deviceScaleFactor,
      storageState: job.storageState && fs.existsSync(job.storageState) ? job.storageState : undefined,
      extraHTTPHeaders: job.headers,
      httpCredentials: job.httpUser && job.httpPass
        ? { username: job.httpUser, password: job.httpPass }
        : undefined,
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();
  }

  if (job.cookieFile) {
    const cookies = readJson(job.cookieFile);
    await context.addCookies(Array.isArray(cookies) ? cookies : cookies.cookies || []);
  }

  return { browser, context, page, ownsContext };
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
  const unstickCss = (job.unstickSelectors || [])
    .map((selector) => `${selector} { position: static !important; top: auto !important; }`)
    .join('\n');

  await page.addStyleTag({
    content: `
${scrollbarCss}
* {
  caret-color: transparent !important;
}
${removeCss}
${unstickCss}
`,
  });
}

async function dismissOverlays(page, selectors) {
  for (const selector of selectors || []) {
    try {
      const locator = page.locator(selector).first();
      await locator.click({ timeout: 1500 });
      await page.waitForTimeout(300);
    } catch {
      // Optional dismiss selectors should never fail a capture.
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
  const result = await page.evaluate(async ({ maxScrollSteps }) => {
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

  return result;
}

async function getVisualState(page) {
  return page.evaluate(() => {
    const scrollingElement = document.scrollingElement || document.documentElement;
    const images = Array.from(document.images);
    return {
      scrollHeight: scrollingElement.scrollHeight,
      clientHeight: scrollingElement.clientHeight,
      bodyHeight: document.body?.scrollHeight || 0,
      imageTotal: images.length,
      imageComplete: images.filter((image) => image.complete).length,
      fontStatus: document.fonts?.status || 'unsupported',
      nodeCount: document.querySelectorAll('*').length,
    };
  });
}

function visualStateKey(state) {
  return [
    state.scrollHeight,
    state.bodyHeight,
    state.imageTotal,
    state.imageComplete,
    state.fontStatus,
    state.nodeCount,
  ].join('|');
}

async function waitForVisualStable(page, timeoutMs) {
  const startedAt = Date.now();
  let lastKey = '';
  let lastState = null;
  let stablePasses = 0;

  while (Date.now() - startedAt < timeoutMs) {
    const state = await getVisualState(page);
    const key = visualStateKey(state);
    const assetsReady = state.imageTotal === state.imageComplete
      && (state.fontStatus === 'loaded' || state.fontStatus === 'unsupported');

    if (key === lastKey && assetsReady) {
      stablePasses += 1;
    } else {
      stablePasses = 0;
    }

    lastKey = key;
    lastState = state;
    if (stablePasses >= 2) {
      return { stable: true, elapsedMs: Date.now() - startedAt, state };
    }
    await page.waitForTimeout(400);
  }

  return { stable: false, elapsedMs: Date.now() - startedAt, state: lastState };
}

async function captureJob(playwright, job) {
  fs.mkdirSync(path.dirname(job.outputPath), { recursive: true });
  fs.mkdirSync(job.reportDir, { recursive: true });

  const { browser, context, page, ownsContext } = await openPage(playwright, job);
  const startedAt = Date.now();
  let warmup = null;
  let stability = null;

  try {
    await page.goto(job.url, { waitUntil: job.waitUntil, timeout: job.timeoutMs });
    await injectCaptureCss(page, job);
    await waitForSelectors(page, job.waitForSelectors, job.timeoutMs);
    await dismissOverlays(page, job.dismissSelectors);
    if (job.waitAfterLoadMs > 0) {
      await page.waitForTimeout(job.waitAfterLoadMs);
    }
    await waitForFontsAndImages(page, job.settleTimeoutMs);
    if (job.scrollWarmup) {
      warmup = await scrollWarmup(page, job);
      await waitForFontsAndImages(page, job.settleTimeoutMs);
    }
    stability = await waitForVisualStable(page, job.settleTimeoutMs);
    await injectCaptureCss(page, job);

    const preScreenshotState = await getVisualState(page);
    const screenshotPlan = resolveScreenshotPlan(job);
    const screenshotBox = resolveScreenshotBox(job, preScreenshotState);
    fs.mkdirSync(path.dirname(screenshotPlan.screenshotPath), { recursive: true });

    const screenshotOptions = {
      path: screenshotPlan.screenshotPath,
      fullPage: screenshotBox.fullPage,
      type: screenshotPlan.playwrightType,
      animations: 'disabled',
      caret: 'hide',
      timeout: job.timeoutMs,
    };
    if (screenshotBox.viewport) {
      await page.setViewportSize(screenshotBox.viewport);
      await page.waitForTimeout(250);
    }
    if (screenshotPlan.playwrightType === 'jpeg') {
      screenshotOptions.quality = job.quality;
    }

    await page.screenshot(screenshotOptions);
    const converter = screenshotPlan.needsConversion
      ? convertToWebp(screenshotPlan.screenshotPath, screenshotPlan.outputPath, job.quality)
      : null;
    const widthNormalization = normalizeImageWidth(screenshotPlan.outputPath, job);

    const finalState = await getVisualState(page);
    const metadata = {
      theme: job.theme,
      requestedUrl: job.url,
      finalUrl: page.url(),
      title: await page.title(),
      outputPath: job.outputPath,
      viewport: job.viewport,
      format: job.format,
      quality: job.format === 'png' ? undefined : job.quality,
      hideScrollbar: job.hideScrollbar,
      scrollWarmup: job.scrollWarmup,
      screenshotPlan,
      screenshotBox,
      converter,
      widthNormalization,
      warmup,
      stability,
      finalState,
      durationMs: Date.now() - startedAt,
      fileSize: fs.statSync(job.outputPath).size,
      capturedAt: new Date().toISOString(),
      auth: {
        connectCdp: Boolean(job.connectCdp),
        storageState: Boolean(job.storageState),
        cookieFile: Boolean(job.cookieFile),
        httpCredentials: Boolean(job.httpUser && job.httpPass),
        headers: Object.keys(job.headers || {}),
      },
    };

    fs.writeFileSync(job.reportPath, JSON.stringify(metadata, null, 2));
    return metadata;
  } finally {
    await page.close().catch(() => {});
    if (!job.connectCdp && ownsContext) {
      await context.close().catch(() => {});
    }
    if (!job.connectCdp) {
      await browser.close().catch(() => {});
    }
  }
}

function showHelp() {
  console.log(`
Capture a long full-page official homepage screenshot for a theme.

Usage:
  npm run capture:theme -- --theme linear
  npm run capture:theme -- --theme linear --url https://linear.app
  npm run capture:theme -- --config theme-capture.json --all

Options:
  --theme NAME                 Theme directory name under src/themes
  --url URL                    Homepage URL. Defaults to theme.json source.websiteUrl
  --config FILE                JSON config with defaults and themes
  --all                        Capture every theme from config
  --output PATH                Output file for one theme, or output directory for batch
  --viewport WxH               Viewport before full-page capture. Default: 1440x1200
  --hide-scrollbar             Hide scrollbars before screenshot. Default
  --show-scrollbar             Keep scrollbars visible
  --scroll-warmup              Scroll down and back up to trigger lazy loading. Default
  --no-scroll-warmup           Disable lazy-load warmup
  --max-screenshot-height N    Cap WebP output height. Default: 16383
  --wait-for-selector SEL      Wait for selector before capture. Repeatable
  --dismiss-selector SEL       Click optional overlay close/accept selector. Repeatable
  --remove-selector SEL        Hide noisy selector before capture. Repeatable
  --unstick-selector SEL       Make sticky selector static before capture. Repeatable
  --connect-cdp URL            Reuse a logged-in Chrome, for example http://localhost:9222
  --browser-executable PATH    Use a specific Chrome/Chromium executable
  --storage-state FILE         Playwright storageState JSON
  --cookie-file FILE           Playwright cookies JSON or { "cookies": [] }
  --header Name=Value          Extra HTTP header. Repeatable
  --http-user USER             Basic auth username
  --http-pass PASS             Basic auth password
  --dry-run                    Print resolved jobs without opening a browser
`);
}

async function runCli() {
  const args = parseCaptureArgs(process.argv);
  if (args.help) {
    showHelp();
    return;
  }

  const jobs = resolveCaptureJobs(args);
  if (args.dryRun) {
    console.log(JSON.stringify(jobs, null, 2));
    return;
  }

  const playwright = await loadPlaywright();
  for (const job of jobs) {
    console.log(`[theme-capture] ${job.theme} ${job.url}`);
    const metadata = await captureJob(playwright, job);
    console.log(`[theme-capture] wrote ${metadata.outputPath}`);
    console.log(`[theme-capture] report ${job.reportPath}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(`[theme-capture] ${error.stack || error.message || error}`);
    process.exitCode = 1;
  });
}
