import { convertFlow, convertHead, FlowUnit, HeadUnit } from '@/lib/units';
import type { SavedPump, SystemCurveData } from '@/types';

// --- Types ---

export interface PumpCurvePoint {
  flow: number;
  head: number;
}

export interface DutyMetric {
  dutyName: string;
  score: number;
  isHidden: boolean;
  canMeet: boolean;
  ph: number;
  pr: number;
  pb: number;
  pe: number;
  pc: number;
  pAbs: number;
  operatingPoint: { flow: number; head: number }; // pump units
  rh: number;
  rq: number;
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
  pb: number;
  pc: number;
  pAbs: number;
  operatingPoint: { flow: number; head: number };
  rh: number;
  rq: number;
  applyFlowPenalty: boolean;
}

// --- Constants ---

const RHO = 998.2; // kg/m^3
const G = 9.81; // m/s^2
const DEFAULT_ETA = 0.65;

// --- Line intersection (ported from discharge-curve-chart.tsx) ---

function findLineIntersection(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number
): { x: number; y: number } | null {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;
  const t =
    ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u =
    -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  if (t >= -1e-6 && t <= 1.000001 && u >= -1e-6 && u <= 1.000001) {
    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
  }
  return null;
}

// --- Interpolate head at flow from pvsq (pump units) ---

function interpolateHeadAtFlow(
  pvsq: { flow: number; head: number }[],
  targetFlow: number
): number {
  if (pvsq.length === 0) return 0;
  if (pvsq.length === 1) return pvsq[0].head;

  const sorted = [...pvsq].sort((a, b) => a.flow - b.flow);
  let lower = sorted[0];
  let upper = sorted[sorted.length - 1];

  for (let i = 0; i < sorted.length - 1; i++) {
    if (
      sorted[i].flow <= targetFlow &&
      sorted[i + 1].flow >= targetFlow
    ) {
      lower = sorted[i];
      upper = sorted[i + 1];
      break;
    }
  }

  if (lower.flow === upper.flow) return lower.head;

  const ratio =
    (targetFlow - lower.flow) / (upper.flow - lower.flow);
  return lower.head + ratio * (upper.head - lower.head);
}

// --- Interpolate power at flow from motor power curve (pump units) ---

function interpolatePowerAtFlow(
  motorPower: { kw: number; flow: number }[] | undefined,
  targetFlow: number
): number | null {
  if (!motorPower || motorPower.length === 0) return null;

  const sorted = [...motorPower].sort((a, b) => a.flow - b.flow);
  if (targetFlow <= sorted[0].flow) return sorted[0].kw;
  if (targetFlow >= sorted[sorted.length - 1].flow)
    return sorted[sorted.length - 1].kw;

  let lower = sorted[0];
  let upper = sorted[sorted.length - 1];

  for (let i = 0; i < sorted.length - 1; i++) {
    if (
      sorted[i].flow <= targetFlow &&
      sorted[i + 1].flow >= targetFlow
    ) {
      lower = sorted[i];
      upper = sorted[i + 1];
      break;
    }
  }

  if (lower.flow === upper.flow) return lower.kw;

  const ratio =
    (targetFlow - lower.flow) / (upper.flow - lower.flow);
  return lower.kw + ratio * (upper.kw - lower.kw);
}

// --- Calculate BEP in pump native units ---

export function calculateBep(pump: SavedPump): { bepFlow: number; bepHead: number } {
  let bepFlow = 0;
  let bepHead = 0;

  if (pump.manualBepFlow && pump.manualBepFlow > 0) {
    bepFlow = pump.manualBepFlow;
    bepHead = interpolateHeadAtFlow(pump.pvsq || [], bepFlow);
    return { bepFlow, bepHead };
  }

  if (pump.pvsq && pump.pvsq.length > 0) {
    let maxProduct = 0;
    pump.pvsq.forEach((point) => {
      const product = point.flow * point.head;
      if (product > maxProduct) {
        maxProduct = product;
        bepFlow = point.flow;
        bepHead = point.head;
      }
    });
  } else {
    const numPoints = 100;
    let maxProduct = 0;
    for (let i = 0; i <= numPoints; i++) {
      const flow = (pump.maxFlow * i) / numPoints;
      const head =
        pump.maxHead * (1 - Math.pow(flow / pump.maxFlow, 2));
      const product = flow * head;
      if (product > maxProduct) {
        maxProduct = product;
        bepFlow = flow;
        bepHead = head;
      }
    }
  }

  return { bepFlow, bepHead };
}

// --- Absorbed power (kW) ---

function calculateAbsorbedPower(
  qo: number,
  ho: number,
  eta: number,
  pumpFlowUnit: FlowUnit,
  pumpHeadUnit: HeadUnit
): number {
  // Convert Qo to m^3/s
  const qo_lmin = convertFlow(qo, pumpFlowUnit, 'L/min');
  const qo_m3s = (qo_lmin * 0.001) / 60;
  // Convert Ho to meters
  const ho_m = convertHead(ho, pumpHeadUnit, 'm');

  const powerWatts = RHO * G * qo_m3s * ho_m;
  return powerWatts / (1000 * eta);
}

// --- Generate system curve points in pump units ---

function generateSystemCurvePointsInPumpUnits(
  system: SystemCurveData,
  maxFlow: number,
  globalFlowUnit: FlowUnit,
  globalHeadUnit: HeadUnit,
  pumpFlowUnit: FlowUnit,
  pumpHeadUnit: HeadUnit
): PumpCurvePoint[] {
  const useComponents =
    system.components && system.components.length > 0;
  const numPoints = 100;
  const points: PumpCurvePoint[] = [];

  if (!useComponents) {
    const staticHead = convertHead(
      system.staticHead,
      globalHeadUnit,
      pumpHeadUnit
    );
    const opHead = convertHead(
      system.operatingHead,
      globalHeadUnit,
      pumpHeadUnit
    );
    const opFlow = convertFlow(
      system.operatingFlow,
      globalFlowUnit,
      pumpFlowUnit
    );

    if (opFlow <= 0) {
      for (let i = 0; i <= numPoints; i++) {
        points.push({
          flow: (maxFlow * i) / numPoints,
          head: staticHead
        });
      }
      return points;
    }

    for (let i = 0; i <= numPoints; i++) {
      const flow = (maxFlow * i) / numPoints;
      const ratio = flow / opFlow;
      const head =
        staticHead + (opHead - staticHead) * Math.pow(ratio, 2);
      points.push({ flow, head });
    }
  } else {
    for (let i = 0; i <= numPoints; i++) {
      const flow = (maxFlow * i) / numPoints;
      let totalHead = 0;

      system.components!.forEach((comp) => {
        const fromFlowUnit = comp.flowUnit || 'L/min';
        const qOp = convertFlow(
          comp.operatingFlow,
          fromFlowUnit,
          pumpFlowUnit
        );
        const hStatic = convertHead(
          comp.staticHead,
          'm',
          pumpHeadUnit
        );
        const hOp = convertHead(
          comp.operatingHead,
          'm',
          pumpHeadUnit
        );

        if (qOp <= 0) {
          totalHead += hStatic;
          return;
        }

        const frictionAtOp = hOp - hStatic;
        const frictionAtQ =
          frictionAtOp * Math.pow(flow / qOp, 2);
        totalHead += hStatic + frictionAtQ;
      });

      points.push({ flow, head: totalHead });
    }
  }

  return points;
}

// --- Find operating point (first valid intersection) ---

function findOperatingPoint(
  pumpPoints: PumpCurvePoint[],
  systemPoints: PumpCurvePoint[]
): { flow: number; head: number } | null {
  const sortedPump = [...pumpPoints].sort((a, b) => a.flow - b.flow);

  for (let i = 0; i < systemPoints.length - 1; i++) {
    for (let j = 0; j < sortedPump.length - 1; j++) {
      const intersect = findLineIntersection(
        systemPoints[i].flow,
        systemPoints[i].head,
        systemPoints[i + 1].flow,
        systemPoints[i + 1].head,
        sortedPump[j].flow,
        sortedPump[j].head,
        sortedPump[j + 1].flow,
        sortedPump[j + 1].head
      );
      if (
        intersect &&
        intersect.x >= 0 &&
        intersect.y >= 0
      ) {
        return { flow: intersect.x, head: intersect.y };
      }
    }
  }
  return null;
}

// --- Preliminary per-duty metrics (pass 1: no PE) ---

export function calculatePreliminaryDutyMetrics(
  pump: SavedPump,
  duty: SystemCurveData,
  globalFlowUnit: FlowUnit,
  globalHeadUnit: HeadUnit
): PreliminaryDutyMetric {
  const dutyName = duty.name || 'Unnamed Duty';

  // Convert duty to pump units
  const dutyFlow = convertFlow(
    duty.operatingFlow,
    globalFlowUnit,
    pump.flowUnit
  );
  const dutyHead = convertHead(
    duty.operatingHead,
    globalHeadUnit,
    pump.headUnit
  );

  if (dutyFlow <= 0 || dutyHead <= 0) {
    return {
      dutyName,
      isHidden: true,
      canMeet: false,
      ph: Infinity,
      pr: Infinity,
      pb: Infinity,
      pc: 0,
      pAbs: Infinity,
      operatingPoint: { flow: dutyFlow, head: dutyHead },
      rh: 0,
      rq: 0,
      applyFlowPenalty: false
    };
  }

  // Pump head at duty flow
  let pumpHeadAtDutyFlow: number;
  if (pump.pvsq && pump.pvsq.length > 0) {
    pumpHeadAtDutyFlow = interpolateHeadAtFlow(pump.pvsq, dutyFlow);
  } else {
    pumpHeadAtDutyFlow =
      pump.maxHead * (1 - Math.pow(dutyFlow / pump.maxFlow, 2));
  }

  // Hidden if duty head > pump head (can't meet)
  const canMeet = dutyHead <= pumpHeadAtDutyFlow + 1e-6;
  if (!canMeet) {
    return {
      dutyName,
      isHidden: true,
      canMeet: false,
      ph: Infinity,
      pr: Infinity,
      pb: Infinity,
      pc: 0,
      pAbs: Infinity,
      operatingPoint: { flow: dutyFlow, head: dutyHead },
      rh: 0,
      rq: 0,
      applyFlowPenalty: false
    };
  }

  // BEP
  const { bepFlow, bepHead } = calculateBep(pump);

  if (bepFlow <= 0) {
    return {
      dutyName,
      isHidden: true,
      canMeet: false,
      ph: Infinity,
      pr: Infinity,
      pb: Infinity,
      pc: 0,
      pAbs: Infinity,
      operatingPoint: { flow: dutyFlow, head: dutyHead },
      rh: 0,
      rq: 0,
      applyFlowPenalty: false
    };
  }

  // Ratios
  const rh = pumpHeadAtDutyFlow / dutyHead;
  const rq = dutyFlow / bepFlow;

  // Penalties (without PE — that needs P_abs_best)
  const ph =
    Math.pow(Math.max(0, (1.04 - rh) / 0.04), 2) +
    Math.pow(Math.max(0, (rh - 1.15) / 0.30), 2);
  const pr = Math.pow(
    Math.max(
      0,
      Math.max((0.7 - rq) / 0.2, (rq - 1.2) / 0.2)
    ),
    2
  );
  const pb = Math.pow(Math.log(rq) / Math.log(1.3), 2);

  // Data confidence
  const hasEfficiency =
    pump.efficiency && pump.efficiency.length > 0;
  const pc = hasEfficiency ? 0 : 1;

  // Operating point (intersection)
  const systemPoints = generateSystemCurvePointsInPumpUnits(
    duty,
    pump.maxFlow * 1.2,
    globalFlowUnit,
    globalHeadUnit,
    pump.flowUnit,
    pump.headUnit
  );

  let pumpPoints: PumpCurvePoint[];
  if (pump.pvsq && pump.pvsq.length > 0) {
    pumpPoints = pump.pvsq.map((p) => ({
      flow: p.flow,
      head: p.head
    }));
  } else {
    const num = 100;
    pumpPoints = [];
    for (let i = 0; i <= num; i++) {
      const f = (pump.maxFlow * i) / num;
      const h =
        pump.maxHead * (1 - Math.pow(f / pump.maxFlow, 2));
      pumpPoints.push({ flow: f, head: h });
    }
  }

  let op = findOperatingPoint(pumpPoints, systemPoints);
  if (!op) {
    op = { flow: dutyFlow, head: dutyHead };
  }

  // Efficiency at operating point
  let eta = DEFAULT_ETA;
  if (hasEfficiency) {
    const effSorted = pump
      .efficiency!.map((e) => ({
        flow: Number(e.flow),
        eff: Number(e.eff)
      }))
      .sort((a, b) => a.flow - b.flow);

    let lower = effSorted[0];
    let upper = effSorted[effSorted.length - 1];
    for (let i = 0; i < effSorted.length - 1; i++) {
      if (
        effSorted[i].flow <= op.flow &&
        effSorted[i + 1].flow >= op.flow
      ) {
        lower = effSorted[i];
        upper = effSorted[i + 1];
        break;
      }
    }

    let rawEta = lower.eff;
    if (lower.flow !== upper.flow) {
      const ratio =
        (op.flow - lower.flow) /
        (upper.flow - lower.flow);
      rawEta = lower.eff + ratio * (upper.eff - lower.eff);
    }

    if (rawEta > 1.5) rawEta /= 100;
    if (rawEta > 0 && rawEta <= 1) eta = rawEta;
  }

  // Absorbed power at operating point
  let pAbs: number;
  const powerFromCurve = interpolatePowerAtFlow(
    pump.motorPower,
    op.flow
  );
  if (powerFromCurve !== null) {
    pAbs = powerFromCurve;
  } else {
    pAbs = calculateAbsorbedPower(
      op.flow,
      op.head,
      eta,
      pump.flowUnit,
      pump.headUnit
    );
  }

  // Flow ratio penalty flag
  const applyFlowPenalty = rq < 0.5 || rq > 1.4;

  return {
    dutyName,
    isHidden: false,
    canMeet: true,
    ph,
    pr,
    pb,
    pc,
    pAbs,
    operatingPoint: op,
    rh,
    rq,
    applyFlowPenalty
  };
}

// --- Pass 2: finalize PE and compute Sd ---

export function finalizeDutyMetrics(
  pre: PreliminaryDutyMetric,
  pAbsBest: number,
  penaltyFactor: number
): DutyMetric {
  if (pre.isHidden) {
    return {
      dutyName: pre.dutyName,
      isHidden: true,
      canMeet: false,
      ph: pre.ph,
      pr: pre.pr,
      pb: pre.pb,
      pc: pre.pc,
      pe: Infinity,
      pAbs: pre.pAbs,
      operatingPoint: pre.operatingPoint,
      rh: pre.rh,
      rq: pre.rq,
      score: Infinity
    };
  }

  const pe = pAbsBest > 0 ? pre.pAbs / pAbsBest - 1 : 0;

  let sd =
    100 *
    (0.35 * pre.ph +
      0.25 * pre.pr +
      0.20 * pe +
      0.15 * pre.pb +
      0.05 * pre.pc);

  if (pre.applyFlowPenalty) {
    sd *= penaltyFactor;
  }

  return {
    dutyName: pre.dutyName,
    isHidden: false,
    canMeet: true,
    ph: pre.ph,
    pr: pre.pr,
    pb: pre.pb,
    pc: pre.pc,
    pe,
    pAbs: pre.pAbs,
    operatingPoint: pre.operatingPoint,
    rh: pre.rh,
    rq: pre.rq,
    score: sd
  };
}

// --- Aggregate for AND mode ---

export function aggregateAndMode(
  metrics: DutyMetric[]
): { finalScore: number; isHidden: boolean } {
  if (metrics.length === 0) {
    return { finalScore: Infinity, isHidden: true };
  }

  const allCanMeet = metrics.every((m) => m.canMeet);
  if (!allCanMeet) {
    return { finalScore: Infinity, isHidden: true };
  }

  const scores = metrics.map((m) => m.score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const worst = Math.max(...scores);
  const finalScore = avg + worst * 0.35;

  return { finalScore, isHidden: false };
}

// --- Aggregate for OR mode ---

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
      finalScore: Infinity,
      isHidden: true,
      bestDutyName: '',
      dutiesPassedCount: 0,
      avgPassedScore: Infinity,
      bestDutyP_abs: Infinity
    };
  }

  const passed = metrics.filter((m) => !m.isHidden);
  const dutiesPassedCount = passed.length;

  if (dutiesPassedCount === 0) {
    return {
      finalScore: Infinity,
      isHidden: true,
      bestDutyName: '',
      dutiesPassedCount: 0,
      avgPassedScore: Infinity,
      bestDutyP_abs: Infinity
    };
  }

  const passedScores = passed.map((m) => m.score);
  const avgPassedScore =
    passedScores.reduce((a, b) => a + b, 0) / passedScores.length;

  let bestIdx = 0;
  let bestScore = Infinity;
  passed.forEach((m, i) => {
    if (m.score < bestScore) {
      bestScore = m.score;
      bestIdx = i;
    }
  });

  const best = passed[bestIdx];

  return {
    finalScore: best.score,
    isHidden: false,
    bestDutyName: best.dutyName,
    dutiesPassedCount,
    avgPassedScore,
    bestDutyP_abs: best.pAbs
  };
}

// --- Convenience wrapper: two-pass scoring for a single pump ---

export function scorePumpForDuties(
  pump: SavedPump,
  duties: SystemCurveData[],
  globalFlowUnit: FlowUnit,
  globalHeadUnit: HeadUnit,
  dischargeCurveMode: 'and' | 'or',
  penaltyFactor: number,
  pAbsBestPerDuty: number[]
): PumpScoringResult {
  if (
    duties.length === 0 ||
    pAbsBestPerDuty.length !== duties.length
  ) {
    return {
      finalScore: Infinity,
      isHidden: true,
      dutiesPassedCount: 0,
      avgPassedScore: Infinity,
      bestDutyP_abs: Infinity,
      dutyMetrics: []
    };
  }

  // Pass 1
  const preliminaries = duties.map((duty) =>
    calculatePreliminaryDutyMetrics(
      pump,
      duty,
      globalFlowUnit,
      globalHeadUnit
    )
  );

  // Pass 2
  const finalized = preliminaries.map((pre, i) =>
    finalizeDutyMetrics(pre, pAbsBestPerDuty[i], penaltyFactor)
  );

  if (dischargeCurveMode === 'and') {
    const andResult = aggregateAndMode(finalized);
    return {
      finalScore: andResult.finalScore,
      isHidden: andResult.isHidden,
      dutiesPassedCount: finalized.filter((m) => !m.isHidden).length,
      avgPassedScore:
        finalized.length > 0
          ? finalized.reduce((sum, m) => sum + m.score, 0) /
            finalized.length
          : Infinity,
      bestDutyP_abs: 0,
      dutyMetrics: finalized
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
    dutyMetrics: finalized
  };
}
