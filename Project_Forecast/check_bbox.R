# %% 
pacman::p_load(
  Ipaper, data.table, dplyr, lubridate, 
  sf, sf2
)

# %% 
range = c(108.0, 115, 24.0, 31)
poly = st_rect(range)
write_sf(poly, "Project_Forecast/shp/poly_HuNan.shp")
