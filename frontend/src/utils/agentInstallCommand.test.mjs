import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp = await mkdtemp(join(tmpdir(), 'cf-monitor-agent-command-'));
const projectLinksSource = await readFile(new URL('./projectLinks.ts', import.meta.url), 'utf8');
const commandSource = await readFile(new URL('./agentInstallCommand.ts', import.meta.url), 'utf8');
await writeFile(join(tmp, 'projectLinks.ts'), projectLinksSource);
await writeFile(join(tmp, 'agentInstallCommand.ts'), commandSource.replace("from './projectLinks'", "from './projectLinks.ts'"));

const { buildAgentInstallCommand, buildAgentUninstallAllCommand, defaultAgentInstallOptions } = await import(pathToFileURL(join(tmp, 'agentInstallCommand.ts')).href);
const { CF_MONITOR_REPOSITORY } = await import(pathToFileURL(join(tmp, 'projectLinks.ts')).href);

const base = {
  serverUrl: 'https://panel.example',
  token: 'token123',
  options: { ...defaultAgentInstallOptions },
  instanceId: '33bc95df-513d-41be-8d98-30979fb17029',
  nodeName: 'node-123',
};

assert.equal(
  buildAgentInstallCommand({ platform: 'unix', ...base }),
  `wget -qO- 'https://raw.githubusercontent.com/${CF_MONITOR_REPOSITORY}/refs/heads/main/agent/install.sh' | sh -s -- '-s' 'https://panel.example' '-t' 'token123' '-n' 'node-123' '-i' '33bc95df-513d-41be-8d98-30979fb17029'`,
);

assert.equal(
  buildAgentInstallCommand({
    platform: 'unix',
    ...base,
    options: { ...defaultAgentInstallOptions, trafficResetDay: '15', downloadProxy: '127.0.0.1:10808' },
  }),
  `wget -qO- 'https://raw.githubusercontent.com/${CF_MONITOR_REPOSITORY}/refs/heads/main/agent/install.sh' | sh -s -- '-s' 'https://panel.example' '-t' 'token123' '-r' '15' '-n' 'node-123' '-i' '33bc95df-513d-41be-8d98-30979fb17029' '--proxy' 'http://127.0.0.1:10808'`,
);

assert.equal(
  buildAgentInstallCommand({
    platform: 'unix',
    ...base,
    options: { ...defaultAgentInstallOptions, installMode: 'user' },
  }),
  `wget -qO- 'https://raw.githubusercontent.com/${CF_MONITOR_REPOSITORY}/refs/heads/main/agent/install.sh' | sh -s -- '-s' 'https://panel.example' '-t' 'token123' '-n' 'node-123' '-i' '33bc95df-513d-41be-8d98-30979fb17029' '--install-mode' 'user'`,
);

assert.equal(
  buildAgentUninstallAllCommand({ platform: 'unix' }),
  `wget -qO- 'https://raw.githubusercontent.com/${CF_MONITOR_REPOSITORY}/refs/heads/main/agent/install.sh' | sh -s -- '--uninstall-all' '--yes'`,
);

// Build-time injection: VITE_CF_MONITOR_REPOSITORY replaces the default repo
// in install commands, and a blank value keeps the upstream default. The
// substitution below stands in for Vite's static define replacement of the
// __CF_MONITOR_REPOSITORY__ global (see vite.config.ts).
for (const [injected, expected] of [
  ['example/my-fork', 'example/my-fork'],
  ['   ', 'kadidalax/cf-vps-monitor'],
]) {
  const injectedDir = await mkdtemp(join(tmpdir(), 'cf-monitor-agent-command-injected-'));
  assert.ok(projectLinksSource.includes('__CF_MONITOR_REPOSITORY__'), 'projectLinks.ts must read the build-time define');
  const injectedSource = projectLinksSource.replaceAll('__CF_MONITOR_REPOSITORY__', JSON.stringify(injected));
  assert.equal(injectedSource.includes('__CF_MONITOR_REPOSITORY__'), false, 'the injection simulation must rewrite the define, not leave it for the fallback');
  await writeFile(join(injectedDir, 'projectLinks.ts'), injectedSource);
  await writeFile(join(injectedDir, 'agentInstallCommand.ts'), commandSource.replace("from './projectLinks'", "from './projectLinks.ts'"));
  const injectedModule = await import(pathToFileURL(join(injectedDir, 'agentInstallCommand.ts')).href);
  const injectedLinks = await import(pathToFileURL(join(injectedDir, 'projectLinks.ts')).href);
  assert.equal(injectedLinks.CF_MONITOR_REPOSITORY, expected);
  assert.equal(
    injectedModule.buildAgentInstallCommand({ platform: 'unix', ...base }),
    `wget -qO- 'https://raw.githubusercontent.com/${expected}/refs/heads/main/agent/install.sh' | sh -s -- '-s' 'https://panel.example' '-t' 'token123' '-n' 'node-123' '-i' '33bc95df-513d-41be-8d98-30979fb17029'`,
  );
  await rm(injectedDir, { recursive: true, force: true });
}

await rm(tmp, { recursive: true, force: true });
