'use client';

import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  CategoryScale
} from 'chart.js';
import { Line } from 'react-chartjs-2';

import { Card } from '@/components/ui/card';

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  CategoryScale
);

export interface DutyPoint {
  head: number;
  flow: number;
}

interface PumpCurveChartProps {
  data: DutyPoint[];
}

const PumpCurveChart: React.FC<PumpCurveChartProps> = ({ data }) => {
  const sortedData = data
    .filter((d) => d.head && d.flow)
    .sort((a, b) => a.flow - b.flow);

  const chartData = {
    labels: sortedData.map((d) => d.flow),
    datasets: [
      {
        label: 'Head vs Flow',
        data: sortedData.map((d) => d.head),
        fill: false,
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f6',
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Flow (L/min)'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Head (m)'
        },
        beginAtZero: true
      }
    }
  };

  if (sortedData.length === 0) {
    return <p className='text-sm text-gray-500'>No P vs Q data available</p>;
  }

  return (
    <Card className='p-4'>
      <h3 className='mb-2 text-lg font-semibold'>Head vs. Flow Curve</h3>
      <Line data={chartData} options={chartOptions} />
    </Card>
  );
};

export default PumpCurveChart;
