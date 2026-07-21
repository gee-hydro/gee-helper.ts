/**
 * SMAP 表层土壤水分：武汉小区域日均值。
 *
 *   node bin/ee run examples/smap-mean.js
 */
var region = ee.Geometry.Rectangle([114.2, 30.4, 114.6, 30.7]);
var img = ee.ImageCollection('NASA/SMAP/SPL4SMGP/008')
  .filterDate('2024-07-01', '2024-07-02')
  .select('sm_surface')
  .mean()
  .clip(region);

var stats = img.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: region,
  scale: 9000,
  maxPixels: 1e7,
});

print('SMAP sm_surface mean 2024-07-01 (Wuhan box)');
print(stats);
Map.centerObject(region, 9);
Map.addLayer(img, { min: 0, max: 0.5, palette: ['#f7fbff', '#08306b'] }, 'sm_surface');
