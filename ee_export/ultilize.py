import ee
import pandas as pd

_DATE_FORMAT = "YYYY-MM-dd'T'HH:mm:ss'Z'"


def format_date(num):
    return ee.Date(num).format(_DATE_FORMAT)


def date_range_slow(col):
    field = "system:time_start"
    limits = col.select(0).reduceColumns(ee.Reducer.minMax(), [field])

    date_beg = limits.get("min")
    date_end = limits.get("max")

    return format_date(date_beg), format_date(date_end)


def date_range(col):
    """在服务端计算 ImageCollection 的时间范围。"""
    date_now = pd.Timestamp.now()
    year = date_now.year
    filter = ee.Filter.calendarRange(year, year, "year")

    date_beg = col.first().get("system:time_start")
    date_end = col.filter(filter).aggregate_max("system:time_start")
    return format_date(date_beg), format_date(date_end)
