# downloading speed: 1min per year
# %%
import sys
sys.path.append("/mnt/z/GitHub/gee-hydro/gee-helper.ts")

from ee_export import ee_export_batch, ee_export_weeks
import ee
ee.Initialize(opt_url="https://earthengine-highvolume.googleapis.com")

bbox = [109.4, 31.2, 111.6, 33.4]  # 十堰
Region = "ShiYan"

# bbox = [108.0, 29.0, 116.5, 33.5]  # 湖北
# Region = "Hubei"

bbox = [108.0, 24.0, 115, 31]  # 湖南
Region = "HuNan"

outdir = f"OUTPUT/{Region}"
date_beg = "2015"
date_end = "2026"
by = "year"

kw = dict(bbox=bbox, date_beg=date_beg, date_end=date_end, by=by, outdir=outdir, overwrite=True)

# %%
# col = ee.ImageCollection("NASA/GPM_L3/IMERG_V07").select("precipitation")
# ee_export_batch(col, prefix=f"{Region}_GPM_v7", **kw)

# col = ee.ImageCollection("JAXA/GPM_L3/GSMaP/v8/operational") \
#     .select("hourlyPrecipRateGC")
# ee_export_batch(col, prefix=f"{Region}_GSMaP_v8", **kw)

# %%
BANDS = [
    "surface_net_thermal_radiation_hourly", # [J]
    "surface_net_solar_radiation_hourly",   # [J]
    "surface_latent_heat_flux_hourly",
    "surface_sensible_heat_flux_hourly",
    "temperature_2m",
    "dewpoint_temperature_2m",
    "u_component_of_wind_10m",
    "v_component_of_wind_10m",
    "surface_pressure",
]
col = ee.ImageCollection("ECMWF/ERA5_LAND/HOURLY").select(BANDS)
ee_export_batch(col, prefix=f"{Region}_ERA5L", **kw)
