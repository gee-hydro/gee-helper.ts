"""下载 dataset.ts 中登记的最新一期预报数据。"""

import os
import sys

sys.path.append("/mnt/z/GitHub/gee-hydro/gee-helper.ts")

import ee
from ee_export import ee_export, grid_params

BBOX = [70, 15, 140, 55]
REGION = "China"
OUTDIR = f"OUTPUT/{REGION}/forecast"
OVERWRITE = False


# 仅保留 dataset.ts 中 temporal="forecast" 的数据源。
WeatherNext2 = {
    "id": "WeatherNext2",
    "collection": "projects/gcp-public-data-weathernext/assets/weathernext_2_0_0",
    "bands": [
        "total_precipitation_6hr",  # m
        "10m_u_component_of_wind",
        "10m_v_component_of_wind",
    ],
    "init_field": "start_time",
    "lead_field": "forecast_hour",
    "group_field": "ensemble_member",
    "groups": [str(i) for i in range(1, 65)],  # 64个集合
    "scales": {"total_precipitation_6hr": 1000},  # m -> mm
}

SOURCES = [
    {
        # https://developers.google.com/earth-engine/datasets/catalog/projects_gcp-public-data-weathernext_assets_weathernext_2_0_0?hl=zh-cn#bands
        "id": "WeatherNext2_mean",
        "collection": "projects/gcp-public-data-weathernext/assets/weathernext_2_0_0_mean",
        "freq": 6, # 15天，一天4次
        "bands": [
            "total_precipitation_6hr",  # m
            "10m_u_component_of_wind",
            "10m_v_component_of_wind",
        ],
        "init_field": "start_time",
        "lead_field": "forecast_hour",
        "scales": {"total_precipitation_6hr": 1000},  # m -> mm
    },
    {
        # https://developers.google.com/earth-engine/datasets/catalog/ECMWF_NRT_FORECAST_IFS_OPER?hl=zh-cn
        "id": "ECMWF_NRT",
        "collection": "ECMWF/NRT_FORECAST/IFS/OPER",
        "freq": 12, # 15天，1天2次
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
        "freq": 6, # 6h，一天4次
        "bands": [
            "total_precipitation_surface",  # kg m-2 s-1
            "u_component_of_wind_10m_above_ground",
            "v_component_of_wind_10m_above_ground",
        ],
        "scales": {"total_precipitation_surface": 3600*6},  # kg m-2 s-1 -> mm/6h
        "init_field": "creation_time",
        "lead_field": "forecast_hours",
    },
    {
        # https://developers.google.com/earth-engine/datasets/catalog/NOAA_CFSR?hl=zh-cn
        "id": "CFSR",
        "collection": "NOAA/CFSR",
        "bands": [
            "Total_precipitation_surface_3_Hour_Accumulation",  # [kg m-2] = [mm]
            "u-component_of_wind_hybrid",
            "v-component_of_wind_hybrid",
        ],
        "scales": {
            "Total_precipitation_surface_3_Hour_Accumulation": 1
        },  # [kg m-2] = [mm]
        "init_field": "system:time_start",
        "lead_field": "forecast_hour",
    },
    {
        # https://developers.google.com/earth-engine/datasets/catalog/NOAA_CFSV2_FOR6H_HARMONIZED
        "id": "CFSV2",
        "collection": "NOAA/CFSV2/FOR6H_HARMONIZED",
        "bands": [
            "Precipitation_rate_surface_6_Hour_Average",  # kg m-2 s-1
            "u-component_of_wind_height_above_ground",
            "v-component_of_wind_height_above_ground",
        ],
        "init_field": "system:time_start",
        "scales": {
            "Precipitation_rate_surface_6_Hour_Average": 3600*6
        },  # kg m-2 s-1 -> mm/6h
    },
]


def scale_bands(col, bands, scales):
    """按 dataset.ts 的 displayScale 转换单位，并保留影像属性。"""
    if not scales:
        return col.select(bands)

    def scale_image(image):
        values = [
            image.select(band).multiply(scales.get(band, 1)).rename(band)
            for band in bands
        ]
        return ee.Image.cat(values).copyProperties(image, image.propertyNames())

    return col.map(scale_image)


def latest_cycle(source):
    """筛选最新起报，并将时间坐标改为预报有效时间。"""
    col = ee.ImageCollection(source["collection"])
    for field, value in source.get("filters", {}).items():
        col = col.filter(ee.Filter.eq(field, value))

    init_field = source["init_field"]
    latest = col.sort(init_field, False).first().get(init_field)
    cycle = ee.Date(latest).format("YYYYMMdd_HHmm").getInfo()
    col = col.filter(ee.Filter.eq(init_field, latest))

    lead_field = source.get("lead_field")
    if lead_field:

        def set_valid_time(image):
            valid = ee.Date(image.get(init_field)).advance(
                ee.Number(image.get(lead_field)), "hour"
            )
            return image.set("system:time_start", valid.millis())

        col = col.map(set_valid_time)

    col = scale_bands(col, source["bands"], source.get("scales", {}))
    return col, cycle


def export_source(source):
    col, cycle = latest_cycle(source)
    grid = grid_params(BBOX, ic=col)
    groups = source.get("groups", [None])

    for group in groups:
        subset = col
        suffix = ""
        if group is not None:
            subset = col.filter(ee.Filter.eq(source["group_field"], group))
            suffix = f"_member{int(group):02d}"

        fout = os.path.join(
            OUTDIR,
            source["id"],
            f"{REGION}_{source['id']}_{cycle}{suffix}.nc",
        )
        ee_export(
            subset,
            BBOX,
            ee.Filter.notNull(["system:time_start"]),
            fout=fout,
            overwrite=OVERWRITE,
            grid=grid,
        )


def main():
    ee.Initialize(opt_url="https://earthengine-highvolume.googleapis.com")
    for source in SOURCES:
        export_source(source)


if __name__ == "__main__":
    main()
