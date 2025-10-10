import React from 'react';
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
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface DutyPoint {
  head: number;
  flow: number;
}

interface PumpHeadFlowChartProps {
  pvsqData: DutyPoint[];
  npshrData: DutyPoint[];
  className?: string;
}

const PumpHeadFlowChart: React.FC<PumpHeadFlowChartProps> = ({
  pvsqData,
  npshrData,
  className = ''
}) => {
  // Sort data by flow for proper curve display
  const sortedPvsq = [...pvsqData].sort((a, b) => a.flow - b.flow);
  const sortedNpshr = [...npshrData].sort((a, b) => a.flow - b.flow);

  const data = {
    labels: sortedPvsq.map((point) => point.flow.toString()),
    datasets: [
      {
        label: 'Head (m)',
        data: sortedPvsq.map((point) => point.head),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: 'y'
      },
      {
        label: 'NPSHr (m)',
        data: sortedNpshr
          .map((point) => {
            // Find corresponding flow point or interpolate
            const flowPoint = sortedPvsq.find((p) => p.flow === point.flow);
            return flowPoint ? point.head : null;
          })
          .filter((val) => val !== null),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
        yAxisID: 'y1'
      }
    ]
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            size: 12,
            weight: 'normal' as const
          }
        }
      },
      title: {
        display: true,
        text: 'Pump Head vs Flow Curve',
        font: {
          size: 14,
          weight: 'bold' as const
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Flow (L/min)',
          font: {
            size: 12,
            weight: 'bold' as const
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Head (m)',
          color: 'rgb(59, 130, 246)',
          font: {
            size: 12,
            weight: 'bold' as const
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'NPSHr (m)',
          color: 'rgb(239, 68, 68)',
          font: {
            size: 12,
            weight: 'bold' as const
          }
        },
        grid: {
          drawOnChartArea: false
        }
      }
    }
  };

  if (sortedPvsq.length === 0) {
    return (
      <div
        className={`flex h-64 items-center justify-center rounded-lg bg-gray-50 ${className}`}
      >
        <p className='text-gray-500'>No pump head data available</p>
      </div>
    );
  }

  return (
    <div className={`h-64 ${className}`}>
      <Line data={data} options={options} />
    </div>
  );
};

export default PumpHeadFlowChart;
