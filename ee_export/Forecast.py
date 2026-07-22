"""预报 ImageCollection 按 date_forecast 导出（lead ≤ 48h）。"""
import glob
import os
import time

import ee
import pandas as pd
import xarray as xr
import xee  # noqa: F401
from dask.diagnostics import ProgressBar

from .grid import grid_params

LEAD_MAX, N_INIT_DAY = 48, 4

# freq / 文件名戳 / 区间右端 / 齐全 fc 数
PERIOD = {
    "day": (
        "D",
        "%Y%m%d",
        lambda t: t + pd.Timedelta(1, unit="D"),
        lambda t0, t1: N_INIT_DAY,
    ),
    "month": (
        "MS",
        "%Y%m",
        lambda t: t + pd.offsets.MonthBegin(1),
        lambda t0, t1: N_INIT_DAY * (t1 - t0).days,
    ),
}


def base_col(source):
    col = ee.ImageCollection(source["collection"])
    for k, v in source.get("filters", {}).items():
        col = col.filter(ee.Filter.eq(k, v))
    return col


def bind_init_bounds(source):
    """WeatherNext start_time 为 str；GFS/ECMWF creation_time 为 millis。"""
    sample = base_col(source).first().get(source["init_field"]).getInfo()
    if isinstance(sample, str):
        fmt = "%Y-%m-%dT%H:%M:%SZ"
        return lambda t0, t1: (t0.strftime(fmt), t1.strftime(fmt))
    return lambda t0, t1: (int(t0.timestamp() * 1000), int(t1.timestamp() * 1000))


def forecast_col(source, t0, t1):
    init, lead = source["init_field"], source["lead_field"]
    bands, scales = source["bands"], source.get("scales", {})
    a, b = source["_init_bounds"](t0, t1)
    col = (
        base_col(source)
        .filter(ee.Filter.gte(init, a)).filter(ee.Filter.lt(init, b))
        .filter(ee.Filter.gte(lead, source.get("lead_min", 0)))
        .filter(ee.Filter.lte(lead, LEAD_MAX))
    )

    def prep(img):
        fc = ee.Date(img.get(init))
        lh = ee.Number(img.get(lead))
        fv = fc.advance(lh, "hour")
        img = img.set({
            "system:time_start": fv.millis(),
            "date_forecast": fc.millis(),
            "date_valid": fv.millis(),
            "lead": lh,
        })
        if not scales:
            return img.select(bands)
        out = [img.select(b).multiply(scales.get(b, 1)).rename(b) for b in bands]
        return ee.Image.cat(out).copyProperties(img, img.propertyNames())

    return col.map(prep)


def meta_coords(col):
    keys = ["date_forecast", "date_valid", "lead"]
    v = col.reduceColumns(ee.Reducer.toList().repeat(3), keys).get("list").getInfo()
    return {
        "date_forecast": ("time", pd.to_datetime(v[0], unit="ms")),
        "date_valid": ("time", pd.to_datetime(v[1], unit="ms")),
        "lead": ("time", v[2]),
    }


def export_range(source, t0, t1, stamp, n_fc_ok, *, bbox, region, outdir):
    """导出 [t0, t1)；存在 _fc{n_fc_ok} 则跳过。"""
    sid = source["id"]
    d = os.path.join(outdir, sid)
    paths = sorted(glob.glob(os.path.join(d, f"{region}_{sid}_{stamp}*.nc")))
    if any(p.endswith(f"_fc{n_fc_ok}.nc") for p in paths):
        print(f"{sid:18s} {stamp}  skip fc{n_fc_ok}", flush=True)
        return

    col = forecast_col(source, t0, t1)
    n = col.size().getInfo()
    print(f"{sid:18s} {stamp}  remote n={n}", flush=True)
    if n == 0:
        return

    t_run = time.perf_counter()
    grid = grid_params(bbox, scale=source["scale"], crs="EPSG:4326", ic=col)
    ds = xr.open_dataset(col, engine="ee", **grid).assign_coords(**meta_coords(col))
    n_fc = int(pd.to_datetime(ds["date_forecast"].values).unique().size)

    os.makedirs(d, exist_ok=True)
    fout = os.path.join(d, f"{region}_{sid}_{stamp}_fc{n_fc}.nc")
    tmp = fout + ".tmp"
    with ProgressBar():
        ds.to_netcdf(tmp)
    os.replace(tmp, fout)
    for old in paths:
        if old != fout:
            os.remove(old)
    print(f"  -> {fout}  ({time.perf_counter() - t_run:.1f}s)", flush=True)


def export_period(source, t, fmt, t1_fn, n_ok_fn, **kw):
    t0, t1 = t, t1_fn(t)
    export_range(source, t0, t1, f"{t:{fmt}}", n_ok_fn(t0, t1), **kw)


def export_day(source, day, **kw):
    _, fmt, t1_fn, n_ok_fn = PERIOD["day"]
    export_period(source, day, fmt, t1_fn, n_ok_fn, **kw)


def export_month(source, month, **kw):
    _, fmt, t1_fn, n_ok_fn = PERIOD["month"]
    export_period(source, month, fmt, t1_fn, n_ok_fn, **kw)


def prepare_source(source):
    """挂上 _init_bounds，供 forecast_col 使用。"""
    return {**source, "_init_bounds": bind_init_bounds(source)}
