/**
 * 自定义 buildFrame：供 CLI --user-script 使用。
 *
 * ee submit --destination local \
 *     --collection NASA/SMAP/SPL4SMGP/008 --band sm_surface --scale 9000 \
 *     --temporal daily_mean --bounds 108.5,29.0,116.2,33.3 \
 *     --start 2024-07-01 --end 2024-07-01 \
 *     --outdir ./cache/examples/smap-custom \
 *     --user-script examples/build-frame.js
 */
'use strict';

/**
 * @param {{ collection: string, band: string, start: string, end: string }} p
 * @returns {ee.ImageCollection}
 */
function buildFrame(p) {
  // 与默认 daily_mean 等价，仅作可运行模板
  return ee.ImageCollection(p.collection)
    .filterDate(p.start, ee.Date(p.end).advance(1, 'day'))
    .select(p.band)
    .mean()
    .rename(p.band)
    .set('system:time_start', ee.Date(p.start).millis());
}

module.exports = { buildFrame };
