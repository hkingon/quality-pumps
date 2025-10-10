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

interface MotorPowerPoint {
  kw: number;
  flow: number;
}

interface MotorPowerChartProps {
  motorPowerData: MotorPowerPoint[];
  className?: string;
}

const MotorPowerChart: React.FC<MotorPowerChartProps> = ({
  motorPowerData,
  className = ''
}) => {
  // Sort data by flow for proper curve display
  const sortedData = [...motorPowerData].sort((a, b) => a.flow - b.flow);

  const data = {
    labels: sortedData.map((point) => point.flow.toString()),
    datasets: [
      {
        label: 'Motor Power (kW)',
        data: sortedData.map((point) => point.kw),
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true
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
        text: 'Motor Power Curve',
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
        display: true,
        title: {
          display: true,
          text: 'Power (kW)',
          font: {
            size: 12,
            weight: 'bold' as const
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        min: 0
      }
    }
  };

  if (sortedData.length === 0) {
    return (
      <div
        className={`flex h-64 items-center justify-center rounded-lg bg-gray-50 ${className}`}
      >
        <p className='text-gray-500'>No motor power data available</p>
      </div>
    );
  }

  return (
    <div className={`h-64 ${className}`}>
      <Line data={data} options={options} />
    </div>
  );
};

export default MotorPowerChart;
