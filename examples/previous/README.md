# GEE 导出示例

本项目分为三层：**portable JS 构造 EE 计算图，Node 编排层负责鉴权/HTTP/文件/导出，Code Editor 顶层脚本负责交互与展示**。portable JS 使用 ES5 和宿主全局 `ee`；鉴权、导出与本地宿主由 `../gee-helper.ts/` 提供。Code Editor 使用 `src/gee/` 下的 portable 权威 JS；`dist/gee/` 只是 tsc 生成的 Node 构建产物，不用于粘贴到 Code Editor。

## 最简形态（自定义数据集）

新建 `my-export.js`：

```js
function buildFrame(p) {
  return ee.ImageCollection(p.collection)
    .select(p.band)
    .filterDate(p.start, ee.Date(p.end).advance(1, 'day'));
}

if (typeof exports !== 'undefined') {
  exports.buildFrame = buildFrame;
}
```

跑：

```bash
cd server
npx tsx src/bin/cache-tiffs.ts \
  --bounds 70,15,140,55 \
  --start 2024-07-01 --end 2024-07-31 \
  --collection ECMWF/ERA5_LAND/HOURLY --band temperature_2m --scale 11132 \
  --temporal daily_mean --bucket month \
  --user-script examples/my-export.js \
  --outdir /mnt/z/ERA5/2024-07
```

## 包含质量掩膜 / 复杂计算

见 [`modis-lst-monthly.js`](./modis-lst-monthly.js)。

## 直接写脚本（无需 bin）

```ts
// my-export.ts（strict TS）
import { exportBatches, type BuildFrameFn } from '@gee-hydro/gee-helper';

// 无相邻 .d.ts 的任意用户 JS 需在消费边界断言；不要写成无声明的直接 import。
const { buildFrame } = require('./my-export.js') as { buildFrame: BuildFrameFn };

async function main(): Promise<void> {
  await exportBatches({
    collection: 'MODIS/061/MOD11A1',
    band: 'LST_Day_1km',
    scale: 1000,
    bounds: { west: 70, south: 15, east: 140, north: 55 },
    start: '2024-07-01', end: '2024-07-31',
    temporal: 'daily_mean',
    bucket: 'month',
    buildFrame,
    cacheDir: '/mnt/z/MODIS/2024',
    concurrency: 4,
  });
}

void main();
```

## buildFrame 参数

| 字段 | 含义 |
|---|---|
| `collection` | GEE collection id |
| `band` | 波段名（仅作信息/命名；不强制用于 select） |
| `start` / `end` | 本桶闭区间时间范围（YYYY-MM-DD 或 ISO Z，均包含） |
| `stepHours` | native 源步长（默认 1） |
| `bounds` | `{west,south,east,north}` |

## 返回值约束

`buildFrame` 可返回 `ee.ImageCollection`（每张 Image = 一帧）或已合成的 `ee.Image`。
集合会先通过 `ImageCollection.toBands()` 合成 multi-band Image，再以
`filePerBand:false` 输出单个 GeoTIFF；band 顺序与 `ImageCollection` 顺序一致。
`toBands()` 生成的 band 名为 `<system:index 或 image id>_<原 band 名>`，建议把
`system:index` 设置为 `YYYY-MM-DD` 或 `YYYYMMDDTHHmmss`，便于下游 GDAL/rasterio 解析。

## 不使用 buildFrame 的退化路径

省略 `buildFrame` 时，`exportBatches` 使用默认 `frameCollection()`：

- `temporal='daily_mean'`：每桶内每日 1 帧，daily mean
- `temporal='native'`：每桶内每 stepHours 1 帧，原生均值

适用于标准 SMAP/GSMaP/IMERG 等不需要自定义计算的源。默认算法的权威源码是 `src/gee/gee-compute.js`；`gee-core.ts` 仅提供 Node 门面和类型化重导出。

## 两个目的地：local / drive

统一入口 `export:tasks submit --destination {local|drive}`：

| 选项 | 命令 | 机制 |
|------|------|------|
| 直接下到本地 | `--destination local --outdir ./cache/gee-batches` | `getDownloadURL` 同步 |
| 导出到 Google Drive | `--destination drive --folder gee-exports` | `Export.image.toDrive` 异步 |

```bash
cd server

# A. 本地磁盘
npm run export:tasks -- submit --destination local \
  --bounds 114.2,30.4,114.6,30.7 \
  --start 2024-07-01 --end 2024-07-02 \
  --source smap --bucket day \
  --outdir ./cache/gee-batches

# B. Google Drive（提交后可退出，稍后查进度）
npm run export:tasks -- submit --destination drive \
  --bounds 114.2,30.4,114.6,30.7 \
  --start 2024-07-01 --end 2024-07-02 \
  --source smap --bucket day \
  --folder gee-exports
npm run export:tasks -- status --job job_<id>
```

`cache:tiffs` 仍可用，等价于 `--destination local`。详情见 `AGENTS.md` →「批量导出」。