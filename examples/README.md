# examples

需 GEE 凭证：`~/.config/earthengine/credentials` 或 `.private-key.json`。

## Code Editor 风格（`gee-helper run`）

```bash
# 单脚本
node bin/gee-helper run examples/hello.js

# 多脚本：只鉴权一次
node bin/gee-helper run \
  examples/hello.js \
  examples/with-require.js \
  examples/smap-mean.js \
  examples/modis-ndvi.js

# shell 展开
node bin/gee-helper run examples/{hello,with-require,smap-mean,modis-ndvi}.js
```

`run` 注入 `require` / `module` / `__filename` / `__dirname`（相对路径按脚本目录解析）。

## 库 API 本地下载

```bash
DRY_RUN=1 node examples/export.js   # 只打印计划
node examples/export.js             # 下载 1 天 SMAP GeoTIFF
```

## CLI 导出

```bash
# dry-run（湖北范围；过小区域在 scale=9000 时 GeoTIFF 可能 <1KB 被拒）
node bin/gee-helper submit --dry-run --destination local \
  --collection NASA/SMAP/SPL4SMGP/008 --band sm_surface --scale 9000 \
  --temporal daily_mean --bounds 108.5,29.0,116.2,33.3 \
  --start 2024-07-01 --end 2024-07-01 \
  --outdir ./cache/examples/smap

# 真下载 + 自定义 buildFrame
node bin/gee-helper submit --destination local \
  --collection NASA/SMAP/SPL4SMGP/008 --band sm_surface --scale 9000 \
  --temporal daily_mean --bounds 108.5,29.0,116.2,33.3 \
  --start 2024-07-01 --end 2024-07-01 \
  --outdir ./cache/examples/smap-custom \
  --user-script examples/build-frame.js
```
