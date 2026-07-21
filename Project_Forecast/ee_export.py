"""xee 按年/月导出 ImageCollection → NetCDF"""
import os.path
import ee
import xee  # noqa: F401 — register xarray ee engine
import xarray
import pandas as pd

_FREQ = {'year': 'YS', 'month': 'MS'}


def ee_export(col, region, filt, fout=None, overwrite=False):
    """导出。col 可为 ImageCollection 或 collection id。"""
    if fout and os.path.isfile(fout) and overwrite == False:
        return

    ic = col.filter(filt)
    if fout:
        print(fout, ic.size().getInfo())

    ds = xarray.open_dataset(
        ic, engine='ee',
        projection=ic.first().select(0).projection(),
        geometry=region,
    )
    if fout:
        ds.to_netcdf(fout)
    return ds


def ee_export_year(col, region, year, fout=None):
    filt = ee.Filter.calendarRange(year, year, 'year')
    return ee_export(col, region, filt, fout=fout)


def ee_export_month(col, region, year, month, fout=None):
    filt = (ee.Filter.calendarRange(year, year, 'year')
            .And(ee.Filter.calendarRange(month, month, 'month')))
    return ee_export(col, region, filt, fout=fout)


def ee_export_batch(
    col,
    region,
    date_beg,
    date_end,
    by="year",
    prefix="",
    outdir="OUTPUT",
    save=True,
    **kw,
):
    """按年/月批量导出。by: 'year' | 'month'
    fout = {prefix}{YYYY}|{YYYYMM}.nc
    date_beg/end 支持 int/str（如 2017 / '2017-01'）

    - `kw`: 
        + `overwrite`
        + `bands`
    """
    if by not in _FREQ:
        raise ValueError(f"by must be 'year' or 'month', got {by!r}")

    # int 会被 pandas 当成纳秒时间戳，必须转 str
    dates = pd.date_range(str(date_beg), str(date_end), freq=_FREQ[by])

    for d in dates:
        stamp = f'{d.year}{d.month:02d}' if by == 'month' else f'{d.year}'
        fout = f'{outdir}/{prefix}_{stamp}.nc' if save else None

        try:
            if by == 'year':
                ee_export_year(col, region, d.year, fout=fout, **kw)
            else:
                ee_export_month(col, region, d.year, d.month,
                                fout=fout, **kw)
        except Exception as e:
            print(e)
