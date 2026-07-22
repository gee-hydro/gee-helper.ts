import ee
import pandas as pd

_DATE_FORMAT = "YYYY-MM-dd'T'HH:mm:ss'Z'"


def format_date(num):
    return ee.Date(num).format(_DATE_FORMAT).getInfo()


def date_range_slow(col):
    field = "system:time_start"
    limits = col.select(0).reduceColumns(ee.Reducer.minMax(), [field])

    date_beg = limits.get("min")
    date_end = limits.get("max")

    return format_date(date_beg), format_date(date_end)


# GFS 18.7x faster
def date_range(col):
    """在服务端计算 ImageCollection 的时间范围。"""
    date = pd.Timestamp.now()
    year, month = date.year, date.month
    # filt = ee.Filter.calendarRange(year, year, "year").And(
    #     ee.Filter.calendarRange(month, month, "month")
    # ) # 两个叠加，速度奇慢
    filt = ee.Filter.calendarRange(year, year, "year")

    date_beg = col.first().get("system:time_start")
    date_end = col.filter(filt).aggregate_max("system:time_start")
    return format_date(date_beg), format_date(date_end)
