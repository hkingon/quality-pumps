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
import { Button } from './ui/button';
import { Download } from 'lucide-react';
import { SystemCurveData } from '@/types';

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
  pumpData: any[]; // Adjust type as needed
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
  segmentedModifiedPumpCurves
}) => {
  const datasets: any[] = [];
  const [showDataTable, setShowDataTable] = useState(false);
  const chartRef = useRef<ChartJS<'line'>>(null);

  // Helper to add segments
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

  // Add original and modified pump curves
  addSegments(segmentedPumpCurves, false, 1);
  addSegments(segmentedModifiedPumpCurves, true, 0.6);

  // Add system curves
  systemCurvePoints.forEach((points, index) => {
    const systemName =
      systemCurveData[index]?.name || `System Curve ${index + 1}`;
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

  // Add operating duty points for system curves
  systemCurveData.forEach((system, index) => {
    if (system.operatingFlow && system.operatingHead) {
      const systemName = system.name || `System Curve ${index + 1}`;
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

  // Add modified BEP points
  // modifiedBepPoints.forEach((point, index) => {
  //   datasets.push({
  //     label: `Modified BEP ${index + 1}`,
  //     data: [{ x: point.flow, y: point.head }],
  //     borderColor: pumpColors[index % pumpColors.length],
  //     backgroundColor: pumpColors[index % pumpColors.length],
  //     pointRadius: 6,
  //     pointStyle: 'circle',
  //     type: 'scatter',
  //     showLine: false,
  //     borderOpacity: 0.6,
  //   });
  // });

  const data = {
    datasets
  };

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
          text: `Flow (${flowUnit || 'gpm'})`
        },
        min: 0,
        max: overallMaxFlow || 150
      },
      y: {
        type: 'linear',
        position: 'left',
        title: {
          display: true,
          text: `Head (${headUnit || 'ft'})`
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
        text: 'Pump Curve Chart',
        font: {
          size: 28
        }
      },
      tooltip: {
        callbacks: {
          title: (tooltipItems) => {
            const item = tooltipItems[0];
            return `Flow: ${item.parsed.x.toFixed(2)} ${flowUnit || 'gpm'}`;
          },
          label: (context) => {
            const label = context.dataset.label || '';
            const yValue = context.parsed.y;
            return `${label}: ${yValue.toFixed(2)} ${headUnit || 'ft'}`;
          }
        }
      }
    }
  };

  const downloadChart = () => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = 'pump-curve-chart.png';
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
