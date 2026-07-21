/**
 * CLI：submit / status / list / jobs / cancel
 */
import * as path from 'node:path';
import { ee } from '../ee';
import {
  exportBatches,
  type BatchInfo,
  type Bucket,
  type BuildFrameFn,
} from '../export/batches';
import {
  cancelTasks,
  getTaskStatuses,
  listJobs,
  listRecentOperations,
  loadJob,
  refreshJob,
  submitExportTasks,
} from '../export/tasks';
import { validateCacheBounds } from '../export/bounds';
import type { GeeDailyReduction, GeeTemporal } from '../types';
import { HELP, type Cli } from './args';

function autoBucket(temporal: GeeTemporal): Bucket {
  return temporal === 'native' || temporal === 'forecast' ? 'week' : 'month';
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function printTask(t: {
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

function printBatch(info: BatchInfo): void {
  const tag = info.status === 'ok' ? '[ok ]' : info.status === 'skip' ? '[skip]' : '[err]';
  console.log(
    `${tag} ${info.index}/${info.total}  ${info.bucketStart} ~ ${info.bucketEnd}`
    + `  (${info.framesCount}f)  → ${info.file} (${fmtBytes(info.bytes)}, ${(info.durationMs / 1000).toFixed(1)}s)`
    + (info.error ? `  ${info.error}` : ''),
  );
}

async function loadBuildFrame(userScript?: string): Promise<BuildFrameFn | undefined> {
  if (!userScript) return undefined;
  (globalThis as typeof globalThis & { ee?: typeof ee }).ee ??= ee;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import(path.resolve(userScript));
  const fn = mod.buildFrame ?? mod.default ?? mod;
  if (typeof fn !== 'function') {
    throw new Error(`--user-script 须导出 buildFrame: ${userScript}`);
  }
  return fn as BuildFrameFn;
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

export async function cmdSubmit(cli: Cli): Promise<number> {
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
  let bounds;
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
    console.log(`  destination : local\n  outdir      : ${outDirAbs}`);
    console.log(`  concurrency : ${cli.concurrency}\n  dry-run     : ${cli.dryRun}`);
    if (cli.dryRun) return 0;

    const t0 = Date.now();
    let aborted = false;
    const onSig = () => {
      if (aborted) return;
      aborted = true;
      console.error('\n# 中断：已派发桶仍在运行');
      setTimeout(() => process.exit(130), 30_000).unref();
    };
    process.on('SIGINT', onSig);
    process.on('SIGTERM', onSig);

    let results: BatchInfo[];
    try {
      results = await exportBatches({
        collection: src.collection, band: src.band, scale: src.scale,
        crs: cli.crs, bounds, start: cli.start, end: cli.end,
        temporal: src.temporal, stepHours: src.stepHours, reduction: src.reduction,
        bucket, cacheDir: outDir, concurrency: cli.concurrency, buildFrame,
        onBatch: (info) => { if (!aborted) printBatch(info); },
      });
    } catch (e) {
      console.error(`本地下载失败: ${e instanceof Error ? e.message : e}`);
      return 1;
    }

    const ok = results.filter((r) => r.status === 'ok').length;
    const skip = results.filter((r) => r.status === 'skip').length;
    const fail = results.filter((r) => r.status === 'fail').length;
    const bytes = results.reduce((s, r) => s + r.bytes, 0);
    console.log(`# 完成(local): ok=${ok} skip=${skip} fail=${fail}`
      + ` bytes=${fmtBytes(bytes)} elapsed=${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log(`# outdir=${outDirAbs}`);
    return aborted ? 130 : fail === 0 ? 0 : 1;
  }

  const dest = cli.destination;
  console.log(`  destination : ${dest}`
    + (dest === 'drive' ? ` folder=${cli.folder ?? 'gee-exports'}` : ` bucket=${cli.gcsBucket}`));
  console.log(`  dry-run     : ${cli.dryRun}`);

  try {
    const result = await submitExportTasks({
      collection: src.collection, band: src.band, scale: src.scale,
      crs: cli.crs, bounds, start: cli.start, end: cli.end,
      temporal: src.temporal, stepHours: src.stepHours, reduction: src.reduction,
      bucket, destination: dest, driveFolder: cli.folder, gcsBucket: cli.gcsBucket,
      fileNamePrefix: cli.fileNamePrefix, maxPixels: cli.maxPixels,
      jobDir: cli.jobDir, dryRun: cli.dryRun, buildFrame,
      onSubmit: (t) => printTask({
        index: t.index, total: t.total, taskId: t.taskId || '(pending)',
        state: t.state, bucketStart: t.bucketStart, bucketEnd: t.bucketEnd,
        framesCount: t.framesCount, description: t.description,
      }),
    });
    console.log(`# jobId=${result.jobId}\n# jobPath=${result.jobPath}`);
    console.log(`# tasks=${result.tasks.length} dryRun=${result.dryRun}`);
    if (!result.dryRun) console.log(`# 查询: ee status --job ${result.jobId}`);
    return 0;
  } catch (e) {
    console.error(`提交失败: ${e instanceof Error ? e.message : e}`);
    return 1;
  }
}

export async function cmdStatus(cli: Cli): Promise<number> {
  try {
    if (cli.job) {
      const job = await refreshJob(cli.job, cli.jobDir);
      console.log(`# job ${job.jobId}  updated=${job.updatedAt}`);
      console.log(`  ${job.options.collection} / ${job.options.band}`);
      console.log(`  ${job.options.start} ~ ${job.options.end}  bucket=${job.options.bucket}`);
      console.log(`  destination=${job.options.destination}`);
      for (const t of job.tasks) {
        printTask({
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
        printTask({
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

export async function cmdList(cli: Cli): Promise<number> {
  try {
    const rows = await listRecentOperations(cli.limit);
    console.log(`# 最近 ${rows.length} 条 operations`);
    for (const r of rows) {
      printTask({
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

export async function cmdJobs(cli: Cli): Promise<number> {
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

export async function cmdCancel(cli: Cli): Promise<number> {
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
        printTask({
          index: t.index, total: t.total, taskId: t.taskId, state: t.state,
          description: t.description, error: t.error,
        });
      }
    } else {
      for (const r of await getTaskStatuses(ids)) {
        printTask({ taskId: r.taskId, state: r.state, error: r.errorMessage });
      }
    }
    return 0;
  } catch (e) {
    console.error(`cancel 失败: ${e instanceof Error ? e.message : e}`);
    return 1;
  }
}
