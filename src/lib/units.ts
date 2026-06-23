export type FlowUnit = 'L/min' | 'L/sec' | 'm³/hr';
export type HeadUnit = 'm' | 'kPa' | 'psi';

const flowConversions: Record<FlowUnit, number> = {
  'L/min': 1,
  'L/sec': 60,
  'm³/hr': 16.6667
};

const headConversions: Record<HeadUnit, number> = {
  m: 1,
  kPa: 0.0981,
  psi: 0.7031
};

// export function convertFlow(
//   value: number,
//   from: FlowUnit,
//   to: FlowUnit
// ): number {
//   return (value * flowConversions[from]) / flowConversions[to];
// }

// export function convertHead(
//   value: number,
//   from: HeadUnit,
//   to: HeadUnit
// ): number {
//   return (value * headConversions[from]) / headConversions[to];
// }

// Flow rate conversion factors to L/min (base unit)
const FLOW_CONVERSION = {
  'L/min': 1,
  'L/sec': 1 / 60,
  'm³/hr': 1 / 16.6667
};

// Head/pressure conversion factors to meters (base unit)
const HEAD_CONVERSION = {
  m: 1,
  kPa: 0.101972,
  psi: 0.70307,
  'm/Head': 1,
  Bar: 10.1972
};

const FLOW_CONVERSION_TO_LMIN = {
  'L/min': 1,
  'L/sec': 60, // 1 L/sec = 60 L/min
  'm³/hr': 16.6667 // 1 m³/hr = 16.6667 L/min
};

export function convertFlow(
  value: number,
  fromUnit: FlowUnit,
  toUnit: FlowUnit
): number {
  // Guard against missing/invalid values so callers that immediately call
  // .toFixed() on the result don't crash on undefined/null/NaN.
  if (typeof value !== 'number' || !isFinite(value)) return 0;
  if (fromUnit === toUnit) return value;

  // Convert to L/min first, then to target unit
  const valueInLmin = value * FLOW_CONVERSION_TO_LMIN[fromUnit];
  const result = valueInLmin / FLOW_CONVERSION_TO_LMIN[toUnit];

  return parseFloat(result.toFixed(6));
}

export function convertHead(
  value: number,
  fromUnit: HeadUnit,
  toUnit: HeadUnit
): number {
  // Guard against missing/invalid values (e.g. a saved pump without maxHead)
  // before calling .toFixed(), which throws on undefined.
  if (typeof value !== 'number' || !isFinite(value)) return 0;
  if (fromUnit === toUnit) return parseFloat(value.toFixed(2));
  const converted =
    (value * HEAD_CONVERSION[fromUnit]) / HEAD_CONVERSION[toUnit];
  return parseFloat(converted.toFixed(2));
}
