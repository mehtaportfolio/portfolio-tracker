import React, { useMemo, useCallback, useState } from "react";
import { Bar } from "react-chartjs-2";
import { useMFTrialMode } from "../../../utils/MFTrialMode.js";

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
  const absVal = Math.abs(val);
  let formatted;

  if (absVal >= 10000000) formatted = (absVal / 10000000).toFixed(1) + " Cr";
  else if (absVal >= 100000) formatted = (absVal / 100000).toFixed(1) + " L";
  else if (absVal >= 1000) formatted = (absVal / 1000).toFixed(1) + " K";
  else if (absVal <= 1000) formatted = absVal.toFixed(0) + "";
  else formatted = absVal;

  return val < 0 ? `-${formatted}` : formatted;
};

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
  let low = -0.9999,
    high = 100,
    guess = 0.1;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const val = npv(mid);
    if (Math.abs(val) < 1e-6) return mid * 100;
    if (val > 0) low = mid;
    else high = mid;
    guess = mid;
  }
  return guess * 100;
};

const MFYearlyChartsOpen = ({
  transactions: transactionsProp,
  txns: txnsProp,
  fundMaster: fundMasterProp,
  account = "ALL",
  mode = "year", // 'year' or 'fy'
}) => {
  const { isTrialMode } = useMFTrialMode();
  const transactions = useMemo(() => transactionsProp ?? [], [transactionsProp]);
  const txns = useMemo(() => txnsProp ?? [], [txnsProp]);
  const fundMaster = useMemo(() => fundMasterProp ?? [], [fundMasterProp]);

  const [activeChartKey, setActiveChartKey] = useState("inflow");

  const masterMap = useMemo(
    () =>
      Object.fromEntries(
        (fundMaster || []).map((m) => [m.fund_short_name, m])
      ),
    [fundMaster]
  );

  const groupByYear = useCallback((dateStr) => new Date(dateStr).getFullYear(), []);
  const groupByFY = useCallback((dateStr) => {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-based
    const nextYearShort = (month >= 3 ? year + 1 : year).toString().slice(-2);
    return month >= 3 ? `${year}-${nextYearShort}` : `${year - 1}-${nextYearShort}`;
  }, []);

  const getYearKey = useCallback(
    (dateStr) => (mode === "year" ? groupByYear(dateStr) : groupByFY(dateStr)),
    [mode, groupByYear, groupByFY]
  );

  const charts = useMemo(() => {
    const source = (transactions && transactions.length ? transactions : txns) || [];

    if (!source || source.length === 0) {
      return {
        inflow: null,
        marketValue: null,
        unrealized: null,
        irr: null,
        xirr: null,
      };
    }

    const inflowMap = {};
    const marketMap = {};
    const unrealizedMap = {};
    const irrMap = {};
    const xirrMap = {};
    const cashflowsByYear = {};

    source.forEach((t) => {
      if (account && account !== "ALL" && t.account_name !== account) return;
      // Only open transactions
      if (t.sell_date) return;

      const key = getYearKey(t.buy_date);
      const units = Number(t.units) || 0;
      const buy = Number(t.buy_nav) || 0;

      const master = masterMap[t.fund_short_name] || {};
      const cmp = master.cmp != null && master.cmp !== "" ? Number(master.cmp) : NaN;
      const lcp = master.lcp != null && master.lcp !== "" ? Number(master.lcp) : NaN;
      const price = !Number.isNaN(cmp) && cmp > 0 ? cmp : !Number.isNaN(lcp) && lcp > 0 ? lcp : 0;

      const invested = units * buy;
      inflowMap[key] = (inflowMap[key] || 0) + invested;

      const marketVal = units * price;
      marketMap[key] = (marketMap[key] || 0) + marketVal;

      if (!cashflowsByYear[key]) cashflowsByYear[key] = [];
      cashflowsByYear[key].push({ amount: -invested, date: new Date(t.buy_date) });
    });

    const years = Object.keys({ ...inflowMap, ...marketMap }).sort((a, b) =>
      mode === "year" ? Number(b) - Number(a) : b.localeCompare(a)
    );

    const inflowValues = years.map((y) => isTrialMode ? 0 : (inflowMap[y] || 0));
    const marketValues = years.map((y) => isTrialMode ? 0 : (marketMap[y] || 0));
    const unrealizedValues = years.map((y) => {
      const invested = inflowMap[y] || 0;
      const marketVal = marketMap[y] || 0;
      const unrealized = marketVal - invested;
      unrealizedMap[y] = isTrialMode ? 0 : unrealized;
      irrMap[y] = invested > 0 ? (unrealized / invested) * 100 : 0;

      const flows = cashflowsByYear[y] ? [...cashflowsByYear[y]] : [];
      if (marketVal > 0) flows.push({ amount: marketVal, date: new Date() });
      const xirrValue = calculateXIRR(flows);
      xirrMap[y] = xirrValue;

      return isTrialMode ? 0 : unrealized;
    });

    const irrValues = years.map((y) => Number((irrMap[y] || 0).toFixed(2)));
    const xirrValues = years.map((y) => {
      const value = xirrMap[y];
      return value != null ? Number(value.toFixed(2)) : null;
    });

    const inflowDataset = {
      labels: years,
      datasets: [
        {
          label: "Invested (Inflow)",
          data: inflowValues,
          backgroundColor: "rgba(255, 159, 64, 0.8)",
          borderRadius: 4,
          maxBarThickness: 50,
        },
      ],
    };

    const marketDataset = {
      labels: years,
      datasets: [
        {
          label: "Market Value (today)",
          data: marketValues,
          backgroundColor: "rgba(54, 162, 235, 0.8)",
          borderRadius: 4,
          maxBarThickness: 50,
        },
      ],
    };

    const unrealizedDataset = {
      labels: years,
      datasets: [
        {
          label: "Unrealized Profit",
          data: unrealizedValues,
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
          data: irrValues,
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
          data: xirrValues,
          backgroundColor: "rgba(255,99,132,0.85)",
          borderRadius: 4,
          maxBarThickness: 50,
        },
      ],
    };

    return {
      inflow: inflowDataset,
      marketValue: marketDataset,
      unrealized: unrealizedDataset,
      irr: irrDataset,
      xirr: xirrDataset,
    };
  }, [transactions, txns, mode, account, masterMap, getYearKey, isTrialMode]);

  const chartOptions = (title, isPercent = false) => ({
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 20, right: 30 } },
    plugins: {
      legend: { display: false },
      title: { display: true, color: "#FFEB3B", text: title, font: { size: 15 }, padding: { bottom: 25 } },
      datalabels: {
        anchor: "end",
        align: "end",
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
      y: { ticks: { color: "#E0E0E0" }, grid: { color: "#3B0A0A" } },
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
    },
  });

  const containerHeight = (ds) => (ds && ds.labels ? Math.max(300, ds.labels.length * 60) : 300);

  const chartsList = useMemo(
    () => [
      {
        key: "inflow",
        label: "Invested",
        dataset: charts.inflow,
        options: chartOptions(`Invested (Inflow) - ${mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase()}`),
        height: containerHeight(charts.inflow),
      },
      {
        key: "marketValue",
        label: "Market Value",
        dataset: charts.marketValue,
        options: chartOptions(`Market Value (today) - ${mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase()}`),
        height: containerHeight(charts.marketValue),
      },
      {
        key: "unrealized",
        label: "Unrealized Profit",
        dataset: charts.unrealized,
        options: chartOptions(`Unrealized Profit - ${mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase()}`),
        height: containerHeight(charts.unrealized),
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
    <div className="p-4 w-full max-w-full flex flex-col space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {chartsList.map((chart) => (
          <button
            key={chart.key}
            type="button"
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

      <div
        className="flex flex-col overflow-y-auto maskable-chart"
        style={{ height: activeChart?.height || 300 }}
      >
        {activeChart?.dataset && activeChart.dataset.labels.length ? (
          <Bar data={activeChart.dataset} options={activeChart.options} />
        ) : (
          <p className="text-gray-500 mt-12 ml-4">No data</p>
        )}
      </div>
    </div>
  );
};

export default MFYearlyChartsOpen;