'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer, X } from 'lucide-react';
import { DischargeCurveChart } from './discharge-curve-chart';
import { NpshCurveChart } from './npsh-curve-chart';
import type { SavedPump, SystemCurveData, SuctionCurveData } from '@/types';
import { FlowUnit, HeadUnit, convertFlow, convertHead } from '@/lib/units';
import {
  scorePumpForDuties,
  representativeDuty,
  energyIntensityKWhPerML,
  getSuitabilityBadge,
  calculateBep,
  SCORING_CONFIG,
  type DutyMetric
} from '@/lib/pump-scoring';

interface PumpReportProps {
  pump: SavedPump;
  speedRatio: number;
  dischargeSystemCurveData: SystemCurveData[];
  suctionCurveData: SuctionCurveData[];
  flowUnit: FlowUnit;
  headUnit: HeadUnit;
  dischargeCurveMode: 'and' | 'or';
  numberOfDutyPumps: number;
  pAbsBestPerDuty: number[];
  dischargeChartProps: React.ComponentProps<typeof DischargeCurveChart>;
  npshChartProps: React.ComponentProps<typeof NpshCurveChart>;
  onClose: () => void;
  isGuest?: boolean;
  onSignUpClick?: () => void;
}

const NA = 'Not Provided';

interface DutyRow {
  name: string;
  capable: boolean;
  reqFlow: number;
  reqHead: number;
  actFlow: number;
  actHead: number;
  flowMargin?: number;
  headMargin?: number;
  result: string;
  score: number;
  rqo: number;
  npshr: number | null;
  npsha: number | null;
  npshMargin: number | null;
}

interface ReportData {
  capable: boolean;
  score: number;
  badge: { label: string; colorClass: string };
  dutyRows: DutyRow[];
  bepFlow: number;
  requiredFlow?: number;
  requiredHead?: number;
  actualFlow?: number;
  actualHead?: number;
  flowMargin?: number;
  headMargin?: number;
  efficiencyPct?: number;
  bepPositionPct?: number;
  hydraulicKW?: number;
  absorbedKW?: number;
  motorSizeKw?: number;
  motorLoading?: number;
  energyIntensity?: number;
  opFlowMin?: number;
  opFlowMax?: number;
  rqoMin?: number;
  rqoMax?: number;
  porLow?: number;
  porHigh?: number;
  rangeStatus?: string;
  hasNpsh?: boolean;
  npshrMin?: number;
  npshrMax?: number;
  npshaMin?: number;
  npshaMax?: number;
  npshMarginMin?: number;
  npshStatus?: string;
  breakdown?: { item: string; pts: number; comment: string }[];
  costPerML?: number;
  estimatedCurrentAtDuty?: number;
}

const num = (v: number | undefined | null, digits = 1): string =>
  v === undefined || v === null || !isFinite(v) ? '—' : v.toFixed(digits);

const signed = (v: number | undefined, digits = 1): string =>
  v === undefined || !isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}`;

const strOr = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return NA;
  if (Array.isArray(v)) return v.length ? v.join(', ') : NA;
  return String(v);
};

/** Linear interpolation of y at x over sorted {flow,head} points (clamped). */
function interpAt(points: { flow: number; head: number }[] | undefined, x: number): number | null {
  if (!points || points.length === 0) return null;
  const pts = [...points].filter((p) => isFinite(p.flow) && isFinite(p.head)).sort((a, b) => a.flow - b.flow);
  if (pts.length === 0) return null;
  if (x <= pts[0].flow) return pts[0].head;
  if (x >= pts[pts.length - 1].flow) return pts[pts.length - 1].head;
  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i].flow <= x && pts[i + 1].flow >= x) {
      const t = (x - pts[i].flow) / (pts[i + 1].flow - pts[i].flow);
      return pts[i].head + t * (pts[i + 1].head - pts[i].head);
    }
  }
  return pts[pts.length - 1].head;
}

/** NPSH-required at a flow (pump units), tolerant of key names, scaled by speed. */
function npshrAtFlow(npshRequired: any[] | undefined, flowPumpUnits: number, r: number): number | null {
  if (!npshRequired || npshRequired.length === 0) return null;
  const pts = npshRequired
    .map((p) => ({
      flow: Number(p.flow) * r,
      head: Number(p.npsh ?? p.head ?? p.value ?? p.npshr)
    }))
    .filter((p) => isFinite(p.flow) && isFinite(p.head));
  return interpAt(pts, flowPumpUnits);
}

export function PumpReport({
  pump,
  speedRatio,
  dischargeSystemCurveData,
  suctionCurveData,
  flowUnit,
  headUnit,
  dischargeCurveMode,
  numberOfDutyPumps,
  pAbsBestPerDuty,
  dischargeChartProps,
  npshChartProps,
  onClose,
  isGuest = false,
  onSignUpClick
}: PumpReportProps) {
  const today = new Date().toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const [meta, setMeta] = useState({
    project: '',
    client: '',
    location: '',
    reportNumber: '',
    preparedBy: 'Quality Pumps - Pump Selection Tool',
    date: today
  });
  const [electricityPrice, setElectricityPrice] = useState('0.35');

  const dutyStr = (flow?: number, head?: number) =>
    flow === undefined || !isFinite(flow) ? '—' : `${num(flow, 1)} ${flowUnit} @ ${num(head, 1)} ${headUnit}`;

  const r = useMemo<ReportData>(() => {
    const validDuties = dischargeSystemCurveData.filter(
      (d) => (d.operatingFlow || 0) > 0 && (d.operatingHead || 0) > 0
    );
    const result = scorePumpForDuties(
      pump,
      validDuties,
      flowUnit,
      headUnit,
      dischargeCurveMode,
      pAbsBestPerDuty,
      numberOfDutyPumps,
      speedRatio
    );
    const rep = representativeDuty(result.dutyMetrics, dischargeCurveMode);
    const badge = getSuitabilityBadge(result.finalScore, result.isHidden);

    // BEP at current speed (display units)
    const bep = calculateBep(pump);
    const bepFlow = convertFlow(bep.bepFlow * speedRatio, pump.flowUnit, flowUnit);

    const suctionPts = npshChartProps.suctionCurvePoints?.[0];

    // Per-duty rows (Section 2) — keep order aligned with validDuties
    const dutyRows = result.dutyMetrics.map((m: DutyMetric, i) => {
      const duty = validDuties[i];
      // Per-pump required and actual flow (head is the same for parallel pumps)
      const reqFlow = (duty?.operatingFlow ?? 0) / numberOfDutyPumps;
      const reqHead = duty?.operatingHead ?? 0;
      const actFlowTotal = convertFlow(m.operatingPoint.flow, pump.flowUnit, flowUnit);
      const actFlow = actFlowTotal / numberOfDutyPumps;
      const actHead = convertHead(m.operatingPoint.head, pump.headUnit, headUnit);
      const flowMargin = reqFlow > 0 ? ((actFlow - reqFlow) / reqFlow) * 100 : undefined;
      const headMargin = reqHead > 0 ? ((actHead - reqHead) / reqHead) * 100 : undefined;
      const b = getSuitabilityBadge(m.score, m.isHidden);
      // NPSH: r evaluated at per-pump flow; a evaluated at total system flow (suction carries total Q)
      const npshr = npshrAtFlow(pump.npshRequired, m.operatingPoint.flow / numberOfDutyPumps, speedRatio);
      const npshaDisp = interpAt(suctionPts, actFlowTotal);
      const npsha = npshaDisp !== null ? convertHead(npshaDisp, headUnit, 'm') : null;
      const npshMargin = npsha !== null && npshr !== null ? npsha - npshr : null;
      return {
        name: duty?.name || `Discharge System ${i + 1}`,
        capable: !m.isHidden,
        reqFlow,
        reqHead,
        actFlow,
        actHead,
        flowMargin,
        headMargin,
        result: b.label,
        score: m.score,
        rqo: m.rqo,
        npshr,
        npsha,
        npshMargin
      };
    });

    const passedRows = dutyRows.filter((d) => d.capable);

    if (!rep || result.isHidden) {
      return { capable: false, score: result.finalScore, badge, dutyRows, bepFlow };
    }

    const dutyCurve =
      validDuties.find((d) => (d.name || 'Unnamed Duty') === rep.dutyName) ?? validDuties[0];
    // Per-pump required and actual flow/head (head is same for all parallel pumps)
    const requiredFlow = (dutyCurve?.operatingFlow ?? 0) / numberOfDutyPumps;
    const requiredHead = dutyCurve?.operatingHead ?? 0;

    const actualFlow = convertFlow(rep.operatingPoint.flow, pump.flowUnit, flowUnit) / numberOfDutyPumps;
    const actualHead = convertHead(rep.operatingPoint.head, pump.headUnit, headUnit);

    const flowMargin = requiredFlow > 0 ? ((actualFlow - requiredFlow) / requiredFlow) * 100 : undefined;
    const headMargin = requiredHead > 0 ? ((actualHead - requiredHead) / requiredHead) * 100 : undefined;

    const qM3s = convertFlow(actualFlow, flowUnit, 'L/sec') / 1000;
    const hM = convertHead(actualHead, headUnit, 'm');
    const hydraulicKW = (SCORING_CONFIG.RHO * SCORING_CONFIG.G * qM3s * hM) / 1000;

    const absorbedKW = rep.pAbs / numberOfDutyPumps;
    const motorSizeKw = pump.kw;
    const motorLoading = motorSizeKw && motorSizeKw > 0 ? absorbedKW / motorSizeKw : undefined;
    const energyIntensity = energyIntensityKWhPerML(absorbedKW, actualFlow, flowUnit);

    // Operating range (Section 3)
    const opFlows = passedRows.map((d) => d.actFlow).filter((f) => isFinite(f));
    const rqos = passedRows.map((d) => d.rqo * 100).filter((f) => isFinite(f));
    const porLow = bepFlow * SCORING_CONFIG.POR_LOW;
    const porHigh = bepFlow * SCORING_CONFIG.POR_HIGH;
    const anyOutsideAor = passedRows.some((d) => d.rqo < SCORING_CONFIG.AOR_LOW || d.rqo > SCORING_CONFIG.AOR_HIGH);

    // NPSH summary (Section 4)
    const npshrs = passedRows.map((d) => d.npshr).filter((v): v is number => v !== null);
    const npshas = passedRows.map((d) => d.npsha).filter((v): v is number => v !== null);
    const npshMargins = passedRows.map((d) => d.npshMargin).filter((v): v is number => v !== null);
    const hasNpsh = suctionCurveData.length > 0 && npshrs.length > 0 && npshas.length > 0;

    // Score breakdown (Section 5) — penalty contributions in points (sum = score)
    const C = SCORING_CONFIG;
    const breakdown = [
      { item: 'Head Margin', pts: C.W_H * rep.ph * 100, comment: 'Head at duty vs preferred head band.' },
      { item: 'Preferred Operating Range', pts: C.W_R * rep.pr * 100, comment: 'Operating flow vs BEP preferred range (70–120%).' },
      { item: 'Allowable Operating Range', pts: C.W_A * rep.pa * 100, comment: 'Excursion beyond allowable range (50–140%).' },
      { item: 'Energy', pts: C.W_E * rep.pe * 100, comment: 'Absorbed power vs the most efficient capable option.' },
      { item: 'Speed (VFD)', pts: C.W_V * rep.pv * 100, comment: 'Deviation from rated speed.' },
      { item: 'Data Confidence', pts: C.W_C * rep.pc * 100, comment: rep.pc > 0 ? 'Efficiency is estimated (no curve/power data).' : 'Efficiency derived from supplied data.' }
    ];

    const price = parseFloat(electricityPrice);
    const costPerML = isFinite(price) && price > 0 ? energyIntensity * price : undefined;

    return {
      capable: true,
      score: result.finalScore,
      badge,
      dutyRows,
      requiredFlow,
      requiredHead,
      actualFlow,
      actualHead,
      flowMargin,
      headMargin,
      efficiencyPct: rep.eta * 100,
      bepPositionPct: rep.rqo * 100,
      hydraulicKW,
      absorbedKW,
      motorSizeKw,
      motorLoading,
      energyIntensity,
      bepFlow,
      // ranges
      opFlowMin: opFlows.length ? Math.min(...opFlows) : undefined,
      opFlowMax: opFlows.length ? Math.max(...opFlows) : undefined,
      rqoMin: rqos.length ? Math.min(...rqos) : undefined,
      rqoMax: rqos.length ? Math.max(...rqos) : undefined,
      porLow,
      porHigh,
      rangeStatus: anyOutsideAor ? 'FAIL' : 'PASS',
      // npsh
      hasNpsh,
      npshrMin: npshrs.length ? Math.min(...npshrs) : undefined,
      npshrMax: npshrs.length ? Math.max(...npshrs) : undefined,
      npshaMin: npshas.length ? Math.min(...npshas) : undefined,
      npshaMax: npshas.length ? Math.max(...npshas) : undefined,
      npshMarginMin: npshMargins.length ? Math.min(...npshMargins) : undefined,
      npshStatus: npshMargins.length ? (Math.min(...npshMargins) >= 0.5 ? 'PASS' : 'FAIL') : 'N/A',
      breakdown,
      costPerML,
      estimatedCurrentAtDuty: pump.amps
    };
  }, [
    pump,
    speedRatio,
    dischargeSystemCurveData,
    suctionCurveData,
    flowUnit,
    headUnit,
    dischargeCurveMode,
    numberOfDutyPumps,
    pAbsBestPerDuty,
    npshChartProps,
    electricityPrice
  ]);

  const worstDuty = useMemo(() => {
    const passed = r.dutyRows.filter((d) => d.capable);
    if (passed.length === 0) return null;
    return passed.reduce((w, d) => (d.score > w.score ? d : w), passed[0]);
  }, [r]);

  const comment = useMemo(() => {
    if (!r.capable) {
      return 'The pump cannot meet the required duty — its head at the duty flow is below the system requirement. Select a larger pump or reduce the duty.';
    }
    const parts: string[] = [];
    parts.push(`The pump achieves the required duty and is rated "${r.badge.label}" (score ${num(r.score, 1)}).`);
    if (r.bepPositionPct !== undefined) {
      const near = r.bepPositionPct >= 70 && r.bepPositionPct <= 120;
      parts.push(
        near
          ? `It operates close to BEP (${num(r.bepPositionPct, 0)}% of BEP flow).`
          : `It operates at ${num(r.bepPositionPct, 0)}% of BEP flow — outside the preferred operating range.`
      );
    }
    if (r.motorLoading !== undefined) {
      parts.push(
        r.motorLoading > 1
          ? `Warning: absorbed power exceeds the rated motor size (loading ${num(r.motorLoading * 100, 0)}%).`
          : `Motor loading is ${num(r.motorLoading * 100, 0)}% of the rated motor size.`
      );
    }
    parts.push(
      'Final selection should still be checked against the manufacturer curve, curve tolerance, liquid conditions, controls, electrical protection, and installation details.'
    );
    return parts.join(' ');
  }, [r]);

  // Warnings (Section 10)
  const warnings = useMemo(() => {
    const w: { type: string; note: string }[] = [];
    if (!r.capable) w.push({ type: 'Capability', note: 'Pump cannot meet the required duty.' });
    if (r.rangeStatus === 'FAIL') w.push({ type: 'Operating range', note: 'One or more duties fall outside the allowable operating range.' });
    if (r.motorLoading !== undefined && r.motorLoading > 1) w.push({ type: 'Motor', note: 'Absorbed power exceeds rated motor size.' });
    if (r.hasNpsh && r.npshStatus === 'FAIL') w.push({ type: 'NPSH', note: 'NPSH margin is below 0.5 m at one or more duties.' });
    if (!r.hasNpsh) w.push({ type: 'NPSH', note: 'No suction system entered — NPSH not assessed.' });
    return w;
  }, [r]);

  const metaFields: { key: keyof typeof meta; label: string }[] = [
    { key: 'project', label: 'Project' },
    { key: 'client', label: 'Client' },
    { key: 'location', label: 'Location' },
    { key: 'reportNumber', label: 'Report Number' },
    { key: 'preparedBy', label: 'Prepared By' },
    { key: 'date', label: 'Report Date' }
  ];

  // KPI tiles (Section 1)
  const tiles = r.capable
    ? [
        { label: 'Required duty', value: dutyStr(r.requiredFlow, r.requiredHead) },
        { label: 'Actual duty', value: dutyStr(r.actualFlow, r.actualHead) },
        { label: 'Efficiency', value: `${num(r.efficiencyPct, 0)}%` },
        { label: 'BEP position', value: `${num(r.bepPositionPct, 0)}%` },
        { label: 'Absorbed power', value: `${num(r.absorbedKW, 2)} kW` },
        { label: 'Motor loading', value: r.motorLoading !== undefined ? `${num(r.motorLoading * 100, 0)}%` : '—' },
        { label: 'Energy intensity', value: `${num(r.energyIntensity, 1)} kWh/ML` },
        {
          label: 'NPSH margin',
          value: r.hasNpsh && r.npshMarginMin !== undefined ? `${num(r.npshMarginMin, 1)} m` : '—'
        }
      ]
    : [];

  // Blurs a result value for guests; clicking opens the sign-up dialog
  const BlurredValue = ({ children }: { children: React.ReactNode }) => {
    if (!isGuest) return <>{children}</>;
    return (
      <span
        className='inline-block cursor-pointer select-none blur-sm'
        onClick={() => onSignUpClick?.()}
        title='Create a free account to view this'
      >
        {children}
      </span>
    );
  };

  const Th = ({ children }: { children: React.ReactNode }) => (
    <th className='border border-gray-300 bg-sky-700 p-2 text-left text-white'>{children}</th>
  );
  const Row = ({ label, value, i }: { label: string; value: string; i: number }) => (
    <tr className={i % 2 ? 'bg-sky-50' : ''}>
      <td className='border border-gray-300 p-2 font-medium'>{label}</td>
      <td className='border border-gray-300 p-2'>
        <BlurredValue>{value}</BlurredValue>
      </td>
    </tr>
  );

  // VSD compatibility from traits
  const vsdCompatible = pump.otherTraits?.some((t) => /vfd|vsd/i.test(t)) ? 'Yes' : NA;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className='pump-report-portal bg-background/95 fixed inset-0 z-50 overflow-y-auto'>
      <style>{`
        @media print {
          /* Hide the whole app; show only this report portal */
          body > *:not(.pump-report-portal) { display: none !important; }
          .pump-report-portal {
            position: static !important;
            overflow: visible !important;
            background: #fff !important;
            display: block !important;
          }
          .pump-report-no-print { display: none !important; }
          #pump-report-printable {
            position: static !important;
            overflow: visible !important;
            max-width: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Hide interactive buttons (e.g. chart "Download") inside the report */
          #pump-report-printable button { display: none !important; }
          .report-section { break-inside: avoid; }
          .report-page-break { break-before: page; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      {/* Toolbar (not printed) */}
      <div className='pump-report-no-print bg-background sticky top-0 z-10 flex items-center justify-between border-b p-3'>
        <span className='font-semibold'>Pump Selection Detailed Report</span>
        <div className='flex items-center gap-3'>
          {!isGuest && (
            <label className='text-muted-foreground flex items-center gap-1 text-sm'>
              Electricity $/kWh
              <Input
                value={electricityPrice}
                onChange={(e) => setElectricityPrice(e.target.value)}
                className='h-8 w-20'
              />
            </label>
          )}
          {isGuest ? (
            <Button onClick={onSignUpClick} className='cursor-pointer'>
              <Printer className='mr-2 h-4 w-4' />
              Sign Up to Print
            </Button>
          ) : (
            <Button onClick={() => window.print()} className='cursor-pointer'>
              <Printer className='mr-2 h-4 w-4' />
              Print / Save as PDF
            </Button>
          )}
          <Button variant='outline' onClick={onClose} className='cursor-pointer'>
            <X className='mr-2 h-4 w-4' />
            Close
          </Button>
        </div>
      </div>

      {/* Guest unlock banner */}
      {isGuest && (
        <div className='pump-report-no-print sticky top-[57px] z-10 flex items-center justify-between border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm'>
          <span className='text-blue-800'>
            🔒 Create a free account to unlock the full report — analysis values are blurred below.
          </span>
          <Button size='sm' className='ml-4 shrink-0' onClick={onSignUpClick}>
            Create Free Account
          </Button>
        </div>
      )}

      <div
        id='pump-report-printable'
        className='mx-auto max-w-4xl space-y-8 bg-white p-6 text-black'
      >
        {/* Branding header */}
        <div className='report-section flex items-center gap-4 border-b pb-4'>
          <Image src='/logo.png' alt='Quality Pumps' width={140} height={48} className='h-12 w-auto' />
          <h1 className='text-2xl font-bold'>Pump Selection Detailed Report</h1>
        </div>

        {/* Metadata */}
        <div className='report-section grid grid-cols-2 gap-3 md:grid-cols-3'>
          {metaFields.map((f) => (
            <div key={f.key} className='space-y-1'>
              <label className='text-xs font-semibold text-gray-600'>{f.label}</label>
              <Input
                value={meta[f.key]}
                onChange={(e) => setMeta((m) => ({ ...m, [f.key]: e.target.value }))}
                className='h-8 text-black'
              />
            </div>
          ))}
        </div>

        {/* KPI tiles */}
        {r.capable && (
          <div className='report-section grid grid-cols-2 gap-3 md:grid-cols-4'>
            {tiles.map((t) => (
              <div key={t.label} className='rounded-lg border bg-gray-50 p-3'>
                <p className='text-xs text-gray-500'>{t.label}</p>
                <p className='text-lg font-bold text-sky-800'>
                  <BlurredValue>{t.value}</BlurredValue>
                </p>
              </div>
            ))}
          </div>
        )}

        {/* 1. Selection Summary */}
        <section className='report-section'>
          <h2 className='mb-2 text-lg font-bold'>1. Selection Summary</h2>
          <table className='w-full border-collapse text-sm'>
            <thead>
              <tr>
                <Th>Item</Th>
                <Th>Result</Th>
              </tr>
            </thead>
            <tbody>
              {[
                { l: 'Pump model', v: strOr(pump.model || pump.name) },
                { l: 'Pump type', v: strOr(pump.type) },
                { l: 'Required duty', v: dutyStr(r.requiredFlow, r.requiredHead) },
                { l: 'Actual duty point', v: dutyStr(r.actualFlow, r.actualHead) },
                { l: 'Flow margin', v: `${signed(r.flowMargin)}%` },
                { l: 'Head margin', v: `${signed(r.headMargin)}%` },
                { l: 'Hydraulic power', v: `${num(r.hydraulicKW, 2)} kW` },
                { l: 'Absorbed power at duty', v: `${num(r.absorbedKW, 2)} kW` },
                { l: 'Motor size', v: r.motorSizeKw ? `${num(r.motorSizeKw, 1)} kW` : NA },
                { l: 'Motor loading', v: r.motorLoading !== undefined ? num(r.motorLoading, 2) : '—' },
                { l: 'Efficiency', v: `${num(r.efficiencyPct, 0)}%` },
                { l: 'Energy intensity', v: `${num(r.energyIntensity, 1)} kWh/ML` },
                { l: 'BEP flow', v: `${num(r.bepFlow, 1)} ${flowUnit}` },
                { l: 'Operating point vs BEP', v: `${num(r.bepPositionPct, 0)}%` },
                { l: 'Score', v: num(r.score, 1) },
                { l: 'Suitability', v: r.badge.label }
              ].map((row, i) => (
                <Row key={row.l} label={row.l} value={row.v} i={i} />
              ))}
            </tbody>
          </table>
          <div className='mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm'>
            <span className='font-semibold'>Selection comment: </span>
            {comment}
          </div>
        </section>

        {/* 2. Pump Performance Curve vs System Curves */}
        <section className='report-section report-page-break'>
          <h2 className='mb-2 text-lg font-bold'>2. Pump Performance Curve vs System Curves</h2>
          <DischargeCurveChart {...dischargeChartProps} />
          <table className='mt-3 w-full border-collapse text-sm'>
            <thead>
              <tr>
                <Th>System</Th>
                <Th>Required Duty</Th>
                <Th>Actual Operating Point</Th>
                <Th>Flow Margin</Th>
                <Th>Head Margin</Th>
                <Th>Result</Th>
                <Th>Score</Th>
              </tr>
            </thead>
            <tbody>
              {r.dutyRows.map((d, i) => (
                <tr key={d.name} className={i % 2 ? 'bg-sky-50' : ''}>
                  <td className='border border-gray-300 p-2'>{d.name}</td>
                  <td className='border border-gray-300 p-2'>{dutyStr(d.reqFlow, d.reqHead)}</td>
                  <td className='border border-gray-300 p-2'>
                    <BlurredValue>{d.capable ? dutyStr(d.actFlow, d.actHead) : 'Not capable'}</BlurredValue>
                  </td>
                  <td className='border border-gray-300 p-2'>
                    <BlurredValue>{d.capable ? `${signed(d.flowMargin)}%` : '—'}</BlurredValue>
                  </td>
                  <td className='border border-gray-300 p-2'>
                    <BlurredValue>{d.capable ? `${signed(d.headMargin)}%` : '—'}</BlurredValue>
                  </td>
                  <td className='border border-gray-300 p-2'>
                    <BlurredValue>{d.result}</BlurredValue>
                  </td>
                  <td className='border border-gray-300 p-2'>
                    <BlurredValue>{num(d.score, 0)}</BlurredValue>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {worstDuty && (
            <p className='mt-2 text-sm'>
              <span className='font-semibold'>Worst Duty:</span> {worstDuty.name}. Limiting factor:{' '}
              {worstDuty.headMargin !== undefined && worstDuty.headMargin < 5
                ? 'highest required head.'
                : 'tightest operating margin.'}
            </p>
          )}
        </section>

        {/* 3. BEP and Operating Range Check */}
        {r.capable && (
        <section className='report-section'>
          <h2 className='mb-2 text-lg font-bold'>3. BEP and Operating Range Check</h2>
          <table className='w-full border-collapse text-sm'>
            <thead>
              <tr>
                <Th>Item</Th>
                <Th>Value</Th>
              </tr>
            </thead>
            <tbody>
              {[
                { l: 'BEP flow', v: `${num(r.bepFlow, 1)} ${flowUnit}` },
                {
                  l: 'Actual operating flow',
                  v:
                    r.opFlowMin !== undefined
                      ? `${num(r.opFlowMin, 1)} to ${num(r.opFlowMax, 1)} ${flowUnit}`
                      : '—'
                },
                {
                  l: 'Operating point vs BEP',
                  v: r.rqoMin !== undefined ? `${num(r.rqoMin, 1)}% to ${num(r.rqoMax, 1)}%` : '—'
                },
                {
                  l: 'Preferred operating range',
                  v: `${num(r.porLow, 1)} to ${num(r.porHigh, 1)} ${flowUnit}`
                },
                { l: 'Preferred flow range', v: '70–120% of BEP' },
                { l: 'Operating range status', v: r.rangeStatus ?? '—' }
              ].map((row, i) => (
                <Row key={row.l} label={row.l} value={row.v} i={i} />
              ))}
            </tbody>
          </table>
        </section>
        )}

        {/* 4. NPSH Curve and Suction Check */}
        <section className='report-section report-page-break'>
          <h2 className='mb-2 text-lg font-bold'>4. NPSH Curve and Suction Check</h2>
          <NpshCurveChart {...npshChartProps} />
          <table className='mt-3 w-full border-collapse text-sm'>
            <thead>
              <tr>
                <Th>Item</Th>
                <Th>Value</Th>
              </tr>
            </thead>
            <tbody>
              {r.hasNpsh
                ? [
                    { l: 'NPSHr at duty', v: `${num(r.npshrMin, 1)} to ${num(r.npshrMax, 1)} m` },
                    { l: 'NPSHa at duty', v: `${num(r.npshaMin, 1)} to ${num(r.npshaMax, 1)} m` },
                    {
                      l: 'NPSH margin',
                      v: r.npshMarginMin !== undefined ? `${num(r.npshMarginMin, 1)} m (min)` : '—'
                    },
                    { l: 'NPSH status', v: r.npshStatus ?? 'N/A' }
                  ].map((row, i) => <Row key={row.l} label={row.l} value={row.v} i={i} />)
                : [
                    { l: 'NPSHr at duty', v: NA },
                    { l: 'NPSHa at duty', v: 'No suction system entered' },
                    { l: 'NPSH margin', v: '—' },
                    { l: 'NPSH status', v: 'N/A' }
                  ].map((row, i) => <Row key={row.l} label={row.l} value={row.v} i={i} />)}
            </tbody>
          </table>
        </section>

        {/* 5. Score Breakdown */}
        {r.capable && r.breakdown && (
          <section className='report-section report-page-break'>
            <h2 className='mb-2 text-lg font-bold'>5. Score Breakdown</h2>
            <div className='space-y-2'>
              {r.breakdown.map((b) => {
                const pct = Math.max(0, Math.min(100, 100 - b.pts));
                return (
                  <div key={b.item} className='flex items-center gap-2 text-sm'>
                    <span className='w-48 shrink-0 text-right'>{b.item}</span>
                    <div className='h-4 flex-1 rounded bg-gray-100'>
                      <BlurredValue>
                        <div className='h-4 rounded bg-sky-500' style={{ width: `${pct}%` }} />
                      </BlurredValue>
                    </div>
                    <span className='w-12 text-right'>
                      <BlurredValue>{num(pct, 0)}%</BlurredValue>
                    </span>
                  </div>
                );
              })}
            </div>
            <table className='mt-3 w-full border-collapse text-sm'>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th>Penalty (pts)</Th>
                  <Th>Comment</Th>
                </tr>
              </thead>
              <tbody>
                {r.breakdown.map((b, i) => (
                  <tr key={b.item} className={i % 2 ? 'bg-sky-50' : ''}>
                    <td className='border border-gray-300 p-2 font-medium'>{b.item}</td>
                    <td className='border border-gray-300 p-2'>{num(b.pts, 2)}</td>
                    <td className='border border-gray-300 p-2'>{b.comment}</td>
                  </tr>
                ))}
                <tr className='bg-green-100 font-bold'>
                  <td className='border border-gray-300 p-2'>Total</td>
                  <td className='border border-gray-300 p-2'>{num(r.score, 2)}</td>
                  <td className='border border-gray-300 p-2'>{r.badge.label}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {/* 6. Power, Efficiency, and Energy Use */}
        <section className='report-section report-page-break'>
          <h2 className='mb-2 text-lg font-bold'>6. Power, Efficiency, and Energy Use</h2>
          <table className='w-full border-collapse text-sm'>
            <thead>
              <tr>
                <Th>Item</Th>
                <Th>Value</Th>
              </tr>
            </thead>
            <tbody>
              {[
                { l: 'Hydraulic power', v: `${num(r.hydraulicKW, 2)} kW` },
                { l: 'Pump absorbed power', v: `${num(r.absorbedKW, 2)} kW` },
                { l: 'Motor rated power', v: r.motorSizeKw ? `${num(r.motorSizeKw, 1)} kW` : NA },
                { l: 'Motor loading', v: r.motorLoading !== undefined ? `${num(r.motorLoading * 100, 1)}%` : '—' },
                { l: 'Pump efficiency*', v: `${num(r.efficiencyPct, 0)}%` },
                { l: 'Energy intensity**', v: `${num(r.energyIntensity, 1)} kWh/ML` },
                { l: 'Electricity price assumption', v: `$${electricityPrice}/kWh` },
                { l: 'Estimated cost per ML', v: r.costPerML !== undefined ? `$${num(r.costPerML, 2)}` : '—' },
                { l: 'Assumed runtime', v: NA },
                { l: 'Estimated annual energy use', v: 'N/A' },
                { l: 'Estimated annual energy cost', v: 'N/A' }
              ].map((row, i) => (
                <Row key={row.l} label={row.l} value={row.v} i={i} />
              ))}
            </tbody>
          </table>
          <p className='mt-1 text-xs text-gray-500'>*Efficiency may be estimated where curve data is missing.</p>
          <p className='text-xs text-gray-500'>**Motor efficiency is not included; confirm with the manufacturer.</p>
        </section>

        {/* 7. Electrical Data */}
        <section className='report-section'>
          <h2 className='mb-2 text-lg font-bold'>7. Electrical Data</h2>
          <table className='w-full border-collapse text-sm'>
            <tbody>
              {[
                ['Voltage', pump.voltage ? `${pump.voltage} V` : NA, 'Phase', strOr(pump.phases)],
                ['Frequency', pump.hz ? `${pump.hz} Hz` : NA, 'Motor size', pump.kw ? `${pump.kw} kW` : NA],
                ['Full-load current', pump.amps ? `${pump.amps} A` : NA, 'Estimated current at duty', r.estimatedCurrentAtDuty ? `${num(r.estimatedCurrentAtDuty, 0)} A` : NA],
                ['Starting method', NA, 'VSD compatible', vsdCompatible],
                ['Max starts/hr', NA, 'Duty rating', NA],
                ['IP rating', NA, 'Insulation', NA]
              ].map((row, i) => (
                <tr key={row[0]} className={i % 2 ? 'bg-sky-50' : ''}>
                  <td className='border border-gray-300 p-2 font-medium'>{row[0]}</td>
                  <td className='border border-gray-300 p-2'>{row[1]}</td>
                  <td className='border border-gray-300 p-2 font-medium'>{row[2]}</td>
                  <td className='border border-gray-300 p-2'>{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 8. Pump Construction Data */}
        <section className='report-section'>
          <h2 className='mb-2 text-lg font-bold'>8. Pump Construction Data</h2>
          <table className='w-full border-collapse text-sm'>
            <tbody>
              {[
                ['Pump type', strOr(pump.type)],
                ['Impeller type', strOr(pump.impellerType)],
                ['Configuration', strOr(pump.configuration)],
                ['Solids passage', NA],
                ['Inlet size', pump.inlet ? `${pump.inlet} mm` : NA],
                ['Outlet size', pump.outlet ? `${pump.outlet} mm` : NA],
                ['Materials', NA],
                ['Mechanical seal', NA],
                ['RPM', strOr(pump.rpm)],
                ['Min / Max temp', pump.minTemp || pump.maxTemp ? `${strOr(pump.minTemp)} / ${strOr(pump.maxTemp)} °C` : NA],
                ['Cable length', NA],
                ['Pump weight', NA],
                ['Installation type', NA]
              ].map((row, i) => (
                <Row key={row[0]} label={row[0]} value={row[1]} i={i} />
              ))}
            </tbody>
          </table>
        </section>

        {/* 9. System Curve Inputs */}
        <section className='report-section report-page-break'>
          <h2 className='mb-2 text-lg font-bold'>9. System Curve Inputs</h2>
          <table className='w-full border-collapse text-sm'>
            <thead>
              <tr>
                <Th>Item</Th>
                {dischargeSystemCurveData.map((s, i) => (
                  <Th key={s.id}>{s.name || `Discharge System ${i + 1}`}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { l: 'Static head', get: (s: SystemCurveData) => `${num(s.staticHead, 1)} ${headUnit}` },
                { l: 'Pipe material', get: (s: SystemCurveData) => strOr(s.components?.[0]?.material) },
                { l: 'Pipe size', get: (s: SystemCurveData) => strOr(s.components?.[0]?.nominalSize) },
                { l: 'Pipe internal diameter', get: (s: SystemCurveData) => (s.components?.[0]?.diameter ? `${s.components[0].diameter} mm` : NA) },
                { l: 'Rising main length', get: (s: SystemCurveData) => (s.components?.[0]?.length ? `${s.components[0].length} m` : NA) },
                { l: 'Friction method', get: (s: SystemCurveData) => (s.components?.[0]?.cValue ? 'Hazen-Williams' : NA) },
                { l: 'Hazen-Williams C value', get: (s: SystemCurveData) => strOr(s.components?.[0]?.cValue) },
                { l: 'Required design flow', get: (s: SystemCurveData) => `${num(s.operatingFlow, 1)} ${flowUnit}` },
                { l: 'Total dynamic head', get: (s: SystemCurveData) => `${num(s.operatingHead, 1)} ${headUnit}` },
                { l: 'Fluid', get: () => 'Water' },
                { l: 'Fluid density', get: () => '1000 kg/m³' }
              ].map((row, i) => (
                <tr key={row.l} className={i % 2 ? 'bg-sky-50' : ''}>
                  <td className='border border-gray-300 p-2 font-medium'>{row.l}</td>
                  {dischargeSystemCurveData.map((s) => (
                    <td key={s.id} className='border border-gray-300 p-2'>
                      {row.get(s)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 10. Warnings and Design Notes */}
        <section className='report-section'>
          <h2 className='mb-2 text-lg font-bold'>10. Warnings and Design Notes</h2>
          <table className='w-full border-collapse text-sm'>
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Note</Th>
              </tr>
            </thead>
            <tbody>
              {warnings.length === 0 ? (
                <Row label='None' value='None' i={0} />
              ) : (
                warnings.map((w, i) => <Row key={w.type + i} label={w.type} value={w.note} i={i} />)
              )}
            </tbody>
          </table>
        </section>

        {/* 11. Assumptions and Limitations */}
        <section className='report-section'>
          <h2 className='mb-2 text-lg font-bold'>11. Assumptions and Limitations</h2>
          <ul className='list-disc space-y-1 pl-6 text-sm'>
            <li>Actual operating point is calculated from the intersection of the pump curve and system curve.</li>
            <li>Energy cost is estimated using the entered electricity rate; runtime is not assumed.</li>
            <li>Friction losses use the selected friction method and entered pipe data.</li>
            <li>Pump efficiency may be estimated where manufacturer data is unavailable; motor efficiency is not included.</li>
            <li>Final selection should be checked against site conditions, power supply, liquid type, control method, installation arrangement, and relevant standards.</li>
            <li>This report does not replace project-specific engineering certification where required.</li>
          </ul>
        </section>

        {/* 12. Final Recommendation */}
        <section className='report-section report-page-break'>
          <h2 className='mb-2 text-lg font-bold'>12. Final Recommendation</h2>
          <div className='rounded-md border border-green-200 bg-green-50 p-3 text-sm'>
            <p className='font-semibold'>Recommended selection: {pump.model || pump.name}</p>
            <p className='mt-1'>{comment}</p>
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}
