#!/usr/bin/env node

import { runCli } from '../src/server/cli.ts';

runCli().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
