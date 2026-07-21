# AGENTS.md

## 项目定位

`@gee-hydro/gee-helper` 是独立 CommonJS 包，提供：

- GEE service-account / OAuth 鉴权
- 本地 GeoTIFF、Google Drive、GCS 批量导出
- Code Editor 风格 GEE JavaScript 本地运行
- `ee` 统一 CLI

## 常用命令

```bash
npm install
npm run build
npm run typecheck
npm test

node bin/ee help
node bin/ee run script.js
node bin/ee add user/pkg
node bin/ee submit --dry-run \
  --collection NASA/SMAP/SPL4SMGP/008 \
  --band sm_surface --scale 9000 --temporal daily_mean \
  --bounds 114.2,30.4,114.6,30.7 \
  --start 2024-07-01 --end 2024-07-02
```

## 代码组织

```
src/
  auth/     ee.js（唯一 EE 实例）+ auth.js（鉴权 / getInfo）
  export/   batches / tasks / frame-collection / bounds
  local/    local-host / gee-require / pkg-add / config
  cli/      index（入口）/ args / export / local
  index.ts  公共 API
```

- 禁止另行初始化 Earth Engine；统一 `src/auth/ee.js`
- CLI 构建后由 `node bin/ee` 直接运行（`dist/cli.js` 兼容 re-export）

## 修改原则

- TypeScript 严格类型；单引号、分号、2 空格、尾随逗号
- 保持 CommonJS，CLI 构建后必须可由 `node` 直接运行
- 禁止另行导入或初始化 Earth Engine；统一使用 `src/auth/ee.js`
- `auth/auth.js` 不记录 token、refresh token 或私钥内容
- 保持凭证优先级：private key → Earth Engine OAuth credentials
- 导出时间区间为闭区间；native 模式必须显式提供正 `stepHours`
- `local-host` 修改后须验证内置 `Map` 构造器兼容性及全局清理
- 不把 server 数据源注册表引入本包；CLI 使用 collection/band/scale/temporal
- 修改公共 API、CLI 参数或 job manifest 时同步更新 README 与测试

## 与 server 的边界

server 通过 `file:../gee-helper.ts` 引用本包，并保留 `--source` 数据源别名适配。不得反向依赖 `server/`，避免循环依赖。
