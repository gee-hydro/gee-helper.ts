/**
 * FAO-56 Penman-Monteith 参考蒸散 ET₀（Allen et al. 1998）
 *
 * 设计纪律（同一 ES5 源可直接在 GEE Code Editor 与 Node.js 运行）：
 *   1. 不加载外部包；只用全局 `ee`
 *   2. 所有计算用 ee.Image.expression() —— 与 Code Editor API 完全一致
 *   3. 类型边界由同名 .d.ts 约束，运行源码保持普通 JavaScript
 *   4. 文件末尾用 exports 存在性守卫提供命名导出
 *
 * Node.js 侧由 TS 适配层注入全局 ee，然后按模块加载同一源码。
 * GEE Code Editor 侧也可把本文件作为命名模块使用。
 */

// ---------- 基础气象函数 ----------

/**
 * 饱和水汽压 es (kPa)
 *   es = 0.6108 * exp(17.27 * T / (T + 237.3))
 * @param T 平均气温 (°C)，ee.Image
 */
function saturationVaporPressure(T) {
  return ee.Image().expression('0.6108 * exp(17.27 * T / (T + 237.3))', { T: T });
}

/**
 * 饱和水汽压曲线斜率 Δ (kPa °C-1)
 *   Δ = 4098 * es / (T + 237.3)²
 */
function slopeSvpCurve(T) {
  return ee.Image().expression('4098 * es / (T + 237.3) ** 2', {
    es: saturationVaporPressure(T),
    T: T
  });
}

/**
 * 干湿表常数 γ (kPa °C-1)
 *   γ = 0.000665 * P
 * @param P 大气压 (kPa)，默认 101.3
 */
function psychrometricConstant(P) {
  return ee.Image().expression('0.000665 * P', {
    P: P == null ? ee.Image(101.3) : P
  });
}

// ---------- 主入口：FAO-56 Penman-Monteith ET₀ ----------

/**
 * FAO-56 Penman-Monteith 参考蒸散 (mm d⁻¹)
 *   ET₀ = (0.408·Δ·(Rn-G) + γ·(900/(T+273))·u₂·(es-ea))
 *          / (Δ + γ·(1 + 0.34·u₂))
 *
 * @see Allen, R.G., Pereira, L.S., Raes, D., Smith, M. (1998) FAO-56
 */
function penmanMonteithET0(p) {
  var delta = slopeSvpCurve(p.T);
  var gamma = psychrometricConstant(p.P);
  var es = saturationVaporPressure(p.T);
  var G = p.G == null ? ee.Image(0) : p.G;

  return ee.Image().expression(
    '(0.408 * delta * (Rn - G) + gamma * (900 / (T + 273)) * u2 * (es - ea))'
    + ' / (delta + gamma * (1 + 0.34 * u2))',
    {
      delta: delta,
      gamma: gamma,
      es: es,
      Rn: p.Rn,
      G: G,
      T: p.T,
      u2: p.u2,
      ea: p.ea
    }
  ).rename('ET0').copyProperties(p.T, ['system:time_start']);
}

/**
 * 由 ERA5-LAND 小时数据合成日均 ET₀（时段内气象变量先聚合再代入 PM 公式）
 *
 * 此函数在桶内调用：start/end 即当前桶的起止（闭区间）；函数返回该桶的逐日 ET₀ 集合
 * （daily mean），便于 filePerBand:false 多 band 输出
 *
 * 依赖：ECMWF/ERA5_LAND/HOURLY
 *   - temperature_2m: K → °C
 *   - dewpoint_temperature_2m: K → °C
 *   - u_component_of_wind_10m, v_component_of_wind_10m: m/s → 10m 风 → 2m 风 (× 4.87/ln(67.8z-5.42))
 *   - surface_net_solar_radiation, surface_net_thermal_radiation: J m⁻² → 日合计 MJ m⁻² d⁻¹
 *   - surface_pressure: Pa → kPa
 */
function era5DailyET0(start, end) {
  var col = ee.ImageCollection('ECMWF/ERA5_LAND/HOURLY')
    .filterDate(start, ee.Date(end).advance(1, 'day'));

  var daily = ee.ImageCollection(
    ee.List.sequence(0, ee.Date(end).difference(ee.Date(start), 'day')).map(function (d) {
      var day = ee.Date(start).advance(ee.Number(d), 'day');
      var dayCol = col.filterDate(day, day.advance(1, 'day'));

      // 2 m 风速：10 m 分量 → 速度 → 2 m 高度换算
      var ws10 = dayCol.map(function (img) {
        var u = img.select('u_component_of_wind_10m');
        var v = img.select('v_component_of_wind_10m');
        return u.pow(2).add(v.pow(2)).sqrt()
          .rename('ws10')
          .copyProperties(img, ['system:time_start']);
      }).mean();
      var u2 = ws10.multiply(4.87)
        .divide(ee.Image(67.8 * 10 - 5.42).log())
        .rename('u2');

      // 温度：K → °C
      var T = dayCol.select('temperature_2m').mean().subtract(273.15).rename('T');

      // 实际水汽压：由露点温度换算
      var ea = dayCol.select('dewpoint_temperature_2m').mean()
        .subtract(273.15)
        .expression('0.6108 * exp(17.27 * Td / (Td + 237.3))', { Td: 'default' })
        .rename('ea');

      // 净辐射：表面净太阳 + 净热辐射（J m⁻²）→ 日合计 MJ m⁻² d⁻¹
      var Rn = dayCol.map(function (img) {
        return img.expression('Rs + Rl', {
          Rs: img.select('surface_net_solar_radiation'),
          Rl: img.select('surface_net_thermal_radiation')
        });
      }).sum()
        .divide(1e6)
        .rename('Rn');

      // 大气压
      var P = dayCol.select('surface_pressure').mean().divide(1000).rename('P');

      return penmanMonteithET0({ Rn: Rn, T: T, u2: u2, ea: ea, P: P })
        .set('system:time_start', day.millis())
        .set('system:index', day.format('YYYY-MM-dd'));
    })
  );
  return daily;
}

var fao56 = {
  saturationVaporPressure: saturationVaporPressure,
  slopeSvpCurve: slopeSvpCurve,
  psychrometricConstant: psychrometricConstant,
  penmanMonteithET0: penmanMonteithET0,
  era5DailyET0: era5DailyET0
};

if (typeof exports !== 'undefined') {
  Object.keys(fao56).forEach(function (name) {
    exports[name] = fao56[name];
  });
}
