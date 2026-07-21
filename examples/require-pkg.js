/**
 * GEE 包 require 须带 .js 后缀（Code Editor 语法）。
 *
 *   node bin/ee run examples/require-pkg.js
 */
var region = require('region.js');
var mask = require('hydro/mask.js');
var math = require('users/kongdd/utils:math.js');

var geom = region.toRectangle(ee, region.WUHAN);
var n = math.add(ee, 40, 2);
print('pkg region', geom);
print('pkg math  ', n);
print('pkg mask  ', typeof mask.waterMask);
