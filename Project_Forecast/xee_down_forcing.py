# downloading speed: 1min per year
# %%
import sys
sys.path.insert(0, "./Project_Forecast/")

from ee_export import ee_export_batch
import ee
ee.Initialize(opt_url="https://earthengine-highvolume.googleapis.com")

region = ee.Geometry.Rectangle(109.4, 31.2, 111.6, 33.4)  # 十堰

date_beg = "2017"
date_end = "2024"
by = "year"

# %%
col = ee.ImageCollection("NASA/GPM_L3/IMERG_V07").select("precipitation")
ee_export_batch(col, region, date_beg, date_end, by=by, prefix="ShiYan_GPM_v7")


# %%
col = ee.ImageCollection("JAXA/GPM_L3/GSMaP/v8/operational") \
    .select("hourlyPrecipRateGC")
ee_export_batch(col, region, date_beg, date_end, by=by, prefix="ShiYan_GSMaP_v8")


# %%
BANDS = [
    "surface_pressure",
    "surface_net_thermal_radiation",
    "surface_net_solar_radiation",
    "temperature_2m",
    "dewpoint_temperature_2m",
    "surface_latent_heat_flux",
    "surface_sensible_heat_flux",
    "u_component_of_wind_10m",
    "v_component_of_wind_10m",
]
col = ee.ImageCollection("ECMWF/ERA5_LAND/HOURLY").select(BANDS)
ee_export_batch(col, region, date_beg, date_end, by=by, prefix="ShiYan_ERA5L")
