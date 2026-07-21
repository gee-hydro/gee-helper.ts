// =====================================================================
//  WeatherNext 2 vs WeatherNext 2 Mean：同一预报时刻对比
//  weathernext_2_0_0      = 64 成员全集合
//  weathernext_2_0_0_mean = 64 成员逐格点平均的预聚合
//
//  运行：cd server && npx tsx scripts/run-gee-script.ts examples/test01.js
//        或直接粘贴到 GEE Code Editor
//
//  注：reduceRegion 在 GEE 单次 evaluate 里拒绝全球大区域，
//      这里用单点 (武汉 114.3°E, 30.6°N) + 25km scale。
// =====================================================================

var INIT = '2022-01-01T00:00:00Z';   // 起报时刻（dataset 起自 2022-01-01）
var LEAD = 6;                        // 预报时效（h），首帧可用值
var BAND = '2m_temperature';         // 待比较变量（K）
var PT   = ee.Geometry.Point([114.3, 30.6]); // 武汉
var SCALE = 25000;

var RAW  = ee.ImageCollection('projects/gcp-public-data-weathernext/assets/weathernext_2_0_0');
var MEAN = ee.ImageCollection('projects/gcp-public-data-weathernext/assets/weathernext_2_0_0_mean');
var dateFilt = ee.Filter.date(INIT, ee.Date(INIT).advance(1, 'hour'));
var leadFilt = ee.Filter.eq('forecast_hour', LEAD);

// 待比较的图
var meanAsset = MEAN.filter(dateFilt).filter(leadFilt).first().select(BAND); // 预聚合平均
var rawAll    = RAW.filter(dateFilt).filter(leadFilt).select(BAND);          // 64 成员集合
var rawMean   = rawAll.mean();                                               // 手算 64 成员平均

// 可视化（Code Editor 真正渲染；Node 端只是记录到 host.layers）
Map.setCenter(114.3, 30.6, 3);
Map.addLayer(meanAsset, {min: 260, max: 300, palette: ['blue','cyan','green','yellow','red']}, 'Mean (asset)');
Map.addLayer(rawMean,   {min: 260, max: 300, palette: ['blue','cyan','green','yellow','red']}, 'Raw 64-member mean');

// 单点统计：mean ± stdDev
var rs = ee.Reducer.mean().combine(ee.Reducer.stdDev(), '', true);

print('Mean (asset)      ', meanAsset.reduceRegion({reducer: rs, geometry: PT, scale: SCALE}));
print('Raw 64-member mean', rawMean.reduceRegion  ({reducer: rs, geometry: PT, scale: SCALE}));

// 一致性校验：|Mean_asset − Raw 64-member mean|（≈0 即二者等价）
print('|Mean_asset − Raw64-mean| (consistency)',
  meanAsset.subtract(rawMean).abs().reduceRegion({
    reducer: ee.Reducer.mean().combine(ee.Reducer.max(), '', true),
    geometry: PT, scale: SCALE}));

// 集合离散度：64 成员 stdDev（仅 Raw 资产能做，Mean 资产已丢信息）
print('Spread (stdDev across 64 members)',
  rawAll.reduce(ee.Reducer.stdDev()).reduceRegion({
    reducer: ee.Reducer.mean(), geometry: PT, scale: SCALE}));