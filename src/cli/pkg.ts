/**
 * CLI 轻量命令：config / add（不加载 earthengine）
 */
import * as path from 'node:path';
import {
  configPath,
  getConfigValue,
  loadMergedConfig,
  saveConfig,
} from '../local/config';
import { defaultPackagePaths } from '../local/gee-require';
import { addPackage, primaryPackagesRoot } from '../local/pkg-add';
import type { Cli } from './args';

export function cmdConfig(cli: Cli): number {
  const [sub, key, ...rest] = cli.configArgs;
  if (!sub || sub === 'show') {
    console.log(JSON.stringify(loadMergedConfig(), null, 2));
    console.log('# effective packages:');
    for (const p of defaultPackagePaths()) console.log(`  ${p}`);
    console.log(`# project: ${configPath('project')}`);
    console.log(`# user:    ${configPath('user')}`);
    return 0;
  }
  if (sub === 'path') {
    console.log(configPath(cli.configScope));
    return 0;
  }
  if (sub === 'get') {
    if (!key) { console.error('用法: ee config get <key>'); return 2; }
    const v = getConfigValue(loadMergedConfig(), key);
    console.log(v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v));
    return 0;
  }
  if (sub === 'set') {
    if (!key || rest.length === 0) {
      console.error('用法: ee config set packages <path> [--user|--project]');
      return 2;
    }
    if (key !== 'packages') {
      console.error(`暂支持 key: packages（收到 ${key}）`);
      return 2;
    }
    const val = rest.length === 1 ? rest[0]! : rest;
    console.log(`# wrote ${saveConfig({ packages: val }, cli.configScope)}`);
    console.log(`packages = ${JSON.stringify(val)}`);
    return 0;
  }
  console.error('用法: ee config [show|get|set|path] ...');
  return 2;
}

export function cmdAdd(cli: Cli): number {
  if (cli.addSpecs.length === 0) {
    console.error('用法: ee add <user>/<pkg> [more ...]');
    console.error('  git clone https://earthengine.googlesource.com/users/$user/$pkg');
    console.error(`  → ${path.join(primaryPackagesRoot(), 'users', '<user>', '<pkg>')}`);
    return 2;
  }
  const root = primaryPackagesRoot();
  console.log(`# packages root: ${root}`);
  let code = 0;
  for (const spec of cli.addSpecs) {
    try {
      const r = addPackage(spec, { root });
      console.log(`[${r.action}] ${r.user}/${r.pkg}\n  url  ${r.url}\n  dest ${r.dest}`);
    } catch (e) {
      console.error(`[fail] ${spec}: ${e instanceof Error ? e.message : e}`);
      code = 1;
    }
  }
  return code;
}
