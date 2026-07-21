# examples

需 GEE 凭证：`~/.config/earthengine/credentials` 或 `.private-key.json`。

```bash
./examples/RunALL.sh          # 全量（含本地下载）
DRY_RUN=1 ./examples/RunALL.sh  # export 仅计划
```

## Code Editor 风格（`ee run`）

```bash
# 单脚本
node bin/ee run examples/hello.js
node bin/ee run examples/smap-mean.js
node bin/ee run examples/modis-ndvi.js

# require：内置 / 相对路径 / packages 包
node bin/ee run examples/with-require.js
node bin/ee run examples/require-pkg.js
node bin/ee run examples/require-smap.js

# 多脚本：只鉴权一次
node bin/ee run \
  examples/hello.js \
  examples/with-require.js \
  examples/require-pkg.js \
  examples/require-smap.js \
  examples/smap-mean.js \
  examples/modis-ndvi.js
```

`run` 注入 `require` / `module` / `__filename` / `__dirname`。

**GEE JS 包**（默认 `./packages`；路径**须带 `.js`**）：

```js
require('region.js')
require('hydro/mask.js')
require('users/kongdd/utils:math.js')  // → packages/users/kongdd/utils/math.js
```

```bash
ee add user/pkg                  # git clone googlesource → packages/users/...
ee config set packages ./packages
ee config get packages
```

| 文件 | 说明 |
|------|------|
| `hello.js` | 最小 print / ee |
| `with-require.js` | Node 内置 + `require('region')` |
| `require-pkg.js` | 裸名 / 嵌套 / users:mod |
| `require-smap.js` | 包 + 真实 SMAP 查询 |
| `smap-mean.js` / `modis-ndvi.js` | 纯 Code Editor 风格 |

## 库 API 本地下载

```bash
DRY_RUN=1 node examples/export.js   # 只打印计划
node examples/export.js             # 下载 1 天 SMAP GeoTIFF
```

## CLI 导出

```bash
# dry-run（湖北范围；过小区域在 scale=9000 时 GeoTIFF 可能 <1KB 被拒）
node bin/ee submit --dry-run --destination local \
  --collection NASA/SMAP/SPL4SMGP/008 --band sm_surface --scale 9000 \
  --temporal daily_mean --bounds 108.5,29.0,116.2,33.3 \
  --start 2024-07-01 --end 2024-07-01 \
  --outdir ./cache/examples/smap

# 真下载 + 自定义 buildFrame
node bin/ee submit --destination local \
  --collection NASA/SMAP/SPL4SMGP/008 --band sm_surface --scale 9000 \
  --temporal daily_mean --bounds 108.5,29.0,116.2,33.3 \
  --start 2024-07-01 --end 2024-07-01 \
  --outdir ./cache/examples/smap-custom \
  --user-script examples/build-frame.js
```
