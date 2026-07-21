# downloading speed: 1min per year
# %%
import sys
sys.path.insert(0, "./Project_Forecast/")

from ee_export import ee_export_batch
import ee
ee.Initialize(opt_url="https://earthengine-highvolume.googleapis.com")

region = ee.Geometry.Rectangle(109.4, 31.2, 111.6, 33.4)  # 十堰
Region = "ShiYan"

# bbox(108.44999999999999, 28.711210351287686, 116.25, 33.611210351287696)
region = ee.Geometry.Rectangle(108.0, 29.0, 116.5, 33.5)  # 湖北
Region = "Hubei"

date_beg = "2025"
date_end = "2026"
by = "year"

# %%
# col = ee.ImageCollection("NASA/GPM_L3/IMERG_V07").select("precipitation")
# ee_export_batch(col, region, date_beg, date_end, by=by, prefix=f"{Region}_GPM_v7")

# col = ee.ImageCollection("JAXA/GPM_L3/GSMaP/v8/operational") \
#     .select("hourlyPrecipRateGC")
# ee_export_batch(col, region, date_beg, date_end, by=by, prefix=f"{Region}_GSMaP_v8")

# %%
BANDS = [
    "surface_pressure",
    "surface_net_thermal_radiation_hourly",
    "surface_net_solar_radiation_hourly",
    "temperature_2m",
    "dewpoint_temperature_2m",
    "surface_latent_heat_flux_hourly",
    "surface_sensible_heat_flux_hourly",
    "u_component_of_wind_10m",
    "v_component_of_wind_10m",
]
img = ee.ImageCollection("ECMWF/ERA5_LAND/HOURLY").select(BANDS).limit(1).first()
print(img)
# ee_export_batch(col, region, date_beg, date_end, by=by, prefix=f"{Region}_ERA5L")
