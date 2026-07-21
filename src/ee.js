'use strict';

/**
 * 单一 earthengine 实例，避免多包副本导致鉴权状态分裂。
 */
const eeNode = require('@google/earthengine');

const ee = eeNode;
if (globalThis.ee == null) globalThis.ee = eeNode;

exports.ee = ee;
