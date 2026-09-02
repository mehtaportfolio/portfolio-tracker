// src/components/Assets/NPSHoldings.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigation } from "../../../context/NavigationContext.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { BACKEND_URL } from "../../../config/apiConfig.js";
import assetAPI from "../../../api/assetAPI.js";
import { Edit, Trash2, X, Activity } from "lucide-react";
import { invalidateBulkCache } from "../../../utils/supabasePagination.js";

const invalidateBackendCache = async () => {
  try {
    await assetAPI.invalidateCache('nps');
    console.log('✅ Backend cache invalidated');
    invalidateBulkCache();
  } catch (error) {
    console.error('⚠️ Failed to invalidate cache:', error);
  }
};

// Helpers
const calculateXIRR = (cashflows) => {
  if (!cashflows || cashflows.length < 2) return null;
  const npv = (rate) =>
    cashflows.reduce(
      (acc, cf) =>
        acc + cf.amount / Math.pow(1 + rate, (cf.date - cashflows[0].date) / (1000 * 60 * 60 * 24 * 365)),
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

const formatDateDDMMYY = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

const toTimestamp = (value) => {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
};

const sortTransactionsChronologically = (transactions = []) =>
  transactions.slice().sort((a, b) => toTimestamp(a?.date) - toTimestamp(b?.date));

const calculateOpenLotsFIFO = (transactions = []) => {
  const FIFO_EPSILON = 1e-8;
  const lots = [];

  const sortedTransactions = sortTransactionsChronologically(transactions);

  sortedTransactions.forEach((txn) => {
    const ttRaw = String(txn?.transaction_type || "buy").toLowerCase();
    const type = ttRaw.includes("buy") ? "buy" : (ttRaw.includes("sell") ? "sell" : (ttRaw.includes("charg") || ttRaw.includes("fee") ? "charges" : "other"));
    const units = Math.abs(Number(txn?.units ?? 0));
    const nav = Number(txn?.nav ?? 0);

    if (!units || type === "other") return;

    if (type === "buy") {
      lots.push({
        units,
        cost: units * nav,
      });
      return;
    }

    if (type === "sell" || type === "charges") {
      let remaining = units;

      while (remaining > FIFO_EPSILON && lots.length) {
        const currentLot = lots[0];
        const lotUnits = currentLot.units;
        const costPerUnit = lotUnits ? currentLot.cost / lotUnits : 0;
        const deduction = Math.min(remaining, lotUnits);

        currentLot.units = lotUnits - deduction;
        currentLot.cost = currentLot.cost - deduction * costPerUnit;
        remaining -= deduction;

        if (currentLot.units <= FIFO_EPSILON) {
          lots.shift();
        }
      }
    }
  });

  const activeLots = lots.filter((lot) => lot.units > FIFO_EPSILON);
  const openUnits = activeLots.reduce((sum, lot) => sum + lot.units, 0);
  const invested = activeLots.reduce((sum, lot) => sum + Math.max(lot.cost, 0), 0);

  return {
    openUnits,
    invested,
  };
};

const buildCashflowsForXirr = (transactions = [], openUnits, marketValue) => {
  const cashflows = [];

  transactions.forEach((txn) => {
    if (!txn?.date) return;
    const ttRaw = String(txn.transaction_type || "buy").toLowerCase();
    const type = ttRaw.includes("buy") ? "buy" : (ttRaw.includes("sell") ? "sell" : (ttRaw.includes("charg") || ttRaw.includes("fee") ? "charges" : "other"));
    const units = Math.abs(Number(txn.units ?? 0));
    const nav = Number(txn.nav ?? 0);
    const amount = units * nav;

    if (!amount || type === "other") return;

    if (type === "buy") {
      cashflows.push({ amount: -amount, date: new Date(txn.date) });
    } else if (type === "sell") {
      cashflows.push({ amount, date: new Date(txn.date) });
    } else if (type === "charges") {
      // Unit deduction based charges have 0 cash inflow/outflow for XIRR
      // as the cost was already paid during buy and reduction in units 
      // is captured in the terminal market value.
    }
  });

  if (openUnits > 0 && marketValue > 0) {
    cashflows.push({ amount: marketValue, date: new Date() });
  }

  return cashflows;
};

const NPSHoldings = () => {
  const { refreshDashboard, refreshAssets } = useNavigation();
  const { session } = useAuth();
  const token = session?.access_token;
  const [funds, setFunds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [buyDateFilter, setBuyDateFilter] = useState("");
  const [selectedFund, setSelectedFund] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // Inline edit / sell / account list
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [editModalOpen, setEditModalOpen] = useState(false);

  // eslint-disable-next-line no-unused-vars
  const [accountList, setAccountList] = useState([]);

  const fetchFunds = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/assets/nps`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch NPS data");
      const data = await response.json();
      
      const transactions = data.transactions || [];
      const masters = data.fundMaster || [];

      // accounts
      const uniqueAccounts = Array.from(
        new Set(transactions.map((t) => t.account_name).filter(Boolean))
      ).sort();
      setAccountList(uniqueAccounts);

      const masterMap = {};
      masters.forEach((m) => {
        if (m.scheme_name) masterMap[m.scheme_name.trim()] = m;
        if (m.fund_name) masterMap[m.fund_name.trim()] = m;
      });

      const grouped = {};
      transactions.forEach((txn) => {
        const ttRaw = String(txn?.transaction_type || "buy").toLowerCase();
        txn.transaction_type = ttRaw.includes("buy") ? "buy" : (ttRaw.includes("sell") ? "sell" : (ttRaw.includes("charg") || ttRaw.includes("fee") ? "charges" : "other"));

        const schemeName = (txn.scheme_name || "").trim();
        const fundName = (txn.fund_name || "").trim();
        const key = schemeName || fundName;
        if (!key) return;

        if (!grouped[key]) {
          const master = masterMap[schemeName] || masterMap[fundName];
          grouped[key] = {
            scheme_name: master?.scheme_name || key,
            fund_name: master?.fund_name || key,
            transactions: [],
            cmp: master?.cmp ?? null,
            lcp: master?.lcp ?? null,
          };
        }
        grouped[key].transactions.push(txn);
      });

      const fundList = Object.values(grouped)
        .map((info) => {
          const { openUnits, invested } = calculateOpenLotsFIFO(info.transactions);
          const marketValue = openUnits * (Number(info.cmp) || 0);
          const urp = marketValue - invested;
          const urpPct = invested > 0 ? (urp / invested) * 100 : 0;
          const avgBuy = openUnits > 0 ? invested / openUnits : 0;

          const cashflows = buildCashflowsForXirr(info.transactions, openUnits, marketValue);
          const xirr = calculateXIRR(cashflows);

          return {
            scheme_name: info.scheme_name,
            fund_name: info.fund_name,
            cmp: info.cmp,
            lcp: info.lcp,
            units: openUnits,
            avgBuy,
            marketValue,
            invested,
            urp,
            urpPct,
            xirr,
            transactions: info.transactions,
          };
        })
        .filter((f) => f.units > 1);

      setFunds(fundList);
    } catch (error) {
      console.error("Error fetching NPS data:", error);
    }
  }, [token]);

  useEffect(() => {
    fetchFunds();
  }, [fetchFunds]);

useEffect(() => {
  document.body.style.overflow = selectedFund ? "hidden" : "";
}, [selectedFund]);


  const filteredFunds = useMemo(() => {
    return funds
      .slice()
      .sort((a, b) => (a.fund_name || "").localeCompare(b.fund_name || ""))
      .map((fund) => {
        const filteredTxns = buyDateFilter
          ? fund.transactions.filter((t) => t.date?.slice(0, 10) === buyDateFilter)
          : fund.transactions;
        return { ...fund, transactions: filteredTxns };
      })
      .filter((fund) => (fund.fund_name || "").toLowerCase().includes(searchQuery.toLowerCase()));
  }, [funds, searchQuery, buyDateFilter]);

  // handlers
  const handleDelete = async (id) => {
    if (!token) return;
    try {
      await assetAPI.deleteTransaction('nps', id, token);
      alert("Transaction deleted successfully!");
      await invalidateBackendCache();
      await new Promise(resolve => setTimeout(resolve, 500));
      fetchFunds();
      refreshDashboard();
      refreshAssets();
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete transaction");
    }
  };

  const handleEdit = (txn) => {
    setEditingId(txn.id);
    setEditValues({ id: txn.id, date: txn.date, units: txn.units, nav: txn.nav, account_name: txn.account_name || "", transaction_type: txn.transaction_type || "buy" });
    setEditModalOpen(true);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValues({});
    setEditModalOpen(false);
  };

  const handleSave = async () => {
    if (!token) return;
    const { id, ...updateValues } = editValues;
    const payload = {
      date: updateValues.date,
      units: Number(updateValues.units),
      nav: Number(updateValues.nav),
      transaction_type: updateValues.transaction_type || "buy",
      account_name: updateValues.account_name || null,
    };
    // Basic validation
    if (!payload.date || isNaN(payload.units) || isNaN(payload.nav)) {
      console.error("Validation failed: date, units, nav are required", payload);
      return;
    }

    try {
      await assetAPI.updateTransaction('nps', editingId, payload, token);
      alert("Transaction updated successfully!");
      await invalidateBackendCache();
      await new Promise(resolve => setTimeout(resolve, 500));
      setEditingId(null);
      setEditValues({});
      setEditModalOpen(false);
      fetchFunds();
      refreshDashboard();
      refreshAssets();
    } catch (error) {
      console.error("Save failed:", error?.message || error, error);
      alert("Failed to update transaction");
    }
  };



  return (
    <div className="w-full max-w-screen-xl mx-auto p-3 sm:p-4 space-y-6">
      {/* 🍏 Apple-Style Collapsible Search + Date Filter - Full Width */}
      <div className="w-full mb-6">
        <div className="bg-gray-800/40 backdrop-blur-2xl p-2 rounded-[2rem]  shadow-2xl flex items-center justify-between gap-4 transition-all duration-500 ease-in-out overflow-hidden h-14 w-full">
          
          {/* Collapsible Search on Left */}
          <div className={`relative flex items-center transition-all duration-500 ease-in-out ${isSearchExpanded ? 'flex-grow max-w-xl opacity-100' : 'w-10 opacity-100'}`}>
            {!isSearchExpanded ? (
              <button 
                onClick={() => setIsSearchExpanded(true)}
                className="w-10 h-10 rounded-xl bg-gray-900/50 border border-gray-700/50 flex items-center justify-center text-gray-400 hover:text-orange-500 hover:border-orange-500/50 transition-all active:scale-95 shrink-0"
                title="Search funds"
              >
                <span className="text-lg">🔍</span>
              </button>
            ) : (
              <div className="relative w-full group animate-in slide-in-from-left-4 duration-300">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-sm">🔍</span>
                </div>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search funds..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-900/50 border border-orange-500/30 rounded-2xl pl-9 pr-9 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all font-medium text-sm h-10"
                />
                <button 
                  onClick={() => {
                    setIsSearchExpanded(false);
                    setSearchQuery("");
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-orange-500 transition-colors"
                >
                  <span className="text-lg">✕</span>
                </button>
              </div>
            )}
          </div>

          {/* Buy Date Filter - Expanded to Right */}
          <div className={`relative group transition-all duration-500 ${isSearchExpanded ? 'w-32 sm:w-40' : 'flex-grow max-w-xs sm:max-w-md'}`}>
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-focus-within:text-orange-500 transition-colors">Buy</span>
            </div>
            <input
              type="date"
              value={buyDateFilter}
              onChange={(e) => setBuyDateFilter(e.target.value)}
              className="w-full bg-gray-900/50 border border-gray-700/50 rounded-2xl pl-12 pr-10 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all font-medium text-xs h-10 text-left"
              title="Filter by Buy Date"
            />
          </div>
        </div>
      </div>

      {/* Table Layout */}
      <div className="w-full">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full divide-y divide-white/5 text-xs sm:text-sm">
            <thead className="sticky top-0 z-20 border-b border-white/10">
              <tr>
                {['Fund Name', 'Units', 'Avg Buy', 'CMP', 'Invested', 'Market Value', 'P/L', 'P/L %', 'XIRR'].map((h) => (
                  <th key={h} className="px-4 sm:px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredFunds.map((fund) => (
                <tr 
                  key={fund.fund_name} 
                  onClick={() => {
                    setSelectedFund(fund);
                    setCurrentPage(1);
                  }}
                  className="hover:bg-white/5 transition-all duration-300 cursor-pointer group"
                >
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3 group-hover:text-blue-400 transition-colors">
                      <div className="p-2 rounded-lg bg-gray-900/50 backdrop-blur-md shadow-inner border border-white/5 text-blue-400">
                        <Activity size={16} strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white tracking-tight">
                          {fund.fund_name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-gray-300 font-black">
                    {fund.units?.toFixed(2)}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-gray-400 font-bold">
                    ₹{fund.avgBuy?.toFixed(2)}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-gray-300 font-black">
                    ₹{fund.cmp}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-gray-300 font-black">
                    ₹{fund.invested.toFixed(0)}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-white font-black text-base">
                    ₹{fund.marketValue?.toFixed(0)}
                  </td>
                  <td className={`px-4 sm:px-6 py-4 whitespace-nowrap font-black ${fund.urp >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {fund.urp >= 0 ? "+" : ""}₹{fund.urp.toFixed(0)}
                  </td>
                  <td className={`px-4 sm:px-6 py-4 whitespace-nowrap font-black ${fund.urpPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {fund.urpPct >= 0 ? "+" : ""}{fund.urpPct.toFixed(1)}%
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-blue-400 font-black">
                    {typeof fund.xirr === "number" ? fund.xirr.toFixed(1) + "%" : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

{/* ===== Fund Popup Modal ===== */}
{selectedFund && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6">
    <div className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-[2.5rem] bg-gray-900 border border-gray-700/50 shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
      
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between bg-gray-800/20 backdrop-blur-xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {selectedFund.fund_name}
          </h2>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-1">{selectedFund.scheme_name}</p>
        </div>
        <button
          className="p-3 rounded-2xl bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700 transition-all border border-gray-700/50 active:scale-95"
          onClick={() => setSelectedFund(null)}
        >
          <X size={24} strokeWidth={2.5} />
        </button>
      </div>

      <div className="p-8 overflow-y-auto custom-scrollbar">
        {(() => {
          const paginatedTransactions = selectedFund.transactions
            .slice()
            .sort((a, b) => toTimestamp(b?.date) - toTimestamp(a?.date))
            .slice((currentPage - 1) * pageSize, currentPage * pageSize);
          return (
            <div className="space-y-8">
              {/* Transactions Table */}
              <div className="overflow-hidden rounded-[2.5rem] border border-blue-500/20 bg-gray-900/60 backdrop-blur-3xl shadow-2xl">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="min-w-full divide-y divide-white/5 text-xs sm:text-sm">
                    <thead className="bg-blue-600/10 sticky top-0 z-20 backdrop-blur-xl border-b border-white/5">
                      <tr>
                        {['Date', 'Type', 'Units', 'NAV', 'IV', 'MV', 'P/L', 'P/L %', 'XIRR', 'Actions'].map((h) => (
                          <th key={h} className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-blue-400/80">{h}</th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-white/5">
                      {paginatedTransactions.map((txn) => {
                          const isEditing = editingId === txn.id;
                          const unitsVal = isEditing ? Number(editValues.units ?? txn.units) : Number(txn.units);
                          const navVal = isEditing ? Number(editValues.nav ?? txn.nav) : Number(txn.nav);
                          const invested = txn.transaction_type === "buy" ? unitsVal * navVal : 0;
                          const signedUnits = (!txn.transaction_type || txn.transaction_type === "buy") ? unitsVal : -unitsVal;
                          const marketValue = signedUnits * (Number(selectedFund.cmp) || 0);
                          const urp = marketValue - invested;
                          const urpPct = invested > 0 ? (urp / invested) * 100 : 0;

                          const cf = [];
                          if (txn.date) cf.push({ amount: -(unitsVal * navVal), date: new Date(txn.date) });
                          if (marketValue > 0) cf.push({ amount: marketValue, date: new Date() });
                          const txnXirr = calculateXIRR(cf);

                          return (
                            <tr key={txn.id} className="hover:bg-blue-500/5 transition-all duration-300 group">
                              <td className="px-6 py-4 whitespace-nowrap text-gray-300 font-bold tracking-tight">
                                {formatDateDDMMYY(txn.date)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                                  txn.transaction_type === "buy" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                                  txn.transaction_type === "sell" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                                  "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                }`}>
                                  {txn.transaction_type || "buy"}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-white font-black">{txn.units?.toFixed(2)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-400 font-bold">₹{Number(txn.nav).toFixed(2)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-300 font-black">₹{invested.toFixed(0)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-white font-black text-base">₹{marketValue.toFixed(0)}</td>
                              <td className={`px-6 py-4 whitespace-nowrap font-black ${urp >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {urp >= 0 ? "+" : ""}₹{urp.toFixed(0)}
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap font-black ${urpPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {urpPct >= 0 ? "+" : ""}{urpPct.toFixed(1)}%
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-blue-400 font-black">
                                {typeof txnXirr === "number" ? txnXirr.toFixed(1) + "%" : "-"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center justify-center gap-3">
                                  <button 
                                    onClick={() => handleEdit(txn)} 
                                    className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 transition-all border border-blue-500/20 active:scale-90"
                                  >
                                    <Edit size={14} strokeWidth={2.5} />
                                  </button>
                                  <button 
                                    onClick={() => handleDelete(txn.id)} 
                                    className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all border border-rose-500/20 active:scale-90"
                                  >
                                    <Trash2 size={14} strokeWidth={2.5} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <div className="flex justify-center items-center gap-6">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-3 rounded-2xl bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none transition-all border border-gray-700 shadow-xl active:scale-95"
                >
                  <span className="text-xl">←</span>
                </button>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Page</span>
                  <span className="text-lg font-black text-white tracking-tighter">
                    {currentPage} <span className="text-gray-600 font-bold text-sm mx-1">of</span> {Math.ceil(selectedFund.transactions.length / pageSize)}
                  </span>
                </div>
                <button
                  onClick={() => setCurrentPage(Math.min(Math.ceil(selectedFund.transactions.length / pageSize), currentPage + 1))}
                  disabled={currentPage === Math.ceil(selectedFund.transactions.length / pageSize)}
                  className="p-3 rounded-2xl bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none transition-all border border-gray-700 shadow-xl active:scale-95"
                >
                  <span className="text-xl">→</span>
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  </div>
)}

{/* Edit Modal */}
{editModalOpen && (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
    <div className="bg-gray-900 border border-gray-700/50 rounded-[2.5rem] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between px-8 py-6 border-b border-gray-800 bg-gray-800/20 backdrop-blur-xl">
        <h3 className="text-xl font-black text-white tracking-tight">Edit Transaction</h3>
        <button 
          className="p-2 rounded-xl bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700/50 transition-all"
          onClick={handleCancel}
        >
          <X size={20} />
        </button>
      </div>
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Date</label>
            <input
              type="date"
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-bold text-sm"
              value={(editValues.date || "").slice(0, 10)}
              onChange={(e) => setEditValues({ ...editValues, date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Type</label>
            <select
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-bold text-sm appearance-none"
              value={editValues.transaction_type || "buy"}
              onChange={(e) => setEditValues({ ...editValues, transaction_type: e.target.value })}
            >
              <option value="buy" className="bg-gray-900">Buy</option>
              <option value="sell" className="bg-gray-900">Sell</option>
              <option value="charges" className="bg-gray-900">Charges</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Units</label>
            <input
              type="number"
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-bold text-sm"
              value={editValues.units || ""}
              onChange={(e) => setEditValues({ ...editValues, units: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">NAV</label>
            <input
              type="number"
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-bold text-sm"
              step="0.01"
              value={editValues.nav || ""}
              onChange={(e) => setEditValues({ ...editValues, nav: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            onClick={handleCancel}
            className="flex-1 px-6 py-4 rounded-2xl bg-gray-800/50 text-gray-300 font-black uppercase tracking-widest text-[10px] border border-gray-700/50 hover:bg-gray-800 hover:text-white transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-6 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all active:scale-95"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  </div>
)}

    </div>
  );
};

export default NPSHoldings;