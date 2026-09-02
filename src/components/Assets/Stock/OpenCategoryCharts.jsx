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

function formatAmount(val) {
  const n = Number(val || 0);
  const abs = Math.abs(n);
  if (abs >= 10000000) return `${(abs / 10000000).toFixed(1)} Cr`;
  if (abs >= 100000) return `${(abs / 100000).toFixed(1)} L`;
  if (abs >= 1000) return `${(abs / 1000).toFixed(1)} K`;
  return n.toFixed(1);
}

function calculateXIRR(flows) {
  if (!flows || flows.length < 2) return null;
  const cashflows = flows
    .map((cf) => ({ amount: Number(cf.amount), date: new Date(cf.date) }))
    .sort((a, b) => a.date - b.date);
  const t0 = cashflows[0].date;
  const npv = (rate) => cashflows.reduce((acc, cf) => acc + cf.amount / Math.pow(1 + rate, (cf.date - t0) / MS_PER_YEAR), 0);
  let low = -0.9999, high = 100, guess = 0.1;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const val = npv(mid);
    if (Math.abs(val) < 1e-6) return mid * 100;
    if (val > 0) low = mid; else high = mid;
    guess = mid;
  }
  return guess * 100;
}

function PieBlock({
  title,
  labels,
  values,
  valueFormatter,
  percentOfTotal = false,
  actualForTooltip,
  colorByLabel = {},
}) {
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
        color: "#E0E0E0",
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
            const rawVal = Number(actualForTooltip ? actualForTooltip[ctx.dataIndex] : values[ctx.dataIndex]) || 0;
            if (percentOfTotal) {
              // show percentage with 1 decimal place
              const p = ((Number(values[ctx.dataIndex] || 0) / total) * 100).toFixed(1);
              return `${label}: ${p}%`;
            }
            if (valueFormatter === "percent") {
              // show percent with 1 decimal place
              return `${label}: ${rawVal.toFixed(1)}%`;
            }
            // amount with percent share in tooltip (1 decimal)
            const pct = ((Number(values[ctx.dataIndex] || 0) / total) * 100).toFixed(1);
            return `${label}: ${formatAmount(rawVal)} (${pct}%)`;
          },
        },
      },
      datalabels: {
        color: "#E0E0E0",
        font: { weight: "bold" },
        formatter: (val, context) => {
          const idx = context.dataIndex;
          const rawVal = Number(values[idx] || 0);
          if (percentOfTotal || valueFormatter === "percent") {
            // display percent with 1 decimal
            return `${rawVal.toFixed(1)}%`;
          }
          // amount with compact unit, 1 decimal
          return formatAmount(rawVal);
        },
      },
    },
  };

  if (!labels.length) return <p className="text-gray-100">No category data available.</p>;

  return (
    <div className="border rounded-lg p-3 shadow w-full max-w-full sm:max-w-sm">
      <h3 className="text-sm font-semibold mb-2 text-yellow-300 text-center break-words">
        {title}
      </h3>
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
      <h3 className="text-sm font-semibold text-yellow-300 mb-3">Category Legend</h3>
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

// Props:
// - transactions: array of open txns with { stock_name, quantity, buy_price, buy_date, ... }
// - stockMaster: array with { stock_name, cmp, lcp, category }
export default function OpenCategoryCharts({ transactions = [], stockMaster = [] }) {
  const charts = useMemo(() => {
    const masterMap = Object.fromEntries((stockMaster || []).map((m) => [m.stock_name, m]));

    const investedByCat = {};
    const marketByCat = {};
    const profitByCat = {};
    const flowsByCat = {}; // for XIRR

    (transactions || []).forEach((t) => {
      if (t.sell_date) return; // only open
      const qty = Number(t.quantity) || 0;
      const buy = Number(t.buy_price) || 0;
      const invested = qty * buy;

      const master = masterMap[t.stock_name] || {};
      const cmp = master.cmp != null && master.cmp !== "" ? Number(master.cmp) : NaN;
      const lcp = master.lcp != null && master.lcp !== "" ? Number(master.lcp) : NaN;
      const price = !isNaN(cmp) && cmp > 0 ? cmp : !isNaN(lcp) && lcp > 0 ? lcp : 0;
      const market = qty * price;

      const cat = (master.category || "Uncategorized").toString();
      investedByCat[cat] = (investedByCat[cat] || 0) + invested;
      marketByCat[cat] = (marketByCat[cat] || 0) + market;

      const profit = market - invested;
      profitByCat[cat] = (profitByCat[cat] || 0) + profit;

      if (!flowsByCat[cat]) flowsByCat[cat] = [];
      // outflows (investments)
      flowsByCat[cat].push({ amount: -invested, date: new Date(t.buy_date) });
      // terminal inflow as current MV
      if (market > 0) flowsByCat[cat].push({ amount: market, date: new Date() });
    });

    const cats = Array.from(new Set([...Object.keys(investedByCat), ...Object.keys(marketByCat)]));

    const investedVals = cats.map((c) => investedByCat[c] || 0);
    const marketVals = cats.map((c) => marketByCat[c] || 0);

    // 3) Invested ratio % (share of total invested)
    const totalInvested = investedVals.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
    const investedSharePct = investedVals.map((v) => (Number(v || 0) / totalInvested) * 100);

    // 4) Profit% as share of total profit (use positive profits for pie)
    const profitValsRaw = cats.map((c) => profitByCat[c] || 0);
    const profitPositive = profitValsRaw.map((v) => (v > 0 ? v : 0));
    const totalProfitPos = profitPositive.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
    const profitSharePct = profitPositive.map((v) => (Number(v || 0) / totalProfitPos) * 100);

    // 5) IRR% (simple non-annualized return% per category)
    const irrPct = cats.map((c, idx) => {
      const inv = investedVals[idx] || 0;
      const mv = marketVals[idx] || 0;
      return inv > 0 ? ((mv - inv) / inv) * 100 : 0;
    });

    // 6) XIRR% per category (annualized, bisection)
    const xirrPct = cats.map((c) => {
      const flows = flowsByCat[c] || [];
      const x = calculateXIRR(flows);
      return x == null || isNaN(x) ? 0 : x;
    });

    return {
      cats,
      investedVals,
      marketVals,
      investedSharePct,
      profitSharePct,
      irrPct,
      xirrPct,
      profitValsRaw,
    };
  }, [transactions, stockMaster]);

  const {
    cats,
    investedVals,
    marketVals,
    investedSharePct,
    profitSharePct,
    irrPct,
    xirrPct,
    profitValsRaw,
  } = charts;

  const categoryColorMap = useMemo(() => {
    return cats.reduce((acc, cat, idx) => {
      acc[cat] = COLOR_PALETTE[idx % COLOR_PALETTE.length];
      return acc;
    }, {});
  }, [cats]);

  return (
    <div className="p-4 w-full max-w-full sm:p-6">
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 flex-1">
          <PieBlock
            title="Invested Amount"
            labels={cats}
            values={investedVals}
            valueFormatter="amount"
            colorByLabel={categoryColorMap}
          />
          <PieBlock
            title="Market Value"
            labels={cats}
            values={marketVals}
            valueFormatter="amount"
            colorByLabel={categoryColorMap}
          />
          <PieBlock
            title="Invested Amount (%)"
            labels={cats}
            values={investedSharePct}
            valueFormatter="percent"
            percentOfTotal
            colorByLabel={categoryColorMap}
          />
          <PieBlock
            title="UnRealized Profit(%)"
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