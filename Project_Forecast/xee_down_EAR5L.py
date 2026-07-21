import ee
import xee
import xarray
import argparse
import os.path

# band, var = "surface_pressure", "Pa"
# band, var = "surface_net_thermal_radiation", "Rln"
bands = [
    "surface_pressure",
    "surface_net_thermal_radiation",
    "surface_net_solar_radiation",
    "temperature_2m",
    "dewpoint_temperature_2m",
    "surface_latent_heat_flux", "surface_sensible_heat_flux",
    "u_component_of_wind_10m", "v_component_of_wind_10m",
]
# prefix = "HuBei_%s_" % var
# prefix = "HuBei_ERA5L_"

# ee.Initialize()
ee.Initialize(opt_url='https://earthengine-highvolume.googleapis.com')


def ee_col_download_year(region, col_id='ECMWF/ERA5_LAND/HOURLY',
                         year=2022, save=False, prefix=""):

    fout = prefix + col_id.replace("/", "_") + "_" + str(year) + ".nc"
    if os.path.isfile(fout):
        return

    ic = (ee.ImageCollection(col_id)
          # .filterDate('2000-01-01', '2023-01-01')
          .filter(ee.Filter.calendarRange(year, year, 'year'))
          .select(bands)
          )
    print(fout)
    print(ic.size().getInfo())

    ds = xarray.open_dataset(ic, engine='ee',
        projection=ic.first().select(0).projection(),
        geometry=region)
    if save:
        ds.to_netcdf(fout)
    ds


def ee_col_download_years(region, col_id='ECMWF/ERA5_LAND/HOURLY',
                          year_beg=2022, year_end=2022, save=False, prefix=""):

    for year in range(year_beg, year_end + 1):
        try:
            ee_col_download_year(region, col_id, year, save, prefix)
        except Exception as e:
            print(str(e))


def parse_args():
    parser = argparse.ArgumentParser(
        description='Download ERA5-Land data for specific years')
    parser.add_argument('--year_beg', type=int, default=2012,
                        help='Beginning year for download (default: 2012)')
    parser.add_argument('--year_end', type=int, default=-1,
                        help='End year for download (default: 2012)')
    parser.add_argument('--prefix', type=str, default="HuBei_ERA5L_",
                        help='Prefix for output files (default: HuBei_ERA5L_)')
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    if args.year_end == -1:
        args.year_end = args.year_beg

    # Initialize Earth Engine
    ee.Initialize(opt_url='https://earthengine-highvolume.googleapis.com')

    # Define region
    # region = ee.Geometry.Rectangle(28.75, 108.5, 33.5, 116.25)
    # region = ee.Geometry.Rectangle(108.45, 28.75, 116.25, 33.55)
    # range = c(113.5, 115, 29.75, 31.5)
    # region = ee.Geometry.Rectangle(113.5, 29.75, 115, 31.5)
    # 108.52083  28.99917 116.06833  33.24833
    region = ee.Geometry.Rectangle(108.45, 28.75, 116.25, 33.55) # 湖北
    region = ee.Geometry.Rectangle(108, 24, 115, 31) # 湖南
    prefix = "Hunan_ERA5L_"

    # Download data using command line arguments
    ee_col_download_years(region,
                          year_beg=args.year_beg,
                          year_end=args.year_end,
                          save=True,
                          prefix=args.prefix)

# python xee_down_EAR5L.py --year_beg 2010 --year_end 2015 --prefix "HuBei_ERA5L_"
# python xee_down_EAR5L.py --year_beg 2017 --year_end 2024 --prefix "HuNan_ERA5L_"

# ee_col_download_year(region, year=2000, save=True)
# ee_col_download_years(region, year_beg=2012,
#                       year_end=2012, save=True, prefix=prefix)
