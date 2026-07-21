import os
import ee
import pandas as pd
from ee_export import ee_export, grid_params


def _remove_stale_weeks_files(fout, date_beg, date_end):
    """删除同一数据起点但结束时间更早的周文件。"""
    directory = os.path.dirname(fout) or "."
    name = os.path.basename(fout)
    marker = f"_[{date_beg},"
    prefix = name.rsplit(marker, 1)[0] + marker
    suffix = f"]{os.path.splitext(name)[1]}"

    for entry in os.scandir(directory):
        if not entry.is_file():
            continue
        old_name = entry.name
        if not old_name.startswith(prefix) or not old_name.endswith(suffix):
            continue
        old_end = old_name[len(prefix) : -len(suffix)]
        if old_end.isdigit() and old_end < date_end:
            os.remove(entry.path)
            print(f"remove {entry.path}")


def ee_export_weeks(
    col,
    region,
    date=None,
    weeks=None,
    year=None,
    include_current_week=True,
    fout=None,
    **kw,
):
    """按年内连续 7 日周批量导出；weeks 支持 int 或可迭代对象。"""
    if isinstance(date, int):
        year = year or date
        date = f"{date}-01-01"
    date = pd.Timestamp.now(tz="UTC") if date is None else pd.Timestamp(date)

    if weeks is None:
        week = (date.dayofyear - 1) // 7 + 1
        if week >= 2 and not include_current_week:
            week -= 1
        weeks = [week]
    elif isinstance(weeks, int):
        weeks = [weeks]
    else:
        weeks = list(weeks)

    if any(not isinstance(w, int) or not 1 <= w <= 53 for w in weeks):
        raise ValueError(f"weeks must contain integers in 1..53, got {weeks!r}")

    year = int(year or date.year)
    root, ext = os.path.splitext(fout or "")
    ext = ext or ".nc"
    datasets = []

    if kw.get("grid") is None:
        kw["grid"] = grid_params(
            region,
            scale=kw.get("scale"),
            crs=kw.get("crs", "EPSG:4326"),
            ic=col,
        )

    for week in weeks:
        filter_begin = pd.Timestamp(year=year, month=1, day=1, tz="UTC")
        filter_begin += pd.Timedelta(days=(week - 1) * 7)
        filter_end = filter_begin + pd.Timedelta(days=7)
        filt = ee.Filter.date(filter_begin.isoformat(), filter_end.isoformat())
        week_fout = None

        if fout:
            values = col.filter(filt).aggregate_array("system:time_start").getInfo()
            if not values:
                print(f"skip {year}-weeks{week:02d}: no data")
                continue
            times = pd.to_datetime(values, unit="ms", utc=True)
            date_beg = times.min().strftime("%Y%m%d%H")
            date_end = times.max().strftime("%Y%m%d%H")
            week_fout = (
                f"{root}_{year}-week{week:02d}_" f"[{date_beg},{date_end}]{ext}"
            )

        ds = ee_export(col, region, filt, fout=week_fout, **kw)
        datasets.append(ds)
        if week_fout and os.path.isfile(week_fout):
            _remove_stale_weeks_files(week_fout, date_beg, date_end)

    return datasets
