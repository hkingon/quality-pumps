import { convertFlow, convertHead, FlowUnit, HeadUnit } from '@/lib/units';
import type { SavedPump, SystemCurveData } from '@/types';

// =============================================================================
// Section 11 — Tunable constants (one config object)
// =============================================================================

export const SCORING_CONFIG = {
  // Head margin penalty
  HEAD_BAND_LOW: 1.04,
  HEAD_BAND_HIGH: 1.15,
  HEAD_LOW_SCALE: 0.04,
  HEAD_LOW_FACTOR: 0.5,
  HEAD_HIGH_SCALE: 0.30,

  // Preferred Operating Range (POR)
  POR_LOW: 0.70,
  POR_HIGH: 1.20,
  POR_SCALE: 0.20,

  // Allowable Operating Range (AOR)
  AOR_LOW: 0.50,
  AOR_HIGH: 1.40,
  AOR_SCALE: 0.10,

  // Energy penalty cap
  PE_CAP: 2.0,

  // VFD speed deviation
  SPEED_DEADBAND: 0.95,
  SPEED_LOW_SCALE: 0.25,
  SPEED_HIGH_SCALE: 0.10,

  // Weights (must sum to 1.00)
  W_H: 0.30,
  W_R: 0.20,
  W_A: 0.15,
  W_E: 0.20,
  W_V: 0.10,
  W_C: 0.05,

  // Efficiency estimate clamps
  ETA_CLAMP_MIN: 0.25,
  ETA_CLAMP_MAX: 0.85,
  ETA_FLOOR_OFF_BEP: 0.05,

  // Specific speed clamps
  NQ_CLAMP_MIN: 8,
  NQ_CLAMP_MAX: 150,

  // AND mode worst-duty weighting
  AND_WORST_WEIGHT: 0.35,

  // Physics constants
  RHO: 998.2, // kg/m³
  G: 9.81,    // m/s²

  // Default efficiency when nothing is available and we cannot estimate
  DEFAULT_ETA: 0.65,
};

// =============================================================================
// Types
// =============================================================================

export interface PumpCurvePoint {
  flow: number;
  head: number;
}

export interface DutyMetric {
  dutyName: string;
  score: number;
  isHidden: boolean;
  canMeet: boolean;
  // penalty values
  ph: number;
  pr: number;
  pa: number;
  pe: number;
  pv: number;
  pc: number;
  pAbs: number;
  // flags
  outsideAor: boolean;
  motorOverload: boolean;
  // operating point in pump native units
  operatingPoint: { flow: number; head: number };
  rh: number;
  rqo: number; // operating-point flow ratio
}

export interface PumpScoringResult {
  finalScore: number;
  isHidden: boolean;
  bestDutyName?: string;
  dutiesPassedCount: number;
  avgPassedScore: number;
  bestDutyP_abs: number;
  dutyMetrics: DutyMetric[];
}

export interface PreliminaryDutyMetric {
  dutyName: string;
  isHidden: boolean;
  canMeet: boolean;
  ph: number;
  pr: number;
  pa: number;
  pv: number;
  pc: number;
  pAbs: number;
  outsideAor: boolean;
  motorOverload: boolean;
  operatingPoint: { flow: number; head: number };
  rh: number;
  rqo: number;
  speedRatio: number;
}

// =============================================================================
// Internal helpers
// =============================================================================

function findLineIntersection(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): { x: number; y: number } | null {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  if (t >= -1e-6 && t <= 1.000001 && u >= -1e-6 && u <= 1.000001) {
    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
  }
  return null;
}

/** Interpolate head at a given flow from a sorted set of curve points.
 *  Clamps to the nearest endpoint if flow is outside the stored range. */
function interpolateHeadAtFlow(
  pvsq: { flow: number; head: number }[],
  targetFlow: number
): number {
  if (pvsq.length === 0) return 0;
  const sorted = [...pvsq].sort((a, b) => a.flow - b.flow);
  if (targetFlow <= sorted[0].flow) return sorted[0].head;
  if (targetFlow >= sorted[sorted.length - 1].flow) return sorted[sorted.length - 1].head;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].flow <= targetFlow && sorted[i + 1].flow >= targetFlow) {
      const ratio = (targetFlow - sorted[i].flow) / (sorted[i + 1].flow - sorted[i].flow);
      return sorted[i].head + ratio * (sorted[i + 1].head - sorted[i].head);
    }
  }
  return sorted[sorted.length - 1].head;
}

/** Interpolate power (kW) at a given flow from motor power curve.
 *  Clamps to nearest endpoint if outside range. */
function interpolatePowerAtFlow(
  motorPower: { kw: number; flow: number }[] | undefined,
  targetFlow: number
): number | null {
  if (!motorPower || motorPower.length === 0) return null;
  const sorted = [...motorPower].sort((a, b) => a.flow - b.flow);
  if (targetFlow <= sorted[0].flow) return sorted[0].kw;
  if (targetFlow >= sorted[sorted.length - 1].flow) return sorted[sorted.length - 1].kw;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].flow <= targetFlow && sorted[i + 1].flow >= targetFlow) {
      const ratio = (targetFlow - sorted[i].flow) / (sorted[i + 1].flow - sorted[i].flow);
      return sorted[i].kw + ratio * (sorted[i + 1].kw - sorted[i].kw);
    }
  }
  return sorted[sorted.length - 1].kw;
}

/** Interpolate efficiency at a given flow from the efficiency curve.
 *  Clamps to nearest endpoint. Returns a value in [0,1]. */
function interpolateEfficiencyAtFlow(
  efficiency: { eff: string; flow: string }[] | undefined,
  targetFlow: number
): number | null {
  if (!efficiency || efficiency.length === 0) return null;
  const sorted = efficiency
    .map(e => ({ flow: Number(e.flow), eff: Number(e.eff) }))
    .sort((a, b) => a.flow - b.flow);
  if (sorted.length === 0) return null;

  let rawEta: number;
  if (targetFlow <= sorted[0].flow) {
    rawEta = sorted[0].eff;
  } else if (targetFlow >= sorted[sorted.length - 1].flow) {
    rawEta = sorted[sorted.length - 1].eff;
  } else {
    let lower = sorted[0], upper = sorted[sorted.length - 1];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].flow <= targetFlow && sorted[i + 1].flow >= targetFlow) {
        lower = sorted[i];
        upper = sorted[i + 1];
        break;
      }
    }
    const ratio = lower.flow === upper.flow ? 0 : (targetFlow - lower.flow) / (upper.flow - lower.flow);
    rawEta = lower.eff + ratio * (upper.eff - lower.eff);
  }

  // Normalise: stored as percent if > 1.5
  if (rawEta > 1.5) rawEta /= 100;
  if (rawEta > 0 && rawEta <= 1) return rawEta;
  return null;
}

// =============================================================================
// Section 2 — Speed ratio and affinity scaling
// =============================================================================

/** Get the speed ratio r = newSpeed / oldSpeed, or 1 if not VFD-adjusted. */
function getSpeedRatio(pump: SavedPump): number {
  const isVfd = pump.otherTraits?.includes('VFD Compatible');
  if (!isVfd) return 1;
  if (pump.oldSpeed && pump.oldSpeed > 0 && pump.newSpeed && pump.newSpeed > 0) {
    return pump.newSpeed / pump.oldSpeed;
  }
  return 1;
}

/** Apply affinity laws to a pvsq curve, scaling flow×r, head×r². */
function affinityScaleCurve(
  pvsq: { flow: number; head: number }[],
  r: number
): { flow: number; head: number }[] {
  if (r === 1) return pvsq;
  return pvsq.map(p => ({ flow: p.flow * r, head: p.head * r * r }));
}

/** Generate a parabolic pump curve (100 points) for pumps with no pvsq data. */
function generateParabolicCurve(
  maxHead: number,
  maxFlow: number,
  r: number
): { flow: number; head: number }[] {
  const scaledMaxHead = maxHead * r * r;
  const scaledMaxFlow = maxFlow * r;
  const points: { flow: number; head: number }[] = [];
  const num = 100;
  for (let i = 0; i <= num; i++) {
    const flow = (scaledMaxFlow * i) / num;
    const head = scaledMaxHead * (1 - Math.pow(flow / scaledMaxFlow, 2));
    points.push({ flow, head });
  }
  return points;
}

// =============================================================================
// Section 3 — Parallel pump curve combination
// =============================================================================

/** Combine N identical pump curves in parallel: at each head, flow = N × single-pump flow. */
function combineParallelCurves(
  singlePumpCurve: { flow: number; head: number }[],
  N: number
): { flow: number; head: number }[] {
  if (N <= 1) return singlePumpCurve;
  return singlePumpCurve.map(p => ({ flow: p.flow * N, head: p.head }));
}

// =============================================================================
// Section 4 — Capability gate
// =============================================================================

function getHeadAtDutyFlow(
  activeCurve: { flow: number; head: number }[],
  dutyFlow: number
): number {
  return interpolateHeadAtFlow(activeCurve, dutyFlow);
}

// =============================================================================
// Section 5 — Efficiency and power data fallback order
// =============================================================================

/** Table 5-1: C constants by pump category */
function getCConstant(pump: SavedPump, ratedRpm: number): number {
  const classes = (pump.pumpClass || []).filter((c): c is string => typeof c === 'string');
  const config = (pump.configuration || []).filter((c): c is string => typeof c === 'string');
  const combined = [...classes, ...config];

  // Borehole / Bore Pump
  if (combined.some(c => c.toLowerCase().includes('borehole') || c.toLowerCase().includes('bore'))) {
    return 128.79;
  }

  // Multistage
  if (combined.some(c =>
    c.toLowerCase().includes('multistage') ||
    c.toLowerCase() === 'vertical turbine'
  )) {
    return 133.95;
  }

  // End suction / surface centrifugal
  if (ratedRpm >= 2200) return 130.27;
  return 128.07;
}

/** Table 5-2: derate factor — minimum if multiple apply */
function getDerateFactors(pump: SavedPump): number {
  const impeller = (pump.impellerType || '').toLowerCase();
  const classes = (pump.pumpClass || []).filter((c): c is string => typeof c === 'string').map(c => c.toLowerCase());
  const factors: number[] = [];

  if (impeller.includes('vortex') || classes.some(c => c.includes('vortex'))) factors.push(0.65);
  if (classes.some(c => c.includes('grinder'))) factors.push(0.60);
  if (classes.some(c => c.includes('cutter'))) factors.push(0.80);
  if (classes.some(c => c.includes('drainage') || c.includes('slurry'))) factors.push(0.85);
  if (impeller.includes('open') && !impeller.includes('semi')) factors.push(0.88);
  if (impeller.includes('semi-open') || impeller.includes('semi open')) factors.push(0.92);

  return factors.length > 0 ? Math.min(...factors) : 1.0;
}

/** Estimate BEP efficiency using EU Regulation 547/2012 specific-speed formula. */
function estimateEfficiencyFromSpecificSpeed(
  pump: SavedPump,
  qBepM3s: number,
  hBepM: number
): number {
  // Step a: rated RPM
  let n = pump.rpm || 0;
  if (n <= 0) {
    const poleMap: Record<number, number> = { 2: 2900, 4: 1450, 6: 960, 8: 730 };
    n = (pump.poles && poleMap[pump.poles]) ? poleMap[pump.poles] : 2900;
  }

  // Step b: Specific speed (metric), clamped
  let nq = n * Math.sqrt(qBepM3s) / Math.pow(hBepM, 0.75);
  nq = Math.max(SCORING_CONFIG.NQ_CLAMP_MIN, Math.min(SCORING_CONFIG.NQ_CLAMP_MAX, nq));

  // Step c: EU 547/2012 formula
  const x = Math.log(nq);
  const qBepM3h = qBepM3s * 3600; // note: different unit for y
  const y = Math.log(qBepM3h);
  const C = getCConstant(pump, n);

  let etaBep = (88.59 * x + 13.46 * y - 11.48 * x * x - 0.85 * y * y - 0.38 * x * y - C) / 100;

  // Step d: derate and clamp
  const derate = getDerateFactors(pump);
  etaBep = etaBep * derate;
  etaBep = Math.max(SCORING_CONFIG.ETA_CLAMP_MIN, Math.min(SCORING_CONFIG.ETA_CLAMP_MAX, etaBep));

  return etaBep;
}

/** 
 * Get efficiency at a given per-pump operating flow q_o using the Section 5 fallback order.
 * Returns { eta, usedEstimate } where usedEstimate=true means P_C should be 1.
 */
function getEfficiency(
  pump: SavedPump,
  qo: number,           // per-pump operating flow in pump native units
  qBepEff: number,      // BEP flow at current speed in pump native units
  hBepM: number,        // BEP head in metres
  qBepM3s: number,      // BEP flow in m³/s at rated speed
  pvsqScaled: { flow: number; head: number }[],
  motorPowerScaled: { kw: number; flow: number }[] | undefined
): { eta: number; usedEstimate: boolean } {
  // Step 1: efficiency curve exists
  if (pump.efficiency && pump.efficiency.length > 0) {
    // The stored efficiency curve is at rated speed, but we use it at scaled flow
    // (spec says: efficiency values travel with their scaled flow points)
    const eta = interpolateEfficiencyAtFlow(pump.efficiency, qo);
    if (eta !== null) return { eta, usedEstimate: false };
  }

  // Step 2: power curve exists — derive efficiency
  if (motorPowerScaled && motorPowerScaled.length > 0) {
    const pKw = interpolatePowerAtFlow(motorPowerScaled, qo);
    if (pKw !== null && pKw > 0) {
      // Need head at qo from scaled curve, then compute
      const hAtQo = interpolateHeadAtFlow(pvsqScaled, qo);
      // qo is in pump native units; convert to m³/s
      const qoLmin = convertFlow(qo, pump.flowUnit, 'L/min');
      const qoM3s = qoLmin / 60 / 1000;
      const hoM = convertHead(hAtQo, pump.headUnit, 'm');
      const etaDerived = (SCORING_CONFIG.RHO * SCORING_CONFIG.G * qoM3s * hoM) / (1000 * pKw);
      if (etaDerived > 0 && etaDerived <= 1) return { eta: etaDerived, usedEstimate: false };
    }
  }

  // Step 3: estimate from specific speed
  const etaBep = estimateEfficiencyFromSpecificSpeed(pump, qBepM3s, hBepM);
  const t = qBepEff > 0 ? qo / qBepEff : 1;
  let eta = etaBep * (2 * t - t * t);
  eta = Math.max(SCORING_CONFIG.ETA_FLOOR_OFF_BEP, eta);
  return { eta, usedEstimate: true };
}

// =============================================================================
// Section 5 — Absorbed power (per pump, kW)
// =============================================================================

function calculateAbsorbedPower(
  qo: number,
  ho: number,
  eta: number,
  pumpFlowUnit: FlowUnit,
  pumpHeadUnit: HeadUnit
): number {
  const qoLmin = convertFlow(qo, pumpFlowUnit, 'L/min');
  const qoM3s = qoLmin / 60 / 1000;
  const hoM = convertHead(ho, pumpHeadUnit, 'm');
  return (SCORING_CONFIG.RHO * SCORING_CONFIG.G * qoM3s * hoM) / (1000 * eta);
}

// =============================================================================
// BEP calculation (in pump native units)
// =============================================================================

export function calculateBep(pump: SavedPump): { bepFlow: number; bepHead: number } {
  const r = getSpeedRatio(pump);

  if (pump.manualBepFlow && pump.manualBepFlow > 0) {
    const scaledBepFlow = pump.manualBepFlow * r;
    const baseCurve = pump.pvsq && pump.pvsq.length > 0
      ? pump.pvsq
      : generateParabolicCurve(pump.maxHead, pump.maxFlow, 1);
    const scaledCurve = affinityScaleCurve(baseCurve, r);
    const bepHead = interpolateHeadAtFlow(scaledCurve, scaledBepFlow);
    return { bepFlow: scaledBepFlow, bepHead };
  }

  const curve = pump.pvsq && pump.pvsq.length > 0
    ? affinityScaleCurve(pump.pvsq, r)
    : generateParabolicCurve(pump.maxHead, pump.maxFlow, r);

  let bepFlow = 0, bepHead = 0, maxProduct = 0;
  curve.forEach(p => {
    const product = p.flow * p.head;
    if (product > maxProduct) {
      maxProduct = product;
      bepFlow = p.flow;
      bepHead = p.head;
    }
  });

  return { bepFlow, bepHead };
}

/** BEP flow at RATED speed (r=1) in pump native units — used for R_Qo denominator. */
function getBepFlowRated(pump: SavedPump): { bepFlowRated: number; bepHeadRated: number } {
  if (pump.manualBepFlow && pump.manualBepFlow > 0) {
    const bepHead = pump.pvsq && pump.pvsq.length > 0
      ? interpolateHeadAtFlow(pump.pvsq, pump.manualBepFlow)
      : pump.maxHead * (1 - Math.pow(pump.manualBepFlow / pump.maxFlow, 2));
    return { bepFlowRated: pump.manualBepFlow, bepHeadRated: bepHead };
  }
  const curve = pump.pvsq && pump.pvsq.length > 0
    ? pump.pvsq
    : generateParabolicCurve(pump.maxHead, pump.maxFlow, 1);
  let bepFlow = 0, bepHead = 0, maxProduct = 0;
  curve.forEach(p => {
    const product = p.flow * p.head;
    if (product > maxProduct) {
      maxProduct = product;
      bepFlow = p.flow;
      bepHead = p.head;
    }
  });
  return { bepFlowRated: bepFlow, bepHeadRated: bepHead };
}

// =============================================================================
// System curve generation in pump native units
// =============================================================================

function generateSystemCurvePointsInPumpUnits(
  system: SystemCurveData,
  maxFlow: number,
  globalFlowUnit: FlowUnit,
  globalHeadUnit: HeadUnit,
  pumpFlowUnit: FlowUnit,
  pumpHeadUnit: HeadUnit
): PumpCurvePoint[] {
  const numPoints = 100;
  const points: PumpCurvePoint[] = [];
  const useComponents = system.components && system.components.length > 0;

  if (!useComponents) {
    const staticHead = convertHead(system.staticHead, globalHeadUnit, pumpHeadUnit);
    const opHead = convertHead(system.operatingHead, globalHeadUnit, pumpHeadUnit);
    const opFlow = convertFlow(system.operatingFlow, globalFlowUnit, pumpFlowUnit);

    if (opFlow <= 0) {
      for (let i = 0; i <= numPoints; i++) {
        points.push({ flow: (maxFlow * i) / numPoints, head: staticHead });
      }
      return points;
    }

    for (let i = 0; i <= numPoints; i++) {
      const flow = (maxFlow * i) / numPoints;
      const ratio = flow / opFlow;
      points.push({ flow, head: staticHead + (opHead - staticHead) * Math.pow(ratio, 2) });
    }
  } else {
    for (let i = 0; i <= numPoints; i++) {
      const flow = (maxFlow * i) / numPoints;
      let totalHead = 0;
      system.components!.forEach(comp => {
        const fromFlowUnit = comp.flowUnit || 'L/min';
        const qOp = convertFlow(comp.operatingFlow, fromFlowUnit, pumpFlowUnit);
        const hStatic = convertHead(comp.staticHead, 'm', pumpHeadUnit);
        const hOp = convertHead(comp.operatingHead, 'm', pumpHeadUnit);
        if (qOp <= 0) { totalHead += hStatic; return; }
        const frictionAtOp = hOp - hStatic;
        totalHead += hStatic + frictionAtOp * Math.pow(flow / qOp, 2);
      });
      points.push({ flow, head: totalHead });
    }
  }
  return points;
}

// =============================================================================
// Operating point intersection
// =============================================================================

function findOperatingPoint(
  pumpCurve: PumpCurvePoint[],
  systemCurve: PumpCurvePoint[]
): { flow: number; head: number } | null {
  const sortedPump = [...pumpCurve].sort((a, b) => a.flow - b.flow);
  for (let i = 0; i < systemCurve.length - 1; i++) {
    for (let j = 0; j < sortedPump.length - 1; j++) {
      const intersect = findLineIntersection(
        systemCurve[i].flow, systemCurve[i].head,
        systemCurve[i + 1].flow, systemCurve[i + 1].head,
        sortedPump[j].flow, sortedPump[j].head,
        sortedPump[j + 1].flow, sortedPump[j + 1].head
      );
      if (intersect && intersect.x >= 0 && intersect.y >= 0) {
        return { flow: intersect.x, head: intersect.y };
      }
    }
  }
  return null;
}

// =============================================================================
// Pass 1: preliminary per-duty metrics (no P_E yet — needs cross-pump pAbsBest)
// =============================================================================

export function calculatePreliminaryDutyMetrics(
  pump: SavedPump,
  duty: SystemCurveData,
  globalFlowUnit: FlowUnit,
  globalHeadUnit: HeadUnit,
  numberOfDutyPumps: number = 1,
  forceSpeedRatio?: number
): PreliminaryDutyMetric {
  const dutyName = duty.name || 'Unnamed Duty';
  const N = Math.max(1, numberOfDutyPumps);

  // Duty point in pump units
  const dutyFlowGlobal = convertFlow(duty.operatingFlow, globalFlowUnit, pump.flowUnit);
  const dutyHead = convertHead(duty.operatingHead, globalHeadUnit, pump.headUnit);

  const FAIL = (extra?: Partial<PreliminaryDutyMetric>): PreliminaryDutyMetric => ({
    dutyName,
    isHidden: true,
    canMeet: false,
    ph: Infinity,
    pr: Infinity,
    pa: Infinity,
    pv: 0,
    pc: 0,
    pAbs: Infinity,
    outsideAor: false,
    motorOverload: false,
    operatingPoint: { flow: 0, head: 0 },
    rh: 0,
    rqo: 0,
    speedRatio: 1,
    ...extra,
  });

  if (dutyFlowGlobal <= 0 || dutyHead <= 0) return FAIL();

  // Speed ratio
  const r = forceSpeedRatio ?? getSpeedRatio(pump);

  // Build scaled active single-pump curve
  const basePvsq = pump.pvsq && pump.pvsq.length > 0
    ? pump.pvsq
    : generateParabolicCurve(pump.maxHead, pump.maxFlow, 1);
  const singlePumpCurveScaled = affinityScaleCurve(basePvsq, r);

  // Active curve (combined for N > 1)
  const activeCurve = N > 1
    ? combineParallelCurves(singlePumpCurveScaled, N)
    : singlePumpCurveScaled;

  // Section 4 — Capability gate: evaluate at combined curve at Q_d
  const pumpHeadAtDuty = getHeadAtDutyFlow(activeCurve, dutyFlowGlobal);
  const rh = dutyHead > 0 ? pumpHeadAtDuty / dutyHead : 0;

  if (rh < 1.0) {
    return FAIL({ rh });
  }

  // BEP at rated speed (r=1) for R_Qo denominator
  const { bepFlowRated, bepHeadRated } = getBepFlowRated(pump);
  if (bepFlowRated <= 0) return FAIL({ rh });

  // Q_BEP_eff = r * Q_BEP (BEP flow at current speed in pump units)
  const qBepEff = r * bepFlowRated;

  // Operating point: where ACTIVE combined pump curve crosses system curve
  const systemCurvePoints = generateSystemCurvePointsInPumpUnits(
    duty,
    Math.max(...activeCurve.map(p => p.flow)) * 1.2,
    globalFlowUnit,
    globalHeadUnit,
    pump.flowUnit,
    pump.headUnit
  );

  const opRaw = findOperatingPoint(activeCurve, systemCurvePoints);
  const Qo = opRaw ? opRaw.flow : dutyFlowGlobal;
  const Ho = opRaw ? opRaw.head : dutyHead;

  // Per-pump operating flow q_o = Q_o / N
  const qo = Qo / N;

  // Operating flow ratio R_Qo = q_o / Q_BEP_eff
  const rqo = qBepEff > 0 ? qo / qBepEff : 0;

  // ---- Efficiency at q_o (Section 5 fallback) ----
  // Scale motor power curve by r³ for affinity laws
  const motorPowerScaled: { kw: number; flow: number }[] | undefined =
    pump.motorPower && pump.motorPower.length > 0
      ? pump.motorPower.map(p => ({
          flow: p.flow * r,
          kw: p.kw * r * r * r,
        }))
      : undefined;

  // BEP head in metres and BEP flow in m³/s at rated speed (for specific-speed estimate)
  const bepHeadM = convertHead(bepHeadRated, pump.headUnit, 'm');
  const bepFlowLmin = convertFlow(bepFlowRated, pump.flowUnit, 'L/min');
  const bepFlowM3s = bepFlowLmin / 60 / 1000;

  const { eta, usedEstimate } = getEfficiency(
    pump, qo, qBepEff, bepHeadM, bepFlowM3s, singlePumpCurveScaled, motorPowerScaled
  );

  // Absorbed power per pump (kW)
  let pAbsPerPump: number;
  const powerFromCurve = motorPowerScaled
    ? interpolatePowerAtFlow(motorPowerScaled, qo)
    : null;
  if (powerFromCurve !== null) {
    pAbsPerPump = powerFromCurve;
  } else {
    pAbsPerPump = calculateAbsorbedPower(qo, Ho, eta, pump.flowUnit, pump.headUnit);
  }

  // Station total
  const pAbsTotal = N * pAbsPerPump;

  // ---- Section 6 — Penalty terms ----

  // 6.1 P_H — evaluated at DUTY point
  const C = SCORING_CONFIG;
  const ph =
    C.HEAD_LOW_FACTOR * Math.pow(Math.max(0, (C.HEAD_BAND_LOW - rh) / C.HEAD_LOW_SCALE), 2) +
    Math.pow(Math.max(0, (rh - C.HEAD_BAND_HIGH) / C.HEAD_HIGH_SCALE), 2);

  // 6.2 P_R — evaluated at OPERATING point using R_Qo
  const pr = Math.pow(
    Math.max(0, (C.POR_LOW - rqo) / C.POR_SCALE, (rqo - C.POR_HIGH) / C.POR_SCALE),
    2
  );

  // 6.3 P_A — AOR excursion, evaluated at OPERATING point
  const paRaw = Math.max(0, (C.AOR_LOW - rqo) / C.AOR_SCALE, (rqo - C.AOR_HIGH) / C.AOR_SCALE);
  const pa = paRaw * paRaw;
  const outsideAor = pa > 0;

  // 6.5 P_V — VFD speed deviation
  const pv =
    Math.pow(Math.max(0, (C.SPEED_DEADBAND - r) / C.SPEED_LOW_SCALE), 2) +
    Math.pow(Math.max(0, (r - 1.0) / C.SPEED_HIGH_SCALE), 2);

  // 6.6 P_C — data confidence
  const hasEfficiency = pump.efficiency && pump.efficiency.length > 0;
  const hasPowerCurve = pump.motorPower && pump.motorPower.length > 0;
  const pc = (hasEfficiency || hasPowerCurve) ? 0 : (usedEstimate ? 1 : 0);

  // Section 8 — Motor overload flag
  // Only meaningful when we have an actual motor power curve, since pAbsPerPump
  // is motor input power derived from the curve. Without a curve, pAbsPerPump
  // is the estimated pump shaft power, which is not comparable to rated motor kw.
  const hasMotorPowerCurve = !!(pump.motorPower && pump.motorPower.length > 0);
  const ratedMotorKw = pump.kw;
  const motorOverload = hasMotorPowerCurve && ratedMotorKw != null && ratedMotorKw > 0
    ? pAbsPerPump > ratedMotorKw
    : false;

  return {
    dutyName,
    isHidden: false,
    canMeet: true,
    ph,
    pr,
    pa,
    pv,
    pc,
    pAbs: pAbsTotal,
    outsideAor,
    motorOverload,
    operatingPoint: { flow: Qo, head: Ho },
    rh,
    rqo,
    speedRatio: r,
  };
}

// =============================================================================
// Pass 2: finalize P_E and compute S_d
// =============================================================================

export function finalizeDutyMetrics(
  pre: PreliminaryDutyMetric,
  pAbsBest: number,
): DutyMetric {
  if (pre.isHidden) {
    return {
      dutyName: pre.dutyName,
      isHidden: true,
      canMeet: false,
      ph: pre.ph,
      pr: pre.pr,
      pa: pre.pa,
      pe: Infinity,
      pv: pre.pv,
      pc: pre.pc,
      pAbs: pre.pAbs,
      outsideAor: false,
      motorOverload: false,
      operatingPoint: pre.operatingPoint,
      rh: pre.rh,
      rqo: pre.rqo,
      score: Infinity,
    };
  }

  // 6.4 P_E — clamped to [0, PE_CAP]
  const pe = pAbsBest > 0
    ? Math.max(0, Math.min(SCORING_CONFIG.PE_CAP, pre.pAbs / pAbsBest - 1))
    : 0;

  const C = SCORING_CONFIG;
  const sd = 100 * (
    C.W_H * pre.ph +
    C.W_R * pre.pr +
    C.W_A * pre.pa +
    C.W_E * pe +
    C.W_V * pre.pv +
    C.W_C * pre.pc
  );

  return {
    dutyName: pre.dutyName,
    isHidden: false,
    canMeet: true,
    ph: pre.ph,
    pr: pre.pr,
    pa: pre.pa,
    pe,
    pv: pre.pv,
    pc: pre.pc,
    pAbs: pre.pAbs,
    outsideAor: pre.outsideAor,
    motorOverload: pre.motorOverload,
    operatingPoint: pre.operatingPoint,
    rh: pre.rh,
    rqo: pre.rqo,
    score: sd,
  };
}

// =============================================================================
// Section 10 — AND / OR mode aggregation
// =============================================================================

export function aggregateAndMode(
  metrics: DutyMetric[]
): { finalScore: number; isHidden: boolean } {
  if (metrics.length === 0) return { finalScore: Infinity, isHidden: true };

  // Must pass all duties
  if (!metrics.every(m => m.canMeet)) return { finalScore: Infinity, isHidden: true };

  const scores = metrics.map(m => m.score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const worst = Math.max(...scores);
  const finalScore = (avg + SCORING_CONFIG.AND_WORST_WEIGHT * worst) / (1 + SCORING_CONFIG.AND_WORST_WEIGHT);

  return { finalScore, isHidden: false };
}

export function aggregateOrMode(
  metrics: DutyMetric[]
): {
  finalScore: number;
  isHidden: boolean;
  bestDutyName: string;
  dutiesPassedCount: number;
  avgPassedScore: number;
  bestDutyP_abs: number;
} {
  if (metrics.length === 0) {
    return {
      finalScore: Infinity, isHidden: true, bestDutyName: '',
      dutiesPassedCount: 0, avgPassedScore: Infinity, bestDutyP_abs: Infinity,
    };
  }

  const passed = metrics.filter(m => !m.isHidden && m.canMeet);
  if (passed.length === 0) {
    return {
      finalScore: Infinity, isHidden: true, bestDutyName: '',
      dutiesPassedCount: 0, avgPassedScore: Infinity, bestDutyP_abs: Infinity,
    };
  }

  const avgPassedScore = passed.reduce((s, m) => s + m.score, 0) / passed.length;

  // Best = lowest score among passed duties
  let best = passed[0];
  for (const m of passed) {
    if (m.score < best.score) best = m;
  }

  return {
    finalScore: best.score,
    isHidden: false,
    bestDutyName: best.dutyName,
    dutiesPassedCount: passed.length,
    avgPassedScore,
    bestDutyP_abs: best.pAbs,
  };
}

// =============================================================================
// Convenience wrapper: two-pass scoring for a single pump
// =============================================================================

export function scorePumpForDuties(
  pump: SavedPump,
  duties: SystemCurveData[],
  globalFlowUnit: FlowUnit,
  globalHeadUnit: HeadUnit,
  dischargeCurveMode: 'and' | 'or',
  pAbsBestPerDuty: number[],
  numberOfDutyPumps: number = 1
): PumpScoringResult {
  if (duties.length === 0 || pAbsBestPerDuty.length !== duties.length) {
    return {
      finalScore: Infinity, isHidden: true,
      dutiesPassedCount: 0, avgPassedScore: Infinity,
      bestDutyP_abs: Infinity, dutyMetrics: [],
    };
  }

  const preliminaries = duties.map(duty =>
    calculatePreliminaryDutyMetrics(pump, duty, globalFlowUnit, globalHeadUnit, numberOfDutyPumps)
  );

  const finalized = preliminaries.map((pre, i) =>
    finalizeDutyMetrics(pre, pAbsBestPerDuty[i])
  );

  if (dischargeCurveMode === 'and') {
    const andResult = aggregateAndMode(finalized);
    return {
      finalScore: andResult.finalScore,
      isHidden: andResult.isHidden,
      dutiesPassedCount: finalized.filter(m => !m.isHidden).length,
      avgPassedScore: finalized.length > 0
        ? finalized.reduce((s, m) => s + m.score, 0) / finalized.length
        : Infinity,
      bestDutyP_abs: 0,
      dutyMetrics: finalized,
    };
  }

  const orResult = aggregateOrMode(finalized);
  return {
    finalScore: orResult.finalScore,
    isHidden: orResult.isHidden,
    bestDutyName: orResult.bestDutyName,
    dutiesPassedCount: orResult.dutiesPassedCount,
    avgPassedScore: orResult.avgPassedScore,
    bestDutyP_abs: orResult.bestDutyP_abs,
    dutyMetrics: finalized,
  };
}

// =============================================================================
// Score badge label helper
// =============================================================================

export function getSuitabilityBadge(score: number, isHidden: boolean): {
  label: string;
  colorClass: string;
} {
  // Pump not capable of duty → Failed (grey)
  if (isHidden || !isFinite(score)) return { label: 'Failed',     colorClass: 'bg-gray-500' };
  // 0–10   → Excellent (green)
  if (score <= 10)  return { label: 'Excellent',  colorClass: 'bg-green-600' };
  // 10–25  → Good (blue)
  if (score <= 25)  return { label: 'Good',       colorClass: 'bg-blue-600' };
  // 25–50  → Acceptable (#d97706 amber)
  if (score <= 50)  return { label: 'Acceptable', colorClass: 'bg-amber-600' };
  // 50–100 → Suboptimal (#ea580c orange)
  if (score <= 100) return { label: 'Suboptimal', colorClass: 'bg-orange-600' };
  // 100+   → Unsuitable (red)
  return                    { label: 'Unsuitable', colorClass: 'bg-red-600' };
}
