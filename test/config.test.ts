import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import {
  loadConfig,
  loadMergedConfig,
  packagesFromConfig,
  projectConfigPath,
  saveConfig,
} from '../src/local/config';
import { DEFAULT_PACKAGES_DIR, defaultPackagePaths } from '../src/local/gee-require';

test('save/load project config packages', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gee-cfg-'));
  try {
    const file = saveConfig({ packages: './my_pkgs' }, 'project', cwd);
    assert.equal(file, projectConfigPath(cwd));
    assert.deepEqual(loadConfig('project', cwd), { packages: './my_pkgs' });
    const abs = packagesFromConfig(loadConfig('project', cwd), cwd);
    assert.equal(abs[0], path.resolve(cwd, 'my_pkgs'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('defaultPackagePaths 含 ./packages 与 config', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gee-cfg-'));
  try {
    saveConfig({ packages: 'extra_pkgs' }, 'project', cwd);
    const paths = defaultPackagePaths(cwd);
    assert.ok(paths.some((p) => p.endsWith(`${path.sep}extra_pkgs`)));
    assert.ok(paths.some((p) => p.endsWith(`${path.sep}${DEFAULT_PACKAGES_DIR}`)));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('loadMergedConfig project 覆盖', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gee-cfg-'));
  const prevHome = process.env.HOME;
  const prevXdg = process.env.XDG_CONFIG_HOME;
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gee-home-'));
  try {
    process.env.HOME = fakeHome;
    delete process.env.XDG_CONFIG_HOME;
    saveConfig({ packages: 'user_pkgs' }, 'user', cwd);
    saveConfig({ packages: 'proj_pkgs' }, 'project', cwd);
    const m = loadMergedConfig(cwd);
    assert.equal(m.packages, 'proj_pkgs');
  } finally {
    process.env.HOME = prevHome;
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = prevXdg;
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(fakeHome, { recursive: true, force: true });
  }
});
