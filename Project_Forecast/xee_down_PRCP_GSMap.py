import os.path
import ee
import xee
import xarray as xr
import xarray

region = [109.4, 31.3, 111.6, 33.4]
# band, var = "surface_pressure", "Pa"
# band, var = "surface_net_thermal_radiation", "Rln"
# prefix = "HuBei_%s_" % var

# ee.Initialize()
ee.Initialize(opt_url='https://earthengine-highvolume.googleapis.com')

prefix = "ShiYan_GSMaP_v8"
col = ee.ImageCollection("JAXA/GPM_L3/GSMaP/v8/operational").select("hourlyPrecipRateGC")

# region = ee.Geometry.Rectangle(28.75, 108.5, 33.5, 116.25)
region = ee.Geometry.Rectangle(109.4, 31.2, 111.6, 33.4) # 湖北
# region = ee.Geometry.Rectangle(108, 24, 115, 31) # 湖南

# range = c(113.5, 115, 29.75, 31.5)
# region = ee.Geometry.Rectangle(113.5, 29.75, 115, 31.5)
# 108.52083  28.99917 116.06833  33.24833

def ee_col_download_year(region, year=2022, save=False, prefix=""):

    fout = prefix + "_" + str(year) + ".nc"
    if os.path.isfile(fout):
        return
    ic = col.filter(ee.Filter.calendarRange(year, year, 'year'))
    print(fout)
    print(ic.size().getInfo())

    ds = xarray.open_dataset(
        ic,
        engine='ee',
        projection=ic.first().select(0).projection(),
        geometry=region
    )
    if save:
        ds.to_netcdf(fout)
    ds


def ee_col_download_years(region, 
                          year_beg=2022, year_end=2022, save=False, prefix=""):

    for year in range(year_beg, year_end + 1):
        try:
            ee_col_download_year(region, year, save, prefix)
        except Exception as e:
            print(str(e))

# ee_col_download_year(region, year=2000, save=True)
ee_col_download_years(region, year_beg=2014,
                      year_end=2024, save=True, prefix=prefix)
