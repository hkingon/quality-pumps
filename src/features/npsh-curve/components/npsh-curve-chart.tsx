import React, { useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { ChartOptions } from 'chart.js';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Filler,
  ScatterController
} from 'chart.js';
import { Button } from '@/components/ui/button';
import { Download, Eye, EyeOff } from 'lucide-react';
import { SystemCurveData, SuctionCurveData } from '@/types';
import { getPumpColor } from '@/lib/pump-colors';

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Filler,
  ScatterController
);

interface PumpCurvePoint {
  flow: number;
  head: number;
}

interface SystemCurvePoint {
  flow: number;
  head: number;
}

interface SuctionCurvePoint {
  flow: number;
  head: number;
}

interface SegmentedPumpCurve {
  start?: PumpCurvePoint[];
  middle?: PumpCurvePoint[];
  end?: PumpCurvePoint[];
}

interface NpshCurveChartProps {
  pumpData: any[];
  suctionCurveData: SuctionCurveData[];
  suctionCurvePoints: SuctionCurvePoint[][];
  npshBepPoints: PumpCurvePoint[];
  modifiedNpshBepPoints: PumpCurvePoint[];
  overallMaxNpsh: number;
  overallMinNpsh: number;
  overallMaxFlow: number;
  flowUnit: string;
  headUnit: string;
  segmentedNpshCurves: SegmentedPumpCurve[];
  segmentedModifiedNpshCurves: SegmentedPumpCurve[];
  /** Per-pump operating flows (in flowUnit). Index matches pumpData. */
  operatingFlows?: number[];
}

const suctionColors = [
  '#FF6B35',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD'
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lerpAt(
  points: { flow: number; head: number }[],
  x: number
): number {
  if (points.length === 0) return 0;
  const sorted = [...points].sort((a, b) => a.flow - b.flow);
  if (x <= sorted[0].flow) return sorted[0].head;
  if (x >= sorted[sorted.length - 1].flow) return sorted[sorted.length - 1].head;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (a.flow <= x && b.flow >= x) {
      const t = (x - a.flow) / (b.flow - a.flow);
      return a.head + t * (b.head - a.head);
    }
  }
  return sorted[sorted.length - 1].head;
}

function flattenCurve(
  curve: SegmentedPumpCurve
): { flow: number; head: number }[] {
  return [
    ...(curve.start || []),
    ...(curve.middle || []),
    ...(curve.end || [])
  ].sort((a, b) => a.flow - b.flow);
}

/**
 * Returns the flow where NPSHa first drops below NPSHr (safe → risk crossing),
 * or null if they never cross within the data range.
 */
function findCriticalFlow(
  npshrPts: { flow: number; head: number }[],
  npshaPoints: { flow: number; head: number }[]
): number | null {
  if (npshrPts.length < 2 || npshaPoints.length < 2) return null;

  const allFlows = [
    ...npshrPts.map((p) => p.flow),
    ...npshaPoints.map((p) => p.flow)
  ].sort((a, b) => a - b);

  const minFlow = allFlows[0];
  const maxFlow = allFlows[allFlows.length - 1];
  const STEPS = 400;

  let prevDiff: number | null = null;
  let prevFlow = minFlow;

  for (let i = 0; i <= STEPS; i++) {
    const flow = minFlow + ((maxFlow - minFlow) * i) / STEPS;
    const npshr = lerpAt(npshrPts, flow);
    const npsha = lerpAt(npshaPoints, flow);
    const diff = npsha - npshr; // positive = safe, negative = cavitation zone

    if (prevDiff !== null && prevDiff > 0 && diff <= 0) {
      // Linear interpolation for the precise crossing
      const t = prevDiff / (prevDiff - diff);
      return prevFlow + t * (flow - prevFlow);
    }
    prevDiff = diff;
    prevFlow = flow;
  }
  return null;
}

interface CavInfo {
  pumpIdx: number;
  color: string;
  operatingFlow: number;
  hasCavitationRisk: boolean;
  criticalFlow: number | null;
  npshrPts: { flow: number; head: number }[];
  npshaPoints: { flow: number; head: number }[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const NpshCurveChart: React.FC<NpshCurveChartProps> = ({
  pumpData,
  suctionCurveData,
  suctionCurvePoints,
  npshBepPoints,
  modifiedNpshBepPoints,
  overallMaxNpsh,
  overallMinNpsh,
  overallMaxFlow,
  flowUnit,
  headUnit,
  segmentedNpshCurves,
  segmentedModifiedNpshCurves,
  operatingFlows
}) => {
  const [showBepPoints, setShowBepPoints] = useState(true);
  const [showModifiedCurves, setShowModifiedCurves] = useState(true);
  const [showSuctionCurves, setShowSuctionCurves] = useState(true);
  const chartRef = useRef<ChartJS<'line'>>(null);

  // ------------------------------------------------------------------
  // Cavitation analysis
  // ------------------------------------------------------------------
  // Use the first suction (NPSHa) curve for the intersection calculation.
  const primaryNpshaPoints: { flow: number; head: number }[] =
    suctionCurvePoints[0] ?? [];

  const cavitationData: CavInfo[] = (operatingFlows ?? []).map(
    (operatingFlow, idx) => {
      const color = getPumpColor(idx);
      const curve = segmentedNpshCurves[idx];

      if (!operatingFlow || !curve) {
        return {
          pumpIdx: idx,
          color,
          operatingFlow,
          hasCavitationRisk: false,
          criticalFlow: null,
          npshrPts: [],
          npshaPoints: []
        };
      }

      const npshrPts = flattenCurve(curve);

      // Direct check: is NPSHa < NPSHr at the operating point?
      const npshrAtOp = lerpAt(npshrPts, operatingFlow);
      const npshaAtOp =
        primaryNpshaPoints.length > 0
          ? lerpAt(primaryNpshaPoints, operatingFlow)
          : Infinity;
      const hasCavitationRisk =
        primaryNpshaPoints.length > 0 && npshaAtOp < npshrAtOp;

      // Find crossover for the fill region; if no crossover, use leftmost data flow.
      const crossover =
        primaryNpshaPoints.length > 0
          ? findCriticalFlow(npshrPts, primaryNpshaPoints)
          : null;
      const criticalFlow =
        crossover ??
        (hasCavitationRisk
          ? Math.min(
              npshrPts[0]?.flow ?? operatingFlow,
              primaryNpshaPoints[0]?.flow ?? operatingFlow
            )
          : null);

      return {
        pumpIdx: idx,
        color,
        operatingFlow,
        hasCavitationRisk,
        criticalFlow,
        npshrPts,
        npshaPoints: primaryNpshaPoints
      };
    }
  );

  const hasCavitationRisk = cavitationData.some((d) => d.hasCavitationRisk);

  // ------------------------------------------------------------------
  // Custom Chart.js plugin — operating-flow line + cavitation fill
  // ------------------------------------------------------------------
  // Store latest cavitation data in a ref so the stable plugin closure
  // always reads fresh values without needing to recreate the plugin object.
  const cavDataRef = useRef<CavInfo[]>([]);
  cavDataRef.current = cavitationData;

  const cavitationPlugin = useRef({
    id: 'npshCavitation',
    afterDraw(chart: any) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales?.x || !scales?.y) return;

      ctx.save();

      for (const info of cavDataRef.current) {
        if (!info.operatingFlow) continue;

        const opXPx = scales.x.getPixelForValue(info.operatingFlow);
        if (opXPx < chartArea.left || opXPx > chartArea.right) continue;

        // Vertical dashed line at operating flow
        ctx.beginPath();
        ctx.strokeStyle = info.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 4]);
        ctx.moveTo(opXPx, chartArea.top);
        ctx.lineTo(opXPx, chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        // Red cavitation-risk fill
        if (
          info.hasCavitationRisk &&
          info.criticalFlow !== null &&
          info.npshaPoints.length > 0 &&
          info.npshrPts.length > 0
        ) {
          const STEPS = 80;
          const startFlow = info.criticalFlow;
          const endFlow = info.operatingFlow;

          ctx.beginPath();
          ctx.fillStyle = 'rgba(220, 38, 38, 0.35)';

          // Move to intersection point (NPSHr ≈ NPSHa there)
          const startNpshr = lerpAt(info.npshrPts, startFlow);
          ctx.moveTo(
            scales.x.getPixelForValue(startFlow),
            scales.y.getPixelForValue(startNpshr)
          );

          // Trace NPSHr from startFlow → endFlow (upper boundary: NPSHr > NPSHa in risk zone)
          for (let i = 0; i <= STEPS; i++) {
            const flow = startFlow + ((endFlow - startFlow) * i) / STEPS;
            const npshr = lerpAt(info.npshrPts, flow);
            ctx.lineTo(
              scales.x.getPixelForValue(flow),
              scales.y.getPixelForValue(npshr)
            );
          }

          // Trace NPSHa from endFlow → startFlow (lower boundary)
          for (let i = STEPS; i >= 0; i--) {
            const flow = startFlow + ((endFlow - startFlow) * i) / STEPS;
            const npsha = lerpAt(info.npshaPoints, flow);
            ctx.lineTo(
              scales.x.getPixelForValue(flow),
              scales.y.getPixelForValue(npsha)
            );
          }

          ctx.closePath();
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }).current;

  // ------------------------------------------------------------------
  // Datasets
  // ------------------------------------------------------------------
  const datasets: any[] = [];

  const addSegments = (
    curves: SegmentedPumpCurve[],
    isModified: boolean,
    opacity: number
  ) => {
    if (!showModifiedCurves && isModified) return;

    curves.forEach((curve, index) => {
      if (index >= pumpData.length) return;

      const pump = pumpData[index];
      const pumpName =
        `${pump.brand || ''} ${pump.model || ''}`.trim() || `${pump.name}`;
      const baseColor = getPumpColor(index);
      const labelPrefix = isModified
        ? `${pumpName} NPSHr (Modified)`
        : `${pumpName} NPSHr`;

      if (curve.start && curve.start.length > 0) {
        datasets.push({
          label: `${labelPrefix} - Start`,
          data: curve.start.map((p) => ({ x: p.flow, y: p.head })),
          borderColor: baseColor,
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0,
          globalAlpha: opacity
        });
      }

      if (curve.middle && curve.middle.length > 0) {
        datasets.push({
          label: `${labelPrefix} - BEP Zone`,
          data: curve.middle.map((p) => ({ x: p.flow, y: p.head })),
          borderColor: baseColor,
          borderWidth: 3,
          pointRadius: 0,
          fill: false,
          tension: 0,
          globalAlpha: opacity
        });
      }

      if (curve.end && curve.end.length > 0) {
        datasets.push({
          label: `${labelPrefix} - End`,
          data: curve.end.map((p) => ({ x: p.flow, y: p.head })),
          borderColor: baseColor,
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0,
          globalAlpha: opacity
        });
      }
    });
  };

  addSegments(segmentedNpshCurves, false, 1);
  addSegments(segmentedModifiedNpshCurves, true, 0.6);

  if (showSuctionCurves) {
    suctionCurvePoints.forEach((points, index) => {
      datasets.push({
        label: `NPSH Available ${index + 1}`,
        data: points.map((p) => ({ x: p.flow, y: p.head })),
        borderColor: suctionColors[index % suctionColors.length],
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
        tension: 0,
        borderDash: [8, 4]
      });
    });
  }

  const data = { datasets };

  const options: ChartOptions<'line'> = {
    responsive: true,
    interaction: {
      mode: 'nearest',
      intersect: false
    },
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        title: {
          display: true,
          text: `Flow (${flowUnit || 'L/min'})`,
          font: { size: 14 }
        },
        min: 0,
        max: overallMaxFlow || 100,
        grid: { display: true, color: 'rgba(0,0,0,0.1)' }
      },
      y: {
        type: 'linear',
        position: 'left',
        title: {
          display: true,
          text: `NPSH (${headUnit || 'm'})`,
          font: { size: 14 }
        },
        min: 0,
        max: overallMaxNpsh || 20,
        grid: { display: true, color: 'rgba(0,0,0,0.1)' }
      }
    },
    plugins: {
      title: {
        display: true,
        text: 'NPSH Curve Analysis',
        font: { size: 18 }
      },
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (tooltipItems) => {
            const item = tooltipItems[0];
            return `Flow: ${item.parsed.x.toFixed(2)} ${flowUnit || 'L/min'}`;
          },
          label: (context) => {
            const label = context.dataset.label || '';
            const yValue = context.parsed.y;
            return `${label}: ${yValue.toFixed(2)} ${headUnit || 'm'}`;
          }
        }
      }
    }
  };

  const downloadChart = () => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = 'npsh-curve-chart.png';
      link.href = chartRef.current.toBase64Image();
      link.click();
    }
  };

  if (
    segmentedNpshCurves.length === 0 ||
    segmentedNpshCurves.every(
      (curve) =>
        (!curve.start || curve.start.length === 0) &&
        (!curve.middle || curve.middle.length === 0) &&
        (!curve.end || curve.end.length === 0)
    )
  ) {
    return (
      <div className='flex h-64 items-center justify-center text-gray-500'>
        <div className='text-center'>
          <p className='text-lg font-medium'>No NPSH Required Data Available</p>
          <p className='text-sm'>
            This pump does not have NPSH Required curve data
          </p>
          <p className='mt-2 text-xs'>
            Contact the manufacturer for NPSH specifications
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {hasCavitationRisk && (
        <div className='mb-3 flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700'>
          ⚠ Cavitation Risk — Operating point exceeds NPSHa/NPSHr crossover
        </div>
      )}

      <Line
        ref={chartRef}
        data={data}
        options={options}
        plugins={[cavitationPlugin]}
      />

      <Button
        onClick={downloadChart}
        className='flex cursor-pointer items-center gap-1'
        disabled={segmentedNpshCurves.length === 0}
        variant='outline'
        size='sm'
      >
        <Download className='h-4 w-4' />
        Download Chart
      </Button>

      {pumpData.length > 0 && (
        <div className='mt-2 text-sm text-gray-600'>
          <p>
            <strong>Note:</strong> Solid lines show NPSH Required curves, dashed
            lines show NPSH Available curves.
          </p>
          <p>
            The pump operates safely when NPSH Available greater than NPSH
            Required at all flow rates.
          </p>
        </div>
      )}
    </>
  );
};
