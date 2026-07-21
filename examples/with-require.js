/**
 * ee run + require：Node 内置 / 相对 JSON / 本地模块 / 包 dist。
 *
 *   node bin/ee run examples/with-require.js
 */
var path = require('node:path');
var fs = require('node:fs');
var pkg = require('../package.json');
var region = require('region.js');           // packages/region.js
var { ee: eeLib } = require('../dist');

print('__filename', path.basename(__filename));
print('__dirname ', path.basename(__dirname));
print('pkg       ', pkg.name, pkg.version);
print('readme?   ', fs.existsSync(path.join(__dirname, 'README.md')));

// 本地模块 + 全局 ee（Code Editor 风格）
var geom = region.toRectangle(ee, region.WUHAN);
print('wuhan rect', geom);

// 也可 require 包内 ee（与全局同一实例）
print('ee same   ', eeLib === ee);
