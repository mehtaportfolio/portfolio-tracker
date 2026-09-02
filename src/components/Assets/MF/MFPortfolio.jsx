import React, { useState, useEffect, useMemo, useCallback } from "react";
import { isEquityMasked } from "../../../utils/EquityMasker.js";
import { useMFTrialMode, getMaskedStats } from "../../../utils/MFTrialMode.js";
import MFYearlyChartsOpen from "./MFOpenYearlyCharts.jsx";
import MFYearlyChartsClosed from "./MFClosedYearlyCharts.jsx";
import MFOpenAMCCharts from "./MFOpenAMCCharts.jsx";
import MFCloseAMCCharts from "./MFCloseAMCCharts.jsx";
import { TrendingUp, PieChart, Briefcase, IndianRupee, Activity, TrendingDown, LayoutGrid, ChevronDown, FileText } from "lucide-react";
import { computeMutualFundRealizedAndOpen } from "../../../utils/realizedCalculations.js";

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365;

// 🔹 XIRR Calculation
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

const MFPortfolio = ({ 
  txns: propTxns = [], 
  funds: propFunds = [], 
  sips: propSips = [],
  sipAccountAmounts: propSipAccountAmounts = {},
  setIsAnyFormOpen 
}) => {
  const { isTrialMode } = useMFTrialMode();
  const [toggle, setToggle] = useState("open"); // "open" | "closed"
  const [openTxns, setOpenTxns] = useState([]);
  const [closedTxns, setClosedTxns] = useState([]);
  const [fundMaster, setFundMaster] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [masked, setMasked] = useState(false);
  const [summarySubTab, setSummarySubTab] = useState("active"); // "active" | "exit"
  const [filterType, setFilterType] = useState(""); // "all", "account_name", "account_type"
  const [accountFilter, setAccountFilter] = useState("");
  const [accountList, setAccountList] = useState([]);
  const [showSIPForm, setShowSIPForm] = useState(false);
  const [sipAssumptions, setSipAssumptions] = useState({
    sipAmount: 10000,
    years: 25,
    cagr: 15,
    increment: 5,
    currentCorpus: null,
    excludeCorpusFromInvested: true,
  });
  const [sipAccountAmounts] = useState(propSipAccountAmounts);

  useEffect(() => {
    setMasked(isEquityMasked());
  }, []);

  useEffect(() => {
    if (propFunds && propFunds.length > 0) {
      setFundMaster(propFunds);
      const all = propTxns || [];
      const open = all.filter(t => (t.transaction_type || "").toLowerCase() === "buy");
      const closed = all.filter(t => (t.transaction_type || "").toLowerCase() === "sell");
      setOpenTxns(open);
      setClosedTxns(closed);

      const uniqueAccounts = Array.from(new Set(all.map(t => t.account_name).filter(Boolean))).sort();
      setAccountList(uniqueAccounts);
    }
  }, [propTxns, propFunds]);

  // 🔹 Compute OPEN stats from FIFO open lots (for account-level breakdown)
  const computeOpenStatsFromLots = useCallback((lots) => {
    const masterMap = Object.fromEntries(fundMaster.map((m) => [(m.fund_short_name || '').trim().toUpperCase(), m]));
    let invested = 0, currentValue = 0, dayChange = 0;
    const cashflows = [];

    (lots || []).forEach((lot, idx) => {
      const qty = Number(lot.units) || 0;
      const buy = Number(lot.buy_nav) || 0;
      const fundName = (lot.fund_short_name || lot.fundName || '').trim().toUpperCase();
      const master = masterMap[fundName];
      const cmp = Number(master?.cmp) || 0;
      const lcp = Number(master?.lcp) || 0;

      invested += qty * buy;
      currentValue += qty * cmp;
      dayChange += qty * (cmp - lcp);

      cashflows.push({ amount: -(qty * buy), date: new Date(lot.buy_date) });
    });

    if (currentValue > 0) {
      cashflows.push({ amount: currentValue, date: new Date() });
    }

    const absReturn = currentValue - invested;
    const returnPct = invested > 0 ? (absReturn / invested) * 100 : 0;
    const xirr = calculateXIRR(cashflows);

    return { invested, currentValue, dayChange, absReturn, returnPct, xirr };
  }, [fundMaster]);

  // 🔹 Compute CLOSED stats
  const computeClosedStats = useCallback(
    (txns) => {
      const sells = (txns || []).filter(t => String(t.transaction_type || "").toLowerCase() === "sell");
      if (!sells.length) return { invested: 0, realizedValue: 0, realizedProfit: 0, returnPct: 0, xirr: null };

      const keySet = new Set(sells.map(t => `${t.fund_short_name.trim()}||${t.account_name||""}`));
      const universe = (propTxns.length ? propTxns : [...openTxns, ...closedTxns]).filter(t => keySet.has(`${t.fund_short_name.trim()}||${t.account_name||""}`));

      const cashflows = [];
      let realizedCost = 0;
      let realizedValue = 0;

      const byKey = new Map();
      universe.forEach((t) => {
        const k = `${t.fund_short_name.trim()}||${t.account_name||""}`;
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k).push(t);
      });

      byKey.forEach((arr) => {
        arr.sort((a, b) => new Date(a.date) - new Date(b.date));
        const lots = [];

        arr.forEach((t) => {
          const tt = String(t.transaction_type || "").toLowerCase();
          const units = Number(t.units) || 0;
          const nav = Number(t.nav) || 0;
          const dt = new Date(t.date);
          if (!units || !nav) return;

          if (tt === "buy") {
            lots.push({ units, nav, date: dt });
          } else if (tt === "sell") {
            let remaining = units;
            cashflows.push({ amount: units * nav, date: dt });
            while (remaining > 0 && lots.length) {
              const lot = lots[0];
              const take = Math.min(remaining, lot.units);
              cashflows.push({ amount: -(take * lot.nav), date: lot.date });
              realizedCost += take * lot.nav;
              realizedValue += take * nav;
              lot.units -= take;
              remaining -= take;
              if (lot.units <= 1e-8) lots.shift();
            }
          }
        });
      });

      const realizedProfit = realizedValue - realizedCost;
      const returnPct = realizedCost > 0 ? (realizedProfit / realizedCost) * 100 : 0;
      const xirr = calculateXIRR(cashflows);

      return { invested: realizedCost, realizedValue, realizedProfit, returnPct, xirr };
    },
    [propTxns, openTxns, closedTxns]
  );

  const closedStats = useMemo(() => {
    const stats = computeClosedStats(closedTxns);
    return getMaskedStats(stats, isTrialMode);
  }, [computeClosedStats, closedTxns, isTrialMode]);

  const allTxnsForSplits = useMemo(() => (propTxns && propTxns.length ? propTxns : [...openTxns, ...closedTxns]), [propTxns, openTxns, closedTxns]);
  const closedSplits = useMemo(() => {
    const { realizedSplits } = computeMutualFundRealizedAndOpen(allTxnsForSplits);
    return realizedSplits;
  }, [allTxnsForSplits]);

  const openLots = useMemo(() => {
    const { open } = computeMutualFundRealizedAndOpen(allTxnsForSplits);
    return open?.lots ?? [];
  }, [allTxnsForSplits]);

  const openStats = useMemo(() => {
    const stats = computeOpenStatsFromLots(openLots);
    return getMaskedStats(stats, isTrialMode);
  }, [openLots, isTrialMode, computeOpenStatsFromLots]);

  const calculateProjectedMFValue = (currentCorpus, monthlySIP, years, cagr, increment, excludeCorpusFromInvested = true) => {
    const months = Math.round(years * 12);
    const monthlyRate = (cagr / 100) / 12;

    let corpus = currentCorpus;
    let totalInvested = excludeCorpusFromInvested ? 0 : currentCorpus;
    let sip = monthlySIP;

    for (let m = 1; m <= months; m++) {
      corpus = (corpus + sip) * (1 + monthlyRate);
      totalInvested += sip;
      if (m % 12 === 0) {
        sip = sip * (1 + increment / 100);
      }
    }

    const profit = corpus - totalInvested;
    return { invested: totalInvested, profit, totalValue: corpus };
  };

  const projectedMFValue = useMemo(() => {
    const startCorpus = sipAssumptions.excludeCorpusFromInvested
      ? 0
      : ((sipAssumptions.currentCorpus !== null && sipAssumptions.currentCorpus !== undefined)
          ? Number(sipAssumptions.currentCorpus) || 0
          : (openStats.currentValue || 0));

    const projected = calculateProjectedMFValue(
      startCorpus,
      sipAssumptions.sipAmount,
      sipAssumptions.years,
      sipAssumptions.cagr,
      sipAssumptions.increment,
      sipAssumptions.excludeCorpusFromInvested
    );
    return getMaskedStats(projected, isTrialMode);
  }, [sipAssumptions, openStats.currentValue, isTrialMode]);

  const renderMFAccountBreakdown = (transactions, isClosed, filterType, accountFilter) => {
    const filteredTxns = accountFilter ? transactions.filter(t => t.account_name === accountFilter) : transactions;
    const groups = {};

    filteredTxns.forEach((txn) => {
      let key = "";
      const date = txn.date || txn.buy_date;
      if (filterType === "account_name") key = txn.account_name || "Unknown";
      else if (filterType === "year") key = new Date(date).getFullYear().toString();
      else if (filterType === "fy") {
        const d = new Date(date);
        key = d.getMonth() + 1 <= 3
          ? `${d.getFullYear() - 1}-${d.getFullYear()}`
          : `${d.getFullYear()}-${d.getFullYear() + 1}`;
      } else if (filterType === "category") key = txn.category || "Uncategorized";
      else key = "All";

      if (!groups[key]) groups[key] = [];
      groups[key].push(txn);
    });

    return (
      <div className="overflow-hidden bg-gray-800/20 backdrop-blur-xl rounded-[2.5rem] border border-gray-700/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-700/50">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">{filterType.replace("_", " ")}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">{isClosed ? "Realized Value" : "Market Value"}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Invested Value</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Overall Return</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Return %</th>
                {!isClosed && <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Today's P&L</th>}
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">XIRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/30">
              {Object.entries(groups)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, txns]) => {
                  const stats = !isClosed 
                    ? computeOpenStatsFromLots(txns)
                    : computeClosedStats(txns);

                  const absReturn = isClosed ? stats.realizedProfit : stats.absReturn;
                  const absReturnPct = stats.returnPct;

                  return (
                    <tr key={key} className="hover:bg-gray-700/20 transition-all group">
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-1.5 h-1.5 rounded-full ${ (isTrialMode ? 0 : absReturn) >= 0 ? "bg-emerald-500" : "bg-rose-500" }`} />
                          <span className="text-xs font-bold text-white uppercase tracking-tight">{key}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right whitespace-nowrap">
                        <div className="text-sm font-bold text-white tracking-tight">
                          {formatINRShort(isTrialMode ? 0 : (isClosed ? stats.realizedValue : stats.currentValue))}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-300 tracking-tight">
                          {formatINRShort(isTrialMode ? 0 : stats.invested)}
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
                          <div className={`text-xs font-bold ${ (isTrialMode ? 0 : stats.dayChange) >= 0 ? "text-cyan-400" : "text-pink-400" }`}>
                            {(isTrialMode ? 0 : stats.dayChange) >= 0 ? "+" : ""}{formatINRShort(isTrialMode ? 0 : stats.dayChange)}
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-5 text-right whitespace-nowrap">
                        <div className="text-xs font-bold text-violet-400">
                          {stats.xirr ? (isTrialMode ? 0 : stats.xirr).toFixed(1) + "%" : "-"}
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
  };

  return (
    <div className="px-4 py-6 sm:p-8 max-w-7xl mx-auto bg-gray-900 min-h-screen text-gray-100 font-sans">
      {/* iOS Segmented Control - Main Toggle */}
      <div className="flex justify-center mb-10 px-2">
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
                Mutual Fund Overview
              </h2>
              <span className="text-xs font-bold text-indigo-400 bg-indigo-900/30 px-3 py-1 rounded-full uppercase tracking-wider border border-indigo-500/20">Active</span>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total MF Value */}
              <div className="bg-gradient-to-br from-blue-600/20 to-indigo-900/40 backdrop-blur-xl p-4 sm:p-6 rounded-[2rem] shadow-xl border border-blue-500/20 flex flex-col justify-between hover:from-blue-600/30 hover:to-indigo-900/50 transition-all duration-300 group overflow-hidden relative">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-500/10 blur-2xl rounded-full" />
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="p-2.5 bg-blue-500/20 rounded-2xl group-hover:scale-110 transition-transform duration-500">
                    <PieChart className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-blue-300/80 uppercase tracking-widest">Market Value</span>
                </div>
                <div className="relative z-10">
                  <div className="text-xl sm:text-3xl font-black text-white tracking-tighter mb-1">
                    {formatINRShort(isTrialMode ? 0 : openStats.currentValue)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs font-bold text-blue-400/60 uppercase tracking-tight">Invested:</span>
                    <span className="text-[10px] sm:text-xs font-bold text-blue-200 tracking-tight">
                      {formatINRShort(isTrialMode ? 0 : openStats.invested)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Net Returns */}
              <div className="bg-gradient-to-br from-emerald-600/20 to-teal-900/40 backdrop-blur-xl p-4 sm:p-6 rounded-[2rem] shadow-xl border border-emerald-500/20 flex flex-col justify-between hover:from-emerald-600/30 hover:to-teal-900/50 transition-all duration-300 group overflow-hidden relative">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-500/10 blur-2xl rounded-full" />
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="p-2.5 bg-emerald-500/20 rounded-2xl group-hover:scale-110 transition-transform duration-500">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-emerald-300/80 uppercase tracking-widest">Net Returns</span>
                </div>
                <div className="relative z-10">
                  <div className={`text-xl sm:text-3xl font-black tracking-tighter mb-1 ${ (isTrialMode ? 0 : openStats.absReturn) >= 0 ? "text-emerald-400" : "text-rose-400" }`}>
                    {(isTrialMode ? 0 : openStats.absReturn) >= 0 ? "+" : ""}{formatINRShort(isTrialMode ? 0 : openStats.absReturn || 0)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs font-bold text-emerald-200 tracking-tight">
                      IRR: {Number(isTrialMode ? 0 : openStats.returnPct || 0).toFixed(0)}%
                    </span>
                    <span className="text-emerald-500/40 text-[10px]">|</span>
                    <span className="text-[10px] sm:text-xs font-bold text-emerald-200 tracking-tight">
                      XIRR: {openStats.xirr ? (isTrialMode ? 0 : openStats.xirr).toFixed(0) + "%" : "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Day's Change */}
              <div className="bg-gradient-to-br from-amber-600/20 to-orange-900/40 backdrop-blur-xl p-4 sm:p-6 rounded-[2rem] shadow-xl border border-amber-500/20 flex flex-col justify-between hover:from-amber-600/30 hover:to-orange-900/50 transition-all duration-300 group overflow-hidden relative">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-500/10 blur-2xl rounded-full" />
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="p-2.5 bg-amber-500/20 rounded-2xl group-hover:scale-110 transition-transform duration-500">
                    <Activity className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-amber-300/80 uppercase tracking-widest">Day's Change</span>
                </div>
                <div className="relative z-10">
                  <div className={`text-xl sm:text-3xl font-black tracking-tighter mb-1 ${ (isTrialMode ? 0 : openStats.dayChange) >= 0 ? "text-emerald-400" : "text-rose-400" }`}>
                    {(isTrialMode ? 0 : openStats.dayChange) >= 0 ? "+" : ""}{formatINRShort(isTrialMode ? 0 : openStats.dayChange)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] sm:text-xs font-bold tracking-tight ${ (isTrialMode ? 0 : openStats.dayChange) >= 0 ? "text-emerald-400/80" : "text-rose-400/80" }`}>
                      {(isTrialMode ? 0 : (openStats.dayChange / (openStats.currentValue - openStats.dayChange || 1)) * 100).toFixed(2)}%
                    </span>
                    <span className="text-amber-500/40 text-[10px]">|</span>
                    <span className="text-[10px] sm:text-xs font-bold text-amber-200 tracking-tight">
                      {new Set(openLots.map(l => l.fund_short_name)).size} Funds
                    </span>
                  </div>
                </div>
              </div>

              {/* Projected Value */}
              <div className="bg-gradient-to-br from-violet-600/20 to-purple-900/40 backdrop-blur-xl p-4 sm:p-6 rounded-[2rem] shadow-xl border border-violet-500/20 flex flex-col justify-between hover:from-violet-600/30 hover:to-purple-900/50 transition-all duration-300 group overflow-hidden relative">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-violet-500/10 blur-2xl rounded-full" />
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] sm:text-xs font-bold text-violet-300/80 uppercase tracking-widest">Projection</span>
                  </div>
                  <button 
                    onClick={() => {
                      setShowSIPForm(true);
                      setIsAnyFormOpen && setIsAnyFormOpen(true);
                    }}
                    className="p-1.5 bg-violet-500/20 rounded-lg hover:bg-violet-500/40 transition-colors"
                  >
                    <FileText size={16} className="text-violet-300" />
                  </button>
                </div>
                <div className="relative z-10">
                  <div className="text-xl sm:text-3xl font-black text-white tracking-tighter mb-1">
                    {formatINRShort(isTrialMode ? 0 : projectedMFValue.totalValue)}
                  </div>
                  <div className="flex items-center gap-2 overflow-hidden">
                    {Object.entries(sipAccountAmounts).length > 0 && (
                      <span className="text-[10px] font-bold text-violet-300/60 truncate">
                        SIP: {Object.entries(sipAccountAmounts).map(([name, amt]) => `₹${Math.round(isTrialMode ? 0 : amt)}`).join(" + ")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 🔹 SIP Form Modal */}
          {showSIPForm && (
            <div className="fixed inset-0 flex items-center justify-center bg-gray-950/80 backdrop-blur-md z-[100] p-4 animate-in fade-in duration-300">
              <div className="w-full max-w-md bg-gray-900 rounded-[2.5rem] shadow-2xl border border-gray-700/50 overflow-hidden">
                <div className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-violet-500/20 rounded-2xl text-violet-400">
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-white tracking-tight">SIP Assumptions</h4>
                      <p className="text-sm text-gray-400 font-medium">Customize your growth projection</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Current Corpus (₹)</label>
                      <input 
                        type="number"
                        placeholder={String(openStats.currentValue || 0)}
                        value={sipAssumptions.currentCorpus ?? ''}
                        onChange={(e) => setSipAssumptions({...sipAssumptions, currentCorpus: e.target.value === '' ? null : Number(e.target.value)})}
                        className="w-full bg-gray-800/50 border border-gray-700/50 rounded-2xl px-4 py-3 text-white font-bold focus:ring-2 focus:ring-violet-500/50 transition-all outline-none"
                      />
                    </div>

                    <label className="flex items-center gap-3 p-4 bg-gray-800/30 rounded-2xl border border-gray-700/30 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={sipAssumptions.excludeCorpusFromInvested}
                        onChange={(e) => setSipAssumptions({...sipAssumptions, excludeCorpusFromInvested: e.target.checked})}
                        className="w-5 h-5 rounded-lg border-gray-700 bg-gray-800 text-violet-500 focus:ring-violet-500/50"
                      />
                      <span className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors uppercase tracking-tight">Exclude corpus from Invested</span>
                    </label>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">SIP (₹/mo)</label>
                        <input 
                          type="number" 
                          value={sipAssumptions.sipAmount} 
                          onChange={(e) => setSipAssumptions({...sipAssumptions, sipAmount: Number(e.target.value)})} 
                          className="w-full bg-gray-800/50 border border-gray-700/50 rounded-2xl px-4 py-3 text-white font-bold focus:ring-2 focus:ring-violet-500/50 transition-all outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Years</label>
                        <input 
                          type="number" 
                          value={sipAssumptions.years} 
                          onChange={(e) => setSipAssumptions({...sipAssumptions, years: Number(e.target.value)})} 
                          className="w-full bg-gray-800/50 border border-gray-700/50 rounded-2xl px-4 py-3 text-white font-bold focus:ring-2 focus:ring-violet-500/50 transition-all outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">CAGR (%)</label>
                        <input 
                          type="number" 
                          value={sipAssumptions.cagr} 
                          onChange={(e) => setSipAssumptions({...sipAssumptions, cagr: Number(e.target.value)})} 
                          className="w-full bg-gray-800/50 border border-gray-700/50 rounded-2xl px-4 py-3 text-white font-bold focus:ring-2 focus:ring-violet-500/50 transition-all outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Step-up (%)</label>
                        <input 
                          type="number" 
                          value={sipAssumptions.increment} 
                          onChange={(e) => setSipAssumptions({...sipAssumptions, increment: Number(e.target.value)})} 
                          className="w-full bg-gray-800/50 border border-gray-700/50 rounded-2xl px-4 py-3 text-white font-bold focus:ring-2 focus:ring-violet-500/50 transition-all outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-8">
                    <button 
                      className="flex-1 px-6 py-4 rounded-2xl bg-gray-800 text-gray-300 font-bold hover:bg-gray-700 transition-all active:scale-95"
                      onClick={() => {
                        setShowSIPForm(false);
                        setIsAnyFormOpen && setIsAnyFormOpen(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button 
                      className="flex-1 px-6 py-4 rounded-2xl bg-violet-600 text-white font-bold hover:bg-violet-500 shadow-lg shadow-violet-900/20 transition-all active:scale-95"
                      onClick={() => {
                        setShowSIPForm(false);
                        setIsAnyFormOpen && setIsAnyFormOpen(false);
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 🔹 Sold Summary (Quick Overview) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-orange-400" />
                Realized Summary
              </h2>
              <span className="text-xs font-bold text-orange-400 bg-orange-900/30 px-3 py-1 rounded-full uppercase tracking-wider border border-orange-500/20">Sold</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/20 backdrop-blur-xl p-4 sm:p-6 rounded-[2rem] border border-gray-700/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-orange-500/20 rounded-xl">
                    <IndianRupee className="w-4 h-4 text-orange-400" />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Realized P/L</span>
                </div>
                <div className={`text-xl sm:text-2xl font-black tracking-tight ${closedStats.realizedProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {formatINRShort(closedStats.realizedProfit)}
                </div>
              </div>
              
              <div className="bg-gray-800/20 backdrop-blur-xl p-4 sm:p-6 rounded-[2rem] border border-gray-700/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-500/20 rounded-xl">
                    <Activity className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Performance</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className={`text-lg sm:text-xl font-black tracking-tight ${closedStats.returnPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {Number(isTrialMode ? 0 : closedStats.returnPct || 0).toFixed(0)}%
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">IRR</span>
                  </div>
                  <div className="h-8 w-px bg-gray-700/50 mt-1" />
                  <div className="flex flex-col">
                    <span className="text-lg sm:text-xl font-black text-violet-400 tracking-tight">
                      {closedStats.xirr ? (isTrialMode ? "0" : ((closedStats.xirr >= 0 ? "+" : "") + closedStats.xirr.toFixed(0))) + "%" : "-"}
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">XIRR</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* 🔹 Summary Sub Tabs */}
          <div className="flex justify-start mb-8 px-1">
            <div className="bg-gray-800/40 backdrop-blur-2xl p-1 rounded-[1.25rem] flex shadow-inner border border-gray-700/50">
              <button
                onClick={() => setSummarySubTab("active")}
                className={`px-6 py-2 text-xs font-bold rounded-xl transition-all duration-300 ${
                  summarySubTab === "active"
                    ? "bg-white text-gray-900 shadow-lg"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setSummarySubTab("exit")}
                className={`px-6 py-2 text-xs font-bold rounded-xl transition-all duration-300 ${
                  summarySubTab === "exit"
                    ? "bg-white text-gray-900 shadow-lg"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Exit
              </button>
            </div>
          </div>

          {/* 🔹 Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Filter Type</label>
              <div className="relative group">
                <select
                  className="w-full bg-gray-800 border border-gray-700/50 rounded-2xl px-4 py-3 text-white font-bold appearance-none focus:ring-2 focus:ring-indigo-500/50 transition-all outline-none"
                  onChange={(e) => setFilterType(e.target.value)}
                  value={filterType}
                >
                  <option value="" className="bg-gray-800">-- Select Filter --</option>
                  <option value="account_name" className="bg-gray-800">Account Name</option>
                  <option value="year" className="bg-gray-800">Year</option>
                  <option value="fy" className="bg-gray-800">Financial Year</option>
                  <option value="amc_name" className="bg-gray-800">AMC Name</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none group-hover:text-white transition-colors" size={16} />
              </div>
            </div>

            {filterType === "account_name" && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-left-4">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Specific Account</label>
                <div className="relative group">
                  <select
                    className="w-full bg-gray-800 border border-gray-700/50 rounded-2xl px-4 py-3 text-white font-bold appearance-none focus:ring-2 focus:ring-indigo-500/50 transition-all outline-none"
                    onChange={(e) => setAccountFilter(e.target.value)}
                    value={accountFilter}
                  >
                    <option value="" className="bg-gray-800">All Accounts</option>
                    {accountList.map(acc => (
                      <option key={acc} value={acc} className="bg-gray-800">{acc}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none group-hover:text-white transition-colors" size={16} />
                </div>
              </div>
            )}
          </div>

          {summarySubTab === "active" ? (
            <div className="space-y-6">
              <div className="flex items-center gap-2 px-1">
                <Activity className="text-indigo-400" size={20} />
                <h2 className="text-lg font-bold text-white tracking-tight">Active Holdings Summary</h2>
              </div>

              {filterType === "" ? (
                <div className="bg-gray-800/20 border border-dashed border-gray-700/50 rounded-[2rem] p-12 text-center">
                  <LayoutGrid className="mx-auto text-gray-600 mb-4" size={48} />
                  <p className="text-gray-400 font-medium tracking-tight">Select a filter type to view detailed breakdown</p>
                </div>
              ) : filterType === "account_name" ? (
                renderMFAccountBreakdown(openLots, false, filterType, accountFilter)
              ) : (filterType === "year" || filterType === "fy") ? (
                !isTrialMode && (
                  <div className="bg-gray-800/20 backdrop-blur-xl p-6 rounded-[2.5rem] border border-gray-700/30">
                    <MFYearlyChartsOpen
                      txns={openLots}
                      fundMaster={fundMaster}
                      mode={filterType}
                      account={accountFilter || "ALL"}
                    />
                  </div>
                )
              ) : filterType === "amc_name" ? (
                !isTrialMode && (
                  <div className="bg-gray-800/20 backdrop-blur-xl p-6 rounded-[2.5rem] border border-gray-700/30">
                    <MFOpenAMCCharts
                      transactions={openLots}
                      fundMaster={fundMaster}
                    />
                  </div>
                )
              ) : null}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-2 px-1">
                <Briefcase className="text-orange-400" size={20} />
                <h2 className="text-lg font-bold text-white tracking-tight">Closed Positions Summary</h2>
              </div>

              {filterType === "" ? (
                <div className="bg-gray-800/20 border border-dashed border-gray-700/50 rounded-[2rem] p-12 text-center">
                  <LayoutGrid className="mx-auto text-gray-600 mb-4" size={48} />
                  <p className="text-gray-400 font-medium tracking-tight">Select a filter type to view historical data</p>
                </div>
              ) : filterType === "account_name" ? (
                renderMFAccountBreakdown(closedTxns, true, filterType, accountFilter)
              ) : (filterType === "year" || filterType === "fy") ? (
                !isTrialMode && (
                  <div className="bg-gray-800/20 backdrop-blur-xl p-6 rounded-[2.5rem] border border-gray-700/30">
                    <MFYearlyChartsClosed
                      txns={closedSplits.map(s => ({
                        fund_short_name: s.fund_short_name,
                        units: Number(s.quantity) || 0,
                        buy_nav: Number(s.buy_price) || 0,
                        sell_nav: Number(s.sell_price) || 0,
                        buy_date: s.buy_date,
                        sell_date: s.sell_date,
                        account_name: s.account_name || ""
                      }))}
                      fundMaster={fundMaster}
                      mode={filterType}
                      account={accountFilter || "ALL"}
                    />
                  </div>
                )
              ) : filterType === "amc_name" ? (
                !isTrialMode && (
                  <div className="bg-gray-800/20 backdrop-blur-xl p-6 rounded-[2.5rem] border border-gray-700/30">
                    <MFCloseAMCCharts
                      transactions={closedSplits.map(s => ({
                        fund_short_name: s.fund_short_name,
                        units: Number(s.quantity) || 0,
                        buy_nav: Number(s.buy_price) || 0,
                        sell_nav: Number(s.sell_price) || 0,
                        buy_date: s.buy_date,
                        sell_date: s.sell_date,
                        account_name: s.account_name || ""
                      }))}
                      fundMaster={fundMaster}
                    />
                  </div>
                )
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MFPortfolio;
