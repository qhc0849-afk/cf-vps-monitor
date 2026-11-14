import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_MONITOR_REPOSITORY, agentScriptRawUrl, resolveMonitorRepository } from './monitor-repository.ts';

test('the default repository is the upstream repository', () => {
  assert.equal(DEFAULT_MONITOR_REPOSITORY, 'kadidalax/cf-vps-monitor');
  assert.equal(resolveMonitorRepository(undefined), DEFAULT_MONITOR_REPOSITORY);
  assert.equal(resolveMonitorRepository(''), DEFAULT_MONITOR_REPOSITORY);
  assert.equal(resolveMonitorRepository('   '), DEFAULT_MONITOR_REPOSITORY);
});

test('a configured owner/repo value is used as-is', () => {
  assert.equal(resolveMonitorRepository('example/my-fork'), 'example/my-fork');
  assert.equal(resolveMonitorRepository('  example/my-fork  '), 'example/my-fork');
  assert.equal(resolveMonitorRepository('my_org/my.repo-1'), 'my_org/my.repo-1');
});

for (const value of [
  'not-a-repository',
  'a/b/c',
  'owner/',
  '/repo',
  'owner/../repo',
  'owner/./repo',
  '../repo',
  'owner/repo?x=1',
  'owner/repo#frag',
  'owner/repo with space',
  'https://github.com/owner/repo',
  42,
  null,
  {},
]) {
  test(`malformed repository value ${JSON.stringify(value)} falls back to the default`, () => {
    assert.equal(resolveMonitorRepository(value), DEFAULT_MONITOR_REPOSITORY);
  });
}

test('install-script URLs stay on raw.githubusercontent.com with the configured repository', () => {
  assert.equal(
    agentScriptRawUrl('example/my-fork', 'install.sh'),
    'https://raw.githubusercontent.com/example/my-fork/main/agent/install.sh',
  );
  assert.equal(
    agentScriptRawUrl(DEFAULT_MONITOR_REPOSITORY, 'install-windows.ps1'),
    'https://raw.githubusercontent.com/kadidalax/cf-vps-monitor/main/agent/install-windows.ps1',
  );
});
