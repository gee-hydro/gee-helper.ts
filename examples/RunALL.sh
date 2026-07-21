#!/usr/bin/env bash
# 跑通全部 examples（GEE 鉴权一次）
set -euo pipefail
cd "$(dirname "$0")/.."

echo '==> build'
npm run build --silent

echo '==> ee run (single auth)'
node bin/ee run \
  examples/hello.js \
  examples/with-require.js \
  examples/require-pkg.js \
  examples/require-smap.js \
  examples/smap-mean.js \
  examples/modis-ndvi.js

echo '==> export.js'
if [[ "${DRY_RUN:-0}" == "1" ]]; then
  DRY_RUN=1 node examples/export.js
else
  node examples/export.js
fi

echo '==> submit dry-run + build-frame'
node bin/ee submit --dry-run --destination local \
  --collection NASA/SMAP/SPL4SMGP/008 --band sm_surface --scale 9000 \
  --temporal daily_mean --bounds 108.5,29.0,116.2,33.3 \
  --start 2024-07-01 --end 2024-07-01 \
  --outdir ./cache/examples/smap \
  --user-script examples/build-frame.js

echo '# all examples ok'
