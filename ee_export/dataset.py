"""GEE 降水预报数据源及档案时间范围检查。"""

import time

import ee

if __package__:
    from .ultilize import date_range
else:
    from ultilize import date_range


PRCP_SOURCES = [
    {
        # https://developers.google.com/earth-engine/datasets/catalog/ECMWF_NRT_FORECAST_IFS_OPER?hl=zh-cn
        "id": "ECMWF_NRT",
        "collection": "ECMWF/NRT_FORECAST/IFS/OPER",
        "freq_forecast": 6,  # 144h, 3h
        "scale": 0.25,
        "crs_transform": [0.25, 0, -180.125, 0, -0.25, 90.125],
        "bands": [
            "total_precipitation_sfc",
            "u_component_of_wind_10m_sfc",
            "v_component_of_wind_10m_sfc",
        ],
        "init_field": "creation_time",
        "lead_field": "forecast_hours",
        "filters": {"model": "ifs"},
        "scales": {"total_precipitation_sfc": 1000},  # m -> mm
    },
    {
        # https://developers.google.com/earth-engine/datasets/catalog/NOAA_GFS0P25?hl=zh-cn
        "id": "GFS",
        "collection": "NOAA/GFS0P25",
        "freq_forecast": 6,  # 384h, 1h (0-120h), 3h(>120h)
        "scale": 0.25,
        "crs_transform": [0.25, 0, -180.125, 0, -0.25, 90.125],
        "bands": [
            "total_precipitation_surface",  # kg m-2 = mm
            "u_component_of_wind_10m_above_ground",
            "v_component_of_wind_10m_above_ground",
        ],
        "scales": {},  # kg m-2 = mm，无需换算
        "init_field": "creation_time",
        "lead_field": "forecast_hours",
        "lead_min": 1,  # lead=0 无 total_precipitation_surface 波段
    },
    {
        # https://developers.google.com/earth-engine/datasets/catalog/projects_gcp-public-data-weathernext_assets_weathernext_2_0_0?hl=zh-cn#bands
        "id": "WeatherNext2_mean",
        "collection": "projects/gcp-public-data-weathernext/assets/weathernext_2_0_0_mean",
        "freq_forecast": 6,  # 360h, 6h (freq_valid)
        "scale": 0.25,
        "crs_transform": [0.25, 0, -180.125, 0, -0.25, 90.125],
        "bands": [
            "total_precipitation_6hr",  # m
            "10m_u_component_of_wind",
            "10m_v_component_of_wind",
        ],
        "init_field": "start_time",
        "lead_field": "forecast_hour",
        "scales": {"total_precipitation_6hr": 1000},  # m -> mm
    },
    # {
    #     "id": "WeatherNext2",
    #     "collection": "projects/gcp-public-data-weathernext/assets/weathernext_2_0_0",
    #     "scale": 0.25,
    #     "crs_transform": [0.25, 0, -180.125, 0, -0.25, 90.125],
    #     "bands": [
    #         "total_precipitation_6hr",  # m
    #         "10m_u_component_of_wind",
    #         "10m_v_component_of_wind",
    #     ],
    #     "init_field": "start_time",
    #     "lead_field": "forecast_hour",
    #     "group_field": "ensemble_member",
    #     "groups": [str(i) for i in range(1, 65)],  # 64个集合
    #     "scales": {"total_precipitation_6hr": 1000},  # m -> mm
    # },
    # {
    #     # https://developers.google.com/earth-engine/datasets/catalog/NOAA_CFSR?hl=zh-cn
    #     "id": "CFSR",
    #     "collection": "NOAA/CFSR",
    #     "freq_forecast": 6,  # 3h, (仅提供3h小时?)
    #     "scale": 0.5,
    #     "crs_transform": [0.5, 0, -360.25, 0, -0.5, 90],
    #     "bands": [
    #         "Total_precipitation_surface_3_Hour_Accumulation",  # [kg m-2] = [mm]
    #         "u-component_of_wind_hybrid",
    #         "v-component_of_wind_hybrid",
    #     ],
    #     "scales": {
    #         "Total_precipitation_surface_3_Hour_Accumulation": 1
    #     },  # [kg m-2] = [mm]
    #     "init_field": "system:time_start",
    #     "lead_field": "forecast_hour",
    # },
    # {
    #     # https://developers.google.com/earth-engine/datasets/catalog/NOAA_CFSV2_FOR6H_HARMONIZED
    #     "id": "CFSV2",
    #     "collection": "NOAA/CFSV2/FOR6H_HARMONIZED",
    #     "freq_forecast": 6,  # 6h (仅提供了6h预报?)
    #     "scale": 0.2045,
    #     "crs_transform": [0.2045451961341671, 0, -180.1022725980671, 0, -0.20442320819112628, 90],
    #     "bands": [
    #         "Precipitation_rate_surface_6_Hour_Average",  # kg m-2 s-1
    #         "u-component_of_wind_height_above_ground",
    #         "v-component_of_wind_height_above_ground",
    #     ],
    #     "init_field": "system:time_start",
    #     "scales": {
    #         "Precipitation_rate_surface_6_Hour_Average": 3600 * 6
    #     },  # kg m-2 s-1 -> mm/6h
    # },
]


def source_date_ranges(sources=PRCP_SOURCES):
    """逐源查询 system:time_start 范围，打印并计时。"""
    ranges = {}
    for source in sources:
        col = ee.ImageCollection(source["collection"])
        for field, value in source.get("filters", {}).items():
            col = col.filter(ee.Filter.eq(field, value))

        t0 = time.perf_counter()
        date_beg, date_end = ee.List(list(date_range(col))).getInfo()
        dt = time.perf_counter() - t0

        ranges[source["id"]] = (date_beg, date_end)
        print(f"{source['id']:18s} {date_beg} -> {date_end}  ({dt:.2f}s)", flush=True)
    return ranges


if __name__ == "__main__":
    ee.Initialize(opt_url="https://earthengine-highvolume.googleapis.com")
    source_date_ranges()
