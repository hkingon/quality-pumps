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
  ChartOptions,
  Filler
} from 'chart.js';
import { HydrographDataPoint } from './index';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Info } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PumpComparisonProps {
  hydrographData: HydrographDataPoint[];
  pumpFlowRate: number;
  setPumpFlowRate: (value: number) => void;
  detentionVolume: number | null;
  handlePumpComparison: () => void;
  selectedIntensity: number;
  catchmentArea: number;
  runOffCoeff: number;
}

export default function PumpComparison({
  hydrographData,
  pumpFlowRate,
  setPumpFlowRate,
  detentionVolume,
  handlePumpComparison,
  selectedIntensity,
  catchmentArea,
  runOffCoeff
}: PumpComparisonProps) {
  const chartRef = useRef<ChartJS<'line'>>(null);
  const [error, setError] = useState<string | null>(null);

  // Format data for Chart.js with pump capacity line
  const chartData = {
    labels: hydrographData.map((point) => `${point.time} min`),
    datasets: [
      {
        label: 'Runoff Flow Rate (m³/hr)',
        data: hydrographData.map((point) => point.flowRate),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        tension: 0.3,
        pointRadius: 0
      },
      {
        label: 'Pump Capacity (m³/hr)',
        data: Array(hydrographData.length).fill(pumpFlowRate),
        borderColor: 'rgb(255, 99, 132)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
      }
    ]
  };

  // Format detention area data (area between hydrograph and pump capacity)
  if (detentionVolume !== null && detentionVolume > 0) {
    chartData.datasets.push({
      label: 'Detention Required',
      data: hydrographData.map((point) =>
        point.flowRate > pumpFlowRate ? point.flowRate : pumpFlowRate
      ),
      borderColor: 'rgba(255, 99, 132, 0)',
      backgroundColor: 'rgba(255, 99, 132, 0.3)',
      pointRadius: 0,
      fill: {
        target: 1,
        above: 'rgba(255, 99, 132, 0.3)'
      }
    } as any);
  }

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
        text: 'Pump Capacity vs. Stormwater Runoff',
        font: {
          size: 16
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Time (minutes)'
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
      link.download = 'pump-comparison.png';
      link.href = chartRef.current.toBase64Image();
      link.click();
    }
  };

  // Validate and handle pump flow rate change
  const handlePumpFlowRateChange = (value: number) => {
    setPumpFlowRate(value);
    setError(null);
  };

  // Validate and calculate detention volume
  const calculateDetention = () => {
    if (!pumpFlowRate || pumpFlowRate <= 0) {
      setError('Pump flow rate must be greater than 0');
      return;
    }

    handlePumpComparison();
  };

  // Peak flow from the hydrograph
  // const peakFlow = Math.max(...hydrographData.map(point => point.flowRate));
  const intensityAtTc = selectedIntensity;
  const peakFlow = (intensityAtTc / 1000) * catchmentArea * runOffCoeff;

  return (
    <div className='space-y-4'>
      <div className='mb-4 grid grid-cols-1 gap-4 md:grid-cols-2'>
        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='pumpFlowRate'>Pump Flow Rate (m³/hr)</Label>
            <Input
              id='pumpFlowRate'
              type='number'
              value={pumpFlowRate || ''}
              onChange={(e) =>
                handlePumpFlowRateChange(parseFloat(e.target.value) || 0)
              }
              placeholder='Enter pump flow rate'
              step='0.1'
            />
            {error && <p className='text-destructive text-sm'>{error}</p>}
          </div>

          <div className='text-muted-foreground text-sm'>
            <p>
              <strong>Peak Runoff Flow Rate:</strong> {peakFlow.toFixed(2)}{' '}
              m³/hr
            </p>
            <p>
              For zero detention, pump capacity should meet or exceed peak flow
              rate.
            </p>
          </div>

          <Button
            onClick={calculateDetention}
            className='w-full cursor-pointer'
          >
            Calculate Detention Volume
          </Button>
        </div>

        {detentionVolume !== null && (
          <Card
            className={
              'border-blue-500 bg-blue-500/10'
            }
          >
            <CardHeader className='pb-2'>
              <CardTitle>Detention Requirement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-3xl font-bold'>
                {detentionVolume.toFixed(2)} m³
              </div>
              <p className='mt-2 text-sm'>
                {detentionVolume > 0
                  ? 'Required detention volume based on pump capacity vs. runoff flow rate'
                  : 'No detention required - pump capacity exceeds peak runoff flow rate'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className='relative h-96'>
        <Line data={chartData} options={chartOptions} ref={chartRef} />
      </div>

      <div className='flex gap-2'>
        <Button
          variant='outline'
          size='sm'
          onClick={downloadChart}
          className='flex cursor-pointer items-center gap-1'
        >
          <Download className='h-4 w-4' />
          Download Chart
        </Button>
      </div>

      <Accordion type='single' collapsible className='w-full'>
        <AccordionItem value='explanation'>
          <AccordionTrigger className='text-sm'>
            <div className='flex items-center gap-2'>
              <Info className='h-4 w-4' />
              How Detention Volume is Calculated
            </div>
          </AccordionTrigger>
          <AccordionContent className='text-muted-foreground text-sm'>
            <p>
              Detention volume is calculated by finding the area between the
              runoff hydrograph curve and the pump capacity line, where the
              runoff exceeds the pump capacity.
            </p>
            <ol className='mt-2 list-inside list-decimal space-y-1'>
              <li>
                At each time step, we measure how much the runoff flow exceeds
                the pump capacity
              </li>
              <li>
                We multiply this excess flow by the time interval to get a
                volume
              </li>
              <li>
                We sum these volumes across all time steps to get the total
                detention volume required
              </li>
            </ol>
            <p className='mt-2'>
              This represents the minimum storage volume needed to temporarily
              hold water when runoff exceeds the pump&apos;s ability to remove
              it.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
