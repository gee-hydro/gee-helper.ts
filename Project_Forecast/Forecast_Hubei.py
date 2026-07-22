# %%
"""按 date_forecast 导出；lead ≤ 48h。
日/月：{Region}_{id}_{YYYYMMDD|YYYYMM}_fc{n}.nc；fc 齐全则跳过。
"""
import sys
sys.path.append("/mnt/z/GitHub/gee-hydro/gee-helper.ts")

import ee
import pandas as pd
import xarray as xr
from ee_export import PRCP_SOURCES, grid_params


bbox = [108.0, 29.0, 116.5, 33.5]
Region, outdir = "Hubei", "OUTPUT/ForecastPast"
by = "month"  # "day" | "month"

date_beg = pd.Timestamp("2022-01-01")
date_end = pd.Timestamp("2026-07-01")


if __name__ == "__main__":
    ee.Initialize(opt_url="https://earthengine-highvolume.googleapis.com")
    if by not in PERIOD:
        raise ValueError(f"by must be {set(PERIOD)}, got {by!r}")
    freq, fmt, t1_fn, n_ok_fn = PERIOD[by]
    print(f"date_forecast: {date_beg} -> {date_end}, by={by}, lead≤{LEAD_MAX}h")

    stamps = pd.date_range(date_beg, date_end, freq=freq, inclusive="left")
    for source in PRCP_SOURCES:
        source = {**source, "_init_bounds": bind_init_bounds(source)}
        for t in stamps:
            export_period(source, t, fmt, t1_fn, n_ok_fn)
