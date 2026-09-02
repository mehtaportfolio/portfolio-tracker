// src/components/Dashboard/Chart.js
import React, { useState, useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { BarChart3, Calendar, Wallet } from "lucide-react";
import { useInvestmentGrowthData } from "./useInvestmentGrowthData.js";
import useAssetInvestmentData from "./useAssetInvestmentData.js";
import { useAssetRowsOptimized } from "../../hooks/useAssetRowsOptimized.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
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

const buildCumulativeSeries = (values = []) => {
  const cumulative = [];
  return values.reduce((accumulator, currentValue) => {
    const nextTotal = (accumulator.length ? accumulator[accumulator.length - 1] : 0) + (currentValue || 0);
    accumulator.push(nextTotal);
    return accumulator;
  }, cumulative);
};

const ChartView = ({ masked = false, isTrialMode = false }) => {
  const [filter, setFilter] = useState("yearwise");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const {
    loading: yearLoading,
    error: yearError,
    labels: yearLabels,
    yearBreakdowns,
  } = useInvestmentGrowthData();
  
  const {
    loading: assetLoading,
    error: assetError,
    labels: assetLabels,
    invested: assetInvested,
  } = useAssetInvestmentData(selectedYear);

  const { summary: backendTotals, loading: rowsLoading } = useAssetRowsOptimized();

  const loading = (filter === "yearwise" ? yearLoading : assetLoading) || rowsLoading;
  const error = filter === "yearwise" ? yearError : assetError;
  const labels = filter === "yearwise" ? yearLabels : assetLabels;
  
  const invested = useMemo(() => {
    if (filter === "yearwise") {
      return (yearLabels || []).map((year) => yearBreakdowns?.combined?.get(year)?.invested || 0);
    }
    return assetInvested || [];
  }, [filter, yearLabels, yearBreakdowns, assetInvested]);

  const cumulativeInvested = useMemo(() => buildCumulativeSeries(invested), [invested]);

  const chartData = useMemo(() => {
let chartLabels = labels || [];
let chartDataValues = filter === 'yearwise' ? cumulativeInvested : invested;

// 🔥 Reverse ONLY for display
if (filter === 'yearwise') {
  chartLabels = [...chartLabels].reverse();
  chartDataValues = [...chartDataValues].reverse();
}

    if (filter === 'assetwise') {
      const sorted = (labels || [])
        .map((label, index) => ({ label, value: invested[index] }))
        .filter((entry) => Number.isFinite(entry.value) && entry.value !== 0)
        .sort((a, b) => b.value - a.value);

      chartLabels = sorted.map((entry) => entry.label);
      chartDataValues = sorted.map((entry) => entry.value);
    }

    return {
      labels: chartLabels,
      datasets: [
        {
          label: filter === 'yearwise' ? "Total Net Investment Value" : "Net Investment by Asset",
          data: chartDataValues,
          backgroundColor: "rgba(99, 102, 241, 0.65)",
          borderColor: "rgba(99, 102, 241, 0.8)",
          borderWidth: 2,
          borderRadius: 12,
          barPercentage: 0.6,
          categoryPercentage: 0.6,
        },
      ],
    };
  }, [labels, cumulativeInvested, invested, filter]);

  const suggestedMaxValue = useMemo(() => {
    const dataset = chartData.datasets?.[0]?.data ?? [];
    if (!dataset.length) return undefined;
    const maxValue = Math.max(...dataset);
    return Number.isFinite(maxValue) ? maxValue * 1.35 : undefined;
  }, [chartData]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { bottom: 0, top: 20 },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: !masked,
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
          label: (context) => `${context.dataset.label}: ${formatINR(context.parsed.y)}`,
        },
      },
      datalabels: {
        display: !masked,
        anchor: "end",
        align: "top",
        color: "#94a3b8",
        font: {
          size: 11,
          weight: "700",
        },
        formatter: (value) => abbreviateINR(value),
      },
    },
    scales: {
      x: {
        grid: { display: false },
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
        suggestedMax: suggestedMaxValue,
        beginAtZero: true,
      },
    },
  }), [suggestedMaxValue, masked]);

  if (loading) return <div className="text-center py-10 text-gray-400">Loading analysis data...</div>;
  if (error) return <div className="text-center py-10 text-rose-400">{error}</div>;

  if (!labels.length || masked || isTrialMode) {
    const message = isTrialMode 
      ? "No data available in Trial Mode" 
      : !labels.length 
      ? "No investment history available." 
      : "Privacy mask active.";

    return (
      <div className="rounded-[2.5rem] border border-gray-700/50 bg-gray-800/40 backdrop-blur-2xl p-10 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gray-900/50 flex items-center justify-center text-gray-500 mb-4">
          <BarChart3 size={32} />
        </div>
        <p className="text-gray-400 font-medium">{message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-[2rem] p-6 shadow-xl transition-all duration-300 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border border-green-500/20 backdrop-blur-2xl hover:from-green-500/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Wallet size={18} />
            </div>
            <span className="text-xs font-bold text-white uppercase tracking-widest">Total Net Investment</span>
          </div>
          <div className="text-2xl font-black text-white tracking-tight leading-tight">
            {abbreviateINR(backendTotals.totalInvestedValue)}
          </div>
        </div>

 <div className="rounded-[2rem] p-6 shadow-xl transition-all duration-300 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent border border-orange-500/20 backdrop-blur-2xl hover:from-orange-500/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <Calendar size={18} />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Analysis View</span>
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)} 
className="flex-1 rounded-xl bg-orange-600/70 border border-orange-800/80 px-4 py-2 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-orange-800 appearance-none"
            >
              <option value="yearwise">Yearwise Trend</option>
              <option value="assetwise">Asset Breakdown</option>
            </select>
            {filter === 'assetwise' && (
              <input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-24 rounded-xl bg-gray-900/50 border border-blue-700/50 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                min="2000"
                max={new Date().getFullYear()}
              />
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[2.5rem] border border-gray-700/50 bg-gray-800/40 backdrop-blur-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <BarChart3 size={20} />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight uppercase tracking-wider">
            {filter === 'yearwise' ? 'Investment Trend' : `Asset Breakdown - ${selectedYear}`}
          </h2>
        </div>

        <div
          className={`w-full overflow-x-auto maskable-chart ${
            filter === "assetwise" ? "h-[350px]" : "h-[320px]"
          }`}
        >
          <div className="min-w-[600px] h-full pr-4">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChartView;
