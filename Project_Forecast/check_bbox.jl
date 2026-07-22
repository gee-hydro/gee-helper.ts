using Ipaper, NetCDFTools

function check_bbox(indir="OUTPUT/HuBei")
  fs = dir(indir)

  for f in fs
    lon = nc_read(f, "x")
    lat = nc_read(f, "y")
    b = st_bbox(lon, lat)
    println(basename(f) * ": ", b)
  end
end

## 
fs = dir("OUTPUT", r"Hubei_ERA5L_2026-week")
fs = dir("OUTPUT", r"Hubei_ERA5L_")

f = "OUTPUT/backup/HuBei_ERA5L_ECMWF_ERA5_LAND_HOURLY_2014.nc"
f = "Project_Forecast/OUTPUT/weekly/Hubei_ERA5L_2026-week26_[2026062500,2026070123].nc"
# f = "OUTPUT/Hubei_ERA5L_2026-week28_[2026070900,2026071523].nc"
# f = "OUTPUT/Hubei_ERA5L_2025.nc"

##
# f = fs[3]
fs = dir("OUTPUT/ShiYan")
f = fs[1]
# [109.4, 31.2, 111.6, 33.4]     # ShiYan
# [107.95, 28.95, 116.55, 33.55] # HuBei

check_bbox("OUTPUT/ShiYan")
check_bbox("OUTPUT/HuBei")
check_bbox("OUTPUT/weekly")

## 
indir = "/mnt/z/Hydrology/CAMELS-FlashFlood/data-raw/ERA5L-HuNan/"
fs = dir(indir, r"HuNan")
# st_bbox(fs[1])
f = fs[1]

lon = nc_read(f, "lon")
lat = nc_read(f, "lat")
b = st_bbox(lon, lat)
# check_bbox(indir)
