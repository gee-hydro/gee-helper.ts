/**
 * GEE Code Editor 风格 —— 与 code.earthengine.google.com 写法一致
 *
 * 这份顶层交互脚本可以：
 *   1. 粘贴到 GEE Code Editor 运行
 *   2. 在本地通过 tsx scripts/run-gee-script.ts 执行
 *
 * 注意：
 *   - 没有 require('@google/earthengine')；ee 是宿主全局
 *   - 没有 export；顶层 var 声明等同于全局
 *   - print / Map / Export / Chart 等宿主 API 由 Node.js 侧的 polyfill 接管
 */

// 1. 数据：ERA5-LAND 月均气温
var era5 = ee.ImageCollection('ECMWF/ERA5_LAND/MONTHLY');
var t2m = era5
  .select('temperature_2m')
  .filterDate('2024-07-01', '2024-08-01')
  .mean()
  .subtract(273.15)
  .rename('T_C');

print('collection:', era5);
print('mean T (°C):', t2m);

// 2. 可视化（Code Editor 里会真正渲染；本地只是记录）
Map.addLayer(t2m, {
  min: -10, max: 35,
  palette: 'blue,cyan,green,yellow,red',
}, 'T_C Jul 2024');

// 3. 导出任务（Code Editor 里会真正提交；本地只是收集到 _host.tasks）
Export.image.toDrive({
  image: t2m,
  description: 'ERA5_T_2024-07',
  folder: 'gee-export',
  scale: 11132,
  region: ee.Geometry.Rectangle([70, 15, 140, 55]),
  fileFormat: 'GeoTIFF',
  maxPixels: 1e10,
});

// 4. Chart（本地仅记录类型与参数）
var chart = Chart.image.series({
  imageCollection: era5.select('temperature_2m'),
  region: ee.Geometry.Point([105, 35]),
  scale: 11132,
});
print('chart:', chart);

// 5. 复杂：FAO-56 PM（权威计算源码见 src/gee/models/fao56.js）
//    顶层脚本只负责交互；模型模块可由 Code Editor require
// var et0 = require('users/<you>/repo:fao56').penmanMonteithET0({ ... });