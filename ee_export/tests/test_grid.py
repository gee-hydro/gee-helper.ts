import unittest

from ee_export.grid import _native_grid


# GPM/GSMaP：像元边界位于 0.1° 整数倍，像元中心以 0.05° 结尾。
GPM_PROJECTION = {
    "crs": "EPSG:4326",
    "transform": [0.1, 0, -180, 0, -0.1, 90],
}

# ERA5-Land：像元边界偏移 0.05°，像元中心位于 0.1° 整数倍。
ERA5L_PROJECTION = {
    "crs": "EPSG:4326",
    "transform": [0.1, 0, -180.05, 0, -0.1, 90.05],
}
BBOX = [109.4, 31.2, 111.6, 33.4]


class NativeGridTest(unittest.TestCase):
    def test_gpm_aligned_bbox_is_not_expanded_by_float_error(self):
        grid = _native_grid(BBOX, GPM_PROJECTION)

        self.assertEqual(grid["crs_transform"], (0.1, 0, 109.4, 0, -0.1, 33.4))
        self.assertEqual(grid["shape_2d"], (22, 22))

        sx, _, xmin, _, sy, ymax = grid["crs_transform"]
        nx, ny = grid["shape_2d"]
        output_bbox = [xmin, ymax + ny * sy, xmin + nx * sx, ymax]
        self.assertEqual([round(x, 10) for x in output_bbox], BBOX)

    def test_era5l_preserves_native_pixel_centers(self):
        grid = _native_grid(BBOX, ERA5L_PROJECTION)

        self.assertEqual(grid["crs_transform"], (0.1, 0, 109.35, 0, -0.1, 33.45))
        self.assertEqual(grid["shape_2d"], (23, 23))


if __name__ == "__main__":
    unittest.main()
