// src/components/Dashboard/Growth.js
import React, { useMemo } from "react";
import { useInvestmentGrowthData } from "./useInvestmentGrowthData.js";
import { useAssetRowsOptimized } from "../../hooks/useAssetRowsOptimized.js";
import { 
  BarChart3, 
  Activity,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartDataLabels,
);

const formatINR = (value) =>
  `₹${(Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const abbreviateINR = (value) => {
  const abs = Math.abs(value || 0);
  if (abs >= 1_00_00_000) {
    return `₹${(value / 1_00_00_000).toFixed(1)} Cr`;
  }
  if (abs >= 1_00_000) {
    return `₹${(value / 1_00_000).toFixed(1)} L`;
  }
  if (abs >= 1_000) {
    return `₹${(value / 1_000).toFixed(1)} K`;
  }
  return formatINR(value);
};

const formatINRWithSuffix = (value) => {
  const abs = Math.abs(value || 0);
  if (abs >= 1_00_00_000) {
    return `₹${(value / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (abs >= 1_00_000) {
    return `₹${(value / 1_00_000).toFixed(1)} L`;
  }
  if (abs >= 1_000) {
    return `₹${(value / 1_000).toFixed(2)} K`;
  }
  return formatINR(value);
};

const Growth = ({ masked = false, isTrialMode = false }) => {
  const { loading: growthLoading, error: growthError, labels: resLabels, yearBreakdowns } = useInvestmentGrowthData();
  const { summary: backendTotals, loading: rowsLoading } = useAssetRowsOptimized();

  const loading = growthLoading || rowsLoading;

  const labels = useMemo(() => (resLabels ? [...resLabels].sort((a, b) => b - a) : []), [resLabels]);
  const investedData = useMemo(() => 
    labels.map(year => yearBreakdowns?.combined?.get?.(year)?.invested || 0), 
    [labels, yearBreakdowns]
  );

  const chartData = useMemo(() => ({
    labels: labels,
    datasets: [
      {
        label: "Net Investment",
        data: investedData,
        borderColor: "#8b5cf6",
        backgroundColor: "rgba(139, 92, 246, 0.1)",
        borderWidth: 3,
        pointRadius: 4,
        pointBackgroundColor: "#8b5cf6",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        tension: 0.4,
        fill: true,
      },
    ],
  }), [labels, investedData]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(17, 24, 39, 0.95)",
        titleColor: "#9ca3af",
        bodyColor: "#fff",
        bodyFont: { weight: "600", size: 14 },
        padding: 12,
        cornerRadius: 12,
        borderColor: "rgba(75, 85, 99, 0.3)",
        borderWidth: 1,
        displayColors: false,
        callbacks: {
          label: (context) => `Investment: ${formatINR(context.parsed.y)}`,
        },
      },
      datalabels: {
        display: !masked,
        anchor: "end",
        align: "top",
        color: "#94a3b8",
        offset: 8,
        font: {
          size: 11,
          weight: "700",
        },
        formatter: (value) => abbreviateINR(value),
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: masked ? "transparent" : "#64748b",
          font: { size: 12, weight: "600" }
        },
      },
      y: {
        grid: {
          color: "rgba(75, 85, 99, 0.1)",
        },
        ticks: {
          color: masked ? "transparent" : "#64748b",
          font: { size: 12, weight: "600" },
          callback: (value) => abbreviateINR(value),
        },
      },
    },
  }), [masked]);

  if (loading) return <div className="text-center py-10 text-gray-400">Loading growth data...</div>;
  if (growthError) return <div className="text-center py-10 text-rose-400">{growthError}</div>;

  if (!labels.length || masked || isTrialMode) {
    const message = isTrialMode 
      ? "No data available in Trial Mode" 
      : !labels.length 
      ? "No investment history available." 
      : "Privacy mask active.";

    return (
      <div className="rounded-[2.5rem] border border-gray-700/50 bg-gray-800/40 backdrop-blur-2xl p-10 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gray-900/50 flex items-center justify-center text-gray-500 mb-4">
          <Activity size={32} />
        </div>
        <p className="text-gray-400 font-medium">{message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
        <div className="rounded-[2rem] p-6 shadow-xl transition-all duration-300 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent border border-red-500/20 backdrop-blur-2xl hover:from-red-500/20">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Investment</span>
          </div>
          <div className="text-2xl font-black text-white">{formatINRWithSuffix(backendTotals.totalInvestedValue)}</div>
        </div>
        
          <div className="rounded-[2rem] p-6 shadow-xl transition-all duration-300 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border border-green-500/20 backdrop-blur-2xl hover:from-green-500/20">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Current Market Value</span>
          </div>
          <div className="text-2xl font-black text-white">{formatINRWithSuffix(backendTotals.totalMarketValue)}</div>
        </div>
      </div>

      <div className="rounded-[2.5rem] border border-gray-700/50 bg-gray-800/40 backdrop-blur-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
            <BarChart3 size={20} />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight uppercase tracking-wider">Investment Details</h2>
        </div>

        <div className="h-[350px] w-full overflow-x-auto maskable-chart">
          <div className="min-w-[700px] h-full">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Growth;
