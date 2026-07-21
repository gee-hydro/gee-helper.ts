/**
 * Node-only 薄包装：FAO-56 ET₀ 月度归档（ERA5-LAND → multi-band GeoTIFF）。
 *
 * 运行（server cwd）：
 *   npm run export:tasks -- submit --destination local \
 *     --bounds 70,15,140,55 \
 *     --start 2024-07-01 --end 2024-12-31 \
 *     --collection ECMWF/ERA5_LAND/HOURLY --band ET0 --scale 11132 \
 *     --temporal daily_mean --bucket month --concurrency 4 \
 *     --user-script examples/et0-pm-monthly.js \
 *     --outdir /mnt/z/ERA5-ET0/2024-H2
 *
 * 此文件依赖 CommonJS require，不能粘贴到 GEE Code Editor；Code Editor 应直接使用
 * src/gee/models/fao56.js 权威计算源码。
 */
const { era5DailyET0 } = require('../src/gee/models/fao56');

function buildFrame(p) {
  return era5DailyET0(p.start, p.end);
}

exports.buildFrame = buildFrame;
