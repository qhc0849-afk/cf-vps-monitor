#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const managedDeploy = join(root, 'scripts', 'deploy-cloudflare.mjs');
const realWrangler = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

const HELP_FLAGS = new Set(['--help', '-h', '--version']);

// Help and version requests must reach real Wrangler directly: routing them
// through the managed deploy entrypoint would run full verification instead
// of printing help. Bare `help`/`version` only count in the first position so
// a value such as `--name help` still deploys.
function isHelpRequest(subArgs) {
  return subArgs.some(arg => HELP_FLAGS.has(arg)) || subArgs[0] === 'help' || subArgs[0] === 'version';
}

export function resolveWrapperCommand(args) {
  if (args[0] === 'deploy' && !isHelpRequest(args.slice(1))) {
    return { type: 'managed-deploy', mode: 'deploy', args: args.slice(1) };
  }
  if (args[0] === 'versions' && args[1] === 'upload' && !isHelpRequest(args.slice(2))) {
    return { type: 'managed-deploy', mode: 'versions-upload', args: args.slice(2) };
  }
  return { type: 'passthrough', args };
}

function run() {
  const command = resolveWrapperCommand(process.argv.slice(2));
  const child = command.type === 'managed-deploy'
    ? spawnSync(process.execPath, [managedDeploy, ...command.args], {
      cwd: root,
      env: { ...process.env, CF_MONITOR_DEPLOY_COMMAND: command.mode },
      stdio: 'inherit',
    })
    : spawnSync(process.execPath, [realWrangler, ...command.args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });
  process.exit(child.status ?? 1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
