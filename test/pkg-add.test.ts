import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import {
  gerritUrl,
  packageDest,
  parseUserPkg,
  primaryPackagesRoot,
} from '../src/local/pkg-add';
import { saveConfig } from '../src/local/config';

test('parseUserPkg', () => {
  assert.deepEqual(parseUserPkg('kongdd/utils'), { user: 'kongdd', pkg: 'utils' });
  assert.deepEqual(parseUserPkg('users/kongdd/utils'), { user: 'kongdd', pkg: 'utils' });
  assert.throws(() => parseUserPkg('only'), /非法/);
  assert.throws(() => parseUserPkg('a/b/c'), /非法/);
});

test('gerritUrl / packageDest', () => {
  assert.equal(
    gerritUrl('kongdd', 'utils'),
    'https://earthengine.googlesource.com/users/kongdd/utils',
  );
  assert.equal(
    packageDest('kongdd', 'utils', '/tmp/pkgs'),
    path.join('/tmp/pkgs', 'users', 'kongdd', 'utils'),
  );
});

test('primaryPackagesRoot 读 config', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gee-add-'));
  try {
    saveConfig({ packages: 'my_pkgs' }, 'project', cwd);
    assert.equal(primaryPackagesRoot(cwd), path.resolve(cwd, 'my_pkgs'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
