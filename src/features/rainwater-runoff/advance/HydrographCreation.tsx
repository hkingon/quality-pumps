'use client';

import { useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { HydrographDataPoint } from './index';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Table as TableIcon } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface HydrographCreationProps {
  hydrographData: HydrographDataPoint[];
  timeOfConcentration: number | null;
  rainfallEvent: string;
  selectedDuration: number;
  selectedIntensity: number;
  catchmentArea: number;
  runOffCoeff: number;
  csvFileName: string;
}

export default function HydrographCreation({
  hydrographData,
  timeOfConcentration,
  rainfallEvent,
  selectedDuration,
  selectedIntensity,
  catchmentArea,
  runOffCoeff,
  csvFileName
}: HydrographCreationProps) {
  const [showDataTable, setShowDataTable] = useState(false);
  const chartRef = useRef<ChartJS<'line'>>(null);

  // Format data for Chart.js
  const chartData = {
    labels: hydrographData.map((point) => `${point.time} min`),
    datasets: [
      {
        label: 'Runoff Flow Rate (m³/hr)',
        data: hydrographData.map((point) => point.flowRate),
        fill: {
          target: 'origin',
          above: 'rgba(53, 162, 235, 0.2)' // Fill color above the line
        },
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 0,
      }
    ]
  };

  // Chart options
  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const
      },
      title: {
        display: true,
        text: 'Stormwater Runoff Hydrograph',
        font: {
          size: 16
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function (context) {
            return `Flow: ${context.parsed.y.toFixed(2)} m³/hr`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Time (minutes)'
        },
        grid: {
          display: true,
          drawOnChartArea: true,
          drawTicks: true
        }
      },
      y: {
        title: {
          display: true,
          text: 'Flow Rate (m³/hr)'
        },
        beginAtZero: true
      }
    }
  };

  // Download chart as an image
  const downloadChart = () => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = 'stormwater-hydrograph.png';
      link.href = chartRef.current.toBase64Image();
      link.click();
    }
  };

  // Calculate the peak flow and total volume
  // const peakFlow = Math.max(...hydrographData.map(point => point.flowRate));
  const intensityAtTc = selectedIntensity;
  const peakFlow = (intensityAtTc / 1000) * catchmentArea * runOffCoeff;

  // Calculate total volume under the curve (m³)
  const totalVolume = hydrographData.reduce((volume, point, index) => {
    if (index === 0) return 0;

    const prevPoint = hydrographData[index - 1];
    const timeStep = (point.time - prevPoint.time) / 60; // Convert to hours
    const avgFlow = (point.flowRate + prevPoint.flowRate) / 2;

    return volume + avgFlow * timeStep;
  }, 0);

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <Card>
          <CardContent className='pt-6'>
            <h4 className='mb-2 font-medium'>Input Parameters</h4>
            <dl className='grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
              <dt className='text-muted-foreground'>Rainfall Event:</dt>
              <dd>{rainfallEvent}</dd>

              <dt className='text-muted-foreground'>CSV Data Source:</dt>
              <dd className='truncate' title={csvFileName}>
                {csvFileName}
              </dd>

              <dt className='text-muted-foreground'>Selected Duration:</dt>
              <dd>{selectedDuration} minutes</dd>

              <dt className='text-muted-foreground'>Rainfall Intensity:</dt>
              <dd>{selectedIntensity} mm/hr</dd>

              <dt className='text-muted-foreground'>Catchment Area:</dt>
              <dd>{catchmentArea} m²</dd>

              <dt className='text-muted-foreground'>Time of Concentration:</dt>
              <dd>{timeOfConcentration} minutes</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='pt-6'>
            <h4 className='mb-2 font-medium'>Hydrograph Results</h4>
            <dl className='grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
              <dt className='text-muted-foreground'>Peak Flow Rate:</dt>
              <dd>{peakFlow.toFixed(2)} m³/hr</dd>

              <dt className='text-muted-foreground'>Time to Peak:</dt>
              <dd>{timeOfConcentration} minutes</dd>

              <dt className='text-muted-foreground'>Total Runoff Volume:</dt>
              <dd>{totalVolume.toFixed(2)} m³</dd>

              <dt className='text-muted-foreground'>Data Points:</dt>
              <dd>{hydrographData.length}</dd>

              <dt className='text-muted-foreground'>Runoff Coefficient:</dt>
              {/* <dd>0.9 (assumed)</dd> */}
              <dd>{runOffCoeff || 0}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className='relative h-96'>
        <Line data={chartData} options={chartOptions} ref={chartRef} />
      </div>

      <div className='flex flex-wrap gap-2'>
        <Button
          variant='outline'
          size='sm'
          onClick={downloadChart}
          className='flex cursor-pointer items-center gap-1'
        >
          <Download className='h-4 w-4' />
          Download Chart
        </Button>

        <Button
          variant='outline'
          size='sm'
          onClick={() => setShowDataTable(!showDataTable)}
          className='flex cursor-pointer items-center gap-1'
        >
          <TableIcon className='h-4 w-4' />
          {showDataTable ? 'Hide Data Table' : 'Show Data Table'}
        </Button>
      </div>

      {showDataTable && (
        <div className='max-h-96 overflow-y-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time (min)</TableHead>
                <TableHead>Flow Rate (m³/hr)</TableHead>
                <TableHead>Phase</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hydrographData.map((point, index) => {
                let phase = 'Rising';
                if (timeOfConcentration && point.time >= timeOfConcentration) {
                  phase = point.time <= selectedDuration ? 'Peak' : 'Falling';
                }

                return (
                  <TableRow key={index}>
                    <TableCell>{point.time}</TableCell>
                    <TableCell>{point.flowRate.toFixed(3)}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          phase === 'Rising'
                            ? 'bg-blue-100 text-blue-800'
                            : phase === 'Peak'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {phase}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Card className='border-blue-200 bg-blue-50'>
        <CardContent className='pt-4'>
          <h4 className='mb-2 font-medium text-blue-900'>
            About This Hydrograph
          </h4>
          <p className='text-sm text-blue-800'>
            This hydrograph was generated using intensity-duration data from
            your uploaded CSV file. The peak flow occurs at the time of
            concentration ({timeOfConcentration} minutes), representing the
            worst-case scenario when the entire catchment contributes to runoff
            simultaneously.
          </p>
          <p className='mt-2 text-sm text-blue-800'>
            <strong>Note:</strong> A runoff coefficient of {runOffCoeff} was
            applied, assuming minimal infiltration. Adjust this value based on
            your specific catchment characteristics for more accurate results.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
