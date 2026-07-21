#!/usr/bin/env node
/**
 * CLI：GEE 导出 + Code Editor 风格脚本本地运行
 *
 *   gee-helper submit|status|list|jobs|cancel|help
 *   gee-helper run <script.js> [more.js ...] | --repl
 */
import * as path from 'node:path';
import * as readline from 'node:readline';
import { ee } from './ee';
import {
  exportBatches,
  type BatchInfo,
  type Bucket,
  type BuildFrameFn,
} from './export-batches';
import {
  cancelTasks,
  getTaskStatuses,
  listJobs,
  listRecentOperations,
  loadJob,
  refreshJob,
  submitExportTasks,
  type TaskDestination,
} from './export-tasks';
import { runScript, type LocalHost } from './local-host';
import { ensureReady } from './auth';
import { validateCacheBounds, type CacheBounds } from './bounds';
import type { GeeDailyReduction, GeeTemporal } from './types';

type CliDestination = 'local' | TaskDestination;
type Cmd = 'submit' | 'status' | 'list' | 'jobs' | 'cancel' | 'run' | 'help';

interface Cli {
  cmd: Cmd;
  bounds?: [number, number, number, number];
  start?: string;
  end?: string;
  collection?: string;
  band?: string;
  scale?: number;
  crs?: string;
  temporal?: GeeTemporal;
  stepHours?: number;
  reduction?: GeeDailyReduction;
  bucket: 'auto' | Bucket;
  destination: CliDestination;
  folder?: string;
  gcsBucket?: string;
  outdir?: string;
  concurrency: number;
  fileNamePrefix?: string;
  maxPixels?: number;
  jobDir?: string;
  job?: string;
  task?: string;
  limit: number;
  dryRun: boolean;
  userScript?: string;
  scripts: string[];
  repl: boolean;
}

const HELP = `用法: gee-helper <command> [options]

命令:
  submit | status | list | jobs | cancel | run | help

导出 submit：
  --destination local|drive|gcs
  --collection --band --scale --temporal daily_mean|native|forecast
  --bounds W,S,E,N --start --end
  --bucket auto|day|week|month|range --reduction mean|sum --step-hours
  local: --outdir --concurrency
  drive/gcs: --folder --gcs-bucket --prefix --max-pixels --job-dir
  --dry-run --user-script

status/cancel: --job <id> | --task id1,id2
list: --limit N

本地运行 GEE JS（多脚本只鉴权一次）：
  gee-helper run script.js [more.js ...]
  gee-helper run examples/*.js
  gee-helper run --repl
`;

function parseArgs(argv: string[]): Cli {
  const cli: Cli = {
    cmd: 'help', bucket: 'auto', destination: 'drive',
    concurrency: 1, limit: 20, dryRun: false, scripts: [], repl: false,
  };
  if (argv.length === 0) return cli;
  const head = argv[0]!;
  if (['submit', 'status', 'list', 'jobs', 'cancel', 'run', 'help', '-h', '--help'].includes(head)) {
    cli.cmd = (head === '-h' || head === '--help') ? 'help' : head as Cmd;
    argv = argv.slice(1);
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = (): string => {
      const v = argv[++i];
      if (v == null) throw new Error(`参数 ${a} 缺值`);
      return v;
    };
    switch (a) {
      case '-h': case '--help': cli.cmd = 'help'; break;
      case '--bounds': {
        const v = next().split(',').map((s) => Number(s.trim()));
        if (v.length !== 4 || v.some((x) => !Number.isFinite(x))) {
          throw new Error('--bounds 须为 west,south,east,north');
        }
        cli.bounds = v as [number, number, number, number];
        break;
      }
      case '--start': cli.start = next(); break;
      case '--end': cli.end = next(); break;
      case '--collection': cli.collection = next(); break;
      case '--band': cli.band = next(); break;
      case '--scale': {
        const v = Number(next());
        if (!Number.isFinite(v) || v <= 0) throw new Error('--scale 须为正数');
        cli.scale = v; break;
      }
      case '--crs': cli.crs = next(); break;
      case '--temporal': {
        const v = next();
        if (v !== 'daily_mean' && v !== 'native' && v !== 'forecast') {
          throw new Error('--temporal 非法');
        }
        cli.temporal = v; break;
      }
      case '--step-hours': {
        const v = Number(next());
        if (!Number.isFinite(v) || v <= 0 || v > 24) throw new Error('--step-hours 须 (0,24]');
        cli.stepHours = v; break;
      }
      case '--reduction': {
        const v = next();
        if (v !== 'mean' && v !== 'sum') throw new Error('--reduction 须 mean|sum');
        cli.reduction = v; break;
      }
      case '--bucket': {
        const v = next();
        if (!['auto', 'day', 'week', 'month', 'range'].includes(v)) throw new Error('--bucket 非法');
        cli.bucket = v as Cli['bucket']; break;
      }
      case '--destination': {
        const v = next();
        if (v !== 'drive' && v !== 'gcs' && v !== 'local') {
          throw new Error('--destination 须 drive|local|gcs');
        }
        cli.destination = v; break;
      }
      case '--folder': cli.folder = next(); break;
      case '--gcs-bucket': cli.gcsBucket = next(); break;
      case '--outdir':
      case '--cache-dir':
        cli.outdir = next(); break;
      case '--concurrency': {
        const v = Number(next());
        if (!Number.isInteger(v) || v < 1 || v > 16) throw new Error('--concurrency 须 1..16');
        cli.concurrency = v; break;
      }
      case '--user-script': cli.userScript = next(); break;
      case '--prefix': cli.fileNamePrefix = next(); break;
      case '--max-pixels': {
        const v = Number(next());
        if (!Number.isFinite(v) || v <= 0) throw new Error('--max-pixels 非法');
        cli.maxPixels = v; break;
      }
      case '--job-dir': cli.jobDir = next(); break;
      case '--job': cli.job = next(); break;
      case '--task': cli.task = next(); break;
      case '--limit': {
        const v = Number(next());
        if (!Number.isInteger(v) || v < 1) throw new Error('--limit 须正整数');
        cli.limit = v; break;
      }
      case '--dry-run': cli.dryRun = true; break;
      case '--repl': case '-i': cli.repl = true; break;
      default:
        if (cli.cmd === 'run' && !a.startsWith('-')) {
          cli.scripts.push(a);
          break;
        }
        throw new Error(`未知参数: ${a}`);
    }
  }
  return cli;
}

function resolveSource(cli: Cli): {
  collection: string; band: string; scale: number;
  temporal: GeeTemporal; stepHours?: number; reduction?: GeeDailyReduction;
} {
  if (!cli.collection || !cli.band || !cli.scale || !cli.temporal) {
    throw new Error('须同时提供 --collection/--band/--scale/--temporal');
  }
  return {
    collection: cli.collection, band: cli.band, scale: cli.scale,
    temporal: cli.temporal, stepHours: cli.stepHours, reduction: cli.reduction,
  };
}

function autoBucket(temporal: GeeTemporal): Bucket {
  return temporal === 'native' || temporal === 'forecast' ? 'week' : 'month';
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function printTaskLine(t: {
  index?: number; total?: number; taskId: string; state: string;
  bucketStart?: string; bucketEnd?: string; framesCount?: number;
  description?: string; error?: string;
}): void {
  const idx = t.index != null && t.total != null
    ? `${String(t.index).padStart(String(t.total).length)}/${t.total}  ` : '';
  const range = t.bucketStart
    ? `${t.bucketStart} ~ ${t.bucketEnd}  (${t.framesCount ?? '?'}f)  ` : '';
  console.log(
    `[${t.state.padEnd(10)}] ${idx}${range}${t.taskId || '(no-id)'}`
    + (t.description ? `  ${t.description}` : '')
    + (t.error ? `  ERR: ${t.error}` : ''),
  );
}

function printBatchLine(info: BatchInfo): void {
  const tag = info.status === 'ok' ? '[ok ]'
    : info.status === 'skip' ? '[skip]' : '[err]';
  const dt = (info.durationMs / 1000).toFixed(1);
  console.log(`${tag} ${String(info.index).padStart(String(info.total).length)}/${info.total}`
    + `  ${info.bucketStart} ~ ${info.bucketEnd}`
    + `  (${info.framesCount} frames)`
    + `  → ${info.file} (${fmtBytes(info.bytes)}, ${dt}s)`
    + (info.error ? `  ${info.error}` : ''));
}

async function loadBuildFrame(userScript?: string): Promise<BuildFrameFn | undefined> {
  if (!userScript) return undefined;
  (globalThis as typeof globalThis & { ee?: typeof ee }).ee ??= ee;
  const scriptPath = path.resolve(userScript);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import(scriptPath);
  const fn = mod.buildFrame ?? mod.default ?? mod;
  if (typeof fn !== 'function') {
    throw new Error(`--user-script 须导出 buildFrame(params) 函数: ${scriptPath}`);
  }
  return fn as BuildFrameFn;
}

async function cmdSubmit(cli: Cli): Promise<number> {
  if (!cli.bounds || !cli.start || !cli.end) {
    console.error('submit 缺 --bounds / --start / --end');
    console.log(HELP);
    return 2;
  }
  if (cli.start > cli.end) {
    console.error(`--start (${cli.start}) 须 ≤ --end (${cli.end})`);
    return 2;
  }

  let src;
  try { src = resolveSource(cli); }
  catch (e) { console.error(e instanceof Error ? e.message : e); return 2; }

  const bucket: Bucket = cli.bucket === 'auto' ? autoBucket(src.temporal) : cli.bucket;
  let bounds: CacheBounds;
  try {
    bounds = validateCacheBounds({
      west: cli.bounds[0], south: cli.bounds[1],
      east: cli.bounds[2], north: cli.bounds[3],
    });
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    return 2;
  }

  let buildFrame: BuildFrameFn | undefined;
  try { buildFrame = await loadBuildFrame(cli.userScript); }
  catch (e) { console.error(e instanceof Error ? e.message : e); return 2; }

  console.log('# 导出计划');
  console.log(`  collection  : ${src.collection}`);
  console.log(`  band/scale  : ${src.band} @ ${src.scale} m`);
  console.log(`  temporal    : ${src.temporal}${src.stepHours ? ` (${src.stepHours}h)` : ''}`);
  console.log(`  bounds      : W${bounds.west} S${bounds.south} E${bounds.east} N${bounds.north}`);
  console.log(`  range/bucket: ${cli.start} ~ ${cli.end}, bucket=${bucket}`);

  if (cli.destination === 'local') {
    const outDir = cli.outdir ?? process.env.GEE_CACHE_DIR ?? 'cache/gee-batches';
    const outDirAbs = path.resolve(outDir);
    console.log(`  destination : local`);
    console.log(`  outdir      : ${outDirAbs}`);
    console.log(`  concurrency : ${cli.concurrency}`);
    console.log(`  dry-run     : ${cli.dryRun}`);
    if (cli.dryRun) return 0;

    const t0 = Date.now();
    let aborted = false;
    const onSig = () => {
      if (aborted) return;
      aborted = true;
      console.error('\n# 收到中断信号，已派发桶仍在运行；不再打印后续回调');
      setTimeout(() => process.exit(130), 30_000).unref();
    };
    process.on('SIGINT', onSig);
    process.on('SIGTERM', onSig);

    let results: BatchInfo[];
    try {
      results = await exportBatches({
        collection: src.collection, band: src.band, scale: src.scale,
        crs: cli.crs, bounds, start: cli.start, end: cli.end,
        temporal: src.temporal, stepHours: src.stepHours,
        reduction: src.reduction,
        bucket, cacheDir: outDir, concurrency: cli.concurrency, buildFrame,
        onBatch: (info) => { if (!aborted) printBatchLine(info); },
      });
    } catch (e) {
      console.error(`本地下载失败: ${e instanceof Error ? e.message : e}`);
      return 1;
    }

    const ok = results.filter((r) => r.status === 'ok').length;
    const skip = results.filter((r) => r.status === 'skip').length;
    const fail = results.filter((r) => r.status === 'fail').length;
    const total = results.reduce((s, r) => s + r.bytes, 0);
    console.log(`# 完成(local): ok=${ok} skip=${skip} fail=${fail}`
      + ` bytes=${fmtBytes(total)} elapsed=${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log(`# outdir=${outDirAbs}`);
    if (aborted) return 130;
    return fail === 0 ? 0 : 1;
  }

  const dest = cli.destination;
  console.log(`  destination : ${dest}`
    + (dest === 'drive' ? ` folder=${cli.folder ?? 'gee-exports'}` : ` bucket=${cli.gcsBucket}`));
  console.log(`  dry-run     : ${cli.dryRun}`);

  try {
    const result = await submitExportTasks({
      collection: src.collection, band: src.band, scale: src.scale,
      crs: cli.crs, bounds, start: cli.start, end: cli.end,
      temporal: src.temporal, stepHours: src.stepHours,
      reduction: src.reduction,
      bucket,
      destination: dest, driveFolder: cli.folder, gcsBucket: cli.gcsBucket,
      fileNamePrefix: cli.fileNamePrefix, maxPixels: cli.maxPixels,
      jobDir: cli.jobDir, dryRun: cli.dryRun, buildFrame,
      onSubmit: (t) => printTaskLine({
        index: t.index, total: t.total, taskId: t.taskId || '(pending)',
        state: t.state, bucketStart: t.bucketStart, bucketEnd: t.bucketEnd,
        framesCount: t.framesCount, description: t.description,
      }),
    });
    console.log(`# jobId=${result.jobId}`);
    console.log(`# jobPath=${result.jobPath}`);
    console.log(`# tasks=${result.tasks.length} dryRun=${result.dryRun}`);
    if (!result.dryRun) {
      console.log(`# 查询: gee-helper status --job ${result.jobId}`);
    }
    return 0;
  } catch (e) {
    console.error(`提交失败: ${e instanceof Error ? e.message : e}`);
    return 1;
  }
}

async function cmdStatus(cli: Cli): Promise<number> {
  try {
    if (cli.job) {
      const job = await refreshJob(cli.job, cli.jobDir);
      console.log(`# job ${job.jobId}  updated=${job.updatedAt}`);
      console.log(`  ${job.options.collection} / ${job.options.band}`);
      console.log(`  ${job.options.start} ~ ${job.options.end}  bucket=${job.options.bucket}`);
      console.log(`  destination=${job.options.destination}`);
      for (const t of job.tasks) {
        printTaskLine({
          index: t.index, total: t.total, taskId: t.taskId, state: t.state,
          bucketStart: t.bucketStart, bucketEnd: t.bucketEnd,
          framesCount: t.framesCount, description: t.description, error: t.error,
        });
      }
      const n = (s: string) => job.tasks.filter((t) => t.state === s).length;
      console.log(`# 汇总 READY=${n('READY')} RUNNING=${n('RUNNING')}`
        + ` COMPLETED=${n('COMPLETED')} FAILED=${n('FAILED')} CANCELLED=${n('CANCELLED')}`);
      return 0;
    }
    if (cli.task) {
      const ids = cli.task.split(',').map((s) => s.trim()).filter(Boolean);
      for (const r of await getTaskStatuses(ids)) {
        printTaskLine({
          taskId: r.taskId, state: r.state,
          description: r.description, error: r.errorMessage,
        });
      }
      return 0;
    }
    console.error('status 须 --job 或 --task');
    return 2;
  } catch (e) {
    console.error(`查询失败: ${e instanceof Error ? e.message : e}`);
    return 1;
  }
}

async function cmdList(cli: Cli): Promise<number> {
  try {
    const rows = await listRecentOperations(cli.limit);
    console.log(`# 最近 ${rows.length} 条 operations`);
    for (const r of rows) {
      printTaskLine({
        taskId: r.taskId, state: r.state,
        description: r.description, error: r.errorMessage,
      });
    }
    return 0;
  } catch (e) {
    console.error(`list 失败: ${e instanceof Error ? e.message : e}`);
    return 1;
  }
}

async function cmdJobs(cli: Cli): Promise<number> {
  const dir = cli.jobDir ?? path.resolve(process.cwd(), 'cache/gee-export-jobs');
  const ids = listJobs(dir);
  console.log(`# jobDir=${dir}  count=${ids.length}`);
  for (const id of ids) {
    try {
      const j = loadJob(id, dir);
      const n = (s: string) => j.tasks.filter((t) => t.state === s).length;
      console.log(
        `  ${id}  dest=${j.options.destination}  tasks=${j.tasks.length}`
        + `  C=${n('COMPLETED')}/R=${n('RUNNING')}/Q=${n('READY')}/F=${n('FAILED')}`
        + `  ${j.options.start}~${j.options.end}  ${j.options.collection}`,
      );
    } catch {
      console.log(`  ${id}  (无法读取)`);
    }
  }
  return 0;
}

async function cmdCancel(cli: Cli): Promise<number> {
  try {
    if (!cli.job && !cli.task) {
      console.error('cancel 须 --job 或 --task');
      return 2;
    }
    const ids = cli.job
      ? loadJob(cli.job, cli.jobDir).tasks.map((t) => t.taskId).filter(Boolean)
      : cli.task!.split(',').map((s) => s.trim()).filter(Boolean);
    console.log(`# 取消 ${ids.length} 个任务…`);
    await cancelTasks(ids);
    if (cli.job) {
      const job = await refreshJob(cli.job, cli.jobDir);
      for (const t of job.tasks) {
        printTaskLine({
          index: t.index, total: t.total, taskId: t.taskId, state: t.state,
          description: t.description, error: t.error,
        });
      }
    } else {
      for (const r of await getTaskStatuses(ids)) {
        printTaskLine({ taskId: r.taskId, state: r.state, error: r.errorMessage });
      }
    }
    return 0;
  } catch (e) {
    console.error(`cancel 失败: ${e instanceof Error ? e.message : e}`);
    return 1;
  }
}

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

async function cmdRun(cli: Cli): Promise<number> {
  if (!cli.scripts.length && !cli.repl) {
    console.error('用法: gee-helper run <script.js> [more.js ...]');
    console.error('      gee-helper run --repl');
    return 2;
  }
  const t0 = Date.now();
  await ensureReady();
  console.log(`[gee] auth ready in ${Date.now() - t0}ms (process-scoped cache)`);

  let code = 0;
  for (const s of cli.scripts) {
    try {
      console.log(`\n========== ${s} ==========`);
      const host = await runScript(s, { ready: true });
      report(host);
    } catch (e) {
      console.error(`脚本失败 (${s}):`, e instanceof Error ? e.message : String(e));
      code = 1;
    }
  }
  if (!cli.repl) return code;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>((r) => rl.question(q, r));
  console.log('\n# REPL 模式（鉴权已就绪）。输入脚本路径回车运行，quit / 空行退出。');
  for (;;) {
    const line = (await ask('gee> ')).trim();
    if (!line || line === 'quit' || line === 'exit') break;
    try {
      console.log(`\n========== ${line} ==========`);
      const host = await runScript(line, { ready: true });
      report(host);
    } catch (e) {
      console.error('脚本失败:', e instanceof Error ? e.message : String(e));
      code = 1;
    }
  }
  rl.close();
  return code;
}

export async function run(argv: string[] = process.argv.slice(2)): Promise<number> {
  let cli: Cli;
  try { cli = parseArgs(argv); }
  catch (e) {
    console.error(`参数错误: ${e instanceof Error ? e.message : e}`);
    console.log(HELP);
    return 2;
  }
  switch (cli.cmd) {
    case 'help': console.log(HELP); return 0;
    case 'submit': return cmdSubmit(cli);
    case 'status': return cmdStatus(cli);
    case 'list': return cmdList(cli);
    case 'jobs': return cmdJobs(cli);
    case 'cancel': return cmdCancel(cli);
    case 'run': return cmdRun(cli);
    default: console.log(HELP); return 2;
  }
}

if (require.main === module) {
  void run().then((code) => process.exit(code))
    .catch((e) => { console.error(e); process.exit(1); });
}
