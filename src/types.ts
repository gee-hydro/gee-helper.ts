/** 日聚合 / 原生帧 / 预报（导出主路径仅用前两者） */
export type GeeTemporal = 'daily_mean' | 'native' | 'forecast';

/** 日聚合算子：强度量 mean，速率量 sum×frameStep → 日累计 */
export type GeeDailyReduction = 'mean' | 'sum';
