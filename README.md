# @gee-hydro/gee-helper

GEE 鉴权、批量导出、Code Editor 风格 JS 本地运行。

## 安装

```bash
cd gee-helper.ts && npm install && npm run build
```

## CLI

```bash
# 导出到本地
npx gee-helper submit --destination local \
  --collection NASA/SMAP/SPL4SMGP/008 --band sm_surface --scale 9000 \
  --temporal daily_mean --bounds 114.2,30.4,114.6,30.7 \
  --start 2024-07-01 --end 2024-07-02 --outdir ./cache/gee-batches

# 导出到 Drive
npx gee-helper submit --destination drive --folder gee-exports \
  --collection ... --band ... --scale ... --temporal daily_mean \
  --bounds ... --start ... --end ...
npx gee-helper status --job job_<id>

# 本地运行 Code Editor 风格 JS
npx gee-helper run script.js
npx gee-helper run --repl
```

## 库

```ts
import {
  ensureReady, getInfo, ee,
  exportBatches, submitExportTasks,
  runScript, setupLocalHost,
} from '@gee-hydro/gee-helper';
```

凭证：`~/.config/earthengine/.private-key.json` 或 `earthengine authenticate`。
