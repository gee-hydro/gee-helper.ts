/** FAO-56 Penman-Monteith 输入，影像返回值由 GEE 宿主提供。 */
export interface ET0Inputs {
  /** 净辐射 Rn (MJ m⁻² d⁻¹) */
  Rn: any;
  /** 平均气温 T (°C) */
  T: any;
  /** 2 m 风速 u₂ (m s⁻¹) */
  u2: any;
  /** 实际水汽压 ea (kPa) */
  ea: any;
  /** 土壤热通量 G (MJ m⁻² d⁻¹)，日尺度默认 0 */
  G?: any;
  /** 大气压 P (kPa)，默认 101.3 */
  P?: any;
}

export function saturationVaporPressure(T: any): any;
export function slopeSvpCurve(T: any): any;
export function psychrometricConstant(P?: any): any;
export function penmanMonteithET0(inputs: ET0Inputs): any;
export function era5DailyET0(start: string, end: string): any;
