using NetCDFTools, DataFrames
f = "OUTPUT/Forecast/ECMWF_NRT/Hubei_ECMWF_NRT_20260701_fc4.nc"
f = "OUTPUT/ForecastPast/ECMWF_NRT/Hubei_ECMWF_NRT_202412_fc62.nc"

# nc_info(f)
nc = nc_open(f)
date = nc_date(f)
date_forecast = nc["date_forecast"][:]
date_valid = nc["date_valid"][:]
lead = nc["lead"][:]
info = DataFrame(; date, date_forecast, date_valid, lead)

##
lon = nc["x"][:]
lat = nc["y"][:]
st_bbox(lon, lat)
