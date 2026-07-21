<h1>@gee-hydro/gee-helper</h1>

[![CI](https://github.com/gee-hydro/gee-helper.ts/actions/workflows/CI.yml/badge.svg)](https://github.com/gee-hydro/gee-helper.ts/actions/workflows/CI.yml)
[![Codecov](https://codecov.io/gh/gee-hydro/gee-helper.ts/branch/main/graph/badge.svg)](https://app.codecov.io/gh/gee-hydro/gee-helper.ts/tree/main)

GEE 鉴权、批量导出、Code Editor 风格 JS 本地运行。

## 1 安装

```bash
npm install && npm run build
```

## 2 测试

```bash
npm test
npm run test:coverage   # text + coverage/lcov.info + HTML
```

## 3 示例

见 [`examples/`](examples/README.md)。

```bash
node bin/ee run examples/hello.js
node bin/ee run examples/with-require.js examples/require-smap.js  # require + 多脚本只鉴权一次
node examples/export.js   # 库 API 本地下载
```

## 4 CLI

```bash
# 导出到本地
npx ee submit --destination local \
  --collection NASA/SMAP/SPL4SMGP/008 --band sm_surface --scale 9000 \
  --temporal daily_mean --bounds 108.5,29.0,116.2,33.3 \
  --start 2024-07-01 --end 2024-07-02 --outdir ./cache/gee-batches

# 导出到 Drive
npx ee submit --destination drive --folder gee-exports \
  --collection ... --band ... --scale ... --temporal daily_mean \
  --bounds ... --start ... --end ...
npx ee status --job job_<id>

# 本地运行 Code Editor 风格 JS（可多脚本；支持 require）
npx ee run script.js [more.js ...]
npx ee run --repl
```

## 5 库

```ts
import {
  ensureReady, getInfo, ee,
  exportBatches, submitExportTasks,
  runScript, setupLocalHost,
} from '@gee-hydro/gee-helper';
```

凭证：`~/.config/earthengine/.private-key.json` 或 `earthengine authenticate`。
