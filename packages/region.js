/**
 * 本地公共模块：供 `ee run` 脚本 require。
 */
'use strict';

const WUHAN = { west: 114.2, south: 30.4, east: 114.6, north: 30.7 };
const HUBEI = { west: 108.5, south: 29.0, east: 116.2, north: 33.3 };

/** @param {typeof ee} ee @param {{west:number,south:number,east:number,north:number}} b */
function toRectangle(ee, b) {
  return ee.Geometry.Rectangle([b.west, b.south, b.east, b.north]);
}

module.exports = { WUHAN, HUBEI, toRectangle };
