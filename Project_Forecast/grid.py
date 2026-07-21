import shapely.geometry
import shapely.ops
from pyproj import Transformer
import math
import xee


def _region_box(region):
    """ee.Geometry → shapely box (lon/lat)。"""
    coords = region.bounds().coordinates().getInfo()[0]
    xs, ys = zip(*coords)
    return shapely.geometry.box(min(xs), min(ys), max(xs), max(ys))


def _native_grid(region, projection):
    """按原始仿射变换裁剪网格，不改变像元中心。"""
    sx, rx, x0, ry, sy, y0 = projection["transform"]
    if rx or ry or sx <= 0 or sy >= 0:
        raise ValueError("仅支持无旋转的北向原生网格")

    transformer = Transformer.from_crs(
        "EPSG:4326",
        projection["crs"],
        always_xy=True,
    )
    box = shapely.ops.transform(transformer.transform, _region_box(region))
    xmin, ymin, xmax, ymax = box.bounds

    col0 = math.floor((xmin - x0) / sx)
    col1 = math.ceil((xmax - x0) / sx)
    row0 = math.floor((ymax - y0) / sy)
    row1 = math.ceil((ymin - y0) / sy)

    # for ERA5L: [0.1, 0, -180.05, 0, -0.1, 90.05]
    # 消除仿射运算产生的 107.99999999999999 等浮点尾差。
    x_origin = round(x0 + col0 * sx, 12)
    y_origin = round(y0 + row0 * sy, 12)
    return {
        "crs": projection["crs"],
        "crs_transform": (sx, 0, x_origin, 0, sy, y_origin),
        "shape_2d": (col1 - col0, row1 - row0),
    }


def grid_params(region, scale=None, crs="EPSG:4326", ic=None):
    """xee open_dataset 网格参数。
    scale=None 时保留首景原生网格；显式 scale 时生成新网格。
    """
    projection = ic.first().select(0).projection().getInfo()
    if scale is None:
        if crs != projection["crs"]:
            raise ValueError("保留原生网格时，crs 必须与数据原始 CRS 相同")
        return _native_grid(region, projection)
    if isinstance(scale, (int, float)):
        s = abs(float(scale))
        scale = (s, -s)
    return xee.fit_geometry(
        _region_box(region),
        grid_crs=crs,
        grid_scale=scale,
    )
