# %%
"""湖北预报：按 date_forecast 日/月导出，lead ≤ 48h。"""
import sys

sys.path.append("/mnt/z/GitHub/gee-hydro/gee-helper.ts")

import ee
import pandas as pd
from ee_export import PRCP_SOURCES
from ee_export.Forecast import LEAD_MAX, PERIOD, export_period, prepare_source

bbox = [108.0, 29.0, 116.5, 33.5]
region = "Hubei"

# %% 
outdir ="OUTPUT/ForecastPast"
by = "month"  # "day" | "month"
date_beg = pd.Timestamp("2022-01-01")
date_end = pd.Timestamp("2026-07-01")


if __name__ == "__main__":
    ee.Initialize(opt_url="https://earthengine-highvolume.googleapis.com")
    if by not in PERIOD:
        raise ValueError(f"by must be {set(PERIOD)}, got {by!r}")

    freq, fmt, t1_fn, n_ok_fn = PERIOD[by]
    kw = dict(bbox=bbox, region=region, outdir=outdir)
    print(f"date_forecast: {date_beg} -> {date_end}, by={by}, lead≤{LEAD_MAX}h")

    stamps = pd.date_range(date_beg, date_end, freq=freq, inclusive="left")
    for source in PRCP_SOURCES:
        source = prepare_source(source)
        for t in stamps:
            export_period(source, t, fmt, t1_fn, n_ok_fn, **kw)
