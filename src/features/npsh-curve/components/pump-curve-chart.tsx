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
  Legend,
  Filler,
  ScatterController
} from 'chart.js';
import { Download } from 'lucide-react';
import { SystemCurveData } from '@/types';
import { Button } from '@/components/ui/button';

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Legend,
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

interface SegmentedPumpCurve {
  start?: PumpCurvePoint[];
  middle?: PumpCurvePoint[];
  end?: PumpCurvePoint[];
}

interface PumpCurveChartProps {
  pumpData: any[];
  systemCurvePoints: SystemCurvePoint[][];
  systemCurveData: SystemCurveData[];
  bepPoints: PumpCurvePoint[];
  modifiedBepPoints: PumpCurvePoint[];
  overallMaxHead: number;
  overallMaxFlow: number;
  flowUnit: string;
  headUnit: string;
  segmentedPumpCurves: SegmentedPumpCurve[];
  segmentedModifiedPumpCurves: SegmentedPumpCurve[];
  activeTab: 'discharge' | 'suction';
  npshCurvePoints?: PumpCurvePoint[][];
}

const pumpColors = [
  '#00B8D4',
  '#43A047',
  '#F4511E',
  '#6A1B9A',
  '#AF3E3E',
  '#F564A9'
];
const systemColors = ['#FFD600', '#0097A7', '#8E24AA', '#D81B60'];
const npshColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];

export const PumpCurveChart: React.FC<PumpCurveChartProps> = ({
  pumpData,
  systemCurvePoints,
  systemCurveData,
  bepPoints,
  modifiedBepPoints,
  overallMaxHead,
  overallMaxFlow,
  flowUnit,
  headUnit,
  segmentedPumpCurves,
  segmentedModifiedPumpCurves,
  activeTab,
  npshCurvePoints = []
}) => {
  const datasets: any[] = [];
  const chartRef = useRef<ChartJS<'line'>>(null);

  const addSegments = (
    curves: SegmentedPumpCurve[],
    isModified: boolean,
    opacity: number
  ) => {
    curves.forEach((curve, index) => {
      const pumpName = pumpData[index]?.name || `Pump ${index + 1}`;
      const baseColor = pumpColors[index % pumpColors.length];
      const labelPrefix = isModified ? `Modified ${pumpName}` : pumpName;

      if (curve.start && curve.start.length > 0) {
        datasets.push({
          label: `${labelPrefix} Start`,
          data: curve.start.map((p) => ({ x: p.flow, y: p.head })),
          borderColor: baseColor,
          borderDash: [4, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.4,
          borderOpacity: opacity
        });
      }

      if (curve.middle && curve.middle.length > 0) {
        datasets.push({
          label: `${labelPrefix} Mid`,
          data: curve.middle.map((p) => ({ x: p.flow, y: p.head })),
          borderColor: baseColor,
          borderWidth: 3,
          pointRadius: 0,
          fill: false,
          tension: 0.4,
          borderOpacity: opacity
        });
      }

      if (curve.end && curve.end.length > 0) {
        datasets.push({
          label: `${labelPrefix} End`,
          data: curve.end.map((p) => ({ x: p.flow, y: p.head })),
          borderColor: baseColor,
          borderDash: [4, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.4,
          borderOpacity: opacity
        });
      }
    });
  };

  // Add pump curves
  addSegments(segmentedPumpCurves, false, 1);
  addSegments(segmentedModifiedPumpCurves, true, 0.6);

  // Add NPSH curves for pumps when in suction mode
  if (activeTab === 'suction' && npshCurvePoints.length > 0) {
    npshCurvePoints.forEach((points, index) => {
      const pumpName = pumpData[index]?.name || `Pump ${index + 1}`;
      datasets.push({
        label: `${pumpName} NPSH Required`,
        data: points.map((p) => ({ x: p.flow, y: p.head })),
        borderColor: npshColors[index % npshColors.length],
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
        tension: 0.4,
        borderDash: [2, 2]
      });
    });
  }

  // Add system curves
  systemCurvePoints.forEach((points, index) => {
    const systemName =
      systemCurveData[index]?.name ||
      `${activeTab === 'suction' ? 'NPSH' : 'System'} Curve ${index + 1}`;
    datasets.push({
      label: systemName,
      data: points.map((p) => ({ x: p.flow, y: p.head })),
      borderColor: systemColors[index % systemColors.length],
      borderWidth: 2.5,
      pointRadius: 0,
      fill: false,
      tension: 0.4
    });
  });

  // Add operating points
  systemCurveData.forEach((system, index) => {
    if (system.operatingFlow && system.operatingHead) {
      const systemName =
        system.name ||
        `${activeTab === 'suction' ? 'NPSH' : 'System'} Curve ${index + 1}`;
      datasets.push({
        label: `${systemName} Operating Point`,
        data: [{ x: system.operatingFlow, y: system.operatingHead }],
        borderColor: systemColors[index % systemColors.length],
        backgroundColor: systemColors[index % systemColors.length],
        pointRadius: 8,
        pointStyle: 'circle',
        type: 'scatter',
        showLine: false
      });
    }
  });

  // Add BEP points
  bepPoints.forEach((point, index) => {
    const pumpName = pumpData[index]?.name || `Pump ${index + 1}`;
    datasets.push({
      label: `BEP ${pumpName}`,
      data: [{ x: point.flow, y: point.head }],
      borderColor: pumpColors[index % pumpColors.length],
      backgroundColor: pumpColors[index % pumpColors.length],
      pointRadius: 6,
      pointStyle: 'circle',
      type: 'scatter',
      showLine: false
    });
  });

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
          text: `Flow (${flowUnit || 'L/min'})`
        },
        min: 0,
        max: overallMaxFlow || 150
      },
      y: {
        type: 'linear',
        position: 'left',
        title: {
          display: true,
          text:
            activeTab === 'suction'
              ? `NPSH (${headUnit || 'm'})`
              : `Head (${headUnit || 'm'})`
        },
        min: 0,
        max: overallMaxHead || 150
      }
    },
    plugins: {
      legend: {
        display: false,
        position: 'top'
      },
      title: {
        display: true,
        text:
          activeTab === 'suction' ? 'NPSH Curves Chart' : 'Pump Curve Chart',
        font: { size: 18 }
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
            const unit =
              activeTab === 'suction' && label.includes('NPSH')
                ? headUnit || 'm'
                : headUnit || 'm';
            return `${label}: ${yValue.toFixed(2)} ${unit}`;
          }
        }
      }
    }
  };

  const downloadChart = () => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = `${activeTab}-curve-chart.png`;
      link.href = chartRef.current.toBase64Image();
      link.click();
    }
  };

  return (
    <>
      <Line ref={chartRef} data={data} options={options} />
      <Button
        onClick={downloadChart}
        className='flex cursor-pointer items-center gap-1'
        disabled={segmentedPumpCurves.length === 0}
        variant='outline'
        size='sm'
      >
        <Download className='h-4 w-4' />
        Download Chart
      </Button>
    </>
  );
};
