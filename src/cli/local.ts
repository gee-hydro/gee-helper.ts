/**
 * CLI：run / config / add
 */
import * as path from 'node:path';
import * as readline from 'node:readline';
import { ensureReady } from '../auth';
import {
  configPath,
  getConfigValue,
  loadMergedConfig,
  saveConfig,
} from '../local/config';
import { defaultPackagePaths } from '../local/gee-require';
import { runScript, type LocalHost } from '../local/local-host';
import { addPackage, primaryPackagesRoot } from '../local/pkg-add';
import type { Cli } from './args';

function report(host: LocalHost): void {
  console.log('\n# 捕获结果');
  console.log(`  print  : ${host.print.length} 条`);
  console.log(`  layers : ${host.layers.length} 个`);
  console.log(`  tasks  : ${host.tasks.length} 个 (${host.tasks.map((t) => t.type).join(', ') || '-'})`);
  console.log(`  charts : ${host.charts.length} 个`);
  if (host.tasks.length) {
    console.log('\n# 任务详情');
    for (const t of host.tasks) {
      console.log(`  - ${t.type}  ${t.description ?? t.assetId ?? ''}`);
    }
  }
}

export async function cmdRun(cli: Cli): Promise<number> {
  if (!cli.scripts.length && !cli.repl) {
    console.error('用法: ee run <script.js> [more.js ...]\n      ee run --repl');
    return 2;
  }
  const t0 = Date.now();
  await ensureReady();
  console.log(`[gee] auth ready in ${Date.now() - t0}ms`);

  const opts = { ready: true as const, packagePaths: cli.packagePaths };
  if (cli.packagePaths.length) {
    console.log(`[gee] package-path: ${cli.packagePaths.join(path.delimiter)}`);
  }

  let code = 0;
  for (const s of cli.scripts) {
    try {
      console.log(`\n========== ${s} ==========`);
      report(await runScript(s, opts));
    } catch (e) {
      console.error(`脚本失败 (${s}):`, e instanceof Error ? e.message : String(e));
      code = 1;
    }
  }
  if (!cli.repl) return code;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>((r) => rl.question(q, r));
  console.log('\n# REPL（鉴权已就绪）。路径回车运行，quit 退出。');
  for (;;) {
    const line = (await ask('gee> ')).trim();
    if (!line || line === 'quit' || line === 'exit') break;
    try {
      console.log(`\n========== ${line} ==========`);
      report(await runScript(line, opts));
    } catch (e) {
      console.error('脚本失败:', e instanceof Error ? e.message : String(e));
      code = 1;
    }
  }
  rl.close();
  return code;
}

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
