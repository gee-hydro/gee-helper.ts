using Ipaper, NetCDFTools

fs = dir("OUTPUT", r"Hubei_ERA5L_2026-week")

f = "OUTPUT/ShiYan_GPM_v7_2017.nc"
f = "OUTPUT/backup/HuBei_ERA5L_ECMWF_ERA5_LAND_HOURLY_2014.nc"
f = "/mnt/z/GitHub/gee-hydro/gee-helper.ts/OUTPUT/Hubei_ERA5L_2026.nc"
f = "OUTPUT/Hubei_ERA5L_2026-week28_[2026070900,2026071523].nc"
# f = "OUTPUT/Hubei_ERA5L_2025.nc"

##
f = fs[3]
lon = nc_read(f, "x")
lat = nc_read(f, "y")

# st_bbox(f)
st_bbox(lon, lat)
# nc_date(f)        # 滞后6天
