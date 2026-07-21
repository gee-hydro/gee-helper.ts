import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import {
  geeIdToRelPath,
  isNodeModuleId,
  resolveGeePackage,
  withGeePackageRequire,
} from '../src/local/gee-require';
import { runInScriptContext, setupLocalHost } from '../src/local/local-host';

test('isNodeModuleId / geeIdToRelPath', () => {
  assert.equal(isNodeModuleId('./x'), true);
  assert.equal(isNodeModuleId('node:fs'), true);
  assert.equal(isNodeModuleId('region.js'), false);
  assert.equal(geeIdToRelPath('users/kongdd/utils:math.js'), 'users/kongdd/utils/math.js');
  assert.equal(geeIdToRelPath('hydro/mask.js'), 'hydro/mask.js');
});

test('resolveGeePackage: 须带 .js（GEE 语法）', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gee-pkg-'));
  try {
    fs.mkdirSync(path.join(root, 'hydro'), { recursive: true });
    fs.mkdirSync(path.join(root, 'users/kongdd/utils'), { recursive: true });
    fs.writeFileSync(path.join(root, 'region.js'), 'module.exports={ok:1}');
    fs.writeFileSync(path.join(root, 'hydro/mask.js'), 'module.exports={m:1}');
    fs.writeFileSync(path.join(root, 'users/kongdd/utils/math.js'), 'exports.n=1');

    assert.match(resolveGeePackage('region.js', [root])!, /region\.js$/);
    assert.match(resolveGeePackage('hydro/mask.js', [root])!, /mask\.js$/);
    assert.match(resolveGeePackage('users/kongdd/utils:math.js', [root])!, /math\.js$/);
    // 无后缀仍可回退（兼容）
    assert.match(resolveGeePackage('region', [root])!, /region\.js$/);
    assert.equal(resolveGeePackage('missing.js', [root]), undefined);
    assert.equal(resolveGeePackage('./region.js', [root]), undefined);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('withGeePackageRequire + runInScriptContext 加载包', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gee-pkg-'));
  try {
    fs.writeFileSync(
      path.join(root, 'echo.js'),
      "module.exports = { hi: function (s) { return 'hi:' + s; } };\n",
    );
    setupLocalHost({ echo: false });
    runInScriptContext(
      `
        var echo = require('echo.js');
        print(echo.hi('pkg'));
      `,
      path.join(root, 'script.js'),
      { packagePaths: [root] },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const host: any = (globalThis as any)._host;
    assert.match(host.print[0]!, /hi:pkg/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('嵌套 require 裸名包', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gee-pkg-'));
  try {
    fs.writeFileSync(path.join(root, 'a.js'), "module.exports = { v: require('b').v + 1 };\n");
    fs.writeFileSync(path.join(root, 'b.js'), 'module.exports = { v: 41 };\n');
    let got = 0;
    withGeePackageRequire([root], () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      got = require(path.join(root, 'a.js')).v;
    });
    assert.equal(got, 42);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
