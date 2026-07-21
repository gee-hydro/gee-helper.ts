/**
 * MODIS 16 日 NDVI：小区域均值。
 *
 * ee examples/modis-ndvi.js
 */
var region = ee.Geometry.Rectangle([114.2, 30.4, 114.6, 30.7]);
var img = ee.ImageCollection('MODIS/061/MOD13A2')
  .filterDate('2024-06-01', '2024-07-01')
  .select('NDVI')
  .mean()
  .multiply(0.0001)
  .clip(region);

var stats = img.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: region,
  scale: 1000,
  maxPixels: 1e7,
});

print('MODIS NDVI mean 2024-06 (Wuhan box)');
print(stats);
