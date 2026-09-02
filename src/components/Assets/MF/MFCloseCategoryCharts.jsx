import React, { useMemo } from "react";
import { Pie } from "react-chartjs-2";
import { useMFTrialMode } from "../../../utils/MFTrialMode.js";
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
    datasets: [{
      label: title,
      data: datasetValues,
      backgroundColor: colors.map(c => `${c}cc`),
      borderColor: colors,
      borderWidth: 1,
    }],
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
              const p = ((Number(values[ctx.dataIndex] || 0) / total) * 100).toFixed(1);
              return `${label}: ${p}%`;
            }
            if (valueFormatter === "percent") return `${label}: ${rawVal.toFixed(1)}%`;
            const pct = ((Number(values[ctx.dataIndex] || 0) / total) * 100).toFixed(1);
            return `${label}: ${formatAmount(rawVal)} (${pct}%)`;
          },
        },
      },
      datalabels: {
        color: "#111827",
        font: { weight: "bold" },
        formatter: (val, context) => {
          const idx = context.dataIndex;
          const rawVal = Number(values[idx] || 0);
          if (percentOfTotal || valueFormatter === "percent") return `${rawVal.toFixed(1)}%`;
          return formatAmount(rawVal);
        },
      },
    },
  };

  if (!labels.length) return <p className="text-gray-500 text-center">No category data available.</p>;

  return (
    <div className="border rounded-lg p-3 sm:p-4 shadow w-full min-w-0 overflow-x-auto">
      <h3 className="text-sm sm:text-base font-semibold mb-2 text-center">{title}</h3>
      <div className="maskable-chart h-[260px] sm:h-[300px]">
        <Pie
          data={data}
          options={{
            ...options,
            maintainAspectRatio: false, // allow shrinking
          }}
        />
      </div>
    </div>
  );
}

function CategoryLegend({ labels, colorByLabel }) {
  if (!labels.length) return null;

  return (
    <div className="border rounded-lg p-4 shadow bg-white/70 text-slate-900 w-full sm:w-64 lg:w-72">
      <h3 className="text-sm font-semibold mb-3 text-center sm:text-left">Category Legend</h3>
      <ul className="space-y-2 text-xs">
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

export default function MFCloseCategoryCharts({ transactions = [], fundMaster = [] }) {
  const { isTrialMode } = useMFTrialMode();
  const charts = useMemo(() => {
    const masterMap = Object.fromEntries((fundMaster || []).map(m => [m.fund_short_name, m]));

    const investedByCat = {};
    const profitByCat = {};
    const flowsByCat = {};

    (transactions || []).forEach(t => {
      if (!t.sell_date) return;
      const units = Number(t.units) || 0;
      const buyNav = Number(t.buy_nav) || 0;
      const invested = units * buyNav;

      const master = masterMap[t.fund_short_name] || {};
      const cmp = master.cmp != null && master.cmp !== "" ? Number(master.cmp) : NaN;
      const lcp = master.lcp != null && master.lcp !== "" ? Number(master.lcp) : NaN;
      const nav = !isNaN(cmp) && cmp > 0 ? cmp : !isNaN(lcp) && lcp > 0 ? lcp : 0;
      const market = units * nav;

      const cat = (master.category || "Uncategorized").toString();
      investedByCat[cat] = (investedByCat[cat] || 0) + invested;

      const profit = market - invested;
      if (profit > 0) profitByCat[cat] = (profitByCat[cat] || 0) + profit;

      if (!flowsByCat[cat]) flowsByCat[cat] = [];
      flowsByCat[cat].push({ amount: -invested, date: new Date(t.buy_date) });
      if (market > 0) flowsByCat[cat].push({ amount: market, date: new Date() });
    });

    const cats = Array.from(new Set([...Object.keys(investedByCat), ...Object.keys(profitByCat)]));

    const investedVals = cats.map(c => investedByCat[c] || 0);
    const profitValsRaw = cats.map(c => profitByCat[c] || 0);

    const totalInvested = investedVals.reduce((a, b) => a + b, 0) || 1;
    const investedSharePct = investedVals.map(v => (v / totalInvested) * 100);

    const totalProfit = profitValsRaw.reduce((a, b) => a + b, 0) || 1;
    const profitSharePct = profitValsRaw.map(v => (v / totalProfit) * 100);

    const irrPct = cats.map((c, idx) => {
      const inv = investedVals[idx] || 0;
      const mv = (investedVals[idx] + profitValsRaw[idx]) || 0;
      return inv > 0 ? ((mv - inv) / inv) * 100 : 0;
    });

    const xirrPct = cats.map(c => {
      const flows = flowsByCat[c] || [];
      const x = calculateXIRR(flows);
      return x == null || isNaN(x) ? 0 : x;
    });

    const maskedInvestedVals = isTrialMode ? investedVals.map(() => 0) : investedVals;
    const maskedProfitValsRaw = isTrialMode ? profitValsRaw.map(() => 0) : profitValsRaw;
    const maskedIrrPct = isTrialMode ? irrPct.map(() => 0) : irrPct;
    const maskedXirrPct = isTrialMode ? xirrPct.map(() => 0) : xirrPct;
    return { cats, investedVals: maskedInvestedVals, investedSharePct, profitSharePct, irrPct: maskedIrrPct, xirrPct: maskedXirrPct, profitValsRaw: maskedProfitValsRaw };
  }, [transactions, fundMaster, isTrialMode]);

  const { cats, investedSharePct, profitSharePct, irrPct, xirrPct, profitValsRaw } = charts;

  const categoryColorMap = useMemo(() => {
    return cats.reduce((acc, cat, idx) => {
      acc[cat] = COLOR_PALETTE[idx % COLOR_PALETTE.length];
      return acc;
    }, {});
  }, [cats]);

  return (
    <div className="w-full max-w-screen-xl mx-auto p-3 sm:p-6">
      <div className="flex flex-col gap-4 sm:gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4 sm:gap-6">
          <PieBlock title="Invested Amount (%)" labels={cats} values={investedSharePct} valueFormatter="percent" percentOfTotal colorByLabel={categoryColorMap} />
          <PieBlock title="Realized Profit (%)" labels={cats} values={profitSharePct} valueFormatter="percent" percentOfTotal actualForTooltip={profitValsRaw} colorByLabel={categoryColorMap} />
          <PieBlock title="IRR (%)" labels={cats} values={irrPct} valueFormatter="percent" colorByLabel={categoryColorMap} />
          <PieBlock title="XIRR (%)" labels={cats} values={xirrPct} valueFormatter="percent" colorByLabel={categoryColorMap} />
        </div>
        <div className="flex justify-center">
          <CategoryLegend labels={cats} colorByLabel={categoryColorMap} />
        </div>
      </div>
    </div>
  );
}