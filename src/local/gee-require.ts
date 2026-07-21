/**
 * GEE JS 包路径解析（Code Editor 语法，路径含 .js 后缀）：
 *   require('region.js')
 *   require('hydro/mask.js')
 *   require('users/x/y:mod.js')  →  packages/users/x/y/mod.js
 *
 * 路径优先级：CLI --package-path > $GEE_JS_PATH > config > ./packages
 */
import * as fs from 'node:fs';
import Module from 'node:module';
import * as path from 'node:path';
import { loadMergedConfig, packagesFromConfig } from './config';

export const DEFAULT_PACKAGES_DIR = 'packages';

export function defaultPackagePaths(cwd = process.cwd()): string[] {
  const fromEnv = (process.env.GEE_JS_PATH ?? '')
    .split(path.delimiter)
    .map((s) => s.trim())
    .filter(Boolean);
  const fromCfg = packagesFromConfig(loadMergedConfig(cwd), cwd);
  const roots = [
    ...fromEnv,
    ...fromCfg,
    path.resolve(cwd, DEFAULT_PACKAGES_DIR),
  ];
  return uniqueResolved(roots);
}

function uniqueResolved(dirs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of dirs) {
    const abs = path.resolve(d);
    if (seen.has(abs)) continue;
    seen.add(abs);
    out.push(abs);
  }
  return out;
}

export function mergePackagePaths(
  extra: string[] | undefined,
  cwd = process.cwd(),
): string[] {
  return uniqueResolved([...(extra ?? []), ...defaultPackagePaths(cwd)]);
}

/** node 内置 / 相对 / 绝对路径：不走包目录 */
export function isNodeModuleId(id: string): boolean {
  return (
    id.startsWith('.')
    || id.startsWith('/')
    || id.startsWith('node:')
    || path.isAbsolute(id)
    || id.startsWith('file:')
  );
}

/** Code Editor: users/foo/bar:utils/x.js → users/foo/bar/utils/x.js */
export function geeIdToRelPath(id: string): string {
  if (id.startsWith('node:')) return id;
  const i = id.indexOf(':');
  if (i > 0) return `${id.slice(0, i)}/${id.slice(i + 1)}`;
  return id;
}

export function resolveGeePackage(id: string, packagePaths: string[]): string | undefined {
  if (isNodeModuleId(id)) return undefined;
  const rel = geeIdToRelPath(id);
  // GEE 语法以显式 .js 为主；无后缀时回退补 .js / index.js
  const cands = rel.endsWith('.js')
    ? [rel]
    : [rel, `${rel}.js`, path.join(rel, 'index.js')];
  for (const root of packagePaths) {
    for (const c of cands) {
      const cand = path.join(root, c);
      try {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
      } catch { /* ignore */ }
    }
  }
  return undefined;
}

type Req = NodeRequire;

/**
 * 在 fn 期间劫持 Module.prototype.require：
 * bare / users/...:mod 优先从 packagePaths 加载，嵌套 require 同样生效。
 */
export function withGeePackageRequire<T>(packagePaths: string[], fn: () => T): T {
  const roots = uniqueResolved(packagePaths);
  const proto = Module.prototype as unknown as { require: Req };
  const orig = proto.require;
  const hooked = function (this: NodeModule, id: string): unknown {
    if (typeof id === 'string') {
      const hit = resolveGeePackage(id, roots);
      if (hit) return orig.call(this, hit);
    }
    // eslint-disable-next-line prefer-rest-params, @typescript-eslint/no-explicit-any
    return (orig as any).apply(this, arguments);
  } as Req;
  Object.assign(hooked, orig);
  hooked.resolve = ((id: string, options?: { paths?: string[] }) => {
    const hit = resolveGeePackage(id, roots);
    if (hit) return hit;
    return orig.resolve(id, options);
  }) as Req['resolve'];
  hooked.cache = orig.cache;
  hooked.extensions = orig.extensions;
  hooked.main = orig.main;

  proto.require = hooked;
  try {
    return fn();
  } finally {
    proto.require = orig;
  }
}
