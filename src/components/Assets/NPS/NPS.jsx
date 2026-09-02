import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Plus, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Calendar, 
  Activity, 
  LayoutGrid, 
  IndianRupee, 
  Landmark, 
  User, 
  Pencil, 
  FileText,
  PieChart
} from "lucide-react";
import assetAPI from "../../../api/assetAPI.js";
import NPSForm from "../Forms/NPSForm.jsx";
import NPSHoldings from "./NPSHoldings.jsx";
import NPSClosedHoldings from "./NPSClosedHoldings.jsx";
import NPSReturns from "./NPSReturns.jsx";
import { useTrialMode } from "../../../hooks/useTrialMode.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { calculateXIRR } from "../../../utils/xirr.jsx";

// 🔹 Projected Value (monthly compounding, annual SIP increment)
const calculateProjectedValueWithSIP = (currentCorpus, monthlySIP, years, cagr, increment, excludeCorpusFromInvested = true) => {
  const months = Math.round(years * 12);
  const monthlyRate = (cagr / 100) / 12; // nominal monthly

  let corpus = currentCorpus; // start corpus
  let totalInvested = excludeCorpusFromInvested ? 0 : currentCorpus; // optionally include
  let sip = monthlySIP; // monthly SIP

  for (let m = 1; m <= months; m++) {
    // annuity-due: deposit then grow
    corpus = (corpus + sip) * (1 + monthlyRate);
    totalInvested += sip;
    if (m % 12 === 0) {
      sip = sip * (1 + increment / 100);
    }
  }

  const profit = corpus - totalInvested;
  return { invested: totalInvested, profit, totalValue: corpus };
};

// 🍏 Reusable Apple-Style Card Component
const Card = ({ title, main, subtitle, icon: Icon, colorClass, iconColor, extra }) => (
  <div className={`bg-gradient-to-br ${colorClass} backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-8 border shadow-2xl hover:scale-[1.02] transition-all duration-500 group relative overflow-hidden flex flex-col justify-between h-full`}>
    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 blur-3xl rounded-full group-hover:bg-white/10 transition-all duration-700" />
    
    <div className="relative z-10">
      <div className="flex items-start justify-between mb-6">
        <div className={`p-4 rounded-2xl bg-gray-900/50 backdrop-blur-md shadow-inner border border-white/5 ${iconColor}`}>
          <Icon size={24} strokeWidth={2.5} />
        </div>
        {extra}
      </div>
      <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-2">{title}</p>
      <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tighter mb-4">{main}</h3>
    </div>
    
    <div className="relative z-10 flex items-center gap-2 text-xs font-bold text-gray-400">
      {subtitle}
    </div>
  </div>
);

const NPS = () => {
  const { isTrialMode } = useTrialMode();
  const [toggle, setToggle] = useState("open");
  const [txns, setTxns] = useState([]);
  const [master, setMaster] = useState([]);
  const [userMasterData, setUserMasterData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAnyFormOpen, setIsAnyFormOpen] = useState(false);

  const [sipAssumptions, setSipAssumptions] = useState({
    sipAmount: 20000,
    years: 20,
    cagr: 10,
    increment: 5,
    currentCorpus: null,
    excludeCorpusFromInvested: false
  });
  const [showSIPForm, setShowSIPForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [showEditAccountForm, setShowEditAccountForm] = useState(false);

  const { session } = useAuth();
  const token = session?.access_token;

  // Fetch Master Data (NPS Subscriber Details from user_master)
  const fetchUserMaster = useCallback(async () => {
    if (!token) return;
    try {
      const data = await assetAPI.getUserMaster('NPS', token);
      setUserMasterData(data || []);
    } catch (err) {
      console.error("❌ Error fetching user master data:", err);
    }
  }, [token]);

  // Calculate Account Age
  const calculateAccountAge = (openingDate) => {
    if (!openingDate) return "";
    const start = new Date(openingDate);
    const today = new Date();
    let years = today.getFullYear() - start.getFullYear();
    let months = today.getMonth() - start.getMonth();
    let days = today.getDate() - start.getDate();
    if (days < 0) { months--; days += new Date(today.getFullYear(), today.getMonth(), 0).getDate(); }
    if (months < 0) { years--; months += 12; }
    return `${years} years ${months} months ${days} days`;
  };

  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const handleSaveAccountDetails = async () => {
    if (editingAccount && token) {
      const record = userMasterData.find(r => r.id === editingAccount);
      if (record) {
        try {
          await assetAPI.updateUserMaster(editingAccount, {
            account_name: record.account_name,
            pran_number: record.pran_number,
            date_of_joining: record.date_of_joining
          }, token);
          fetchUserMaster(); // Refresh data
        } catch (error) {
          console.error("Error updating user master:", error);
          alert("Failed to save changes");
        }
      }
    }
    setShowEditAccountForm(false);
    setEditingAccount(null);
  };

  const masterByName = useMemo(() => {
    const map = new Map();
    (master || []).forEach((m) => {
      map.set(m.fund_name, m);
    });
    return map;
  }, [master]);

  // 🔹 Compute metrics using FIFO on new schema (date, nav, units, transaction_type)
  const { openStats, closedStats } = useMemo(() => {
    const byScheme = new Map();
    (txns || []).forEach((t) => {
      const name = t.fund_name;
      if (!byScheme.has(name)) byScheme.set(name, []);
      byScheme.get(name).push(t);
    });


    let openCost = 0; // cost basis of remaining open units
    let currentValue = 0;
    let dayChange = 0;

    let realizedValue = 0; // only from SELLs
    let realizedCost = 0;  // only cost consumed by SELLs


    const cashflowsOpen = [];   // buys (-), sells (+); terminal = currentValue (+)
    const cashflowsClosed = []; // buys (-), sells (+); no terminal

    byScheme.forEach((arr, scheme) => {
      // ensure chronological order
      arr.sort((a, b) => new Date(a.date) - new Date(b.date));

      // FIFO lots of open units
      const lots = [];

      arr.forEach((txn) => {
        const rawUnits = Number(txn.units) || 0;
        const unitsAbs = Math.abs(rawUnits);
        const nav = Number(txn.nav) || 0;
        const ttRaw = String(txn.transaction_type || "").toLowerCase();
        const tt = ttRaw.includes("buy") ? "buy" : ttRaw.includes("sell") ? "sell" : (ttRaw.includes("charg") || ttRaw.includes("fee")) ? "charges" : "other";
        const dt = new Date(txn.date);
        if (!unitsAbs || tt === "other") return;

        if (tt === "buy") {
          const u = unitsAbs; // treat as positive regardless of sign in data
          lots.push({ units: u, nav, date: dt });
     
          cashflowsOpen.push({ amount: -(u * nav), date: dt });
          // closed cashflows for buys are recorded when realized by sells (per-lot at original buy date)
        } else if (tt === "sell" || tt === "charges") {
          const qty = unitsAbs; // consume lots regardless of sign

          if (tt === "sell") {
            cashflowsOpen.push({ amount: qty * nav, date: dt });
            cashflowsClosed.push({ amount: qty * nav, date: dt });
          }

          // Consume FIFO lots
          let remaining = qty;
          while (remaining > 0 && lots.length) {
            const lot = lots[0];
            const consume = Math.min(remaining, lot.units);
            const costPortion = consume * lot.nav;

            if (tt === "sell") {
              realizedCost += costPortion;
              realizedValue += consume * nav;
              // add realized buy cashflow at original buy date for closed XIRR
              cashflowsClosed.push({ amount: -costPortion, date: lot.date });
            } else if (tt === "charges") {
              // Realized loss from charges: cost is realized, value is 0
              realizedCost += costPortion;
              // Add realized buy cashflow for closed XIRR (inflow is 0)
              cashflowsClosed.push({ amount: -costPortion, date: lot.date });
            }

            lot.units -= consume;
            remaining -= consume;
            if (lot.units <= 0.0000001) lots.shift();
          }
        }
      });

      // After processing all transactions in this scheme, compute open stats
      const remainingUnits = lots.reduce((sum, l) => sum + l.units, 0);
      const remainingCost = lots.reduce((sum, l) => sum + l.units * l.nav, 0);

      const m = masterByName.get(scheme) || {};
      const cmp = Number(m.cmp) || 0;
      const lcp = Number(m.lcp) || 0;

      if (remainingUnits > 1) {
        openCost += remainingCost;
        currentValue += remainingUnits * cmp;
        dayChange += remainingUnits * (cmp - lcp);
      } else {
        // Consider it sold - move to realized
        realizedCost += remainingCost;
        realizedValue += remainingUnits * cmp;
        if (remainingUnits > 0) {
          // Record the "system sell" for XIRR
          cashflowsOpen.push({ amount: remainingUnits * cmp, date: new Date() });
          lots.forEach(lot => {
            if (lot.units > 0) {
              cashflowsClosed.push({ amount: -(lot.units * lot.nav), date: lot.date });
              cashflowsClosed.push({ amount: lot.units * cmp, date: new Date() });
            }
          });
        }
      }
    });

    if (currentValue > 0) cashflowsOpen.push({ amount: currentValue, date: new Date() });

    // Unrealized profit also reflects charges adjustment (applied to open lots only)
    const absReturn = currentValue - openCost;
    const returnPctOpen = openCost > 0 ? (absReturn / openCost) * 100 : 0;
    const xirrOpen = calculateXIRR(cashflowsOpen);

    const realizedProfit = realizedValue - realizedCost; // from sells only
    const returnPctClosed = realizedCost > 0 ? (realizedProfit / realizedCost) * 100 : 0;
    const xirrClosed = calculateXIRR(cashflowsClosed);

    return {
      openStats: {
        invested: Math.max(0, openCost), // open cost minus (charge_inflow - cost_consumed)
        currentValue,
        dayChange,
        absReturn,
        returnPct: returnPctOpen,
        xirr: xirrOpen,
      },
      closedStats: {
        realizedValue,
        realizedProfit,
        returnPct: returnPctClosed,
        xirr: xirrClosed,
      },
    };
  }, [txns, masterByName]);

  const dayChangePct = useMemo(() => {
    const denom = openStats.currentValue - openStats.dayChange || 0;
    if (!denom) return 0;
    return (openStats.dayChange / denom) * 100;
  }, [openStats]);

  const projectedNPSValue = useMemo(() => {
    const startCorpus = sipAssumptions.excludeCorpusFromInvested
      ? 0
      : ((sipAssumptions.currentCorpus !== null && sipAssumptions.currentCorpus !== undefined)
          ? Number(sipAssumptions.currentCorpus) || 0
          : (openStats.currentValue || 0));

    return calculateProjectedValueWithSIP(
      startCorpus,
      sipAssumptions.sipAmount,
      sipAssumptions.years,
      sipAssumptions.cagr,
      sipAssumptions.increment,
      sipAssumptions.excludeCorpusFromInvested
    );
  }, [sipAssumptions, openStats.currentValue]);

  const formatIndianValue = (val) => {
    if (val >= 10000000) return (val / 10000000).toFixed(2) + "Cr";
    if (val >= 100000) return (val / 100000).toFixed(2) + "L";
    return val.toLocaleString('en-IN');
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      setLoading(true);
      setError("");
      try {
        const data = await assetAPI.getTransactions('nps', token);
        setTxns(data.transactions || []);
        setMaster(data.fundMaster || []);
      } catch (err) {
        console.error("Error loading NPS data:", err);
        setError("Failed to load NPS data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    fetchUserMaster();

    const handleCacheInvalidation = (e) => {
      if (e.detail?.assetType === 'nps') {
        fetchData();
        fetchUserMaster();
      }
    };
    window.addEventListener('portfolio-cache-invalidated', handleCacheInvalidation);
    return () => window.removeEventListener('portfolio-cache-invalidated', handleCacheInvalidation);
  }, [fetchUserMaster, token]);

  const [showForm, setShowForm] = useState(false);

  return (
    <div className="px-2 py-6 sm:p-8 max-w-7xl mx-auto bg-gray-900 min-h-screen text-gray-100">
      {/* iOS Segmented Control - Main Tabs */}
      <div className="flex justify-center mb-10 px-2">
        <div className="bg-gray-800/40 backdrop-blur-2xl p-1.5 rounded-[1.5rem] flex w-full max-w-xl shadow-inner border border-gray-700/50">
          {[
            { id: "open", label: "Dashboard" },
            { id: "holdings", label: "Holdings" },
            { id: "closed", label: "Closed" },
            { id: "Returns", label: "Returns" }
          ].map((tab) => (
            <button
              key={tab.id}
              className={`flex-1 py-2.5 text-[12px] sm:text-xs font-bold rounded-[1.25rem] transition-all duration-500 ease-out ${
                toggle === tab.id
                  ? "bg-white text-gray-900 shadow-2xl scale-[1.02] translate-y-[-1px]"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5 active:scale-95"
              }`}
              onClick={() => setToggle(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {toggle === "open" && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* 🟩 NPS Summary Hero Card */}
          <div className="space-y-4">
            <div className="px-1">
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 whitespace-nowrap">
                <Activity className="w-5 h-5 text-orange-400" />
                NPS Overview
              </h2>
            </div>

            <div className="bg-gradient-to-br from-orange-600 via-amber-600 to-yellow-600 rounded-[2.5rem] shadow-2xl p-8 text-white relative overflow-hidden group text-center">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700" />
              <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-black/20 rounded-full blur-3xl" />
              
              <div className="relative z-10 flex flex-col items-center gap-8">
                <div>
                  <p className="text-orange-100 text-sm font-bold uppercase tracking-widest mb-1">Total NPS Corpus</p>
                  <h1 className="text-5xl sm:text-6xl font-black tracking-tighter">
                    ₹{isTrialMode ? 0 : (openStats.currentValue / 100000).toFixed(2)}L
                  </h1>
                  <div className="mt-3">
                    <span className="text-[10px] font-bold text-purple-400 bg-purple-900/30 px-3 py-1 rounded-full uppercase tracking-widest border border-purple-500/20">
                      {userMasterData[0]?.date_of_joining ? calculateAccountAge(userMasterData[0].date_of_joining) : "N/A"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-8 sm:gap-12">
                  <div className="text-center">
                    <p className="text-orange-100 text-[10px] font-bold uppercase tracking-widest mb-1 opacity-80">Invested</p>
                    <p className="text-xl font-bold tracking-tight">
                      ₹{isTrialMode ? 0 : (openStats.invested / 100000).toFixed(2)}L
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-orange-100 text-[10px] font-bold uppercase tracking-widest mb-1 opacity-80">Returns</p>
                    <p className="text-xl font-bold tracking-tight">
                      ₹{Number(isTrialMode ? 0 : openStats.absReturn || 0).toFixed(0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-orange-100 text-[10px] font-bold uppercase tracking-widest mb-1 opacity-80">Gain</p>
                    <div className="flex items-center justify-center gap-1 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/30 mt-1">
                      <TrendingUp size={14} className="text-white" />
                      <span className="text-sm font-black text-white">
                        {Number(isTrialMode ? 0 : openStats.returnPct || 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 🔹 Detailed Stats Grid */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1 whitespace-nowrap">
              <LayoutGrid className="w-5 h-5 text-orange-400" />
              <h2 className="text-xl font-bold text-white tracking-tight">Detailed Breakdown</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <Card
                title="Current Balance"
                icon={Wallet}
                colorClass="from-emerald-600/20 to-teal-900/40 border-emerald-500/20"
                iconColor="text-emerald-400"
                main={`₹${isTrialMode ? 0 : (openStats.currentValue / 100000).toFixed(2)}L`}
                subtitle={
                  <div className="flex items-center gap-1">
                    <TrendingUp size={12} className="text-emerald-400" />
                    <span>Invested: ₹{isTrialMode ? 0 : (openStats.invested / 100000).toFixed(2)}L</span>
                  </div>
                }
              />

              <Card
                title="Total Returns"
                icon={IndianRupee}
                colorClass="from-amber-600/20 to-orange-900/40 border-amber-500/20"
                iconColor="text-amber-400"
                main={`₹${Number(isTrialMode ? 0 : openStats.absReturn || 0).toFixed(0)}`}
                subtitle={
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Activity size={12} className="text-amber-400" />
                      <span className="text-amber-400">XIRR: {openStats.xirr ? (isTrialMode ? 0 : openStats.xirr).toFixed(1) + "%" : "-"}</span>
                    </div>
                  </div>
                }
              />

              <Card
                title="Day's Change"
                icon={TrendingUp}
                colorClass={openStats.dayChange >= 0 ? "from-blue-600/20 to-indigo-900/40 border-blue-500/20" : "from-rose-600/20 to-pink-900/40 border-rose-500/20"}
                iconColor={openStats.dayChange >= 0 ? "text-blue-400" : "text-rose-400"}
                main={`${openStats.dayChange >= 0 ? "+" : ""}₹${(isTrialMode ? 0 : openStats.dayChange).toFixed(0)}`}
                subtitle={
                  <div className="flex items-center gap-1">
                    {openStats.dayChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    <span>{isTrialMode ? 0 : dayChangePct.toFixed(2)}% Today</span>
                  </div>
                }
              />

              <Card
                title="Projected Value"
                icon={BarChart3}
                colorClass="from-violet-600/20 to-purple-900/40 border-violet-500/20"
                iconColor="text-violet-400"
                main={`₹${formatIndianValue(isTrialMode ? 0 : projectedNPSValue.totalValue || 0)}`}
                extra={
                  <button
                    className="p-2 rounded-full bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors border border-violet-500/30"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSIPForm(true);
                      setIsAnyFormOpen(true);
                    }}
                  >
                    <FileText size={18} />
                  </button>
                }
                subtitle={
                  <span className="text-violet-400 font-bold">Estimated Maturity</span>
                }
              />
            </div>
          </div>

          {/* 🔹 NPS Account Details */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <Landmark className="w-5 h-5 text-pink-400" />
                Account Details
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(userMasterData.length > 0 ? userMasterData : [{ id: 'empty', account_name: 'No Data', pran_number: 'N/A', date_of_joining: null }]).map(record => (
                <div key={record.id} className="bg-gray-800/20 backdrop-blur-xl rounded-[2.5rem] border border-gray-700/30 p-6 sm:p-8 hover:bg-gray-700/30 transition-all duration-300 relative group overflow-hidden">
                  <div className="absolute -right-8 -top-8 w-32 h-32 bg-pink-500/5 blur-3xl rounded-full group-hover:bg-pink-500/10 transition-all" />
                  
                  <div className="flex items-start justify-between mb-6 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg">
                        <User className="text-white w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-white tracking-tight">{record.account_name}</h3>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-0.5">NPS Subscriber</p>
                      </div>
                    </div>
                    {record.id !== 'empty' && (
                      <button
                        className="p-2 rounded-xl bg-gray-700/30 text-gray-400 hover:text-white hover:bg-gray-700/50 transition-all border border-gray-600/30"
                        onClick={() => {
                          setEditingAccount(record.id);
                          setShowEditAccountForm(true);
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-6 relative z-10">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">PRAN Number</p>
                      <p className="text-sm font-bold text-gray-200">{record.pran_number}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Opening Date</p>
                      <div className="flex items-center justify-end gap-1.5 text-emerald-400 font-bold text-sm">
                        <Calendar size={12} />
                        {formatDateForDisplay(record.date_of_joining)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-gray-700/30 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                      <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Account Age</span>
                    </div>
                    <p className="text-xs font-black text-purple-400 tracking-tight">
                      {calculateAccountAge(record.date_of_joining)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 🔹 Realized Summary */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <PieChart className="w-5 h-5 text-rose-400" />
              <h2 className="text-xl font-bold text-white tracking-tight">Realized Summary</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <Card
                title="Realized P/L"
                icon={TrendingUp}
                colorClass={closedStats.realizedProfit >= 0 ? "from-emerald-600/20 to-teal-900/40 border-emerald-500/20" : "from-rose-600/20 to-pink-900/40 border-rose-500/20"}
                iconColor={closedStats.realizedProfit >= 0 ? "text-emerald-400" : "text-rose-400"}
                main={`${closedStats.realizedProfit >= 0 ? "+" : ""}₹${Number(isTrialMode ? 0 : closedStats.realizedProfit || 0).toFixed(0)}`}
                subtitle="From Closed Units"
              />

              <Card
                title="Performance"
                icon={Activity}
                colorClass="from-blue-600/20 to-indigo-900/40 border-blue-500/20"
                iconColor="text-blue-400"
                main={`${Number(isTrialMode ? 0 : closedStats.returnPct || 0).toFixed(0)}%`}
                subtitle={
                  <div className="flex items-center gap-1">
                    <Activity size={12} />
                    <span>XIRR: {closedStats.xirr ? (isTrialMode ? 0 : closedStats.xirr).toFixed(1) + "%" : "-"}</span>
                  </div>
                }
              />
            </div>
          </div>
        </div>
      )}

      {toggle === "holdings" && <NPSHoldings />}
      {toggle === "closed" && <NPSClosedHoldings />}
      {toggle === "Returns" && <NPSReturns />}

      {/* 🔹 Assumptions Modal */}
      {showSIPForm && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] px-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => { setShowSIPForm(false); setIsAnyFormOpen(false); }} />
          <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] shadow-2xl p-8 w-full max-w-lg relative animate-in zoom-in-95 duration-300">
            <h4 className="text-2xl font-black text-white mb-8 tracking-tight flex items-center gap-3">
              <BarChart3 className="text-violet-400" />
              NPS Assumptions
            </h4>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Current Corpus (₹)</label>
                  <input
                    type="number"
                    placeholder={String(openStats.currentValue || 0)}
                    value={sipAssumptions.currentCorpus ?? ""}
                    onChange={(e) => setSipAssumptions({ ...sipAssumptions, currentCorpus: e.target.value === "" ? null : Number(e.target.value) })}
                    className="w-full bg-gray-800/50 border border-gray-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">NPS Amount (₹/mo)</label>
                  <input
                    type="number"
                    value={sipAssumptions.sipAmount}
                    onChange={(e) => setSipAssumptions({ ...sipAssumptions, sipAmount: Number(e.target.value) })}
                    className="w-full bg-gray-800/50 border border-gray-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Years</label>
                  <input
                    type="number"
                    value={sipAssumptions.years}
                    onChange={(e) => setSipAssumptions({ ...sipAssumptions, years: Number(e.target.value) })}
                    className="w-full bg-gray-800/50 border border-gray-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">CAGR (%)</label>
                  <input
                    type="number"
                    value={sipAssumptions.cagr}
                    onChange={(e) => setSipAssumptions({ ...sipAssumptions, cagr: Number(e.target.value) })}
                    className="w-full bg-gray-800/50 border border-gray-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 bg-gray-800/30 p-4 rounded-2xl border border-gray-700/50">
                <input
                  type="checkbox"
                  id="excludeCorpus"
                  checked={sipAssumptions.excludeCorpusFromInvested}
                  onChange={(e) => setSipAssumptions({ ...sipAssumptions, excludeCorpusFromInvested: e.target.checked })}
                  className="w-5 h-5 rounded-lg border-gray-700 bg-gray-900 text-violet-500 focus:ring-violet-500/50"
                />
                <label htmlFor="excludeCorpus" className="text-sm font-bold text-gray-300">Exclude current corpus from Invested</label>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <button
                  className="px-8 py-3 rounded-2xl bg-gray-800 text-white font-black hover:bg-gray-700 transition-all active:scale-95"
                  onClick={() => { setShowSIPForm(false); setIsAnyFormOpen(false); }}
                >
                  Cancel
                </button>
                <button
                  className="px-8 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black hover:shadow-xl hover:shadow-violet-500/20 transition-all active:scale-95"
                  onClick={() => { setShowSIPForm(false); setIsAnyFormOpen(false); }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🍏 Edit Account Modal */}
      {showEditAccountForm && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] px-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => { setShowEditAccountForm(false); setEditingAccount(null); }} />
          <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] shadow-2xl p-8 w-full max-w-md relative animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-black text-white mb-8 tracking-tight">Edit NPS Account</h3>
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleSaveAccountDetails(); }}>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Account Name</label>
                <input
                  type="text"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all font-bold"
                  value={userMasterData.find(r => r.id === editingAccount)?.account_name || ""}
                  onChange={(e) => {
                    setUserMasterData(prev => prev.map(r => r.id === editingAccount ? { ...r, account_name: e.target.value } : r));
                  }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">PRAN Number</label>
                <input
                  type="text"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all font-bold"
                  value={userMasterData.find(r => r.id === editingAccount)?.pran_number || ""}
                  onChange={(e) => {
                    setUserMasterData(prev => prev.map(r => r.id === editingAccount ? { ...r, pran_number: e.target.value } : r));
                  }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Opening Date</label>
                <input
                  type="date"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all font-bold color-scheme-dark"
                  value={userMasterData.find(r => r.id === editingAccount)?.date_of_joining || ""}
                  onChange={(e) => {
                    setUserMasterData(prev => prev.map(r => r.id === editingAccount ? { ...r, date_of_joining: e.target.value } : r));
                  }}
                />
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <button
                  type="button"
                  className="px-8 py-3 rounded-2xl bg-gray-800 text-white font-black hover:bg-gray-700 transition-all"
                  onClick={() => { setShowEditAccountForm(false); setEditingAccount(null); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-black hover:shadow-xl hover:shadow-pink-500/20 transition-all"
                >
                  Save Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔹 Floating Add Button */}
      <button
        onClick={() => setShowForm(true)}
        className={`fixed z-[60] right-6 bottom-10 bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 group ${
          showForm || showSIPForm || isAnyFormOpen ? "scale-0 opacity-0" : "scale-100 opacity-100"
        }`}
        aria-label="Add NPS Transaction"
      >
        <Plus size={32} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-500" />
      </button>

      {/* 🔹 Modal Form */}
      {showForm && (
        <NPSForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            window.location.reload();
          }}
        />
      )}

      {loading && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-800/80 backdrop-blur-md px-6 py-3 rounded-full border border-gray-700 flex items-center gap-3 animate-pulse">
          <div className="w-4 h-4 rounded-full bg-orange-500 animate-ping" />
          <span className="text-sm font-bold text-gray-300">Updating NPS Data…</span>
        </div>
      )}
      {error && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-rose-500/10 backdrop-blur-md px-6 py-3 rounded-full border border-rose-500/20 flex items-center gap-3">
          <Activity className="text-rose-500 w-4 h-4" />
          <span className="text-sm font-bold text-rose-500">{error}</span>
        </div>
      )}
    </div>
  );
};

export default NPS;
