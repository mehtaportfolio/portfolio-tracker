import React, { useMemo } from "react";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

const COLOR_PALETTE = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#22c55e",
  "#06b6d4",
  "#e11d48",
];

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365;

function calculateXIRR(flows) {
  if (!flows || flows.length < 2) return null;
  const cashflows = flows
    .map((cf) => ({ amount: Number(cf.amount), date: new Date(cf.date) }))
    .sort((a, b) => a.date - b.date);
  const t0 = cashflows[0].date;
  const npv = (rate) =>
    cashflows.reduce(
      (acc, cf) =>
        acc + cf.amount / Math.pow(1 + rate, (cf.date - t0) / MS_PER_YEAR),
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
}

function PieBlock({ title, labels, values, valueFormatter, percentOfTotal = false, actualForTooltip, colorByLabel = {} }) {
  const total = (values || []).reduce((a, b) => a + (Number(b) || 0), 0) || 1;
  const datasetValues = values.map((v) => Math.max(0, Number(v) || 0));

  const colors = labels.map((label) => colorByLabel[label] || "#9ca3af");

  const data = {
    labels,
    datasets: [
      {
        label: title,
        data: datasetValues,
        backgroundColor: colors.map((c) => `${c}cc`),
        borderColor: colors,
        borderWidth: 1,
      },
    ],
  };

  const options = {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.label || "";
            const rawVal = Number(
              actualForTooltip ? actualForTooltip[ctx.dataIndex] : values[ctx.dataIndex]
            ) || 0;
            if (percentOfTotal) {
              const p = ((Number(values[ctx.dataIndex] || 0) / total) * 100).toFixed(1);
              return `${label}: ${p}%`;
            }
            if (valueFormatter === "percent") {
              return `${label}: ${rawVal.toFixed(1)}%`;
            }
            return `${label}: ${rawVal.toFixed(1)}`;
          },
        },
      },
      datalabels: {
        color: "#111827",
        font: { weight: "bold" },
        formatter: (val) => (valueFormatter === "percent" ? `${val.toFixed(1)}%` : val.toFixed(1)),
      },
    },
  };

  if (!labels.length) return <p className="text-gray-500">No category data available.</p>;

  return (
    <div className="border rounded-lg p-3 shadow w-full max-w-full sm:max-w-sm">
      <h3 className="text-sm font-semibold mb-2 text-center break-words">{title}</h3>
      <div className="maskable-chart h-[240px] sm:h-[300px]">
        <Pie data={data} options={options} />
      </div>
    </div>
  );
}

function CategoryLegend({ labels, colorByLabel }) {
  if (!labels.length) return null;

  return (
    <div className="border rounded-lg p-4 shadow bg-slate-900/60 w-full sm:w-64 lg:w-72">
      <h3 className="text-sm font-semibold mb-3 text-center text-yellow-300">Category Legend</h3>
      <ul className="space-y-2 text-xs text-gray-200">
        {labels.map((label) => (
          <li key={label} className="flex items-center gap-3">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: colorByLabel[label] || "#9ca3af" }}
            />
            <span className="flex-1 truncate">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CloseCategoryCharts({ transactions = [], stockMaster = [] }) {
  const charts = useMemo(() => {
    const masterMap = Object.fromEntries((stockMaster || []).map((m) => [m.stock_name, m]));

    const investedByCat = {};
    const realizedByCat = {};
    const profitByCat = {};
    const flowsByCat = {};

    (transactions || []).forEach((t) => {
      if (!t.sell_date) return; // only closed txns
      const qty = Number(t.quantity) || 0;
      const buy = Number(t.buy_price) || 0;
      const invested = qty * buy;
      const sell = Number(t.sell_price) || 0;
      const realized = qty * sell;

      const master = masterMap[t.stock_name] || {};
      const cat = (master.category || "Uncategorized").toString();

      investedByCat[cat] = (investedByCat[cat] || 0) + invested;
      realizedByCat[cat] = (realizedByCat[cat] || 0) + realized;
      profitByCat[cat] = (profitByCat[cat] || 0) + (realized - invested);

      if (!flowsByCat[cat]) flowsByCat[cat] = [];
      flowsByCat[cat].push({ amount: -invested, date: new Date(t.buy_date) });
      flowsByCat[cat].push({ amount: realized, date: new Date(t.sell_date) });
    });

    const cats = Array.from(new Set([...Object.keys(investedByCat), ...Object.keys(realizedByCat)]));

    const investedVals = cats.map((c) => investedByCat[c] || 0);

    const totalInvested = investedVals.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
    const investedSharePct = investedVals.map((v) => (Number(v || 0) / totalInvested) * 100);

    const profitValsRaw = cats.map((c) => profitByCat[c] || 0);
    const profitPositive = profitValsRaw.map((v) => (v > 0 ? v : 0));
    const totalProfitPos = profitPositive.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
    const profitSharePct = profitPositive.map((v) => (Number(v || 0) / totalProfitPos) * 100);

    const irrPct = cats.map((c, idx) => {
      const inv = investedVals[idx] || 0;
      const realized = realizedByCat[c] || 0;
      return inv > 0 ? ((realized - inv) / inv) * 100 : 0;
    });

    const xirrPct = cats.map((c) => {
      const flows = flowsByCat[c] || [];
      const x = calculateXIRR(flows);
      return x == null || isNaN(x) ? 0 : x;
    });

    return { cats, investedSharePct, profitSharePct, irrPct, xirrPct, profitValsRaw };
  }, [transactions, stockMaster]);

  const { cats, investedSharePct, profitSharePct, irrPct, xirrPct, profitValsRaw } = charts;

  const categoryColorMap = useMemo(() => {
    return cats.reduce((acc, cat, idx) => {
      acc[cat] = COLOR_PALETTE[idx % COLOR_PALETTE.length];
      return acc;
    }, {});
  }, [cats]);

  return (
    <div className="p-4 w-full max-w-full sm:p-6">
      <div className="flex flex-col gap-4 sm:gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <PieBlock
            title="Invested Amount (%)"
            labels={cats}
            values={investedSharePct}
            valueFormatter="percent"
            percentOfTotal
            colorByLabel={categoryColorMap}
          />
          <PieBlock
            title="Realized Profit (%)"
            labels={cats}
            values={profitSharePct}
            valueFormatter="percent"
            percentOfTotal
            actualForTooltip={profitValsRaw}
            colorByLabel={categoryColorMap}
          />
          <PieBlock
            title="IRR (%)"
            labels={cats}
            values={irrPct}
            valueFormatter="percent"
            colorByLabel={categoryColorMap}
          />
          <PieBlock
            title="XIRR (%)"
            labels={cats}
            values={xirrPct}
            valueFormatter="percent"
            colorByLabel={categoryColorMap}
          />
        </div>
        <CategoryLegend labels={cats} colorByLabel={categoryColorMap} />
      </div>
    </div>
  );
}
