/**
 * require packages 包 + SMAP 区域均值。
 *
 *   node bin/ee run examples/require-smap.js
 */
var region = require('region.js');

var geom = region.toRectangle(ee, region.WUHAN);
var img = ee.ImageCollection('NASA/SMAP/SPL4SMGP/008')
  .filterDate('2024-07-01', '2024-07-02')
  .select('sm_surface')
  .mean()
  .clip(geom);

print('SMAP mean (Wuhan, via require region)');
print(img.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: geom,
  scale: 9000,
  maxPixels: 1e7,
}));
