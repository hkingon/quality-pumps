import React, { useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { ChartOptions, Legend, ScriptableLineSegmentContext } from 'chart.js';
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
import { Download, Zap } from 'lucide-react';
import { PumpData, SystemCurveData } from '@/types';
import { Badge } from '@/components/ui/badge';
import { get } from 'http';

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Filler,
  ScatterController,
  Legend
);

interface PumpCurvePoint {
  flow: number;
  head: number;
}

interface SystemCurvePoint {
  flow: number;
  head: number;
}

interface MotorPowerPoint {
  kw: number;
  flow: number;
}

interface EfficiencyPoint {
  eff: string;
  flow: string;
}

interface SegmentedPumpCurve {
  start?: PumpCurvePoint[];
  middle?: PumpCurvePoint[];
  end?: PumpCurvePoint[];
}

interface DischargeCurveChartProps {
  pumpData: PumpData[];
  dischargeSystemCurveData: SystemCurveData[];
  dischargeSystemCurvePoints: SystemCurvePoint[][];
  bepPoints: PumpCurvePoint[];
  modifiedBepPoints: PumpCurvePoint[];
  overallMaxHead: number;
  overallMaxFlow: number;
  flowUnit: string;
  headUnit: string;
  segmentedPumpCurves: SegmentedPumpCurve[];
  segmentedModifiedPumpCurves: SegmentedPumpCurve[];

  numberOfDutyPumps: number;
  segmentedCombinedPumpCurves: SegmentedPumpCurve[];
  segmentedModifiedCombinedPumpCurves: SegmentedPumpCurve[];
  combinedBepPoints: PumpCurvePoint[];
  modifiedCombinedBepPoints: PumpCurvePoint[];
}

const pumpColors = [
  '#00B8D4',
  '#43A047',
  '#F4511E',
  '#6A1B9A',
  '#AF3E3E',
  '#F564A9'
];
const dischargeColors = ['#FFD600', '#0097A7', '#8E24AA', '#D81B60'];
const motorPowerColors = ['#AB47BC', '#7B1FA2', '#4A148C', '#D81B60'];
const efficiencyColors = ['#4CAF50', '#2E7D32', '#1B5E20', '#66BB6A'];

const generateDistinctColor = (index: number): string => {
  const goldenRatio = 0.618033988749895;
  let hue = (index * goldenRatio * 360) % 360;

  if (hue >= 45 && hue <= 65) {
    hue = (hue + 30) % 360;
  }

  const saturation = 65 + (index % 3) * 10;
  const lightness = 50 + (index % 2) * 10;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

// Update the color selection in your functions
const getPumpColor = (index: number): string => {
  return generateDistinctColor(index);
};

const createChevronArrow = (color: string) => {
  const size = 24;
  const strokeWidth = 3;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d")!;
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";

  ctx.save();
  ctx.translate(size / 2, size / 2);

  ctx.beginPath();
  ctx.moveTo(-4, -6);   // top-left
  ctx.lineTo(4, 0);     // center point
  ctx.lineTo(-4, 6);    // bottom-left
  ctx.stroke();

  ctx.restore();
  return canvas;
};


export const DischargeCurveChart: React.FC<DischargeCurveChartProps> = ({
  pumpData,
  dischargeSystemCurveData,
  dischargeSystemCurvePoints,
  bepPoints,
  modifiedBepPoints,
  overallMaxHead,
  overallMaxFlow,
  flowUnit,
  headUnit,
  segmentedPumpCurves,
  segmentedModifiedPumpCurves,

  numberOfDutyPumps,
  segmentedCombinedPumpCurves,
  segmentedModifiedCombinedPumpCurves,
  combinedBepPoints,
  modifiedCombinedBepPoints
}) => {
  const datasets: any[] = [];
  const [showDataTable, setShowDataTable] = useState(false);
  const chartRef = useRef<ChartJS<'line'>>(null);

  // Helper to add segments for pump curves (P vs Q) as a single dataset
  const addSegments = (
    curves: SegmentedPumpCurve[],
    isModified: boolean,
    opacity: number,
    labelSuffix: string = ''
  ) => {
    curves.forEach((curve, index) => {
      const pumpName = pumpData[index]?.name || `Pump ${index + 1}`;
      const baseColor = getPumpColor(index);
      const labelPrefix = isModified ? `Modified ${pumpName}` : `${pumpName}`;
      const fullLabel = `${labelPrefix}${labelSuffix}`;

      const allPoints = [
        ...(curve.start || []),
        ...(curve.middle || []),
        ...(curve.end || [])
      ].sort((a, b) => a.flow - b.flow);

      if (allPoints.length > 0) {
        datasets.push({
          label: `${fullLabel} (Head)`,
          data: allPoints.map((p) => ({ x: p.flow, y: p.head })),
          // borderColor: baseColor,
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.4,
          // Apply opacity by modifying the color
          borderColor:
            opacity < 1
              ? baseColor.replace('rgb', 'rgba').replace(')', `, ${opacity})`)
              : baseColor,
          yAxisID: 'y',
          segment: {
            borderDash: (context: any) => {
              const index = context.p0DataIndex || 0;
              const points = allPoints;
              if (index < (curve.start?.length || 0)) return [4, 4]; // Start segment
              if (
                index >=
                (curve.start?.length || 0) + (curve.middle?.length || 0)
              )
                return [4, 4]; // End segment
              return []; // Middle segment (solid)
            }
          }
        });
      }
    });
  };

  const getPumpCurveMaxValues = () => {
    let maxFlow = 0;
    let maxHead = 0;

    // Include ALL curves: individual, modified, AND combined curves
    const allCurves = [
      ...segmentedPumpCurves,
      ...segmentedModifiedPumpCurves,
      ...segmentedCombinedPumpCurves, // ADD THIS
      ...segmentedModifiedCombinedPumpCurves // ADD THIS
    ];

    allCurves.forEach((curve) => {
      const allPoints = [
        ...(curve.start || []),
        ...(curve.middle || []),
        ...(curve.end || [])
      ];
      if (allPoints.length > 0) {
        const curveMaxFlow = Math.max(...allPoints.map((p) => p.flow));
        const curveMaxHead = Math.max(...allPoints.map((p) => p.head));
        maxFlow = Math.max(maxFlow, curveMaxFlow);
        maxHead = Math.max(maxHead, curveMaxHead);
      }
    });

    // Also include system curve points and BEP points
    dischargeSystemCurvePoints.forEach((points) => {
      if (points.length > 0) {
        const curveMaxFlow = Math.max(...points.map((p) => p.flow));
        const curveMaxHead = Math.max(...points.map((p) => p.head));
        maxFlow = Math.max(maxFlow, curveMaxFlow);
        maxHead = Math.max(maxHead, curveMaxHead);
      }
    });

    // Include BEP points (both individual and combined)
    const allBepPoints = [
      ...bepPoints,
      ...modifiedBepPoints,
      ...combinedBepPoints, // ADD THIS
      ...modifiedCombinedBepPoints // ADD THIS
    ];

    allBepPoints.forEach((point) => {
      if (point.flow > 0 && point.head > 0) {
        maxFlow = Math.max(maxFlow, point.flow);
        maxHead = Math.max(maxHead, point.head);
      }
    });

    return {
      maxFlow: Math.ceil(maxFlow / 10) * 10 || 100,
      maxHead: Math.ceil(maxHead / 10) * 10 || 150
    };
  };

  const { maxFlow, maxHead } = getPumpCurveMaxValues();

  // Add motor power curves
  const addMotorPowerCurves = () => {
    pumpData.forEach((pump, index) => {
      if (pump.motor_power && pump.motor_power.length > 0) {
        // Calculate speed ratio for affinity laws
        const hasSpeedChange =
          pump.currentRpm && pump.baseRpm && pump.currentRpm !== pump.baseRpm;
        const speedRatio = hasSpeedChange
          ? pump.currentRpm! / pump.baseRpm!
          : 1;
        const powerMultiplier = Math.pow(speedRatio, 3); // Power ∝ Speed³

        // Apply affinity laws to motor power data
        const sortedData = [...pump.motor_power]
          .map((point) => ({
            flow: point.flow * speedRatio, // Flow ∝ Speed
            kw: point.kw * powerMultiplier // Power ∝ Speed³
          }))
          .sort((a, b) => a.flow - b.flow);

        // Create the dataset
        datasets.push({
          label: `${pump.name} (Power${speedRatio !== 1 ? ` @ ${(speedRatio * 100).toFixed(0)}%` : ''})`,
          data: sortedData.map((point) => ({
            x: point.flow,
            y: point.kw
          })),
          borderColor: getPumpColor(index),
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.4,
          yAxisID: 'y1',
          borderDash: speedRatio !== 1 ? [5, 5] : [], // Dashed line for adjusted speed
          backgroundColor:
            speedRatio !== 1
              ? motorPowerColors[index % motorPowerColors.length] + '50'
              : motorPowerColors[index % motorPowerColors.length]
        });

        // Optionally show the original curve as reference when speed is adjusted
        if (speedRatio !== 1) {
          const originalData = [...pump.motor_power].sort(
            (a, b) => a.flow - b.flow
          );

          datasets.push({
            label: `${pump.name} (Power @ 100% - Reference)`,
            data: originalData.map((point) => ({
              x: point.flow,
              y: point.kw
            })),
            borderColor: getPumpColor(index),
            borderWidth: 1,
            pointRadius: 0,
            fill: false,
            tension: 0.4,
            yAxisID: 'y1',
            borderDash: [2, 2], // Dotted for reference
            backgroundColor: 'transparent',
            hidden: false // Show by default, user can toggle in legend
          });
        }
      }
    });
  };

  // Add efficiency curves
  const addEfficiencyCurves = () => {
    pumpData.forEach((pump, index) => {
      if (pump.efficiency && pump.efficiency.length > 0) {
        // Calculate speed ratio
        const hasSpeedChange =
          pump.currentRpm && pump.baseRpm && pump.currentRpm !== pump.baseRpm;
        const speedRatio = hasSpeedChange
          ? pump.currentRpm! / pump.baseRpm!
          : 1;

        // Efficiency curve shape remains the same, but flow values shift
        const processedData = pump.efficiency
          .map((point) => ({
            flow: parseFloat(point.flow) * speedRatio, // Adjust flow
            efficiency: parseFloat(point.eff) // Efficiency unchanged
          }))
          .filter((point) => !isNaN(point.flow) && !isNaN(point.efficiency))
          .sort((a, b) => a.flow - b.flow);

        datasets.push({
          label: `${pump.name} (Efficiency${speedRatio !== 1 ? ` @ ${(speedRatio * 100).toFixed(0)}%` : ''})`,
          data: processedData.map((point) => ({
            x: point.flow,
            y: point.efficiency
          })),
          borderColor: getPumpColor(index),
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.4,
          yAxisID: 'y1',
          borderDash: speedRatio !== 1 ? [5, 5] : []
        });
      }
    });
  };

  if (numberOfDutyPumps > 1) {
    // Show combined curves at 100% opacity (solid)
    addSegments(segmentedCombinedPumpCurves, false, 1, ' (Combined)');
    addSegments(segmentedModifiedCombinedPumpCurves, true, 1, ' (Combined)');

    // Show individual curves at 50% opacity (faded)
    addSegments(segmentedPumpCurves, false, 0.5, ' (Individual)');
    addSegments(segmentedModifiedPumpCurves, true, 0.5, ' (Individual)');
  } else {
    // Show individual curves normally at 100% opacity
    addSegments(segmentedPumpCurves, false, 1);
    addSegments(segmentedModifiedPumpCurves, true, 0.6);
  }

  // Add motor power and efficiency curves
  addMotorPowerCurves();
  addEfficiencyCurves();

  // Add discharge system curves
  dischargeSystemCurvePoints.forEach((points, index) => {
    const systemName =
      dischargeSystemCurveData[index]?.name || `Discharge System ${index + 1}`;
    datasets.push({
      label: systemName,
      data: points.map((p) => ({ x: p.flow, y: p.head })),
      borderColor: dischargeColors[index % dischargeColors.length],
      borderWidth: 2.5,
      pointRadius: 0,
      fill: false,
      tension: 0.4,
      yAxisID: 'y'
    });
  });

  // Add operating duty points for discharge system curves
  dischargeSystemCurveData.forEach((system, index) => {
    if (system.operatingFlow && system.operatingHead) {
      const systemName = system.name || `Discharge System ${index + 1}`;
      datasets.push({
        label: `${systemName} Operating Point`,
        data: [{ x: system.operatingFlow, y: system.operatingHead }],
        borderColor: dischargeColors[index % dischargeColors.length],
        backgroundColor: dischargeColors[index % dischargeColors.length],
        pointRadius: 8,
        // pointStyle: 'triangle',
        pointStyle: () =>
          createChevronArrow(dischargeColors[index % dischargeColors.length]),
        // pointRotation: 90,
        type: 'scatter',
        showLine: false,
        yAxisID: 'y'
        // legendDisplay: false
      });
    }
  });

  if (numberOfDutyPumps > 1) {
    combinedBepPoints.forEach((point, index) => {
      const pumpName = pumpData[index]?.name || `Pump ${index + 1}`;
      datasets.push({
        label: `Combined BEP ${pumpName}`,
        data: [{ x: point.flow, y: point.head }],
        borderColor: getPumpColor(index),
        backgroundColor: getPumpColor(index),
        pointRadius: 8,
        pointStyle: 'rectRot',
        type: 'scatter',
        showLine: false,
        yAxisID: 'y'
        // legendDisplay: false
      });
    });

    // Show individual BEP points with reduced opacity
    bepPoints.forEach((point, index) => {
      const pumpName = pumpData[index]?.name || `Pump ${index + 1}`;
      const color = getPumpColor(index);
      datasets.push({
        label: `Individual BEP ${pumpName}`,
        data: [{ x: point.flow, y: point.head }],
        borderColor: color.replace('rgb', 'rgba').replace(')', ', 0.5)'),
        backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.5)'),
        pointRadius: 6,
        pointStyle: 'circle',
        type: 'scatter',
        showLine: false,
        yAxisID: 'y'
        // legendDisplay: false
      });
    });
  } else {
    // Show individual BEP points normally
    bepPoints.forEach((point, index) => {
      const pumpName = pumpData[index]?.name || `Pump ${index + 1}`;
      datasets.push({
        label: `BEP ${pumpName}`,
        data: [{ x: point.flow, y: point.head }],
        borderColor: getPumpColor(index),
        backgroundColor: getPumpColor(index),
        pointRadius: 6,
        pointStyle: 'circle',
        type: 'scatter',
        showLine: false,
        yAxisID: 'y'
        // legendDisplay: false
      });
    });
  }

  // Add BEP points for pump curves
  bepPoints.forEach((point, index) => {
    const pumpName = pumpData[index]?.name || `Pump ${index + 1}`;
    datasets.push({
      label: `BEP ${pumpName}`,
      data: [{ x: point.flow, y: point.head }],
      borderColor: getPumpColor(index),
      backgroundColor: getPumpColor(index),
      pointRadius: 6,
      pointStyle: 'circle',
      type: 'scatter',
      showLine: false,
      yAxisID: 'y'
      // legendDisplay: false
    });
  });

  // Add modified BEP points for pump curves
  modifiedBepPoints.forEach((point, index) => {
    if (point.flow > 0 && point.head > 0) {
      const pumpName = pumpData[index]?.name || `Pump ${index + 1}`;
      datasets.push({
        label: `Modified BEP ${pumpName}`,
        data: [{ x: point.flow, y: point.head }],
        borderColor: getPumpColor(index),
        backgroundColor: getPumpColor(index),
        pointRadius: 6,
        pointStyle: 'triangle',
        type: 'scatter',
        showLine: false,
        yAxisID: 'y'
        // legendDisplay: false
      });
    }
  });

  const data = { datasets };

  // Calculate max values for secondary axis
  const maxPower = Math.max(
    ...pumpData
      .filter((pump) => pump.motor_power && pump.motor_power.length > 0)
      .flatMap((pump) => pump.motor_power!.map((point) => point.kw)),
    1
  );
  const maxEfficiency = Math.max(
    ...pumpData
      .filter((pump) => pump.efficiency && pump.efficiency.length > 0)
      .flatMap((pump) =>
        pump.efficiency!.map((point) => parseFloat(point.eff))
      ),
    100
  );
  // const maxSecondary = Math.max(maxPower, maxEfficiency);

  
  const getSecondaryAxisMax = () => {
    let maxPower = 0;
    let maxEfficiency = 0;

    pumpData.forEach((pump) => {
      // Calculate speed ratio
      const speedRatio =
        pump.currentRpm && pump.baseRpm ? pump.currentRpm / pump.baseRpm : 1;
      const powerMultiplier = Math.pow(speedRatio, 3);

      // Find max power considering speed adjustment
      if (pump.motor_power && pump.motor_power.length > 0) {
        const adjustedMaxPower = Math.max(
          ...pump.motor_power.map((p) => p.kw * powerMultiplier)
        );
        maxPower = Math.max(maxPower, adjustedMaxPower);
      }

      // Efficiency doesn't change with speed
      if (pump.efficiency && pump.efficiency.length > 0) {
        const pumpMaxEff = Math.max(
          ...pump.efficiency.map((e) => parseFloat(e.eff))
        );
        maxEfficiency = Math.max(maxEfficiency, pumpMaxEff);
      }
    });

    return Math.max(maxPower, maxEfficiency);
  };

  // Use this in your component:
  const maxSecondary = getSecondaryAxisMax();


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
          font: { size: 14, weight: 'bold' }
        },
        min: 0,
        max: maxFlow || 100
      },
      y: {
        type: 'linear',
        position: 'left',
        title: {
          display: true,
          text: `Head (${headUnit || 'm'})`,
          font: { size: 14, weight: 'bold' }
        },
        min: 0,
        max: maxHead || 150,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      y1: {
        type: 'linear',
        position: 'right',
        title: {
          display: true,
          text: 'Power (kW) / Efficiency (%)',
          font: { size: 14, weight: 'bold' }
        },
        min: 0,
        max: Math.ceil(maxSecondary / 10) * 10,
        grid: {
          drawOnChartArea: false // Don't overlay grid lines
        },
        ticks: {
          callback: function (value) {
            return value;
          }
        }
      }
    },
    plugins: {
      title: {
        display: true,
        text: 'Discharge Curve Analysis (PvsQ, Power, Efficiency)',
        font: { size: 18, weight: 'bold' }
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

            if (label.includes('Power')) {
              return `${label}: ${yValue.toFixed(2)} kW`;
            } else if (label.includes('Efficiency')) {
              return `${label}: ${yValue.toFixed(2)}%`;
            } else if (label.includes('Head')) {
              return `${label}: ${yValue.toFixed(2)} ${headUnit || 'm'}`;
            } else {
              return `${label}: ${yValue.toFixed(2)} ${headUnit || 'm'}`;
            }
          },
          afterBody: (tooltipItems) => {
            const context = tooltipItems[0];
            const datasetIndex = context.datasetIndex;
            const pump = pumpData[Math.floor(datasetIndex / 4)]; // Approximate pump index

            if (
              pump?.currentRpm &&
              pump?.baseRpm &&
              pump.currentRpm !== pump.baseRpm
            ) {
              const speedRatio = pump.currentRpm / pump.baseRpm;
              return [
                '',
                `Speed: ${(speedRatio * 100).toFixed(0)}% of base`,
                `RPM: ${pump.currentRpm.toFixed(0)} / ${pump.baseRpm.toFixed(0)}`
              ];
            }
            return [];
          }
        }
      },
      legend: {
        display: true,
        position: 'top',
        labels: {
          filter: (legendItem, chartData) => {
            const datasetLabel = legendItem.text;
            // Show pump curves, power, efficiency, but hide BEP and operating points from legend
            return (
              !datasetLabel.includes('BEP') &&
              !datasetLabel.includes('Operating Point')
            );
          },
          usePointStyle: true,
          boxWidth: 15,
          padding: 10,
          font: { size: 11 }
        }
      }
    }
  };

  const downloadChart = () => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = 'discharge-curve-chart.png';
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
