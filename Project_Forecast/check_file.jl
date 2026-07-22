using Ipaper, NetCDFTools

fs = dir("OUTPUT", r"Hubei_ERA5L_2026-week")
fs = dir("OUTPUT", r"Hubei_ERA5L_")

f = "OUTPUT/ShiYan_GPM_v7_2017.nc"
f = "OUTPUT/backup/HuBei_ERA5L_ECMWF_ERA5_LAND_HOURLY_2014.nc"
f = "/mnt/z/GitHub/gee-hydro/gee-helper.ts/OUTPUT/Hubei_ERA5L_2026.nc"
f = "Project_Forecast/OUTPUT/weekly/Hubei_ERA5L_2026-week26_[2026062500,2026070123].nc"
f = "OUTPUT/HuBei/Hubei_ERA5L_2026.nc"
# f = "OUTPUT/Hubei_ERA5L_2026-week28_[2026070900,2026071523].nc"
# f = "OUTPUT/Hubei_ERA5L_2025.nc"

##
# f = fs[3]
fs = dir("OUTPUT/ShiYan")
f = fs[1]
# [109.4, 31.2, 111.6, 33.4]

for f in fs
  println(basename(f) * ": ", st_bbox(f))
end

lon = nc_read(f, "x")
lat = nc_read(f, "y")
# st_bbox(lon, lat)
# nc_date(f)        # 滞后6天
