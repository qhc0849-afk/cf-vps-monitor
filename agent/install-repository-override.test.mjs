import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const DEFAULT_REPOSITORY = 'kadidalax/cf-vps-monitor';

// The repository assignment is evaluated in isolation so the override logic
// is covered without running the installers.
function evaluateShellAssignment(file, env) {
  const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
  const line = source.match(/^CF_MONITOR_REPOSITORY=.*$/m)?.[0];
  assert.ok(line, `${file} must keep a single CF_MONITOR_REPOSITORY assignment line`);
  const script = `${line}\nprintf '%s' "$CF_MONITOR_REPOSITORY"`;
  return execFileSync('sh', ['-c', script], { encoding: 'utf8', env });
}

for (const file of ['install.sh', 'install-linux.sh']) {
  test(`${file} uses the upstream repository when CF_MONITOR_REPOSITORY is unset or empty`, () => {
    const withoutEnv = { ...process.env };
    delete withoutEnv.CF_MONITOR_REPOSITORY;
    assert.equal(evaluateShellAssignment(file, withoutEnv), DEFAULT_REPOSITORY);
    assert.equal(evaluateShellAssignment(file, { ...process.env, CF_MONITOR_REPOSITORY: '' }), DEFAULT_REPOSITORY);
  });

  test(`${file} honors CF_MONITOR_REPOSITORY from the environment`, () => {
    assert.equal(
      evaluateShellAssignment(file, { ...process.env, CF_MONITOR_REPOSITORY: 'example/my-fork' }),
      'example/my-fork',
    );
  });
}

test('install-windows.ps1 prefers $env:CF_MONITOR_REPOSITORY and falls back to the upstream default', () => {
  const source = readFileSync(new URL('./install-windows.ps1', import.meta.url), 'utf8');
  assert.match(source, /^\$defaultRepository\s*=\s*"kadidalax\/cf-vps-monitor"/m);
  assert.match(source, /^\$repository\s*=\s*\$env:CF_MONITOR_REPOSITORY/m);
  assert.match(source, /if \(-not \$repository\) \{ \$repository = \$defaultRepository \}/);
  // The override must feed the same download URLs the hardcoded value fed.
  assert.match(source, /"https:\/\/github\.com\/\$repository\/releases\/latest\/download"/);
});
