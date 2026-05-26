#!/usr/bin/env node

const baseUrl = process.argv[2] || 'http://localhost:51720';
const targets = process.argv.slice(3).length > 0
  ? process.argv.slice(3)
  : [
      '/prototypes/ref-antd',
      '/prototypes/ref-app-home',
      '/themes/antd-new',
    ];

let hasFailure = false;

for (const target of targets) {
  const requestUrl = new URL(target, baseUrl).toString();

  try {
    const response = await fetch(requestUrl, {
      redirect: 'follow',
      headers: {
        Accept: 'text/html',
      },
    });

    const html = await response.text();
    const htmlProxyMatches = Array.from(
      html.matchAll(/src="([^"]*html-proxy[^"]*)"/g),
      (match) => match[1],
    );
    const loaderProxy = htmlProxyMatches.find((value) => value.includes('index=0.js')) || htmlProxyMatches[0] || null;

    let loaderScript = '';
    if (loaderProxy) {
      loaderScript = await fetch(new URL(loaderProxy, baseUrl)).then((res) => res.text());
    }

    const ok = response.ok
      && html.includes('<div id="root"></div>')
      && htmlProxyMatches.length >= 1
      && !html.includes('waitForBootstrap')
      && loaderScript.includes('import PreviewComponent from')
      && loaderScript.includes('import.meta.hot.accept(')
      && html.includes('<div id="root"></div>');

    if (!ok) {
      hasFailure = true;
      console.error(`[preview-smoke] FAIL ${requestUrl}`);
      console.error(`  status=${response.status}`);
      console.error(`  containsRoot=${html.includes('<div id="root"></div>')}`);
      console.error(`  htmlProxyCount=${htmlProxyMatches.length}`);
      console.error(`  removedLegacyLoader=${!html.includes('waitForBootstrap')}`);
      console.error(`  loaderProxy=${Boolean(loaderProxy)}`);
      console.error(`  loaderImportsEntry=${loaderScript.includes('import PreviewComponent from')}`);
      console.error(`  loaderHasAcceptBoundary=${loaderScript.includes('import.meta.hot.accept(')}`);
      continue;
    }

    console.log(`[preview-smoke] OK   ${requestUrl}`);
  } catch (error) {
    hasFailure = true;
    console.error(`[preview-smoke] ERROR ${requestUrl}`);
    console.error(`  ${(error && error.message) || error}`);
  }
}

if (hasFailure) {
  process.exitCode = 1;
}
