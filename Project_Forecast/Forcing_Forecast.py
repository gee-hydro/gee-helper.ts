"""下载 dataset.ts 中登记的最新一期预报数据。"""

import os
import sys

sys.path.append("/mnt/z/GitHub/gee-hydro/gee-helper.ts")

import ee
from ee_export import ee_export, grid_params, PRCP_SOURCES

BBOX = [70, 15, 140, 55]
REGION = "China"
OUTDIR = f"OUTPUT/{REGION}/forecast"
OVERWRITE = False


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
    if lead_field and "lead_min" in source:
        col = col.filter(ee.Filter.gte(lead_field, source["lead_min"]))

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
    for source in PRCP_SOURCES:
        export_source(source)


if __name__ == "__main__":
    main()
