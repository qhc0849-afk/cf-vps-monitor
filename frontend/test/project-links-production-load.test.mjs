import assert from 'node:assert/strict';
import test from 'node:test';
import { productionModule } from './helpers/production-module.mjs';

// Regression test for the CI failure in PR #1: productionModule transpiles to
// CommonJS and evaluates with vm.runInNewContext as a classic script, where
// import.meta is a parse-time error. projectLinks.ts (and everything it is
// imported by) must stay loadable through this path, with the upstream
// default when no build-time repository define is present.
test('projectLinks loads through the vm-based production loader with the upstream default', () => {
  const links = productionModule('src/utils/projectLinks.ts');
  assert.equal(links.CF_MONITOR_REPOSITORY, 'kadidalax/cf-vps-monitor');
  assert.equal(links.CF_MONITOR_GITHUB_URL, 'https://github.com/kadidalax/cf-vps-monitor');
});

test('agentInstallCommand loads through the vm-based production loader and uses the upstream default', () => {
  const { buildAgentInstallCommand, defaultAgentInstallOptions } = productionModule('src/utils/agentInstallCommand.ts');
  const command = buildAgentInstallCommand({
    platform: 'unix',
    serverUrl: 'https://panel.example',
    token: 'token123',
    options: { ...defaultAgentInstallOptions },
    instanceId: '33bc95df-513d-41be-8d98-30979fb17029',
    nodeName: 'node-123',
  });
  assert.match(command, /raw\.githubusercontent\.com\/kadidalax\/cf-vps-monitor\/refs\/heads\/main\/agent\/install\.sh/);
});
