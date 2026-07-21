/**
 * GEE 数据源注册表（类型 + 集合/波段/默认 vis）
 * portable 算法见 ./gee-compute.js · Node 门面见 ./gee-core.ts · 鉴权见 ./ee-init.js
 *
 * 同一 collection 可注册 1D + 1H 两套入口：
 * - daily_mean：UTC 日历日聚合；按 source.dailyReduction 选 mean / sum×frameStepHours
 * - native：按 timeStepHours 取原生帧（GSMaP 1h / IMERG 0.5h）
 */

export interface GeeBandDef {
  id: string;
  name: string;
  unit: string;
  displayUnit?: string;
  displayScale?: number;
}

export interface GeeVis {
  min: number;
  max: number;
  palette: readonly string[] | string[];
}

/** 时间合成策略
 * - daily_mean：UTC 日历日聚合（默认 mean，sum 由 dailyReduction 切换）
 * - native：按 timeStepHours 取原生帧
 * - forecast：集合预报（init_time × lead_hour × ensemble_member）
 */
export type GeeTemporal = 'daily_mean' | 'native' | 'forecast';

/** 日聚合算子
 * - mean：对强度量（m³/m³、K 等）取日平均
 * - sum：对 mm/h 速率取日合计 Σrate × frameStepHours 转为 mm/d
 *   （GSMaP 1h × 1h、IMERG 0.5h × 0.5h；与帧时长一致）
 *
 * 仅对 temporal='daily_mean' 的源生效。单位语义由 band.displayUnit /
 * source.vis 反映；这里只决定 reducer。
 */
export type GeeDailyReduction = 'mean' | 'sum';

/**
 * 稳定 source id：
 * - smap：日尺度
 * - gsmap / imerg：日合计（兼容旧 id，原 1D=日均已改为 sum）
 * - gsmap_1h / imerg_1h：原生小时/半小时帧
 * - weathernext2：WeatherNext 2 集合预报
 */
export type GeeSourceId = 'smap' | 'gsmap' | 'gsmap_1h' | 'imerg' | 'imerg_1h' | 'weathernext2' | 'weathernext2_mean' | 'ecmwf_nrt' | 'gfs' | 'cfsr' | 'cfsv2';

export interface GeeSourceDef {
  id: GeeSourceId;
  collection: string;
  name: string;
  bands: GeeBandDef[];
  scale: number;
  vis: GeeVis;
  maxWindowDays: number;
  /** 播放/时间轴粒度（h）；daily_mean 源通常为 24、native 源等于数据帧间隔 */
  timeStepHours: number;
  /** 原数据帧时间步（h），仅 dailySum 积分时使用；缺省回退到 timeStepHours。
   *  与 timeStepHours 不同例：GSMaP 1D 源 timeStepHours=24（播放）、
   *  但底集实为逐小时、同名 band 的 1h 帧；IMERG 同（24 vs 0.5）。 */
  frameStepHours?: number;
  defaultWindowSteps?: number;
  /** 缺省 daily_mean；native 表示不按日聚合；forecast 表示集合预报 */
  temporal?: GeeTemporal;
  /** 日聚合算子（仅 daily_mean 源生效）；缺省 mean。
   *  强度量 (m³/m³) → mean；mm/h 速率类带源 → sum（注册表已显式设置）。 */
  dailyReduction?: GeeDailyReduction;
  /** forecast 专用：init_time / lead_hour / ensemble_member 在 ee 中的 property 名。
   *  特殊值 'derived'：GEE 集合里没有显式的 init_time 属性（如 CFSR/CFSV2 只有
   *  system:time_start），由 compute 层对 system:time_start 做 Filter.eq。
   *  特殊值 'derived' 适用于帧所有 fh 帧共享同一 system:time_start 的集合。 */
  initTimeField?: string | 'derived';
  /** forecast 专用：lead 时效属性名。
   *  特殊值 '__none__'：该集合每个 init cycle 只有 1 帧（如 CFSV2 每 6h 累计帧），
   *  无需 lead 过滤；frame.leadHour 任意值都成立。 */
  leadTimeField?: string | '__none__';
  /** @deprecated 旧名，同义 leadTimeField，保留以兼容下游可能引用。 */
  leadHourField?: string | '__none__';
  /** forecast 专用：集合成员属性名。
   *  特殊值 '__none__'：表示该集合无集合成员字段（如 GFS / CFSV2 / WN2_mean），
   *  compute 层跳过 ensemble 过滤。仅传 frame.ensemble 也总是成立。 */
  ensembleField?: string | '__none__';
  /** forecast 专用：UI 可选的 init_time 属性名候选；缺省 = [initTimeField]
   *  当数据集属性名频繁变动 / 多版本时，用此暴露给用户切换 */
  initTimeFieldCandidates?: readonly string[];
  leadTimeFieldCandidates?: readonly string[];
  ensembleFieldCandidates?: readonly string[];
  /** forecast 专用：可选 lead hours（小时）；缺省 0..360 步长 6。
   *  默认加载窗由 defaultWindowSteps ∩ maxWindowDays*24 裁剪（见 windowLeadTimes）。 */
  leadTimes?: readonly number[];
  /** forecast 专用：可选 ensemble member 列表（字符串） */
  ensembleMembers?: readonly string[];
  /** forecast 专用：默认 ensemble member；缺省 ensembleMembers[0] */
  defaultEnsemble?: string;
  /** forecast 专用：meta 暴露的最近 init 时间天数；缺省 7 */
  recentInitDays?: number;
  /** forecast 专用：档案起点（GEE 集合过大，不全表 sort；起点可固定） */
  forecastStart?: string;
  /**
   * forecast 专用：相对「当前 UTC」再回退几个 timeStep 作为最新起报。
   * 缺省 1（避开尚未入库的当前槽）；0 = 对齐到最近已过槽。
   * 不再写死 forecastEnd——实时产品用 latestForecastInitIso()。
   */
  forecastEndLagSteps?: number;
}

/** 最新可用起报：floor((now - lag*step) / step) * step，UTC */
export function latestForecastInitIso(
  source: Pick<GeeSourceDef, 'timeStepHours' | 'forecastEndLagSteps'>,
  nowMs = Date.now(),
): string {
  const stepH = source.timeStepHours > 0 ? source.timeStepHours : 6;
  const stepMs = stepH * 3600e3;
  const lagSteps = source.forecastEndLagSteps ?? 1;
  const lagMs = Math.max(0, lagSteps) * stepMs;
  const aligned = Math.floor((nowMs - lagMs) / stepMs) * stepMs;
  return new Date(aligned).toISOString().replace('.000Z', 'Z');
}

const SMAP_PALETTE = [
  '#a50026', '#d73027', '#f46d43', '#fdae61', '#fee090',
  '#e0f3f8', '#abd9e9', '#74add1', '#4575b4', '#313695',
] as const;

const GSMAP_PALETTE = [
  '#1621a2', '#ffffff', '#03ffff', '#13ff03', '#efff00', '#ffb103', '#ff2300',
] as const;

const IMERG_PALETTE = [
  '#000096', '#0064ff', '#00b4ff', '#33db80', '#9beb4a',
  '#ffeb00', '#ffb300', '#ff6400', '#eb1e00', '#af0000',
] as const;

// WeatherNext 2 调色板：温度（蓝→红）/ 降水（白→紫）/ 风速（蓝→灰→红）/ 气压（紫→橙）
const WN_TEMP_PALETTE = [
  '#1a237e', '#3461b8', '#3aa3c2', '#5cc2a0', '#9fd472',
  '#dfd189', '#e9a45d', '#d65a3a', '#8e2424', '#3b0c1d',
] as const;
const WN_WIND_PALETTE = WN_TEMP_PALETTE;
const WN_GEOPOT_PALETTE = [
  '#3b1d70', '#3e63a8', '#3a99c0', '#5cc2a0', '#9fd472',
  '#dfd189', '#e9a45d', '#d65a3a', '#8e2424', '#3b0c1d',
] as const;

// 单位约定：unit / displayUnit = 对外数值语义（瓦片 stretch、时序、图例）；
// displayScale 在 gee-core frame/series 中把 GEE 原生量 × scale 成上述单位（缺省 1）。
// 例：WeatherNext 降水 GEE 原生 m → ×1000 → mm。
// GSMaP/IMERG 日源：dailyReduction=sum → 数值已是 mm/d；小时源仍是 mm/h 速率。
const GSMAP_BANDS_1D: GeeBandDef[] = [{
  id: 'hourlyPrecipRateGC',
  name: 'hourlyPrecipRateGC (gauge-cal)',
  unit: 'mm/d',
  displayUnit: 'mm/d',
}];
const GSMAP_BANDS_1H: GeeBandDef[] = [{
  id: 'hourlyPrecipRateGC',
  name: 'hourlyPrecipRateGC (gauge-cal)',
  unit: 'mm/h',
  displayUnit: 'mm/h',
}];

const IMERG_BANDS_1D: GeeBandDef[] = [{
  id: 'precipitation',
  name: 'precipitation (calibrated)',
  unit: 'mm/d',
  displayUnit: 'mm/d',
}];
const IMERG_BANDS_05H: GeeBandDef[] = [{
  id: 'precipitation',
  name: 'precipitation (calibrated)',
  unit: 'mm/h',
  displayUnit: 'mm/h',
}];

// WeatherNext 2 仅暴露两个核心变量：6h 累计降水 + 10m 风 U/V 分量
// 完整波段见 GEE catalog；这里只保留与现有 Open-Meteo 降水/风场对齐的量
// 降水：GEE 原生 m，displayScale=1000 → 对外统一 mm（/6h）
const WN_BANDS: GeeBandDef[] = [
  {
    id: 'total_precipitation_6hr',
    name: '6h 累计降水',
    unit: 'mm',
    displayUnit: 'mm',
    displayScale: 1000,
  },
  { id: '10m_u_component_of_wind', name: '10m U 风', unit: 'm/s', displayUnit: 'm/s' },
  { id: '10m_v_component_of_wind', name: '10m V 风', unit: 'm/s', displayUnit: 'm/s' },
];

// ECMWF NRT IFS：用户只要求 3 个量
// 降水：GEE 原生 m，displayScale=1000 → 对外统一 mm
// （注：total_precipitation_sfc 是 init 起累计量；如需单步降水，需取相邻 lead 之差，
//   此处保留原生累计语义，由前端按需展示或自行求差）
// 风：m/s，无量纲换算
const ECMWF_BANDS: GeeBandDef[] = [
  {
    id: 'total_precipitation_sfc',
    name: '总降水（init 起累计）',
    unit: 'mm',
    displayUnit: 'mm',
    displayScale: 1000,
  },
  { id: 'u_component_of_wind_10m_sfc', name: '10m U 风', unit: 'm/s', displayUnit: 'm/s' },
  { id: 'v_component_of_wind_10m_sfc', name: '10m V 风', unit: 'm/s', displayUnit: 'm/s' },
];

// GFS 0.25°：与 ECMWF 同结构（init+lead），但单位 kg/m² = mm（1:1）。
// total_precipitation_surface 是「前 1–6h 累计降水」，表头公式 ((F-1)%6)+1
// 决定本帧累计窗口长度；本项目按 init 起累计量呈现，UI 可自行取差分取单步。
const GFS_BANDS: GeeBandDef[] = [
  {
    id: 'total_precipitation_surface',
    name: '总降水（前 1–6h 累计）',
    unit: 'mm',
    displayUnit: 'mm',
  },
  { id: 'u_component_of_wind_10m_above_ground', name: '10m U 风', unit: 'm/s', displayUnit: 'm/s' },
  { id: 'v_component_of_wind_10m_above_ground', name: '10m V 风', unit: 'm/s', displayUnit: 'm/s' },
];

// CFSR：只有 03h 累计降水（kg/m² = mm，1:1）；风为混合层（≈10m）。
// initTimeField='derived'：GEE 只存 system:time_start=valid_time，由 compute 推导。
const CFSR_BANDS: GeeBandDef[] = [
  {
    id: 'Total_precipitation_surface_3_Hour_Accumulation',
    name: '3h 累计降水（仅 lead=3）',
    unit: 'mm',
    displayUnit: 'mm',
  },
  { id: 'u-component_of_wind_hybrid', name: 'U 风（混合层 ≈10m）', unit: 'm/s', displayUnit: 'm/s' },
  { id: 'v-component_of_wind_hybrid', name: 'V 风（混合层 ≈10m）', unit: 'm/s', displayUnit: 'm/s' },
];

// CFSV2：6h 平均降水率 kg/m²/s × 21600s = mm/6h（displayScale=21600）；风同上。
const CFSV2_BANDS: GeeBandDef[] = [
  {
    id: 'Precipitation_rate_surface_6_Hour_Average',
    name: '6h 平均降水率 → mm/6h',
    unit: 'mm/6h',
    displayUnit: 'mm/6h',
    displayScale: 21600,
  },
  { id: 'u-component_of_wind_height_above_ground', name: '10m U 风', unit: 'm/s', displayUnit: 'm/s' },
  { id: 'v-component_of_wind_height_above_ground', name: '10m V 风', unit: 'm/s', displayUnit: 'm/s' },
];

/** forecast lead hours：0..360h 步长 6（与 GEE catalog 一致） */
const WN_LEAD_TIMES: readonly number[] = (() => {
  const out: number[] = [];
  for (let h = 0; h <= 360; h += 6) out.push(h);
  return Object.freeze(out);
})();

/** ECMWF NRT IFS 预报 lead hours：0..360h 步长 3（catalog 实测 3h 步长）。
 *  total_precipitation_sfc 是「自 init 起的累计降水」，需在 UI 层取相邻 lead 之差
 *  作为单步降水量。 */
const ECMWF_LEAD_TIMES: readonly number[] = (() => {
  const out: number[] = [];
  for (let h = 0; h <= 360; h += 3) out.push(h);
  return Object.freeze(out);
})();

/** GFS lead hours：0..120h 步长 1，123..384h 步长 3（与 catalog 一致）。
 *  2017-07-09 前的 36h 预测不包含 fh=0；此处取全量后 UI 端可按需裁剪。 */
const GFS_LEAD_TIMES: readonly number[] = (() => {
  const out: number[] = [];
  for (let h = 0; h <= 120; h += 1) out.push(h);
  for (let h = 123; h <= 384; h += 3) out.push(h);
  return Object.freeze(out);
})();

/** CFSR lead hours：catalog 只保留 00h / 03h 两档预报。 */
const CFSR_LEAD_TIMES: readonly number[] = Object.freeze([0, 3]);

/** CFSV2 lead hours：catalog 保留 00/06/12/18h 四档（每 6h 一帧，预报窗口 0–18h）。 */
const CFSV2_LEAD_TIMES: readonly number[] = Object.freeze([0, 6, 12, 18]);

/** 风速 U/V 调色板：发散蓝→白→红，适合有符号 m/s 量。 */
const ECMWF_WIND_PALETTE = [
  '#313695', '#4575b4', '#74add1', '#abd9e9', '#ffffff',
  '#fdae61', '#f46d43', '#d73027', '#a50026',
] as const;
/** 64 个集合成员 */
const WN_ENSEMBLE_MEMBERS: readonly string[] = (() => {
  const out: string[] = [];
  for (let i = 1; i <= 64; i++) out.push(String(i));
  return Object.freeze(out);
})();

export const GEE_SOURCES: readonly GeeSourceDef[] = [
  {
    id: 'smap',
    collection: 'NASA/SMAP/SPL4SMGP/008',
    name: 'SMAP L4 (SPL4SMGP.008)',
    scale: 11000,
    maxWindowDays: 14,
    timeStepHours: 24,
    defaultWindowSteps: 14,
    temporal: 'daily_mean',
    dailyReduction: 'mean',
    vis: { min: 0.05, max: 0.5, palette: SMAP_PALETTE },
    bands: [
      { id: 'sm_surface', name: 'sm_surface (0–5 cm)', unit: 'm³/m³', displayUnit: 'm³/m³' },
      { id: 'sm_rootzone', name: 'sm_rootzone (0–100 cm)', unit: 'm³/m³', displayUnit: 'm³/m³' },
      { id: 'sm_profile', name: 'sm_profile', unit: 'm³/m³', displayUnit: 'm³/m³' },
    ],
  },
  {
    id: 'gsmap',
    collection: 'JAXA/GPM_L3/GSMaP/v8/operational',
    name: 'GSMaP v8 · 1D',
    scale: 11132,
    maxWindowDays: 14,
    timeStepHours: 24,
    frameStepHours: 1,        // 底层是逐小时；积分到 mm/d
    defaultWindowSteps: 14,
    temporal: 'daily_mean',
    dailyReduction: 'sum',    // mm/h 速率 × 1h × 24 → 日合计 mm/d
    vis: { min: 0, max: 50, palette: GSMAP_PALETTE },
    bands: GSMAP_BANDS_1D,
  },
  {
    id: 'gsmap_1h',
    collection: 'JAXA/GPM_L3/GSMaP/v8/operational',
    name: 'GSMaP v8 · 1H',
    scale: 11132,
    maxWindowDays: 3,
    timeStepHours: 1,
    defaultWindowSteps: 24,
    temporal: 'native',
    vis: { min: 0, max: 10, palette: GSMAP_PALETTE },
    bands: GSMAP_BANDS_1H,
  },
  {
    id: 'imerg',
    collection: 'NASA/GPM_L3/IMERG_V07',
    name: 'GPM IMERG V07 · 1D',
    scale: 11132,
    maxWindowDays: 14,
    timeStepHours: 24,
    frameStepHours: 0.5,      // 底层逐 0.5h；积分到 mm/d
    defaultWindowSteps: 14,
    temporal: 'daily_mean',
    dailyReduction: 'sum',    // mm/h 速率 × 0.5h × 48 → 日合计 mm/d
    vis: { min: 0, max: 50, palette: IMERG_PALETTE },
    bands: IMERG_BANDS_1D,
  },
  {
    id: 'imerg_1h',
    collection: 'NASA/GPM_L3/IMERG_V07',
    name: 'GPM IMERG V07 · 0.5H',
    scale: 11132,
    maxWindowDays: 3,
    timeStepHours: 0.5,
    defaultWindowSteps: 48,
    temporal: 'native',
    vis: { min: 0, max: 15, palette: IMERG_PALETTE },
    bands: IMERG_BANDS_05H,
  },
  // WeatherNext 2：Google DeepMind 集合预报
  // https://developers.google.com/earth-engine/datasets/catalog/projects_gcp-public-data-weathernext_assets_weathernext_2_0_0
  // init 00/06/12/18z；lead 0..360h 步长 6；64 成员；0.25° (~27.8 km) 网格
  {
    id: 'weathernext2',
    collection: 'projects/gcp-public-data-weathernext/assets/weathernext_2_0_0',
    name: 'WeatherNext 2 · GDM',
    scale: 27830,
    // 默认色标按 mm：0–50 mm / 6h（= 原生 0–0.05 m）
    vis: { min: 0, max: 50, palette: WN_WIND_PALETTE },
    bands: WN_BANDS,
    maxWindowDays: 7,
    timeStepHours: 6,
    // 默认只加载 24*7h：lead 0..168 @ 6h → 29 帧
    defaultWindowSteps: Math.round((24 * 7) / 6) + 1,
    temporal: 'forecast',
    initTimeField: 'start_time',
    initTimeFieldCandidates: ['start_time', 'date_forecast', 'init_time', 'time_beg'],
    leadTimeField: 'forecast_hour',
    leadTimeFieldCandidates: ['forecast_hour', 'lead_hour', 'lead_time'],
    ensembleField: 'ensemble_member',
    ensembleFieldCandidates: ['ensemble_member', 'number', 'member'],
    leadTimes: WN_LEAD_TIMES,
    ensembleMembers: WN_ENSEMBLE_MEMBERS,
    defaultEnsemble: '1',
    recentInitDays: 7,
    // 档案起点固定；最新起报由 latestForecastInitIso 按 UTC 动态推算（不写死 end）
    forecastStart: '2022-01-01T00:00:00Z',
    forecastEndLagSteps: 1,
  },
  // ECMWF Near-Realtime IFS 大气预报
  // https://developers.google.com/earth-engine/datasets/catalog/ECMWF_NRT_FORECAST_IFS_OPER
  // 确定性预报（无集合成员）；起报每天 00/12z；lead 0..360h 步长 3；0.25° (~28 km) 网格
  // 关键属性：creation_time（毫秒）、forecast_hours（相对 init 的偏移小时）、
  //           forecast_time（valid 毫秒）、model（'ifs'|'aifs'）、stream（'oper'|'enfo'…）
  {
    id: 'ecmwf_nrt',
    collection: 'ECMWF/NRT_FORECAST/IFS/OPER',
    name: 'ECMWF NRT IFS · OPER',
    scale: 27830,
    // 风 U/V 有符号 m/s 默认 [-30, 30]；发散蓝→红
    vis: { min: -30, max: 30, palette: ECMWF_WIND_PALETTE },
    bands: ECMWF_BANDS,
    maxWindowDays: 10,
    timeStepHours: 3,
    // 默认只加载 10d = 240h / 3h = 81 帧（含 lead=0）
    defaultWindowSteps: Math.round((24 * 10) / 3) + 1,
    temporal: 'forecast',
    initTimeField: 'creation_time',
    initTimeFieldCandidates: ['creation_time', 'start_time', 'init_time', 'time_beg'],
    leadTimeField: 'forecast_hours',
    leadTimeFieldCandidates: ['forecast_hours', 'forecast_hour', 'lead_hour', 'lead_time'],
    // 集合字段用 stream 占位（oper/enfo…）；确定性预报通常仅 'oper' 单值
    ensembleField: 'model',
    ensembleFieldCandidates: ['model', 'stream', 'ensemble_member', 'number'],
    leadTimes: ECMWF_LEAD_TIMES,
    // 单集合占位（确定性 IFS）；不改 UI 默认成员选择，仅用于过滤
    ensembleMembers: ['ifs'],
    defaultEnsemble: 'ifs',
    recentInitDays: 7,
    forecastStart: '2024-11-12T12:00:00Z',
    forecastEndLagSteps: 1,
  },
  // GFS 0.25° Global Forecast System 384h
  // https://developers.google.com/earth-engine/datasets/catalog/NOAA_GFS0P25
  // 确定性预报；起报每天 00/06/12/18z；lead 0..120h @1h, 123..384h @3h；0.25° (~28 km) 网格
  // 关键属性：creation_time（DOUBLE 毫秒）、forecast_hours（DOUBLE 整数）、
  //           forecast_time（DOUBLE 毫秒）。
  {
    id: 'gfs',
    collection: 'NOAA/GFS0P25',
    name: 'GFS 0.25° · NOAA',
    scale: 27830,
    vis: { min: -30, max: 30, palette: ECMWF_WIND_PALETTE },
    bands: GFS_BANDS,
    maxWindowDays: 7,
    timeStepHours: 6,
    // 默认 7d × 4 init/天 = 28 init；leadTimes 默认全 0..120h @1h = 121 帧
    defaultWindowSteps: 121,
    temporal: 'forecast',
    initTimeField: 'creation_time',
    initTimeFieldCandidates: ['creation_time', 'start_time', 'init_time', 'time_beg'],
    leadTimeField: 'forecast_hours',
    leadTimeFieldCandidates: ['forecast_hours', 'forecast_hour', 'lead_hour', 'lead_time'],
    // GFS 无集合成员字段（确定性预报）；跳过 ensemble 过滤
    ensembleField: '__none__',
    ensembleFieldCandidates: ['ensemble_member', 'number', 'member'],
    leadTimes: GFS_LEAD_TIMES,
    ensembleMembers: ['gfs'],
    defaultEnsemble: 'gfs',
    recentInitDays: 7,
    forecastStart: '2015-07-01T00:00:00Z',
    forecastEndLagSteps: 1,
  },
  // CFSR（Climate Forecast System Reanalysis）2018-12 起运营实时段
  // https://developers.google.com/earth-engine/datasets/catalog/NOAA_CFSR
  // 起报每天 00/06/12/18z；只保留 00h 与 03h 两档预报（cdas1.t??z.pgrbh**03|00**.grib2）
  // GEE 中 system:time_start = init_time（同一 cycle 内 fh=0 与 fh=3 共享 init），使用 initTimeField='derived'。
  // 共有属性：forecast_hour（INT）；无 ensemble_member。
  {
    id: 'cfsr',
    collection: 'NOAA/CFSR',
    name: 'CFSR · NOAA NCEP',
    scale: 55660,
    vis: { min: -30, max: 30, palette: ECMWF_WIND_PALETTE },
    bands: CFSR_BANDS,
    maxWindowDays: 7,
    timeStepHours: 6,
    // 每个起报 2 帧（lead=0/3），7d × 4 init/天 × 2 帧 = 56 帧；显示窗 = 56
    defaultWindowSteps: CFSR_LEAD_TIMES.length,
    temporal: 'forecast',
    initTimeField: 'derived',
    initTimeFieldCandidates: ['derived', 'creation_time', 'start_time', 'init_time'],
    leadTimeField: 'forecast_hour',
    leadTimeFieldCandidates: ['forecast_hour', 'forecast_hours', 'lead_hour', 'lead_time'],
    // CFSR 无集合成员字段；跳过 ensemble 过滤
    ensembleField: '__none__',
    ensembleFieldCandidates: ['ensemble_member', 'number', 'member'],
    leadTimes: CFSR_LEAD_TIMES,
    ensembleMembers: ['cfsr'],
    defaultEnsemble: 'cfsr',
    recentInitDays: 7,
    forecastStart: '2018-12-13T00:00:00Z',
    forecastEndLagSteps: 1,
  },
  // CFSV2 (NCEP CFSv2, 6-Hourly Products Harmonized)
  // https://developers.google.com/earth-engine/datasets/catalog/NOAA_CFSV2_FOR6H_HARMONIZED
  // 每个 init cycle（6h）只保留 1 帧：该帧覆盖 [init, init+6h]，数据为 6h 平均 / 6h 累计。
  // 集合中不存在 forecast_hour / lead_hour / start_hour 属性；仅有 system:time_start = init_time。
  // 因此 leadTimeField='__none__'，不做 lead 过滤（frame.leadHour 任意值都成立）。
  {
    id: 'cfsv2',
    collection: 'NOAA/CFSV2/FOR6H_HARMONIZED',
    name: 'CFSv2 · NOAA NCEP',
    scale: 22264,
    vis: { min: -30, max: 30, palette: ECMWF_WIND_PALETTE },
    bands: CFSV2_BANDS,
    maxWindowDays: 7,
    timeStepHours: 6,
    // 1 帧 / cycle：7d × 4 init/天 = 28 帧
    defaultWindowSteps: 1,
    temporal: 'forecast',
    initTimeField: 'derived',
    initTimeFieldCandidates: ['derived', 'creation_time', 'start_time', 'init_time'],
    // CFSV2 无 lead 字段：每 init 周期仅 1 帧
    leadTimeField: '__none__',
    leadTimeFieldCandidates: ['forecast_hour', 'forecast_hours', 'start_hour', 'lead_hour', 'lead_time'],
    // CFSV2 无集合成员字段；跳过 ensemble 过滤
    ensembleField: '__none__',
    ensembleFieldCandidates: ['ensemble_member', 'number', 'member'],
    leadTimes: [0],
    ensembleMembers: ['cfsv2'],
    defaultEnsemble: 'cfsv2',
    recentInitDays: 7,
    forecastStart: '1979-01-01T00:00:00Z',
    forecastEndLagSteps: 1,
  },
  // WeatherNext 2 Mean：64 个集合成员的逐格点平均预聚合版本（无 ensemble_member 属性）
  // https://developers.google.com/earth-engine/datasets/catalog/projects_gcp-public-data-weathernext_assets_weathernext_2_0_0_mean
  // 属性 start_time / end_time 为 STRING（不像 weathernext2 那样为 INT ms）；
  // 体量约为 weathernext2 的 1/64，加载快，适合日常可视化与确定性预报。
  // 起报每天 00/06/12/18z；lead 0..360h 步长 6；0.25° (~28 km) 网格。
  {
    id: 'weathernext2_mean',
    collection: 'projects/gcp-public-data-weathernext/assets/weathernext_2_0_0_mean',
    name: 'WeatherNext 2 Mean · GDM',
    scale: 27830,
    vis: { min: 0, max: 50, palette: WN_WIND_PALETTE },
    bands: WN_BANDS,
    maxWindowDays: 7,
    timeStepHours: 6,
    defaultWindowSteps: Math.round((24 * 7) / 6) + 1,
    temporal: 'forecast',
    initTimeField: 'start_time',
    initTimeFieldCandidates: ['start_time', 'date_forecast', 'init_time', 'time_beg'],
    leadTimeField: 'forecast_hour',
    leadTimeFieldCandidates: ['forecast_hour', 'lead_hour', 'lead_time'],
    // WeatherNext 2 Mean 是 64 成员平均，无 ensemble_member 字段；跳过过滤
    ensembleField: '__none__',
    ensembleFieldCandidates: ['ensemble_member', 'number', 'member'],
    leadTimes: WN_LEAD_TIMES,
    ensembleMembers: ['mean'],
    defaultEnsemble: 'mean',
    recentInitDays: 7,
    forecastStart: '2022-01-01T00:00:00Z',
    forecastEndLagSteps: 1,
  },
] as const;

export function isNativeTemporal(source: GeeSourceDef): boolean {
  return (source.temporal ?? 'daily_mean') === 'native';
}

export function isForecastTemporal(source: GeeSourceDef): boolean {
  return (source.temporal ?? 'daily_mean') === 'forecast';
}

/** 日聚合算子；缺省 mean。daily/native/forecast 都返回同一默认；调用方按需判断。 */
export function dailyReductionOf(source: GeeSourceDef): GeeDailyReduction {
  return source.dailyReduction ?? 'mean';
}

/** 数据帧积分步长（h）；优先 frameStepHours，回退 timeStepHours。
 *  dailySum 与 nativeFrame 的窗口推进都使用此值。 */
export function frameStepHoursOf(source: GeeSourceDef): number {
  return source.frameStepHours ?? source.timeStepHours;
}

/** forecast 默认加载窗内的 lead 列表。
 *  全量 leadTimes 仍可保留到 360h；默认只取
 *  defaultWindowSteps 帧 ∩ lead ≤ maxWindowDays*24。
 *  例：6h 步长、maxWindowDays=7、defaultWindowSteps=29 → 0..168h。
 */
export function windowLeadTimes(source: GeeSourceDef): number[] {
  const all = source.leadTimes ?? [];
  if (!all.length) return [];
  const maxH = Math.max(0, (source.maxWindowDays ?? 7) * 24);
  const byHours = all.filter((h) => h <= maxH);
  const steps = source.defaultWindowSteps ?? byHours.length;
  return byHours.slice(0, Math.max(1, steps));
}
