/**
 * MODIS LST 逐日帧 + 质量掩膜（ES5，GEE Code Editor 风格）
 *
 * 运行（server cwd）：
 *   npm run export:tasks -- submit --destination local \
 *     --bounds 70,15,140,55 \
 *     --start 2024-07-01 --end 2024-12-31 \
 *     --collection MODIS/061/MOD11A1 --band LST_Day_1km --scale 1000 \
 *     --temporal daily_mean --bucket month --concurrency 4 \
 *     --user-script examples/modis-lst-monthly.js \
 *     --outdir /mnt/z/China/MODIS-LST/2024
 *
 * 参数由 Node CLI 注入；在 Code Editor 中也可直接调用 buildFrame(p)。
 * 返回 ee.ImageCollection，每张 Image 对应一日。
 */

/**
 * 逐日 LST + QA 掩膜（QC_Day 位 0/1 = 质量等级，仅保留 good quality 00）。
 * @param {{collection:string,band:string,start:string,end:string,bounds:object}} p
 */
function buildFrame(p) {
  var t0 = ee.Date(p.start);
  var t1 = ee.Date(p.end);
  var n = t1.difference(t0, 'day').add(1);
  return ee.ImageCollection(
    ee.List.sequence(0, n.subtract(1)).map(function (d) {
      var day = t0.advance(ee.Number(d), 'day');
      return ee.ImageCollection(p.collection)
        .select([p.band, 'QC_Day'])
        .filterDate(day, day.advance(1, 'day'))
        .map(function (img) {
          var mask = img.select('QC_Day').bitwiseAnd(3).eq(0);
          return img.updateMask(mask);
        })
        .mean()
        .select(p.band)
        .set('system:time_start', day.millis())
        .set('system:index', day.format('YYYY-MM-dd'));
    })
  );
}

if (typeof exports !== 'undefined') {
  exports.buildFrame = buildFrame;
}
