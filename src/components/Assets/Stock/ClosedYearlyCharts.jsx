// YearlyChartsClosed.js
import React, { useMemo, useCallback, useState } from "react";
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

// Helper to format amounts
const formatAmount = (val) => {
  const num = Number(val) || 0;
  const absVal = Math.abs(num);
  let formatted;

  if (absVal >= 10000000) formatted = (absVal / 10000000).toFixed(1) + " Cr";
  else if (absVal >= 100000) formatted = (absVal / 100000).toFixed(1) + " L";
  else if (absVal >= 1000) formatted = (absVal / 1000).toFixed(1) + " K";
  else formatted = absVal.toFixed(1);

  return num < 0 ? `-${formatted}` : formatted;
};

const sumNumber = (value) => Number(value) || 0;

// XIRR calculator
const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365;
const calculateXIRR = (flows) => {
  if (!flows || flows.length < 2) return null;
  const cashflows = flows
    .map((cf) => ({ amount: Number(cf.amount), date: new Date(cf.date) }))
    .sort((a, b) => a.date - b.date);
  const t0 = cashflows[0].date;
  const npv = (rate) =>
    cashflows.reduce(
      (acc, cf) => acc + cf.amount / Math.pow(1 + rate, (cf.date - t0) / MS_PER_YEAR),
      0
    );
  let low = -0.9999;
  let high = 100;
  let guess = 0.1;
  for (let i = 0; i < 100; i += 1) {
    const mid = (low + high) / 2;
    const val = npv(mid);
    if (Math.abs(val) < 1e-6) return mid * 100;
    if (val > 0) low = mid;
    else high = mid;
    guess = mid;
  }
  return guess * 100;
};

const YearlyChartsClosed = ({
  transactions = [],
  stockMaster = [],
  account = "ALL",
  mode = "year", // 'year' or 'fy'
}) => {
  const [activeChartKey, setActiveChartKey] = useState("inflow");
  const groupByYear = (dateStr) => new Date(dateStr).getFullYear();
  const groupByFY = (dateStr) => {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-based
    const nextYearShort = (month >= 3 ? year + 1 : year).toString().slice(-2);
    return month >= 3 ? `${year}-${nextYearShort}` : `${year - 1}-${nextYearShort}`;
  };

  const getYearKey = useCallback(
    (dateStr) => (mode === "year" ? groupByYear(dateStr) : groupByFY(dateStr)),
    [mode]
  );

  const charts = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return { inflow: null, realized: null, irr: null, xirr: null };
    }

    const inflowMap = {};
    const realizedMap = {};
    const cashflowsByYear = {};

    transactions.forEach((t) => {
      if (account && account !== "ALL" && t.account_name !== account) return;

      const key = getYearKey(t.sell_date || t.buy_date);
      const qty = Number(t.quantity) || 0;
      const buyTotal = sumNumber(t.buy_total);
      const sellTotal = sumNumber(t.sell_total);

      const invested = buyTotal || qty * Number(t.buy_price || 0);
      const proceeds = sellTotal || qty * Number(t.sell_price || 0);
      const realized = proceeds - invested;

      inflowMap[key] = (inflowMap[key] || 0) + invested;
      realizedMap[key] = (realizedMap[key] || 0) + realized;

      if (!cashflowsByYear[key]) cashflowsByYear[key] = [];
      cashflowsByYear[key].push({ amount: -invested, date: new Date(t.buy_date) });
      if (proceeds > 0)
        cashflowsByYear[key].push({ amount: proceeds, date: new Date(t.sell_date) });
    });

    const years = Object.keys({ ...inflowMap, ...realizedMap }).sort((a, b) =>
      mode === "year" ? Number(b) - Number(a) : b.localeCompare(a)
    );

    const inflowDataset = {
      labels: years,
      datasets: [
        {
          label: "Invested (Inflow)",
          data: years.map((y) => inflowMap[y] || 0),
          backgroundColor: "rgba(255, 159, 64, 0.8)",
          borderRadius: 4,
          maxBarThickness: 50,
        },
      ],
    };

    const realizedDataset = {
      labels: years,
      datasets: [
        {
          label: "Realized Profit",
          data: years.map((y) => realizedMap[y] || 0),
          backgroundColor: "rgba(34,139,34,0.8)",
          borderRadius: 4,
          maxBarThickness: 50,
        },
      ],
    };

    const irrDataset = {
      labels: years,
      datasets: [
        {
          label: "IRR (%)",
          data: years.map((y) => {
            const invested = inflowMap[y] || 0;
            const profit = realizedMap[y] || 0;
            return invested ? Number(((profit / invested) * 100).toFixed(2)) : 0;
          }),
          backgroundColor: "rgba(153,102,255,0.85)",
          borderRadius: 4,
          maxBarThickness: 50,
        },
      ],
    };

    const xirrDataset = {
      labels: years,
      datasets: [
        {
          label: "XIRR (%)",
          data: years.map((y) => {
            const flows = cashflowsByYear[y];
            const result = calculateXIRR(flows);
            return result !== null ? Number(result.toFixed(2)) : null;
          }),
          backgroundColor: "rgba(255,99,132,0.85)",
          borderRadius: 4,
          maxBarThickness: 50,
        },
      ],
    };

    return {
      inflow: inflowDataset,
      realized: realizedDataset,
      irr: irrDataset,
      xirr: xirrDataset,
    };
  }, [transactions, account, mode, getYearKey]);

  const chartOptions = (title, isPercent = false) => ({
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 40 } },
    plugins: {
      legend: { display: false },
      title: { display: true, text: title, color: "#FFEB3B", font: { size: 15 }, padding: { bottom: 15 } },
      datalabels: {
        anchor: "end",
        align: "right",
        color: "#E0E0E0",
        font: { weight: "bold" },
        formatter: (val) => (isPercent ? `${val}%` : formatAmount(val)),
      },
      tooltip: {
        callbacks: {
          label: (ctx) => (isPercent ? `${ctx.raw}%` : String(formatAmount(ctx.raw))),
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          color: "#E0E0E0",
          callback: (v) => (isPercent ? `${v}%` : formatAmount(v)),
        },
        grid: { color: "#3B0A0A" },
        afterDataLimits: (scale) => {
          const range = scale.max - scale.min;
          scale.max = scale.max + range * 0.15;
        },
      },
      y: { ticks: { color: "#E0E0E0" }, grid: { display: false } },
    },
  });

  const containerHeight = (ds) => (ds && ds.labels ? ds.labels.length * 60 + 100 : 350);

  const chartsList = useMemo(
    () => [
      {
        key: "inflow",
        label: "Invested (Inflow)",
        dataset: charts.inflow,
        options: chartOptions(`Invested (Inflow) - ${mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase()}`),
        height: containerHeight(charts.inflow),
      },
      {
        key: "realized",
        label: "Realized Profit",
        dataset: charts.realized,
        options: chartOptions(`Realized Profit - ${mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase()}`),
        height: containerHeight(charts.realized),
      },
      {
        key: "irr",
        label: "IRR (%)",
        dataset: charts.irr,
        options: chartOptions(`IRR (%) - ${mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase()}`, true),
        height: containerHeight(charts.irr),
      },
      {
        key: "xirr",
        label: "XIRR (%)",
        dataset: charts.xirr,
        options: chartOptions(`XIRR (%) - ${mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase()}`, true),
        height: containerHeight(charts.xirr),
      },
    ],
    [charts, mode]
  );

  const activeChart = chartsList.find((chart) => chart.key === activeChartKey);

  return (
    <div className="p-4 sm:p-6 w-full max-w-full flex flex-col space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {chartsList.map((chart) => (
          <button
            key={chart.key}
            onClick={() => setActiveChartKey(chart.key)}
            className={`px-3 py-1.5 text-sm border rounded-md transition-colors duration-150 ${
              activeChartKey === chart.key
                ? "bg-blue-600 text-white border-blue-700"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
            }`}
          >
            {chart.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col overflow-y-auto maskable-chart" style={{ height: activeChart?.height || 350 }}>
        {activeChart?.dataset && activeChart.dataset.labels.length ? (
          <Bar data={activeChart.dataset} options={activeChart.options} />
        ) : (
          <p className="text-gray-500 mt-12 ml-4">No data</p>
        )}
      </div>
    </div>
  );
};

export default YearlyChartsClosed;