# Project_Forecast

使用 GEE + `xee` 按年/月导出 ImageCollection 为 NetCDF。

## 安装

```bash
pip install earthengine-api xee xarray pandas shapely pyproj netcdf4
earthengine authenticate
```

## 使用

```python
import ee
from ee_export import ee_export_batch

ee.Initialize(opt_url='https://earthengine-highvolume.googleapis.com')
region = ee.Geometry.Rectangle(
    [108.0, 29.0, 116.5, 33.5], geodesic=False,
)
col = ee.ImageCollection('ECMWF/ERA5_LAND/HOURLY').select('temperature_2m')

ee_export_batch(
    col, region, '2020', '2021', by='year',
    prefix='Hubei_ERA5L', outdir='OUTPUT',
)
```

## 网格

- `scale=None`：保持原始 CRS、分辨率及像元中心。
- `crs='EPSG:4326', scale=0.05`：重投影至 WGS84、`0.05°`。
- 连续变量可先执行 `col.map(lambda x: x.resample('bilinear'))`。
- 设置 `overwrite=True` 可覆盖已有文件。
