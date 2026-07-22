// 检查 2026-07-10 UTC 一天内的 GEE 预报数据。

var START = '2026-07-10T00:00:00Z';
var END = '2026-07-11T00:00:00Z';

var SOURCES = [
  {
    id: 'WeatherNext2_mean',
    collection: 'projects/gcp-public-data-weathernext/assets/weathernext_2_0_0_mean',
    bands: [
      'total_precipitation_6hr',
      '10m_u_component_of_wind',
      '10m_v_component_of_wind',
    ],
    initField: 'start_time',
    leadField: 'forecast_hour',
  },
  {
    id: 'ECMWF_NRT',
    collection: 'ECMWF/NRT_FORECAST/IFS/OPER',
    bands: [
      'total_precipitation_sfc',
      'u_component_of_wind_10m_sfc',
      'v_component_of_wind_10m_sfc',
    ],
    initField: 'creation_time',
    leadField: 'forecast_hours',
    filters: {model: 'ifs'},
  },
  {
    id: 'GFS',
    collection: 'NOAA/GFS0P25',
    bands: [
      'total_precipitation_surface',
      'u_component_of_wind_10m_above_ground',
      'v_component_of_wind_10m_above_ground',
    ],
    initField: 'creation_time',
    leadField: 'forecast_hours',
  },
  {
    id: 'CFSR',
    collection: 'NOAA/CFSR',
    bands: [
      'Total_precipitation_surface_3_Hour_Accumulation',
      'u-component_of_wind_hybrid',
      'v-component_of_wind_hybrid',
    ],
    initField: 'system:time_start',
    leadField: 'forecast_hour',
  },
  {
    id: 'CFSV2',
    collection: 'NOAA/CFSV2/FOR6H_HARMONIZED',
    bands: [
      'Precipitation_rate_surface_6_Hour_Average',
      'u-component_of_wind_height_above_ground',
      'v-component_of_wind_height_above_ground',
    ],
    initField: 'system:time_start',
  },
];

function checkSource(source) {
  var col = ee.ImageCollection(source.collection).filterDate(START, END);
  Object.keys(source.filters || {}).forEach(function (field) {
    col = col.filter(ee.Filter.eq(field, source.filters[field]));
  });

  print(source.id + ' data', col);
  print(source.id + ' count', col.size());
  print(source.id + ' first', col.first());
  // print(source.id + ' configured bands', source.bands);
  // print(source.id + ' first image bands', ee.Image(col.first()).bandNames());
  print(
    source.id + ' init times',
    col.aggregate_array(source.initField).distinct().sort()
  );

  if (source.leadField) {
    print(
      source.id + ' lead hours',
      col.aggregate_array(source.leadField).distinct().sort()
    );
  }
}

SOURCES.forEach(checkSource);
