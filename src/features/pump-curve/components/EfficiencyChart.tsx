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

interface EfficiencyPoint {
  eff: string;
  flow: string;
}

interface EfficiencyChartProps {
  efficiencyData: EfficiencyPoint[];
  className?: string;
}

const EfficiencyChart: React.FC<EfficiencyChartProps> = ({
  efficiencyData,
  className = ''
}) => {
  // Convert string data to numbers and sort by flow
  const processedData = efficiencyData
    .map((point) => ({
      flow: parseFloat(point.flow),
      efficiency: parseFloat(point.eff)
    }))
    .filter((point) => !isNaN(point.flow) && !isNaN(point.efficiency))
    .sort((a, b) => a.flow - b.flow);

  const data = {
    labels: processedData.map((point) => point.flow.toString()),
    datasets: [
      {
        label: 'Efficiency (%)',
        data: processedData.map((point) => point.efficiency),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
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
        text: 'Pump Efficiency Curve',
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
          text: 'Efficiency (%)',
          font: {
            size: 12,
            weight: 'bold' as const
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        min: 0,
        max: 100
      }
    }
  };

  if (processedData.length === 0) {
    return (
      <div
        className={`flex h-64 items-center justify-center rounded-lg bg-gray-50 ${className}`}
      >
        <p className='text-gray-500'>No efficiency data available</p>
      </div>
    );
  }

  return (
    <div className={`h-64 ${className}`}>
      <Line data={data} options={options} />
    </div>
  );
};

export default EfficiencyChart;
