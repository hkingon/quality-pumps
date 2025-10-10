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
}

const pumpColors = [
  '#00B8D4',
  '#43A047',
  '#F4511E',
  '#6A1B9A',
  '#AF3E3E',
  '#F564A9'
];
const suctionColors = [
  '#FF6B35',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD'
];

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
  segmentedModifiedNpshCurves
}) => {
  const [showBepPoints, setShowBepPoints] = useState(true);
  const [showModifiedCurves, setShowModifiedCurves] = useState(true);
  const [showSuctionCurves, setShowSuctionCurves] = useState(true);
  const chartRef = useRef<ChartJS<'line'>>(null);

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
      const baseColor = pumpColors[index % pumpColors.length];
      const labelPrefix = isModified
        ? `${pumpName} NPSHr (Modified)`
        : `${pumpName} NPSHr`;

      // Start segment (typically lower efficiency zone)
      if (curve.start && curve.start.length > 0) {
        datasets.push({
          label: `${labelPrefix} - Start`,
          data: curve.start.map((p) => ({ x: p.flow, y: p.head })),
          borderColor: baseColor,
          // borderDash: [4, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.4,
          globalAlpha: opacity
        });
      }

      // Middle segment (BEP zone - highlighted)
      if (curve.middle && curve.middle.length > 0) {
        datasets.push({
          label: `${labelPrefix} - BEP Zone`,
          data: curve.middle.map((p) => ({ x: p.flow, y: p.head })),
          borderColor: baseColor,
          borderWidth: 3,
          pointRadius: 0,
          fill: false,
          tension: 0.4,
          globalAlpha: opacity
        });
      }

      // End segment (higher flow zone)
      if (curve.end && curve.end.length > 0) {
        datasets.push({
          label: `${labelPrefix} - End`,
          data: curve.end.map((p) => ({ x: p.flow, y: p.head })),
          borderColor: baseColor,
          // borderDash: [4, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.4,
          globalAlpha: opacity
        });
      }
    });
  };

  // Add original NPSH Required curves
  addSegments(segmentedNpshCurves, false, 1);

  // Add modified NPSH Required curves
  addSegments(segmentedModifiedNpshCurves, true, 0.6);

  // Add suction system curves (NPSH Available)
  if (showSuctionCurves) {
    suctionCurvePoints.forEach((points, index) => {
      const suctionName = `NPSH Available ${index + 1}`;
      datasets.push({
        label: suctionName,
        data: points.map((p) => ({ x: p.flow, y: p.head })),
        borderColor: suctionColors[index % suctionColors.length],
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
        tension: 0.4,
        borderDash: [8, 4] // Dashed line to distinguish from NPSH Required
      });
    });
  }

  // Add BEP points for original curves
  // if (showBepPoints) {
  //   npshBepPoints.forEach((point, index) => {
  //     if (point.flow > 0 && point.head >= 0) {
  //       const pump = pumpData[index];
  //       const pumpName =
  //         `${pump?.brand || ''} ${pump?.model || ''}`.trim() ||
  //         `Pump ${index + 1}`;
  //       datasets.push({
  //         label: `${pumpName} NPSHr BEP`,
  //         data: [{ x: point.flow, y: point.head }],
  //         borderColor: pumpColors[index % pumpColors.length],
  //         backgroundColor: pumpColors[index % pumpColors.length],
  //         pointRadius: 8,
  //         pointStyle: 'circle',
  //         type: 'scatter',
  //         showLine: false
  //       });
  //     }
  //   });

  //   // Add BEP points for modified curves
  //   if (showModifiedCurves) {
  //     modifiedNpshBepPoints.forEach((point, index) => {
  //       if (point.flow > 0 && point.head >= 0) {
  //         const pump = pumpData[index];
  //         const pumpName =
  //           `${pump?.brand || ''} ${pump?.model || ''}`.trim() ||
  //           `Pump ${index + 1}`;
  //         datasets.push({
  //           label: `${pumpName} NPSHr BEP (Modified)`,
  //           data: [{ x: point.flow, y: point.head }],
  //           borderColor: pumpColors[index % pumpColors.length],
  //           backgroundColor: pumpColors[index % pumpColors.length],
  //           pointRadius: 6,
  //           pointStyle: 'triangle',
  //           type: 'scatter',
  //           showLine: false
  //         });
  //       }
  //     });
  //   }
  // }

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
        grid: {
          display: true,
          color: 'rgba(0,0,0,0.1)'
        }
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
        grid: {
          display: true,
          color: 'rgba(0,0,0,0.1)'
        }
      }
    },
    plugins: {
      title: {
        display: true,
        text: 'NPSH Curve Analysis',
        font: { size: 18 }
      },
      legend: {
        display: false
      },
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
      <Line ref={chartRef} data={data} options={options} />

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
