import React, { useState, useEffect, useMemo } from "react";
import { usePortfolioDataOptimized } from "../../../hooks/usePortfolioDataOptimized.js";
import { useTrialMode } from "../../../hooks/useTrialMode.js";
import { useMode } from "../../../context/ModeContext.jsx";
import { useLivePrices } from "../../../context/LivePriceContext.jsx";
import YearlyChartsOpen from "./OpenYearlyCharts.jsx";
import YearlyChartsClosed from "./ClosedYearlyCharts.jsx";
import { TrendingUp, PieChart, Briefcase, IndianRupee, Activity, BarChart3, Wallet, TrendingDown, LayoutGrid, ChevronDown } from "lucide-react";

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365;

// 🔹 Better XIRR: sort by date & base on earliest date
const calculateXIRR = (flows) => {
  if (!flows || flows.length < 2) return null;

  const cashflows = flows
    .map((cf) => ({ amount: Number(cf.amount), date: new Date(cf.date) }))
    .sort((a, b) => a.date - b.date);

  const t0 = cashflows[0].date;
  const npv = (rate) =>
    cashflows.reduce(
      (acc, cf) =>
        acc +
        cf.amount /
          Math.pow(1 + rate, (cf.date - t0) / MS_PER_YEAR),
      0
    );

  let low = -0.9999;
  let high = 100; // 10,000% upper cap
  let guess = 0.1;

  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const val = npv(mid);
    if (Math.abs(val) < 1e-6) return mid * 100; // %
    if (val > 0) low = mid;
    else high = mid;
    guess = mid;
  }
  return guess * 100;
};


// Format amounts in Indian system with short units (Cr, L).
function formatINRShort(value) {
  const num = Number(value) || 0;
  const abs = Math.abs(num);

  const CRORE = 1e7; // 1,00,00,000
  const LAKH = 1e5;  // 1,00,000
  const THOUSAND = 1e3; // 1,000

  if (abs >= CRORE) return `₹${(num / CRORE).toFixed(2)} Cr`;
  if (abs >= LAKH) return `₹${(num / LAKH).toFixed(2)} L`;
  if (abs >= THOUSAND) return `₹${(num / THOUSAND).toFixed(1)} K`;
  
  return `₹${num.toLocaleString("en-IN")}`;
}

const Portfolio = () => {
  const { isTrialMode } = useTrialMode();
  const { priceSource } = useMode();
  const { livePrices } = useLivePrices();
  // Use optimized backend API for portfolio data
  const {
    openStats: backendOpenStats,
    closedStats: backendClosedStats,
    openSummary,
    openTransactions,
    closedTransactions,
    masterMap,
  } = usePortfolioDataOptimized();

  const [toggle, setToggle] = useState("open"); // "open" | "closed" | "all"
  const [summarySubTab, setSummarySubTab] = useState("active"); // "active" | "exit"
  const [filterType, setFilterType] = useState("account_name"); // "all", "account_name", "account_type"
  const [selectedEquityType, setSelectedEquityType] = useState("");
  const [selectedAccountType, setSelectedAccountType] = useState("");
  const [stockMaster, setStockMaster] = useState([]);

  // Reset filters when subtab changes
  useEffect(() => {
    setSelectedEquityType("");
    setSelectedAccountType("");
  }, [summarySubTab]);

  // Update stockMaster from backend masterMap
  useEffect(() => {
    if (masterMap && Object.keys(masterMap).length > 0) {
      const masters = Object.entries(masterMap).map(([stock_name, data]) => ({
        stock_name,
        ...data,
      }));
      setStockMaster(masters);
    }
  }, [masterMap]);

const equityTypes = useMemo(() => {
  const list = summarySubTab === "active" ? openTransactions : closedTransactions;
  return Array.from(new Set(list.map((t) => (t.equity_type || "Unknown").toLowerCase()))).sort();
}, [summarySubTab, openTransactions, closedTransactions]);

const accountTypesOptions = useMemo(() => {
  const list = summarySubTab === "active" ? openTransactions : closedTransactions;
  return Array.from(new Set(list.map((t) => (t.account_type || "Unknown").toLowerCase()))).sort();
}, [summarySubTab, openTransactions, closedTransactions]);

// 🔹 Filtering function
const filterTransactions = (transactions) => {
  if (!Array.isArray(transactions) || !transactions.length) return [];

  let filtered = transactions;

  // 🔹 Apply Equity Type filter
  if (selectedEquityType) {
    filtered = filtered.filter((t) => (t.equity_type || "Unknown").toLowerCase() === selectedEquityType.toLowerCase());
  }
  
  // 🔹 Apply Account Type filter
  if (selectedAccountType) {
    filtered = filtered.filter((t) => (t.account_type || "Unknown").toLowerCase() === selectedAccountType.toLowerCase());
  }

  return filtered;
};

  // 🔹 Recalculate openStats if priceSource is live
  const openStats = useMemo(() => {
    if (!backendOpenStats || !openTransactions) return { invested: 0, currentValue: 0, dayChange: 0, absReturn: 0, returnPct: 0, xirr: null };
    
    if (priceSource !== 'live') return backendOpenStats;

    let totalInvested = 0;
    let totalMarketValue = 0;
    let totalDayChange = 0;
    const cashflows = [];

    const openTxns = (openTransactions || []).filter(t => !t.sell_date);
    
    // Group by stock to get symbol_ao
    const stocksMap = {};
    openTxns.forEach(t => {
      if (!stocksMap[t.stock_name]) {
        stocksMap[t.stock_name] = { invested: 0, quantity: 0, symbol_ao: t.symbol_ao };
      }
      stocksMap[t.stock_name].invested += t.quantity * t.buy_price;
      stocksMap[t.stock_name].quantity += t.quantity;
      cashflows.push({ amount: -t.quantity * t.buy_price, date: new Date(t.buy_date) });
    });

    Object.entries(stocksMap).forEach(([name, data]) => {
      totalInvested += data.invested;
      const livePrice = livePrices[data.symbol_ao] || (masterMap && masterMap[name]?.cmp) || 0;
      const lcp = (masterMap && masterMap[name]?.lcp) || 0;
      
      totalMarketValue += data.quantity * livePrice;
      totalDayChange += data.quantity * (livePrice - lcp);
    });

    if (totalMarketValue > 0) {
      cashflows.push({ amount: totalMarketValue, date: new Date() });
    }

    const absReturn = totalMarketValue - totalInvested;
    const returnPct = totalInvested > 0 ? (absReturn / totalInvested) * 100 : 0;
    const xirr = calculateXIRR(cashflows);

    return {
      invested: totalInvested,
      currentValue: totalMarketValue,
      dayChange: totalDayChange,
      absReturn,
      returnPct,
      xirr
    };
  }, [backendOpenStats, openTransactions, priceSource, livePrices, masterMap]);

  const closedStats = backendClosedStats || { invested: 0, realizedValue: 0, realizedProfit: 0, returnPct: 0, xirr: null };
  const openTxns = openTransactions || [];
  const closedTxns = closedTransactions || [];

  // 🔹 Reusable Account Breakdown (isClosed toggles MV/Day & realized logic)
  const renderAccountBreakdown = (txns, isClosed = false, filterType = "") => {

// Order for account types (normalized to lowercase for comparison)
const accountTypeOrder = ["free", "regular"];

// Sorted account names (normalized to lowercase for uniqueness)
const accountsByName = Array.from(new Set(txns.map(t => (t.account_name || "Unknown").toLowerCase())))
  .sort((a, b) => a.localeCompare(b));


// Sorted account types (normalized to lowercase for uniqueness)
const accountsByType = Array.from(new Set(txns.map((t) => (t.account_type || "Unknown").toLowerCase()))).sort(
  (a, b) => {
    const indexA = accountTypeOrder.indexOf(a);
    const indexB = accountTypeOrder.indexOf(b);
    const posA = indexA === -1 ? Infinity : indexA;
    const posB = indexB === -1 ? Infinity : indexB;
    return posA - posB;
  }
);


    const masterMap = Object.fromEntries(stockMaster.map((m) => [m.stock_name, m]));

    const renderTable = (accounts, keyField) => (
      <div className="overflow-hidden bg-gray-800/20 backdrop-blur-xl rounded-[2.5rem] border border-gray-700/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-700/50">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">{keyField.replace("_", " ")}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">{isClosed ? "Realized Value" : "Market Value"}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Invested Value</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Overall Return</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Return %</th>
                {!isClosed && <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Today's P&L</th>}
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">XIRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/30">
              {accounts.map((account) => {
                const accTxns = txns.filter((t) => (t[keyField] || "Unknown").toLowerCase() === account);
                let invested = 0, currentValue = 0, dayChange = 0;
                const cashflows = [];

                accTxns.forEach((txn) => {
                  const livePrice = (priceSource === 'live' && txn.symbol_ao) ? livePrices[txn.symbol_ao] : null;
                  const cmp = livePrice || parseFloat(masterMap[txn.stock_name]?.cmp || 0);
                  invested += txn.quantity * txn.buy_price;

                  if (!isClosed) {
                    currentValue += cmp ? txn.quantity * cmp : 0;
                    const lcp = parseFloat(masterMap[txn.stock_name]?.lcp || 0);
                    dayChange += cmp && lcp ? txn.quantity * (cmp - lcp) : 0;
                  }

                  cashflows.push({ amount: -txn.quantity * txn.buy_price, date: new Date(txn.buy_date) });

                  if (txn.sell_date) {
                    cashflows.push({ amount: txn.quantity * txn.sell_price, date: new Date(txn.sell_date) });
                  }
                });

                if (!isClosed && currentValue > 0) {
                  cashflows.push({ amount: currentValue, date: new Date() });
                }

                let absReturn;
                if (isClosed) {
                  absReturn = accTxns.reduce((sum, t) => sum + (t.sell_price - t.buy_price) * t.quantity, 0);
                } else {
                  absReturn = currentValue - invested;
                }

                const absReturnPct = invested > 0 ? (absReturn / invested) * 100 : 0;
                const xirr = calculateXIRR(cashflows);

                return (
                  <tr key={account} className="hover:bg-gray-700/20 transition-all group">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full ${ (isTrialMode ? 0 : absReturn) >= 0 ? "bg-emerald-500" : "bg-rose-500" }`} />
                        <span className="text-xs font-bold text-white uppercase tracking-tight">
                          {account.charAt(0).toUpperCase() + account.slice(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right whitespace-nowrap">
                      <div className="text-sm font-bold text-white tracking-tight">
                        {formatINRShort(isTrialMode ? 0 : (isClosed ? absReturn + invested : currentValue))}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-300 tracking-tight">
                        {formatINRShort(isTrialMode ? 0 : invested)}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right whitespace-nowrap">
                      <div className={`text-sm font-bold ${ (isTrialMode ? 0 : absReturn) >= 0 ? "text-emerald-400" : "text-rose-400" }`}>
                        {(isTrialMode ? 0 : absReturn) >= 0 ? "+" : ""}{formatINRShort(isTrialMode ? 0 : absReturn)}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right whitespace-nowrap">
                      <div className={`text-xs font-bold ${ (isTrialMode ? 0 : absReturnPct) >= 0 ? "text-emerald-400" : "text-rose-400" }`}>
                        { (isTrialMode ? 0 : absReturnPct) >= 0 ? "+" : "" }{(isTrialMode ? 0 : absReturnPct).toFixed(1)}%
                      </div>
                    </td>
                    {!isClosed && (
                      <td className="px-6 py-5 text-right whitespace-nowrap">
                        <div className={`text-xs font-bold ${ (isTrialMode ? 0 : dayChange) >= 0 ? "text-cyan-400" : "text-pink-400" }`}>
                          {(isTrialMode ? 0 : dayChange) >= 0 ? "+" : ""}{formatINRShort(isTrialMode ? 0 : dayChange)}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-5 text-right whitespace-nowrap">
                      <div className="text-xs font-bold text-violet-400">
                        {xirr ? (isTrialMode ? 0 : xirr).toFixed(1) + "%" : "-"}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );

    return (
      <div className="space-y-12">
        {(!filterType || filterType === "account_name") && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Wallet className="text-orange-400" size={20} />
              <h2 className="text-lg font-bold text-white tracking-tight">Summary by Account</h2>
            </div>
            {renderTable(accountsByName, "account_name")}
          </div>
        )}

        {(!filterType || filterType === "account_type") && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Activity className="text-blue-400" size={20} />
              <h2 className="text-lg font-bold text-white tracking-tight">Summary by Type</h2>
            </div>
            {renderTable(accountsByType, "account_type")}
          </div>
        )}
      </div>
    );
  };

const activeStocksCount = openSummary?.length
  ? openSummary.length
  : new Set(openTxns.map((txn) => txn.stock_name)).size;


  return (
    <div className="px-4 py-6 sm:p-8 max-w-7xl mx-auto bg-gray-900 min-h-screen text-gray-100">
      {/* iOS Segmented Control - Main Toggle */}
      <div className="flex justify-center mb-8 px-2">
        <div className="bg-gray-800/40 backdrop-blur-2xl p-1.5 rounded-[1.5rem] flex w-full max-w-md shadow-inner border border-gray-700/50">
          <button
            className={`flex-1 py-2.5 text-sm font-bold rounded-[1.25rem] transition-all duration-500 ease-out ${
              toggle === "open"
                ? "bg-white text-gray-900 shadow-2xl scale-[1.02] translate-y-[-1px]"
                : "text-gray-400 hover:text-gray-200 hover:bg-white/5 active:scale-95"
            }`}
            onClick={() => setToggle("open")}
          >
            Dashboard
          </button>
          <button
            className={`flex-1 py-2.5 text-sm font-bold rounded-[1.25rem] transition-all duration-500 ease-out ${
              toggle === "closed"
                ? "bg-white text-gray-900 shadow-2xl scale-[1.02] translate-y-[-1px]"
                : "text-gray-400 hover:text-gray-200 hover:bg-white/5 active:scale-95"
            }`}
            onClick={() => setToggle("closed")}
          >
            Summary
          </button>
        </div>
      </div>

      {toggle === "open" ? (
  <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
    {/* 🔹 Portfolio Summary Cards */}
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          Portfolio Overview
        </h2>
        <span className="text-xs font-bold text-indigo-400 bg-indigo-900/30 px-3 py-1 rounded-full uppercase tracking-wider border border-indigo-500/20">Active</span>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Equity Value */}
        <div className="bg-gradient-to-br from-blue-600/20 to-indigo-900/40 backdrop-blur-xl p-4 sm:p-6 rounded-[2rem] shadow-xl border border-blue-500/20 flex flex-col justify-between hover:from-blue-600/30 hover:to-indigo-900/50 transition-all duration-300 group overflow-hidden relative">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-500/10 blur-2xl rounded-full" />
          <div className="flex items-center gap-2 sm:gap-3 mb-4 relative z-10">
            <div className="p-2 sm:p-2.5 bg-blue-500/30 rounded-2xl text-blue-300 group-hover:scale-110 transition-transform">
              <TrendingUp size={18} strokeWidth={2.5} />
            </div>
            <h3 className="text-[10px] sm:text-xs font-bold text-blue-200/70 uppercase tracking-widest">Market Value</h3>
          </div>
          <div className="relative z-10">
            <p className="text-xl sm:text-2xl font-bold text-white mb-1 tracking-tight">{formatINRShort(isTrialMode ? 0 : openStats.currentValue)}</p>
            <p className="text-[10px] sm:text-xs font-medium text-blue-200/50">
              Invested: <span className="text-blue-100">₹{isTrialMode ? 0 : (openStats.invested / 100000).toFixed(2)}L</span>
            </p>
          </div>
        </div>

        {/* Net Returns */}
        <div className={`bg-gradient-to-br ${ (isTrialMode ? 0 : openStats.absReturn) >= 0 ? "from-emerald-600/20 to-teal-900/40 border-emerald-500/20" : "from-rose-600/20 to-red-900/40 border-rose-500/20" } backdrop-blur-xl p-4 sm:p-6 rounded-[2rem] shadow-xl border flex flex-col justify-between hover:opacity-90 transition-all duration-300 group overflow-hidden relative`}>
          <div className={`absolute -right-4 -top-4 w-20 h-20 ${ (isTrialMode ? 0 : openStats.absReturn) >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10" } blur-2xl rounded-full`} />
          <div className="flex items-center gap-2 sm:gap-3 mb-4 relative z-10">
            <div className={`p-2 sm:p-2.5 rounded-2xl ${ (isTrialMode ? 0 : openStats.absReturn) >= 0 ? "bg-emerald-500/30 text-emerald-300" : "bg-rose-500/30 text-rose-300" } group-hover:scale-110 transition-transform`}>
              <PieChart size={18} strokeWidth={2.5} />
            </div>
            <h3 className={`text-[10px] sm:text-xs font-bold ${ (isTrialMode ? 0 : openStats.absReturn) >= 0 ? "text-emerald-200/70" : "text-rose-200/70" } uppercase tracking-widest`}>Net Returns</h3>
          </div>
          <div className="relative z-10">
            <div className="flex items-baseline gap-1 sm:gap-2 mb-1">
              <p className={`text-xl sm:text-2xl font-bold tracking-tight ${ (isTrialMode ? 0 : openStats.absReturn) >= 0 ? "text-emerald-300" : "text-rose-300" }`}>
                {(isTrialMode ? 0 : openStats.absReturn) >= 0 ? "+" : ""}{formatINRShort(isTrialMode ? 0 : openStats.absReturn)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className={`text-xs sm:text-sm font-bold flex items-center gap-0.5 ${ (isTrialMode ? 0 : openStats.returnPct) >= 0 ? "text-emerald-300" : "text-rose-300" }`}>
                { (isTrialMode ? 0 : openStats.returnPct) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} /> }
                {Math.abs(Number(isTrialMode ? 0 : openStats.returnPct || 0)).toFixed(1)}%
              </span>
              <span className={`text-[9px] sm:text-[10px] font-bold ${ (isTrialMode ? 0 : openStats.absReturn) >= 0 ? "text-emerald-200/50" : "text-rose-200/50" } uppercase tracking-tighter`}>Total P/L</span>
            </div>
          </div>
        </div>

        {/* Day Change */}
        <div className={`bg-gradient-to-br ${ (isTrialMode ? 0 : openStats.dayChange) >= 0 ? "from-cyan-600/20 to-blue-900/40 border-cyan-500/20" : "from-pink-600/20 to-purple-900/40 border-pink-500/20" } backdrop-blur-xl p-4 sm:p-6 rounded-[2rem] shadow-xl border flex flex-col justify-between hover:opacity-90 transition-all duration-300 group overflow-hidden relative`}>
          <div className={`absolute -right-4 -top-4 w-20 h-20 ${ (isTrialMode ? 0 : openStats.dayChange) >= 0 ? "bg-cyan-500/10" : "bg-pink-500/10" } blur-2xl rounded-full`} />
          <div className="flex items-center gap-2 sm:gap-3 mb-4 relative z-10">
            <div className={`p-2 sm:p-2.5 rounded-2xl ${ (isTrialMode ? 0 : openStats.dayChange) >= 0 ? "bg-cyan-500/30 text-cyan-300" : "bg-pink-500/30 text-pink-300" } group-hover:scale-110 transition-transform`}>
              <BarChart3 size={18} strokeWidth={2.5} />
            </div>
            <h3 className={`text-[10px] sm:text-xs font-bold ${ (isTrialMode ? 0 : openStats.dayChange) >= 0 ? "text-cyan-200/70" : "text-pink-200/70" } uppercase tracking-widest`}>Day Change</h3>
          </div>
          <div className="relative z-10">
            <div className="flex items-baseline gap-1 sm:gap-2 mb-1">
              <p className={`text-xl sm:text-2xl font-bold tracking-tight ${ (isTrialMode ? 0 : openStats.dayChange) >= 0 ? "text-cyan-300" : "text-pink-300" }`}>
                {(isTrialMode ? 0 : openStats.dayChange) >= 0 ? "+" : ""}{formatINRShort(isTrialMode ? 0 : openStats.dayChange)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className={`text-xs sm:text-sm font-bold flex items-center gap-0.5 ${ (isTrialMode ? 0 : openStats.dayChange) >= 0 ? "text-cyan-300" : "text-pink-300" }`}>
                { (isTrialMode ? 0 : openStats.dayChange) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} /> }
                {(Math.abs((isTrialMode ? 0 : openStats.dayChange) / ((isTrialMode ? 0 : openStats.currentValue) - (isTrialMode ? 0 : openStats.dayChange) || 1)) * 100).toFixed(2)}%
              </span>
              <span className={`text-[9px] sm:text-[10px] font-bold ${ (isTrialMode ? 0 : openStats.dayChange) >= 0 ? "text-cyan-200/50" : "text-pink-200/50" } uppercase tracking-tighter`}>Today</span>
            </div>
          </div>
        </div>

        {/* Assets */}
        <div className="bg-gradient-to-br from-violet-600/20 to-purple-900/40 backdrop-blur-xl p-4 sm:p-6 rounded-[2rem] shadow-xl border border-violet-500/20 flex flex-col justify-between hover:from-violet-600/30 hover:to-purple-900/50 transition-all duration-300 group overflow-hidden relative">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-violet-500/10 blur-2xl rounded-full" />
          <div className="flex items-center gap-2 sm:gap-3 mb-4 relative z-10">
            <div className="p-2 sm:p-2.5 bg-violet-500/30 rounded-2xl text-violet-300 group-hover:scale-110 transition-transform">
              <Briefcase size={18} strokeWidth={2.5} />
            </div>
            <h3 className="text-[10px] sm:text-xs font-bold text-violet-200/70 uppercase tracking-widest">Holdings</h3>
          </div>
          <div className="relative z-10">
            <p className="text-xl sm:text-2xl font-bold text-white mb-1 tracking-tight">{activeStocksCount}</p>
            <p className="text-[10px] sm:text-xs font-medium text-violet-200/50">Active Symbols</p>
          </div>
        </div>
      </div>
    </div>

    {/* 🔹 Closed Summary */}
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <PieChart className="w-5 h-5 text-indigo-400" />
          Sold Summary
        </h2>
        <span className="text-xs font-bold text-rose-400 bg-rose-900/30 px-3 py-1 rounded-full uppercase tracking-wider border border-rose-500/20">Realized</span>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Realized Profit Card */}
        <div className={`bg-gradient-to-br ${ (isTrialMode ? 0 : closedStats.realizedProfit) >= 0 ? "from-emerald-600/20 to-teal-900/40 border-emerald-500/20" : "from-rose-600/20 to-red-900/40 border-rose-500/20" } backdrop-blur-xl p-4 sm:p-6 rounded-[2rem] shadow-xl border flex flex-col justify-between hover:opacity-90 transition-all duration-300 group overflow-hidden relative`}>
          <div className={`absolute -right-4 -top-4 w-20 h-20 ${ (isTrialMode ? 0 : closedStats.realizedProfit) >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10" } blur-2xl rounded-full`} />
          <div className="flex items-center gap-2 sm:gap-3 mb-4 relative z-10">
            <div className={`p-2 sm:p-2.5 rounded-2xl ${ (isTrialMode ? 0 : closedStats.realizedProfit) >= 0 ? "bg-emerald-500/30 text-emerald-300" : "bg-rose-500/30 text-rose-300" } group-hover:scale-110 transition-transform`}>
              <IndianRupee size={18} strokeWidth={2.5} />
            </div>
            <h3 className={`text-[10px] sm:text-xs font-bold ${ (isTrialMode ? 0 : closedStats.realizedProfit) >= 0 ? "text-emerald-200/70" : "text-rose-200/70" } uppercase tracking-widest`}>Realized P/L</h3>
          </div>
          <div className="relative z-10">
            <p className={`text-xl sm:text-2xl font-bold tracking-tight mb-1 ${ (isTrialMode ? 0 : closedStats.realizedProfit) >= 0 ? "text-emerald-300" : "text-rose-300" }`}>
              {(isTrialMode ? 0 : closedStats.realizedProfit) >= 0 ? "+" : ""}
              {formatINRShort(isTrialMode ? 0 : closedStats.realizedProfit)}
            </p>
            <p className={`text-[9px] sm:text-[10px] font-medium ${ (isTrialMode ? 0 : closedStats.realizedProfit) >= 0 ? "text-emerald-200/50" : "text-rose-200/50" }`}>
              Net of Charges: <span className="text-white">₹{ (isTrialMode ? 0 : closedStats.totalCharges || 0).toLocaleString("en-IN") }</span>
            </p>
          </div>
        </div>

        {/* Performance Card */}
        <div className="bg-gradient-to-br from-amber-600/20 to-orange-900/40 backdrop-blur-xl p-4 sm:p-6 rounded-[2rem] shadow-xl border border-amber-500/20 flex flex-col justify-between hover:from-amber-600/30 hover:to-orange-900/50 transition-all duration-300 group overflow-hidden relative">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-500/10 blur-2xl rounded-full" />
          <div className="flex items-center gap-2 sm:gap-3 mb-4 relative z-10">
            <div className="p-2 sm:p-2.5 bg-amber-500/30 rounded-2xl text-amber-300 group-hover:scale-110 transition-transform">
              <Activity size={18} strokeWidth={2.5} />
            </div>
            <h3 className="text-[10px] sm:text-xs font-bold text-amber-200/70 uppercase tracking-widest">Performance</h3>
          </div>
          <div className="flex items-end justify-between relative z-10">
            <div>
              <p className={`text-xl sm:text-2xl font-bold tracking-tight mb-1 ${ (isTrialMode ? 0 : closedStats.returnPct || 0) >= 0 ? "text-emerald-300" : "text-rose-300" }`}>
                {Number(isTrialMode ? 0 : closedStats.returnPct || 0).toFixed(1)}%
              </p>
              <p className="text-[9px] sm:text-[10px] font-medium text-amber-200/50 uppercase tracking-tight">Realized IRR</p>
            </div>
            <div className="text-right">
              <p className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {closedStats.xirr ? (isTrialMode ? 0 : closedStats.xirr).toFixed(1) + "%" : "-"}
              </p>
              <p className="text-[9px] sm:text-[10px] font-bold text-amber-200/50 uppercase tracking-tight">XIRR</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
) : (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    {/* 🔹 Summary Sub Tabs - iOS Segmented Control */}
    <div className="flex justify-center">
      <div className="bg-gray-800/40 backdrop-blur-2xl p-1.5 rounded-[1.5rem] flex w-full max-w-xs shadow-inner border border-gray-700/50">
        <button
          onClick={() => setSummarySubTab("active")}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-500 ease-out ${
            summarySubTab === "active"
              ? "bg-white text-gray-900 shadow-2xl scale-[1.02] translate-y-[-1px]"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setSummarySubTab("exit")}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-500 ease-out ${
            summarySubTab === "exit"
              ? "bg-white text-gray-900 shadow-2xl scale-[1.02] translate-y-[-1px]"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Exit
        </button>
      </div>
    </div>

    {/* 🔹 Modern Filters */}
    <div className="bg-gray-800/20 backdrop-blur-xl p-6 rounded-[2.5rem] shadow-xl border border-gray-700/30 mask-hide-when-on">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 flex items-center gap-2">
            <LayoutGrid size={12} className="text-indigo-400" />
            Group By
          </label>
          <div className="relative group">
            <select
              className="w-full bg-gray-900/40 border border-gray-700/30 text-sm font-bold text-gray-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer appearance-none hover:bg-gray-900/60"
              onChange={(e) => setFilterType(e.target.value)}
              value={filterType}
            >
              <option value="account_name" className="bg-gray-900">Account Name</option>
              <option value="account_type" className="bg-gray-900">Account Type</option>
              <option value="year" className="bg-gray-900">Calendar Year</option>
              <option value="fy" className="bg-gray-900">Financial Year</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 group-hover:text-indigo-400 transition-colors">
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 flex items-center gap-2">
            <PieChart size={12} className="text-emerald-400" />
            Equity Type
          </label>
          <div className="relative group">
            <select
              className="w-full bg-gray-900/40 border border-gray-700/30 text-sm font-bold text-gray-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer appearance-none hover:bg-gray-900/60"
              onChange={(e) => setSelectedEquityType(e.target.value)}
              value={selectedEquityType}
            >
              <option value="" className="bg-gray-900">All Equities</option>
              {equityTypes.map((type) => (
                <option key={type} value={type} className="bg-gray-900">
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 group-hover:text-emerald-400 transition-colors">
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 flex items-center gap-2">
            <Wallet size={12} className="text-violet-400" />
            Account Type
          </label>
          <div className="relative group">
            <select
              className="w-full bg-gray-900/40 border border-gray-700/30 text-sm font-bold text-gray-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer appearance-none hover:bg-gray-900/60"
              onChange={(e) => setSelectedAccountType(e.target.value)}
              value={selectedAccountType}
            >
              <option value="" className="bg-gray-900">All Accounts</option>
              {accountTypesOptions.map((type) => (
                <option key={type} value={type} className="bg-gray-900">
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 group-hover:text-violet-400 transition-colors">
              <ChevronDown size={16} />
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* 🔹 Render based on Active/Exit */}
    {summarySubTab === "active" ? (
      <div className="mask-hide-when-on space-y-8">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            Active Portfolio Summary
          </h2>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/20 px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-500/20">Live</span>
        </div>
        {openTxns?.length > 0 ? (
          <>
            {renderAccountBreakdown(filterTransactions(openTxns), false, filterType)}

            {!isTrialMode && (
              <div className="mt-8">
                {filterType === "year" && (
                  <YearlyChartsOpen transactions={filterTransactions(openTxns)} stockMaster={stockMaster} mode="year" />
                )}
                {filterType === "fy" && (
                  <YearlyChartsOpen transactions={filterTransactions(openTxns)} stockMaster={stockMaster} mode="fy" />
                )}
              </div>
            )}
          </>
        ) : (
          <div className="bg-gray-800/20 backdrop-blur-sm p-12 rounded-[2rem] border border-dashed border-gray-700/50 text-center">
            <p className="text-gray-500 font-medium text-sm">No active holdings available for the selected filters.</p>
          </div>
        )}
      </div>
    ) : (
      <div className="mask-hide-when-on space-y-8">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <PieChart className="w-5 h-5 text-indigo-400" />
            Closed Portfolio Summary
          </h2>
          <span className="text-[10px] font-bold text-rose-400 bg-rose-900/20 px-3 py-1 rounded-full uppercase tracking-widest border border-rose-500/20">Settled</span>
        </div>
        {closedTxns?.length > 0 ? (
          <>
            {renderAccountBreakdown(filterTransactions(closedTxns), true, filterType)}

            {!isTrialMode && (
              <div className="mt-8">
                {filterType === "year" && (
                  <YearlyChartsClosed transactions={filterTransactions(closedTxns)} mode="year" />
                )}
                {filterType === "fy" && (
                  <YearlyChartsClosed transactions={filterTransactions(closedTxns)} mode="fy" />
                )}
              </div>
            )}
          </>
        ) : (
          <div className="bg-gray-800/20 backdrop-blur-sm p-12 rounded-[2rem] border border-dashed border-gray-700/50 text-center">
            <p className="text-gray-500 font-medium text-sm">No closed transactions available for the selected filters.</p>
          </div>
        )}
      </div>
    )}
  </div>
)}

    </div>
  );
};

export default Portfolio;
