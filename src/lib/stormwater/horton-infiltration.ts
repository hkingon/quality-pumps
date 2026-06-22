/**
 * Horton infiltration model for the Advanced Stormwater calculator.
 *
 * Horton's equation describes infiltration capacity decaying over the storm:
 *   f(t) = fc + (f0 - fc) * e^(-k * t)
 * where t is the time since the start of the storm in HOURS.
 *
 * Note: this is unrelated to the `hortonValues` (Manning's-n surface roughness)
 * used for time-of-concentration in the calculator.
 */

export type InfiltrationType =
  | 'None'
  | 'Hardstand'
  | 'Soil A'
  | 'Soil B'
  | 'Soil C'
  | 'Soil D'
  | 'Custom'
  | 'Residential'
  | 'Commercial'
  | 'Industrial';

export type AMC = '1' | '2' | '3' | '4' | 'Max';

export const INFILTRATION_TYPES: InfiltrationType[] = [
  'None',
  'Hardstand',
  'Soil A',
  'Soil B',
  'Soil C',
  'Soil D',
  'Custom',
  'Residential',
  'Commercial',
  'Industrial'
];

export const AMC_OPTIONS: AMC[] = ['1', '2', '3', '4', 'Max'];

/** Soil types that take an AMC selection. */
export const SOIL_TYPES: InfiltrationType[] = ['Soil A', 'Soil B', 'Soil C', 'Soil D'];

/** Composite urban types split between EIA and ICA sub-soils. */
export const COMPOSITE_TYPES: InfiltrationType[] = ['Residential', 'Commercial', 'Industrial'];

/** Horton shape factor (decay coefficient) in 1/hr. Constant across soil types. */
export const HORTON_K = 2;

/** Base soil parameters (mm/h). f0 = initial rate (AMC 1 / completely dry), fc = final rate. */
export const SOIL_BASE: Record<string, { f0: number; fc: number }> = {
  'Soil A': { f0: 250, fc: 25 },
  'Soil B': { f0: 200, fc: 13 },
  'Soil C': { f0: 125, fc: 6 },
  'Soil D': { f0: 75, fc: 3 }
};

/**
 * AMC-adjusted initial infiltration rate f0 (mm/h) per soil type.
 * AMC 'Max' is handled separately (f0 = fc).
 */
export const AMC_INITIAL_RATES: Record<string, Record<'1' | '2' | '3' | '4', number>> = {
  'Soil A': { '1': 250, '2': 162.3, '3': 83.6, '4': 33.1 },
  'Soil B': { '1': 200, '2': 130.1, '3': 66.3, '4': 30.7 },
  'Soil C': { '1': 125, '2': 78, '3': 33.7, '4': 6.6 },
  'Soil D': { '1': 75, '2': 40.9, '3': 7.4, '4': 3.0 }
};

/** Fixed sub-soil parameters making up the Total Impervious Area of composite types. */
export const EIA = { f0: 2, fc: 0 }; // Effective Impervious Area
export const ICA = { f0: 20, fc: 2.5 }; // Indirectly Connected Area

/** Area split between EIA and ICA for each composite catchment type. */
export const COMPOSITE_SPLIT: Record<string, { eia: number; ica: number }> = {
  Residential: { eia: 0.65, ica: 0.35 },
  Commercial: { eia: 0.94, ica: 0.06 },
  Industrial: { eia: 0.77, ica: 0.23 }
};

/** Horton infiltration capacity at time t (hours). */
export const hortonRate = (f0: number, fc: number, k: number, tHours: number): number =>
  fc + (f0 - fc) * Math.exp(-k * tHours);

/** A weighted Horton sub-component covering a fraction of the catchment area. */
interface InfiltrationComponent {
  fraction: number;
  f0: number;
  fc: number;
}

export interface InfiltrationParams {
  infiltrationType?: InfiltrationType;
  amc?: AMC;
  customF0?: number;
  customFc?: number;
}

/** Resolve a catchment's infiltration settings into area-weighted Horton components. */
const resolveComponents = (c: InfiltrationParams): InfiltrationComponent[] => {
  const type = c.infiltrationType ?? 'Hardstand';

  if (type === 'None' || type === 'Hardstand') return [];

  if (type === 'Custom') {
    return [{ fraction: 1, f0: c.customF0 ?? 0, fc: c.customFc ?? 0 }];
  }

  if (SOIL_TYPES.includes(type)) {
    const fc = SOIL_BASE[type].fc;
    const amc = c.amc ?? 'Max';
    // 'Max' => no decay capacity above the minimum: f0 = fc (constant minimum infiltration).
    const f0 = amc === 'Max' ? fc : AMC_INITIAL_RATES[type][amc];
    return [{ fraction: 1, f0, fc }];
  }

  if (COMPOSITE_TYPES.includes(type)) {
    const split = COMPOSITE_SPLIT[type];
    return [
      { fraction: split.eia, f0: EIA.f0, fc: EIA.fc },
      { fraction: split.ica, f0: ICA.f0, fc: ICA.fc }
    ];
  }

  return [];
};

/**
 * Effective infiltration intensity (mm/h) for a catchment at time `tMinutes` from
 * the start of the storm. This is the area-weighted sum of each sub-component's
 * Horton rate, so it can be multiplied by the full catchment area to get the
 * infiltration flow. Returns 0 for None/Hardstand.
 */
export const infiltrationIntensity = (c: InfiltrationParams, tMinutes: number): number => {
  const components = resolveComponents(c);
  if (components.length === 0) return 0;
  const tHours = tMinutes / 60;
  return components.reduce(
    (sum, comp) => sum + comp.fraction * hortonRate(comp.f0, comp.fc, HORTON_K, tHours),
    0
  );
};
