import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { checkWranglerConfigs, parseWranglerToml } from './check-wrangler-configs.mjs';

const ROOT_CONFIG = `
name = "cf-vps-monitor"
main = "worker/src/index.ts"
compatibility_date = "2026-06-21"
compatibility_flags = ["nodejs_compat"]
workers_dev = true
preview_urls = true

[placement]
mode = "smart"

[triggers]
crons = ["*/2 * * * *"]

[[durable_objects.bindings]]
name = "LIVE_DATA"
class_name = "LiveDataDO"

[vars]
SUPABASE_URL = "https://PROJECT_REF.supabase.co"
CF_MONITOR_REPOSITORY = "kadidalax/cf-vps-monitor"

[assets]
directory = "frontend/dist"
not_found_handling = "single-page-application"
`;

const WORKER_CONFIG = `
name = "cf-vps-monitor"
main = "src/index.ts"
compatibility_date = "2026-06-21"
compatibility_flags = ["nodejs_compat"]

[placement]
mode = "smart"

[triggers]
crons = ["*/2 * * * *"]

[[durable_objects.bindings]]
name = "LIVE_DATA"
class_name = "LiveDataDO"

[vars]
SUPABASE_URL = "https://PROJECT_REF.supabase.co"
CF_MONITOR_REPOSITORY = "kadidalax/cf-vps-monitor"

[assets]
directory = "../frontend/dist"
not_found_handling = "single-page-application"
`;

function writeFixture({ root = ROOT_CONFIG, worker = WORKER_CONFIG, example = WORKER_CONFIG } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wrangler-configs-'));
  for (const [relative, contents] of [['wrangler.toml', root], ['worker/wrangler.toml', worker], ['worker/wrangler.example.toml', example]]) {
    const path = join(dir, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
  return dir;
}

test('the parser reads sections, dotted paths, arrays of tables, and arrays', () => {
  const parsed = parseWranglerToml(ROOT_CONFIG, 'fixture');
  assert.equal(parsed.name, 'cf-vps-monitor');
  assert.equal(parsed.placement.mode, 'smart');
  assert.deepEqual(parsed.triggers.crons, ['*/2 * * * *']);
  assert.deepEqual(parsed.durable_objects.bindings, [{ name: 'LIVE_DATA', class_name: 'LiveDataDO' }]);
  assert.equal(parsed.vars.CF_MONITOR_REPOSITORY, 'kadidalax/cf-vps-monitor');
  assert.equal(parsed.workers_dev, true);
});

test('consistent configurations pass despite the allowed path and dev-key differences', () => {
  const result = checkWranglerConfigs({ root: writeFixture() });
  assert.deepEqual(result, { ok: true, problems: [] });
});

test('a missing placement section in the worker config fails with the differing path', () => {
  const worker = WORKER_CONFIG.replace('[placement]\nmode = "smart"\n\n', '');
  const result = checkWranglerConfigs({ root: writeFixture({ worker, example: worker }) });
  assert.equal(result.ok, false);
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /placement: root wrangler\.toml has \{"mode":"smart"\}, worker\/wrangler\.toml has missing/);
  assert.match(result.problems[0], /root wrangler\.toml and worker\/wrangler\.toml differ/);
});

test('a changed variable value in one config fails', () => {
  const root = ROOT_CONFIG.replace('kadidalax/cf-vps-monitor', 'example/my-fork');
  const result = checkWranglerConfigs({ root: writeFixture({ root }) });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some(problem => problem.includes('vars.CF_MONITOR_REPOSITORY')));
});

test('the example must match the worker config exactly, including paths', () => {
  const example = WORKER_CONFIG.replace('directory = "../frontend/dist"', 'directory = "frontend/dist"');
  const result = checkWranglerConfigs({ root: writeFixture({ example }) });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some(problem => problem.includes('assets.directory') && problem.includes('example must match exactly')));
});

test('a missing config file fails instead of passing silently', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wrangler-configs-missing-'));
  writeFileSync(join(dir, 'wrangler.toml'), ROOT_CONFIG);
  const result = checkWranglerConfigs({ root: dir });
  assert.equal(result.ok, false);
  assert.equal(result.problems.length, 2);
  assert.ok(result.problems.every(problem => problem.includes('could not be read')));
});

test('an unparsable config fails with a parse problem', () => {
  const result = checkWranglerConfigs({ root: writeFixture({ worker: 'this is = not [valid toml' }) });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some(problem => problem.includes('worker wrangler.toml')));
});
