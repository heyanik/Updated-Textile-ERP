#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const appName = process.env.NATIVEFIER_APP_NAME || 'Textile ERP';
const targetUrl = process.env.NATIVEFIER_URL || 'http://127.0.0.1:5173';
const outputDir = process.env.NATIVEFIER_OUTPUT || path.join(rootDir, 'dist', 'desktop');
const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
const iconPath = path.join(rootDir, 'public', iconName);

if (!existsSync(iconPath)) {
  console.error(`Missing desktop icon: ${iconPath}`);
  process.exit(1);
}

console.log(`Packaging desktop app "${appName}" with icon ${iconPath}`);

const args = [
  'nativefier',
  '--name',
  appName,
  '--icon',
  iconPath,
  '--single-instance',
  '--fast-quit',
  '--disable-dev-tools',
  targetUrl,
  outputDir,
];

const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
  cwd: rootDir,
  stdio: 'inherit',
});

if (result.error) {
  console.error('\nNativefier is not available. Install it with:\n  npm install -g nativefier\nor run:\n  npx nativefier ...');
  process.exit(1);
}

process.exit(result.status ?? 0);
