import math
import shapely.geometry
import shapely.ops
import xee
from pyproj import Transformer


def _snap_integer(value, atol=1e-9):
    """消除理论整数网格索引的浮点尾差。"""
    nearest = round(value)
    return nearest if abs(value - nearest) <= atol else value


def _native_grid(bbox, projection, digits=10):
    """按原始仿射变换裁剪网格，不改变像元中心。"""
    sx, rx, x0, ry, sy, y0 = projection["transform"]
    sx, sy = round(sx, digits), round(sy, digits)  # 兼容约 30 m 网格
    if rx or ry or sx <= 0 or sy >= 0:
        raise ValueError("仅支持无旋转的北向原生网格")

    transformer = Transformer.from_crs("EPSG:4326", projection["crs"], always_xy=True)
    box = shapely.ops.transform(transformer.transform, shapely.geometry.box(*bbox))
    xmin, ymin, xmax, ymax = box.bounds

    col0 = math.floor(_snap_integer((xmin - x0) / sx))
    col1 = math.ceil(_snap_integer((xmax - x0) / sx))
    row0 = math.floor(_snap_integer((ymax - y0) / sy))
    row1 = math.ceil(_snap_integer((ymin - y0) / sy))

    crs_transform = (
        sx,
        0,
        round(x0 + col0 * sx, digits),
        0,
        sy,
        round(y0 + row0 * sy, digits),
    )
    return {
        "crs": projection["crs"],
        "crs_transform": crs_transform,
        "shape_2d": (col1 - col0, row1 - row0),
    }


def grid_params(bbox, scale=None, crs="EPSG:4326", ic=None):
    """xee open_dataset 网格参数；默认保持首景原生网格。"""
    projection = ic.first().select(0).projection().getInfo()
    if scale is None:
        if crs != projection["crs"]:
            raise ValueError("保留原生网格时，crs 必须与数据原始 CRS 相同")
        return _native_grid(bbox, projection)

    if isinstance(scale, (int, float)):
        s = abs(float(scale))
        scale = (s, -s)
    return xee.fit_geometry(
        shapely.geometry.box(*bbox),
        grid_crs=crs,
        grid_scale=scale,
    )


def get_scale(col):
    """获取 ImageCollection 的原始像元大小。"""
    projection = col.first().select(0).projection().getInfo()
    sx, rx, _, ry, sy, _ = projection["transform"]
    sx, sy = round(sx, 12), round(sy, 12)
    if rx or ry or sx <= 0 or sy >= 0:
        raise ValueError("仅支持无旋转的北向原生网格")
    return (sx, -sy)
