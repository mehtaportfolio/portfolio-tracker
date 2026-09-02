import PropTypes from "prop-types";
import { useState, useEffect } from "react";
import Portfolio from "./Portfolio.jsx";
import Performance from "./Performance.jsx";
import AssetsTable from "./assets.jsx";
import { useAssetRowsOptimized } from "../../hooks/useAssetRowsOptimized.js";
import { useNavigation } from "../../context/NavigationContext.jsx";
import ModeHeader from "../Auth/ModeHeader.jsx";

const TABS = ["Portfolio", "Assets", "Performance"];

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactNumberFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0);

const formatCurrencyCompact = (value) => {
  const amount = Number(value) || 0;
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (absAmount >= 1e7) {
    return `${sign}₹${compactNumberFormatter.format(absAmount / 1e7)} Cr`;
  }

  if (absAmount >= 1e5) {
    return `${sign}₹${compactNumberFormatter.format(absAmount / 1e5)} L`;
  }

  if (absAmount >= 1e3) {
    return `${sign}₹${compactNumberFormatter.format(absAmount / 1e3)} K`;
  }

  return formatCurrency(amount);
};

const formatPercent = (value) => `${percentFormatter.format(Number(value) || 0)}%`;

function SummaryCard({ label, value, accentClass = "text-white" }) {
  return (
    <div className="rounded-[2rem] border border-gray-700/50 bg-gray-800/40 backdrop-blur-xl p-6 shadow-xl transition-all duration-300 hover:bg-gray-700/50 hover:shadow-2xl">
      <div className="text-sm font-medium text-gray-400 tracking-wide uppercase">{label}</div>
      <div className={`mt-2 text-2xl font-bold tracking-tight ${accentClass}`}>{value}</div>
    </div>
  );
}

SummaryCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
  accentClass: PropTypes.string,
};

export default function Dashboard() {
  const { initialSubTab, setInitialSubTab } = useNavigation();
  const hasPerformance = Boolean(Performance);
  const defaultTab = hasPerformance ? "Portfolio" : "Portfolio";
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    if (initialSubTab && TABS.includes(initialSubTab)) {
      setActiveTab(initialSubTab);
      setInitialSubTab(null);
    }
  }, [initialSubTab, setInitialSubTab]);

  const { rows, summary: assetSummary } = useAssetRowsOptimized();

  const profitAccent = assetSummary.profit > 0 ? "text-emerald-400" : assetSummary.profit < 0 ? "text-rose-400" : "text-white";

  return (
    <div className="w-full bg-gray-900 min-h-screen text-gray-100 font-sans selection:bg-indigo-500/30">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {/* Header with Mode Switcher */}
        <div className="flex flex-col mb-4">
          <ModeHeader />
        </div>

      {/* Tabs */}
      <div className="flex items-center justify-start mb-10 px-1">
        <div className="flex p-1.5 bg-gray-800/40 backdrop-blur-2xl rounded-[1.5rem] border border-gray-700/50 shadow-inner">
          {TABS.filter((tab) => (tab === "Performance" ? hasPerformance : true)).map((tab) => (
            <button
              key={tab}
              className={`px-8 py-3 font-bold text-sm rounded-[1.25rem] transition-all duration-500 ease-out
                ${
                  activeTab === tab
                    ? "bg-white text-gray-900 shadow-2xl scale-[1.02] translate-y-[-1px]"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5 active:scale-95"
                }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Portfolio" && (
        <div>
          <Portfolio />
        </div>
      )}

      {activeTab === "Assets" && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Market Value" value={formatCurrencyCompact(assetSummary.totalMarketValue)} />
            <SummaryCard label="Invested Value" value={formatCurrencyCompact(assetSummary.totalInvestedValue)} />
            <SummaryCard label="Return" value={formatCurrencyCompact(assetSummary.profit)} accentClass={profitAccent} />
            <SummaryCard label="Return %" value={formatPercent(assetSummary.profitPercent)} accentClass={profitAccent} />
          </div>
          <AssetsTable rows={rows} />
        </div>
      )}

      {hasPerformance && activeTab === "Performance" && <Performance />}
      </div>
    </div>
  );
}
