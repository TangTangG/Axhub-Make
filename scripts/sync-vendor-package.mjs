#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadVendorPackagesConfig,
  syncVendorPackages,
  withVendorSyncLock,
} from './utils/vendor-packages.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const shouldBuild = !args.has('--skip-build');

const config = loadVendorPackagesConfig(appRoot);
const result = withVendorSyncLock(
  appRoot,
  () => syncVendorPackages(appRoot, config, { shouldBuild }),
);
const packageNames = [...new Set(result.packages.map((pkg) => pkg.packageName))].join(', ');
console.log(`Synced make-server vendor packages: ${packageNames}`);
