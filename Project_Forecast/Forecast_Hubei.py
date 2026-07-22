# downloading speed: 1min per year
# %%
import sys
sys.path.append("/mnt/z/GitHub/gee-hydro/gee-helper.ts")

from ee_export import ee_export_batch, ee_export_weeks
import ee
ee.Initialize(opt_url="https://earthengine-highvolume.googleapis.com")

bbox = [109.4, 31.2, 111.6, 33.4]  # 十堰
Region = "ShiYan"

bbox = [108.0, 29.0, 116.5, 33.5]  # 湖北
Region = "Hubei"

# bbox = [108.0, 24.0, 115, 31]  # 湖南
# Region = "HuNan"

# outdir = f"OUTPUT/{Region}"
outdir = f"OUTPUT/Forecast"
date_beg = "2026-07-10 00:00:00"
date_end = "2026-07-11 00:00:00"
by = "day"

kw = dict(bbox=bbox, date_beg=date_beg, date_end=date_end, by=by, outdir=outdir, overwrite=True)

##
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


if __name__ == "__main__":
    ee.Initialize(opt_url="https://earthengine-highvolume.googleapis.com")
    for source in PRCP_SOURCES:
        export_source(source)
