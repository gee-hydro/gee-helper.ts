"""xee 按年/月导出 ImageCollection → NetCDF（xee≥0.1）"""

import os
import ee
import xee  # noqa: F401 — register xarray ee engine
import xarray
import pandas as pd
from grid import grid_params

_FREQ = {"year": "YS", "month": "MS"}


def ee_export(
    col,
    region,
    filt,
    fout=None,
    overwrite=False,
    scale=None,
    crs="EPSG:4326",
    grid=None,
    verbose=True,
):
    """导出。grid 可预计算以避免重复请求。"""
    if fout and os.path.isfile(fout) and not overwrite:
        if verbose:
            print(f"File exists, skip: {fout}")
        return

    ic = col.filter(filt)
    if fout:
        print(fout, ic.size().getInfo())
        os.makedirs(os.path.dirname(fout) or ".", exist_ok=True)

    if grid is None:
        grid = grid_params(region, scale=scale, crs=crs, ic=ic)

    try:
        # if verbose: print(f"Running: {fout}")
        ds = xarray.open_dataset(ic, engine="ee", **grid)
        if fout:
            ds.to_netcdf(fout)

    except Exception as e:
        print(e)
    return ds


def ee_export_year(col, region, year, fout=None, **kw):
    filt = ee.Filter.calendarRange(year, year, "year")
    return ee_export(col, region, filt, fout=fout, **kw)


def ee_export_month(col, region, year, month, fout=None, **kw):
    filt = ee.Filter.calendarRange(year, year, "year").And(
        ee.Filter.calendarRange(month, month, "month")
    )
    return ee_export(col, region, filt, fout=fout, **kw)


def ee_export_batch(
    col,
    region,
    date_beg,
    date_end,
    by="year",
    prefix="",
    outdir="OUTPUT",
    scale=None,
    crs="EPSG:4326",
    overwrite=False,
):
    """按年/月批量导出。by: 'year' | 'month'
    fout = {outdir}/{prefix}_{YYYY|YYYYMM}.nc
    """
    if by not in _FREQ:
        raise ValueError(f"by must be 'year' or 'month', got {by!r}")

    dates = pd.date_range(str(date_beg), str(date_end), freq=_FREQ[by])
    # 网格只算一次
    grid = grid_params(region, scale=scale, crs=crs, ic=col)

    for d in dates:
        stamp = f"{d.year}{d.month:02d}" if by == "month" else f"{d.year}"
        fout = os.path.join(outdir, f"{prefix}_{stamp}.nc")

        kw = dict(fout=fout, overwrite=overwrite, grid=grid)
        if by == "year":
            ee_export_year(col, region, d.year, **kw)
        else:
            ee_export_month(col, region, d.year, d.month, **kw)
