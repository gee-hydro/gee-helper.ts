'use strict';
/** 示例嵌套包：require('hydro/mask') */
function waterMask(ee, image, threshold) {
  return image.gt(threshold == null ? 0.3 : threshold);
}
module.exports = { waterMask };
