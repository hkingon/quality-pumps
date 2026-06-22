'use client';

import { useMemo, useState } from 'react';
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
  SCORING_CONFIG
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
}

interface ReportData {
  capable: boolean;
  score: number;
  badge: { label: string; colorClass: string };
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
  bepFlow?: number;
  npsha?: number;
  npshr?: number;
  npshMargin?: number;
}

const num = (v: number | undefined, digits = 1): string =>
  v === undefined || !isFinite(v) ? '—' : v.toFixed(digits);

const signed = (v: number | undefined, digits = 1): string =>
  v === undefined || !isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}`;

/** Tolerant interpolation of NPSH-required at a flow (handles npsh/head/value keys). */
function npshrAtFlow(npshRequired: any[] | undefined, flow: number, r: number): number | null {
  if (!npshRequired || npshRequired.length === 0) return null;
  const pts = npshRequired
    .map((p) => ({
      flow: Number(p.flow) * r,
      npsh: Number(p.npsh ?? p.head ?? p.value ?? p.npshr)
    }))
    .filter((p) => isFinite(p.flow) && isFinite(p.npsh))
    .sort((a, b) => a.flow - b.flow);
  if (pts.length === 0) return null;
  if (flow <= pts[0].flow) return pts[0].npsh;
  if (flow >= pts[pts.length - 1].flow) return pts[pts.length - 1].npsh;
  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i].flow <= flow && pts[i + 1].flow >= flow) {
      const t = (flow - pts[i].flow) / (pts[i + 1].flow - pts[i].flow);
      return pts[i].npsh + t * (pts[i + 1].npsh - pts[i].npsh);
    }
  }
  return pts[pts.length - 1].npsh;
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
  onClose
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

  const report = useMemo<ReportData>(() => {
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

    if (!rep || result.isHidden) {
      return { capable: false, score: result.finalScore, badge };
    }

    // Required duty = matching system curve
    const dutyCurve =
      validDuties.find((d) => (d.name || 'Unnamed Duty') === rep.dutyName) ?? validDuties[0];
    const requiredFlow = dutyCurve?.operatingFlow ?? 0;
    const requiredHead = dutyCurve?.operatingHead ?? 0;

    const actualFlow = convertFlow(rep.operatingPoint.flow, pump.flowUnit, flowUnit);
    const actualHead = convertHead(rep.operatingPoint.head, pump.headUnit, headUnit);

    const flowMargin = requiredFlow > 0 ? ((actualFlow - requiredFlow) / requiredFlow) * 100 : undefined;
    const headMargin = requiredHead > 0 ? ((actualHead - requiredHead) / requiredHead) * 100 : undefined;

    // Hydraulic power = ρ·g·Q·H / 1000  (Q in m³/s, H in m)
    const qM3s = convertFlow(actualFlow, flowUnit, 'L/sec') / 1000;
    const hM = convertHead(actualHead, headUnit, 'm');
    const hydraulicKW = (SCORING_CONFIG.RHO * SCORING_CONFIG.G * qM3s * hM) / 1000;

    const absorbedKW = rep.pAbs;
    const motorSizeKw = pump.kw;
    const motorLoading =
      motorSizeKw && motorSizeKw > 0 ? absorbedKW / motorSizeKw : undefined;

    const bep = calculateBep(pump);
    const bepFlow = convertFlow(bep.bepFlow * speedRatio, pump.flowUnit, flowUnit);

    // NPSH margin (first suction system, if any)
    let npshMargin: number | undefined;
    let npsha: number | undefined;
    let npshr: number | undefined;
    if (suctionCurveData.length > 0) {
      npsha = suctionCurveData[0].operatingNpsha;
      const r = npshrAtFlow(pump.npshRequired, rep.operatingPoint.flow, speedRatio);
      if (r !== null && isFinite(npsha)) {
        npshr = r;
        npshMargin = npsha - r;
      }
    }

    return {
      capable: true,
      score: result.finalScore,
      badge,
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
      energyIntensity: energyIntensityKWhPerML(absorbedKW, actualFlow, flowUnit),
      bepFlow,
      npsha,
      npshr,
      npshMargin
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
    pAbsBestPerDuty
  ]);

  const comment = useMemo(() => {
    if (!report.capable) {
      return 'The pump cannot meet the required duty — its head at the duty flow is below the system requirement. Select a larger pump or reduce the duty.';
    }
    const parts: string[] = [];
    parts.push(
      `The pump achieves the required duty and is rated "${report.badge.label}" (score ${num(report.score, 1)}).`
    );
    if (report.bepPositionPct !== undefined) {
      const near = report.bepPositionPct >= 70 && report.bepPositionPct <= 120;
      parts.push(
        near
          ? `It operates close to BEP (${num(report.bepPositionPct, 0)}% of BEP flow).`
          : `It operates at ${num(report.bepPositionPct, 0)}% of BEP flow — outside the preferred operating range.`
      );
    }
    if (report.motorLoading !== undefined) {
      parts.push(
        report.motorLoading > 1
          ? `Warning: absorbed power exceeds the rated motor size (loading ${num(report.motorLoading * 100, 0)}%).`
          : `Motor loading is ${num(report.motorLoading * 100, 0)}% of the rated motor size.`
      );
    }
    parts.push(
      'Final selection should still be checked against the manufacturer curve, curve tolerance, liquid conditions, controls, electrical protection, and installation details.'
    );
    return parts.join(' ');
  }, [report]);

  const dutyStr = (flow?: number, head?: number) =>
    flow === undefined ? '—' : `${num(flow, 1)} ${flowUnit} @ ${num(head, 1)} ${headUnit}`;

  const tiles: { label: string; value: string }[] = report.capable
    ? [
        { label: 'Required duty', value: dutyStr(report.requiredFlow, report.requiredHead) },
        { label: 'Actual duty', value: dutyStr(report.actualFlow, report.actualHead) },
        { label: 'Efficiency', value: `${num(report.efficiencyPct, 0)}%` },
        { label: 'BEP position', value: `${num(report.bepPositionPct, 0)}%` },
        { label: 'Absorbed power', value: `${num(report.absorbedKW, 2)} kW` },
        { label: 'Motor loading', value: report.motorLoading !== undefined ? `${num(report.motorLoading * 100, 0)}%` : '—' },
        { label: 'Energy intensity', value: `${num(report.energyIntensity, 1)} kWh/ML` },
        { label: 'NPSH margin', value: report.npshMargin !== undefined ? `${num(report.npshMargin, 1)} m` : '—' }
      ]
    : [];

  const rows: { item: string; result: string }[] = report.capable
    ? [
        { item: 'Pump model', result: pump.model || pump.name || '—' },
        { item: 'Pump type', result: pump.type?.join(', ') || '—' },
        { item: 'Required duty', result: dutyStr(report.requiredFlow, report.requiredHead) },
        { item: 'Actual duty point', result: dutyStr(report.actualFlow, report.actualHead) },
        { item: 'Flow margin', result: `${signed(report.flowMargin, 1)}%` },
        { item: 'Head margin', result: `${signed(report.headMargin, 1)}%` },
        { item: 'Hydraulic power', result: `${num(report.hydraulicKW, 2)} kW` },
        { item: 'Absorbed power at duty', result: `${num(report.absorbedKW, 2)} kW` },
        { item: 'Motor size', result: report.motorSizeKw ? `${num(report.motorSizeKw, 1)} kW` : '—' },
        { item: 'Motor loading', result: report.motorLoading !== undefined ? num(report.motorLoading, 2) : '—' },
        { item: 'Efficiency', result: `${num(report.efficiencyPct, 0)}%` },
        { item: 'Energy intensity', result: `${num(report.energyIntensity, 1)} kWh/ML` },
        { item: 'BEP flow', result: `${num(report.bepFlow, 1)} ${flowUnit}` },
        { item: 'Operating point vs BEP', result: `${num(report.bepPositionPct, 0)}%` },
        { item: 'Score', result: num(report.score, 1) },
        { item: 'Suitability', result: report.badge.label },
        ...(report.npsha !== undefined
          ? [{ item: 'NPSH available', result: `${num(report.npsha, 1)} m` }]
          : []),
        ...(report.npshr !== undefined
          ? [{ item: 'NPSH required (at duty)', result: `${num(report.npshr, 1)} m` }]
          : []),
        ...(report.npshMargin !== undefined
          ? [{ item: 'NPSH margin', result: `${num(report.npshMargin, 1)} m` }]
          : [])
      ]
    : [];

  const metaFields: { key: keyof typeof meta; label: string }[] = [
    { key: 'project', label: 'Project' },
    { key: 'client', label: 'Client' },
    { key: 'location', label: 'Location' },
    { key: 'reportNumber', label: 'Report Number' },
    { key: 'preparedBy', label: 'Prepared By' },
    { key: 'date', label: 'Report Date' }
  ];

  return (
    <div className='bg-background/95 fixed inset-0 z-50 overflow-y-auto'>
      {/* Print rules: only the report container prints */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #pump-report-printable, #pump-report-printable * { visibility: visible !important; }
          #pump-report-printable { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          .pump-report-no-print { display: none !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      {/* Toolbar (not printed) */}
      <div className='pump-report-no-print bg-background sticky top-0 z-10 flex items-center justify-between border-b p-3'>
        <span className='font-semibold'>Pump Selection Detailed Report</span>
        <div className='flex gap-2'>
          <Button onClick={() => window.print()} className='cursor-pointer'>
            <Printer className='mr-2 h-4 w-4' />
            Print / Save as PDF
          </Button>
          <Button variant='outline' onClick={onClose} className='cursor-pointer'>
            <X className='mr-2 h-4 w-4' />
            Close
          </Button>
        </div>
      </div>

      <div
        id='pump-report-printable'
        className='mx-auto max-w-4xl space-y-6 bg-white p-6 text-black'
      >
        {/* Branding header */}
        <div className='flex items-center gap-4 border-b pb-4'>
          <Image src='/logo.png' alt='Quality Pumps' width={140} height={48} className='h-12 w-auto' />
          <h1 className='text-2xl font-bold'>Pump Selection Detailed Report</h1>
        </div>

        {/* Editable metadata */}
        <div className='grid grid-cols-2 gap-3 md:grid-cols-3'>
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
        {report.capable && (
          <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
            {tiles.map((t) => (
              <div key={t.label} className='rounded-lg border bg-gray-50 p-3'>
                <p className='text-xs text-gray-500'>{t.label}</p>
                <p className='text-lg font-bold text-sky-800'>{t.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Selection Summary table */}
        <div>
          <h2 className='mb-2 text-lg font-bold'>1. Selection Summary</h2>
          <table className='w-full border-collapse text-sm'>
            <thead>
              <tr className='bg-sky-700 text-left text-white'>
                <th className='border p-2'>Item</th>
                <th className='border p-2'>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.item} className={i % 2 ? 'bg-sky-50' : ''}>
                  <td className='border p-2 font-medium'>{r.item}</td>
                  <td className='border p-2'>{r.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className='mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm'>
            <span className='font-semibold'>Selection comment: </span>
            {comment}
          </div>
        </div>

        {/* Pressure vs Flow */}
        <div>
          <h2 className='mb-2 text-lg font-bold'>2. Pressure vs Flow</h2>
          <DischargeCurveChart {...dischargeChartProps} />
        </div>

        {/* NPSH */}
        <div>
          <h2 className='mb-2 text-lg font-bold'>3. NPSH and Suction Curves</h2>
          <NpshCurveChart {...npshChartProps} />
        </div>
      </div>
    </div>
  );
}
