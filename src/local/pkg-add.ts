/**
 * ee add user/pkg → git clone GEE 脚本仓库到 packages/users/$user/$pkg
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadMergedConfig, packagesFromConfig } from './config';
import { DEFAULT_PACKAGES_DIR } from './gee-require';

const GERRIT_BASE = 'https://earthengine.googlesource.com';

export interface UserPkg {
  user: string;
  pkg: string;
}

/** 解析 user/pkg 或 users/user/pkg */
export function parseUserPkg(spec: string): UserPkg {
  const s = spec.trim().replace(/^users\//, '').replace(/\/+$/, '');
  const parts = s.split('/').filter(Boolean);
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`非法包名: ${spec}（期望 user/pkg）`);
  }
  if (!/^[\w.-]+$/.test(parts[0]) || !/^[\w.-]+$/.test(parts[1])) {
    throw new Error(`非法 user/pkg: ${spec}`);
  }
  return { user: parts[0], pkg: parts[1] };
}

export function gerritUrl(user: string, pkg: string): string {
  return `${GERRIT_BASE}/users/${user}/${pkg}`;
}

/** 主 packages 根：config 优先，否则 ./packages */
export function primaryPackagesRoot(cwd = process.cwd()): string {
  const fromCfg = packagesFromConfig(loadMergedConfig(cwd), cwd);
  if (fromCfg[0]) return fromCfg[0];
  return path.resolve(cwd, DEFAULT_PACKAGES_DIR);
}

export function packageDest(user: string, pkg: string, root?: string): string {
  return path.join(root ?? primaryPackagesRoot(), 'users', user, pkg);
}

export interface AddPackageResult {
  user: string;
  pkg: string;
  url: string;
  dest: string;
  action: 'clone' | 'pull' | 'skip';
}

export interface AddPackageOptions {
  root?: string;
  /** 已存在时 pull（默认 true） */
  pull?: boolean;
}

export function addPackage(spec: string, opts: AddPackageOptions = {}): AddPackageResult {
  const { user, pkg } = parseUserPkg(spec);
  const url = gerritUrl(user, pkg);
  const dest = packageDest(user, pkg, opts.root);
  const pull = opts.pull !== false;

  if (fs.existsSync(path.join(dest, '.git'))) {
    if (!pull) {
      return { user, pkg, url, dest, action: 'skip' };
    }
    const r = spawnSync('git', ['-C', dest, 'pull', '--ff-only'], { encoding: 'utf8' });
    if (r.status !== 0) {
      throw new Error(`git pull 失败 (${dest}): ${r.stderr || r.stdout || r.status}`);
    }
    return { user, pkg, url, dest, action: 'pull' };
  }

  if (fs.existsSync(dest)) {
    throw new Error(`目标已存在且非 git 仓库: ${dest}`);
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const r = spawnSync('git', ['clone', '--depth', '1', url, dest], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git clone 失败 (${url}): ${r.stderr || r.stdout || r.status}`);
  }
  return { user, pkg, url, dest, action: 'clone' };
}
