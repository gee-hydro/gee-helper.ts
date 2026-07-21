# GEE 可移植模型：FAO-56

FAO-56 的权威源码是 [`src/gee/models/fao56.js`](../src/gee/models/fao56.js)，同名 `.d.ts` 只约束 TypeScript 消费边界。Code Editor 直接使用这份 ES5 源码，不依赖构建产物。

## 三层结构

1. **portable JS 计算层**：`src/gee/gee-compute.js` 与 `src/gee/models/*.js` 只使用宿主全局 `ee`，构造 EE 计算图。
2. **Node 编排层（TS + Node-only JS）**：负责鉴权、HTTP、文件、CLI、下载和任务提交，并在加载 portable JS 前安装 `globalThis.ee`。鉴权、导出和本地宿主由 `../gee-helper.ts/` 提供，不能粘贴到 Code Editor。
3. **Code Editor 顶层脚本**：调用 portable 模型，负责 `Map`、`Export`、`Chart` 等交互。

## 编写纪律

- 严格使用 Code Editor 明确保证的 ES5 子集，不使用箭头函数、`const`/`let`、可选链或 ES6 内建。
- 不导入 npm 包或 Node 内置模块；不访问文件、进程、网络等 Node 能力。
- EE 数学使用 Code Editor 同样支持的 API，例如 `ee.Image.expression()`。
- 公共参数结构写入同名 `.d.ts`，避免 TS 消费面退化为无约束参数。
- 命名导出放在 `typeof exports !== 'undefined'` 守卫内，确保直接粘贴到 Code Editor 时不会因 `exports` 不存在而失败。

`npm run check:gee-js` 检查 `gee-compute.js` 与全部当前模型 JS；`build:model` 是兼容别名。主项目保留 `allowJs: true`，`npm run build` 生成供 Node 部署的 `dist/gee/` 构建产物；该产物不是源码的原样副本，也不用于 Code Editor。

## Node 导出

```js
// ee 由 --user-script 的 TS loader 注入。
const { era5DailyET0 } = require('../src/gee/models/fao56');

function buildFrame(p) {
  return era5DailyET0(p.start, p.end);
}

exports.buildFrame = buildFrame;
```

`buildFrame` 的 `start` 与 `end` 均为闭区间端点；`era5DailyET0()` 会包含末日，
并仅在调用 `filterDate()` 时将 `end` 推进一天以适配 GEE 的右开区间语义。

完整示例见 [`et0-pm-monthly.js`](./et0-pm-monthly.js)。

## GEE Code Editor

把 `src/gee/models/fao56.js` 作为 Code Editor 模块维护后：

```js
var pm = require('users/<you>/repo:fao56');
var et0Col = pm.era5DailyET0('2024-07-01', '2024-07-31');

Map.addLayer(et0Col.first(), {min: 0, max: 8}, 'ET0');
Export.image.toDrive({
  image: et0Col.first(),
  description: 'ET0_2024-07_Asia',
  scale: 11132,
  region: ee.Geometry.Rectangle([70, 15, 140, 55]),
  fileFormat: 'GeoTIFF',
});
```

新增模型时，在 `src/gee/models/<name>.js` 写权威计算源码，并配同名 `.d.ts`；不要恢复 TS→临时 JS 的双源码构建链。需要文件系统、网络或任务管理的逻辑应留在 Node 编排层。
