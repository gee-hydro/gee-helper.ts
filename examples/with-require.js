/**
 * gee-helper run 下使用 require（Node 内置 + 相对路径）。
 *
 *   node bin/gee-helper run examples/with-require.js
 */
var path = require('node:path');
var pkg = require('../package.json');

print('script', path.basename(__filename));
print('pkg', pkg.name, pkg.version);

var region = ee.Geometry.Point([114.3, 30.5]);
print('point', region);
