import assert from 'node:assert/strict';
import { resolveWrapperCommand } from './wrangler-wrapper.mjs';

assert.deepEqual(resolveWrapperCommand(['deploy']), {
  type: 'managed-deploy',
  mode: 'deploy',
  args: [],
});

assert.deepEqual(resolveWrapperCommand(['deploy', '--name', 'demo']), {
  type: 'managed-deploy',
  mode: 'deploy',
  args: ['--name', 'demo'],
});

assert.deepEqual(resolveWrapperCommand(['versions', 'upload', '--dry-run']), {
  type: 'managed-deploy',
  mode: 'versions-upload',
  args: ['--dry-run'],
});

assert.deepEqual(resolveWrapperCommand(['deploy', '--name', 'help']), {
  type: 'managed-deploy',
  mode: 'deploy',
  args: ['--name', 'help'],
});

// Help and version requests reach real Wrangler instead of managed deploy.
assert.deepEqual(resolveWrapperCommand(['deploy', '--help']), {
  type: 'passthrough',
  args: ['deploy', '--help'],
});

assert.deepEqual(resolveWrapperCommand(['deploy', '-h']), {
  type: 'passthrough',
  args: ['deploy', '-h'],
});

assert.deepEqual(resolveWrapperCommand(['deploy', 'help']), {
  type: 'passthrough',
  args: ['deploy', 'help'],
});

assert.deepEqual(resolveWrapperCommand(['deploy', '--name', 'demo', '--help']), {
  type: 'passthrough',
  args: ['deploy', '--name', 'demo', '--help'],
});

assert.deepEqual(resolveWrapperCommand(['deploy', '--version']), {
  type: 'passthrough',
  args: ['deploy', '--version'],
});

assert.deepEqual(resolveWrapperCommand(['versions', 'upload', '--help']), {
  type: 'passthrough',
  args: ['versions', 'upload', '--help'],
});

assert.deepEqual(resolveWrapperCommand(['versions', 'upload', 'help']), {
  type: 'passthrough',
  args: ['versions', 'upload', 'help'],
});

assert.deepEqual(resolveWrapperCommand(['secret', 'list']), {
  type: 'passthrough',
  args: ['secret', 'list'],
});
