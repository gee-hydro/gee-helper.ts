"""xee 按年/月导出 ImageCollection → NetCDF（xee≥0.1）"""
import math
import os
import ee
import xee  # noqa: F401 — register xarray ee engine
import xarray
import pandas as pd
import shapely.geometry
import shapely.ops
from pyproj import Transformer

_FREQ = {'year': 'YS', 'month': 'MS'}


def _region_box(region):
    """ee.Geometry → shapely box (lon/lat)。"""
    coords = region.bounds().coordinates().getInfo()[0]
    xs, ys = zip(*coords)
    return shapely.geometry.box(min(xs), min(ys), max(xs), max(ys))


def _native_grid(region, projection):
    """按原始仿射变换裁剪网格，不改变像元中心。"""
    sx, rx, x0, ry, sy, y0 = projection['transform']
    if rx or ry or sx <= 0 or sy >= 0:
        raise ValueError('仅支持无旋转的北向原生网格')

    transformer = Transformer.from_crs(
        'EPSG:4326', projection['crs'], always_xy=True,
    )
    box = shapely.ops.transform(transformer.transform, _region_box(region))
    xmin, ymin, xmax, ymax = box.bounds

    col0 = math.floor((xmin - x0) / sx)
    col1 = math.ceil((xmax - x0) / sx)
    row0 = math.floor((ymax - y0) / sy)
    row1 = math.ceil((ymin - y0) / sy)

    return {
        'crs': projection['crs'],
        'crs_transform': (sx, 0, x0 + col0 * sx,
                          0, sy, y0 + row0 * sy),
        'shape_2d': (col1 - col0, row1 - row0),
    }


def grid_params(region, scale=None, crs='EPSG:4326', ic=None):
    """xee open_dataset 网格参数。
    scale=None 时保留首景原生网格；显式 scale 时生成新网格。
    """
    projection = ic.first().select(0).projection().getInfo()
    if scale is None:
        if crs != projection['crs']:
            raise ValueError('保留原生网格时，crs 必须与数据原始 CRS 相同')
        return _native_grid(region, projection)
    if isinstance(scale, (int, float)):
        s = abs(float(scale))
        scale = (s, -s)
    return xee.fit_geometry(
        _region_box(region), grid_crs=crs, grid_scale=scale,
    )


def ee_export(col, region, filt, fout=None, overwrite=False,
              scale=None, crs='EPSG:4326', grid=None):
    """导出。grid 可预计算以避免重复请求。"""
    if fout and os.path.isfile(fout) and not overwrite:
        return

    ic = col.filter(filt)
    if fout:
        print(fout, ic.size().getInfo())
        os.makedirs(os.path.dirname(fout) or '.', exist_ok=True)

    if grid is None:
        grid = grid_params(region, scale=scale, crs=crs, ic=ic)

    ds = xarray.open_dataset(ic, engine='ee', **grid)
    if fout:
        ds.to_netcdf(fout)
    return ds


def ee_export_year(col, region, year, fout=None, **kw):
    filt = ee.Filter.calendarRange(year, year, 'year')
    return ee_export(col, region, filt, fout=fout, **kw)


def ee_export_month(col, region, year, month, fout=None, **kw):
    filt = (ee.Filter.calendarRange(year, year, 'year')
            .And(ee.Filter.calendarRange(month, month, 'month')))
    return ee_export(col, region, filt, fout=fout, **kw)


def ee_export_batch(col, region, date_beg, date_end, by='year',
                    prefix='', outdir='OUTPUT', scale=None, crs='EPSG:4326',
                    overwrite=False):
    """按年/月批量导出。by: 'year' | 'month'
    fout = {outdir}/{prefix}_{YYYY|YYYYMM}.nc
    """
    if by not in _FREQ:
        raise ValueError(f"by must be 'year' or 'month', got {by!r}")

    dates = pd.date_range(str(date_beg), str(date_end), freq=_FREQ[by])
    # 网格只算一次
    grid = grid_params(region, scale=scale, crs=crs, ic=col)

    for d in dates:
        stamp = f'{d.year}{d.month:02d}' if by == 'month' else f'{d.year}'
        fout = os.path.join(outdir, f'{prefix}_{stamp}.nc')
        try:
            if by == 'year':
                ee_export_year(col, region, d.year, fout=fout,
                               overwrite=overwrite, grid=grid)
            else:
                ee_export_month(col, region, d.year, d.month, fout=fout,
                                overwrite=overwrite, grid=grid)
        except Exception as e:
            print(e)
