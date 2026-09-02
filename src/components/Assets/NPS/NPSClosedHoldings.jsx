// src/components/Assets/NPSClosedHoldings.js
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

const NPSClosedHoldings = () => {
  const { refreshDashboard, refreshAssets } = useNavigation();
  const { session } = useAuth();
  const token = session?.access_token;
  const [funds, setFunds] = useState([]);
  const [modalFund, setModalFund] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [buyDateFilter, setBuyDateFilter] = useState("");
  const [sellDateFilter, setSellDateFilter] = useState("");

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
      const master = data.fundMaster || [];

      const masterMap = {};
      master.forEach(m => {
        if (m.scheme_name) masterMap[m.scheme_name.trim()] = m;
        if (m.fund_name) masterMap[m.fund_name.trim()] = m;
      });

      const uniqueAccounts = Array.from(new Set(transactions.map(t => t.account_name).filter(Boolean))).sort();
      setAccountList(uniqueAccounts);

      const grouped = {};
      transactions
        .forEach((txn) => {
          const ttRaw = String(txn?.transaction_type || "buy").toLowerCase();
          txn.transaction_type = ttRaw.includes("buy") ? "buy" : (ttRaw.includes("sell") ? "sell" : (ttRaw.includes("charg") || ttRaw.includes("fee") ? "charges" : "other"));
          
          const schemeName = (txn.scheme_name || "").trim();
          const fundName = (txn.fund_name || "").trim();
          const key = schemeName || fundName;
          if (!key) return;

          if (!grouped[key]) {
            const mEntry = masterMap[schemeName] || masterMap[fundName];
            grouped[key] = { 
              scheme_name: mEntry?.scheme_name || key, 
              fund_name: mEntry?.fund_name || key, 
              transactions: [] 
            };
          }
          grouped[key].transactions.push(txn);
        });

      const fundList = Object.entries(grouped)
        .map(([scheme_name, info]) => {
          const txnsSorted = (info.transactions || [])
            .slice()
            .sort((a, b) => new Date(a.date) - new Date(b.date));

          // FIFO lots from BUYs
          const lots = []; // { remainingUnits, nav, date }
          const sellRows = []; // split rows for realizations: { id, sellDate, buyDate, units, buy_nav, sell_nav, type }

          for (const txn of txnsSorted) {
            const type = txn.transaction_type;
            const units = Math.abs(Number(txn.units) || 0);
            const nav = Number(txn.nav) || 0;

            if (type === "buy") {
              if (units > 0) lots.push({ remainingUnits: units, nav, date: txn.date });
            } else if (type === "sell" || type === "charges") {
              let remaining = units;
              for (const lot of lots) {
                if (remaining <= 0) break;
                if (lot.remainingUnits <= 0) continue;
                const take = Math.min(remaining, lot.remainingUnits);
                sellRows.push({
                  id: txn.id,
                  sellDate: txn.date,
                  buyDate: lot.date,
                  units: take,
                  buy_nav: lot.nav,
                  sell_nav: type === "charges" ? 0 : nav, // Charges realized at 0 proceeds
                  type: type
                });
                lot.remainingUnits -= take;
                remaining -= take;
              }
              // If sells exceed available lots, record unmatched portion with zero buy_nav
              if (remaining > 0) {
                sellRows.push({
                  id: txn.id,
                  sellDate: txn.date,
                  buyDate: null,
                  units: remaining,
                  buy_nav: 0,
                  sell_nav: type === "charges" ? 0 : nav,
                  type: type
                });
              }
            }
          }

          // Dust threshold logic: if remaining units <= 1, consider it fully sold at CMP
          const totalRemaining = lots.reduce((s, l) => s + l.remainingUnits, 0);
          if (totalRemaining > 0 && totalRemaining <= 1) {
            const cmp = Number(masterMap[scheme_name]?.cmp) || 0;
            lots.forEach(lot => {
              if (lot.remainingUnits > 0) {
                sellRows.push({
                  id: `dust-${scheme_name}-${lot.date}`,
                  sellDate: new Date().toISOString(),
                  buyDate: lot.date,
                  units: lot.remainingUnits,
                  buy_nav: lot.nav,
                  sell_nav: cmp,
                  type: 'dust'
                });
                lot.remainingUnits = 0;
              }
            });
          }

          const visibleSellRows = sellRows.filter((row) => row.type !== "charges");
          const invested = visibleSellRows.reduce((s, r) => s + r.units * r.buy_nav, 0);
          const closedValue = visibleSellRows.reduce((s, r) => s + r.units * r.sell_nav, 0);
          const urp = closedValue - invested;
          const urpPct = invested > 0 ? (urp / invested) * 100 : 0;

          // Build cashflows from split rows for XIRR
          const cashflows = [];
          for (const r of visibleSellRows) {
            if (r.buyDate) cashflows.push({ amount: -(r.units * r.buy_nav), date: new Date(r.buyDate) });
            if (r.type !== 'charges') {
              cashflows.push({ amount: r.units * r.sell_nav, date: new Date(r.sellDate) });
            }
          }
          const xirr = calculateXIRR(cashflows);
          const sellCount = visibleSellRows.filter(r => r.type === 'sell').length;

          return {
            scheme_name,
            fund_name: info.fund_name,
            invested,
            closedValue,
            urp,
            urpPct,
            xirr,
            transactions: info.transactions,
            sellRows: visibleSellRows,
            sellCount,
          };
        })
        .filter((f) => f.sellRows.length > 0);

      setFunds(fundList);
    } catch (error) {
      console.error("Error fetching NPS data:", error);
    }
  }, [token]);

  useEffect(() => {
    fetchFunds();
  }, [fetchFunds]);

  useEffect(() => {
    document.body.style.overflow = isModalOpen ? "hidden" : "";
  }, [isModalOpen]);

  useEffect(() => {
    if (isModalOpen) {
      setCurrentPage(1);
    }
  }, [isModalOpen, modalFund]);

  const filteredFunds = useMemo(() => {
    return funds
      .slice()
      .sort((a, b) => (a.fund_name || "").localeCompare(b.fund_name || ""))
      .filter((fund) => (fund.fund_name || "").toLowerCase().includes(searchQuery.toLowerCase()))
      .filter((fund) =>
        fund.transactions.some((t) => (buyDateFilter ? (t.transaction_type === "buy" && t.date?.slice(0, 10) === buyDateFilter) : true))
      )
      .filter((fund) =>
        fund.transactions.some((t) => (sellDateFilter ? (t.transaction_type === "sell" && t.date?.slice(0, 10) === sellDateFilter) : true))
      );
  }, [funds, searchQuery, buyDateFilter, sellDateFilter]);

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

  const handleEdit = (row) => {
    const sellTxn = (modalFund.transactions || []).find(t => t.id === row.id) || {};
    setEditingId(row.id);
    setEditValues({
      date: (sellTxn.date || row.sellDate || "").slice(0, 10),
      nav: Number(sellTxn.nav ?? row.sell_nav) || 0,
      units: Number(sellTxn.units) || 0,
      transaction_type: sellTxn.transaction_type || "sell",
      account_name: sellTxn.account_name || "",
    });
    setEditModalOpen(true);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValues({});
    setEditModalOpen(false);
  };

  const handleSave = async () => {
    if (!editingId || !token) return;
    const payload = {
      date: editValues.date,
      units: Number(editValues.units),
      nav: Number(editValues.nav),
      transaction_type: editValues.transaction_type || "sell",
      account_name: editValues.account_name || null,
    };
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
      console.error("Save failed:", error);
      alert("Failed to update transaction");
    }
  };

  return (
    <div className="w-full max-w-screen-xl mx-auto p-3 sm:p-4 space-y-6">
      {/* Search and date filters */}
      <div className="w-full mb-6">
        <div className="bg-gray-800/40 backdrop-blur-2xl p-3 rounded-[2rem] shadow-2xl flex flex-col gap-2 transition-all duration-500 ease-in-out w-full">
          <div className="flex items-center w-full">
            <div className={`flex items-center transition-all duration-500 ease-in-out ${isSearchExpanded ? 'w-full' : 'w-fit'}`}>
              {!isSearchExpanded ? (
                <button 
                  onClick={() => setIsSearchExpanded(true)}
                  className="flex items-center gap-2 px-3 h-10 rounded-2xl bg-gray-900/50 border border-gray-700/50 text-gray-300 hover:text-orange-500 hover:border-orange-500/50 transition-all active:scale-95 shrink-0"
                  title="Search funds"
                >
                  <span className="text-base">🔍</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Search</span>
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
          </div>

          <div className="flex flex-row items-stretch gap-2 w-full">
            <div className="relative group flex-1 min-w-0">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-focus-within:text-orange-500 transition-colors">Buy</span>
              </div>
              <input
                type="date"
                value={buyDateFilter}
                onChange={(e) => setBuyDateFilter(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-700/50 rounded-2xl pl-12 pr-2 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all font-medium text-[10px] h-10 text-right sm:text-left"
                title="Filter by Buy Date"
              />
            </div>

            <div className="relative group flex-1 min-w-0">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-focus-within:text-orange-500 transition-colors">Sell</span>
              </div>
              <input
                type="date"
                value={sellDateFilter}
                onChange={(e) => setSellDateFilter(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-700/50 rounded-2xl pl-12 pr-2 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all font-medium text-[10px] h-10 text-right sm:text-left"
                title="Filter by Sell Date"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table Layout */}
      <div className="w-full">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full divide-y divide-white/5 text-xs sm:text-sm">
            <thead className="sticky top-0 z-20 border-b border-white/10">
              <tr>
                {['Fund Name', 'Invested', 'Closed Value', 'P/L', 'P/L %', 'XIRR', 'Txns'].map((h) => (
                  <th key={h} className="px-4 sm:px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredFunds.map((fund) => (
                <tr
                  key={fund.fund_name}
                  onClick={() => {
                    setModalFund(fund);
                    setIsModalOpen(true);
                    setCurrentPage(1);
                  }}
                  className="hover:bg-white/5 transition-all duration-300 cursor-pointer group"
                >
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3 group-hover:text-blue-400 transition-colors">
                      <div className="p-2 rounded-lg bg-gray-900/50 backdrop-blur-md shadow-inner border border-white/5 text-rose-400">
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
                    ₹{fund.invested.toFixed(0)}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-white font-black text-base">
                    ₹{fund.closedValue.toFixed(0)}
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
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-gray-300 font-black">
                    {fund.sellCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details modal */}
      {isModalOpen && modalFund && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6"
          onClick={() => { setIsModalOpen(false); setModalFund(null); }}
        >
          <div className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-[2.5rem] bg-gray-900 border border-gray-700/50 shadow-2xl flex flex-col animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between bg-gray-800/20 backdrop-blur-xl">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {modalFund.fund_name}
                </h2>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-1">{modalFund.scheme_name}</p>
              </div>
              <button
                className="p-3 rounded-2xl bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700 transition-all border border-gray-700/50 active:scale-95"
                onClick={() => { setIsModalOpen(false); setModalFund(null); }}
              >
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar">
              {(() => {
                const visibleRows = (modalFund.sellRows || []).filter((row) => row?.type !== "charges");
                const paginatedRows = visibleRows
                  .slice()
                  .sort((a, b) => toTimestamp(b?.sellDate) - toTimestamp(a?.sellDate))
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize);

                return (
                  <div className="space-y-8">
                    <div className="overflow-hidden rounded-[2.5rem] border border-blue-500/20 bg-gray-900/60 backdrop-blur-3xl shadow-2xl">
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="min-w-full divide-y divide-white/5 text-xs sm:text-sm">
                          <thead className="bg-blue-600/10 sticky top-0 z-20 backdrop-blur-xl border-b border-white/5">
                            <tr>
                              {['Buy Date', 'Realized Date', 'Type', 'Units', 'Buy NAV', 'Realized NAV', 'Invested', 'Realized Val', 'P/L', 'P/L %', 'XIRR', 'Actions'].map((h) => (
                                <th key={h} className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-blue-400/80">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {paginatedRows.map((row, idx) => {
                              const invested = Number(row.units) * Number(row.buy_nav || 0);
                              const closedVal = Number(row.units) * Number(row.sell_nav || 0);
                              const urp = closedVal - invested;
                              const urpPct = invested > 0 ? (urp / invested) * 100 : 0;
                              const cf = [];
                              if (row.buyDate) cf.push({ amount: -Number(row.units) * Number(row.buy_nav || 0), date: new Date(row.buyDate) });
                              cf.push({ amount: Number(row.units) * Number(row.sell_nav || 0), date: new Date(row.sellDate) });
                              const txnXirr = calculateXIRR(cf);

                              return (
                                <tr key={`${row.id}-${idx}`} className="hover:bg-blue-500/5 transition-all duration-300 group">
                                  <td className="px-6 py-4 whitespace-nowrap text-gray-300 font-bold tracking-tight">{formatDateDDMMYY(row.buyDate)}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-gray-300 font-bold tracking-tight">{formatDateDDMMYY(row.sellDate)}</td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                                      row.type === "sell" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                                      row.type === "charges" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                      "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                    }`}>
                                      {row.type === 'dust' ? 'Threshold' : row.type}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-white font-black">{Number(row.units).toFixed(2)}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-gray-400 font-bold">₹{Number(row.buy_nav || 0).toFixed(2)}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-gray-400 font-bold">₹{Number(row.sell_nav || 0).toFixed(2)}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-gray-300 font-black">₹{invested.toFixed(0)}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-white font-black text-base">₹{closedVal.toFixed(0)}</td>
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
                                      {row.type !== 'dust' && (
                                        <>
                                          <button 
                                            onClick={() => handleEdit(row)} 
                                            className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 transition-all border border-blue-500/20 active:scale-90"
                                          >
                                            <Edit size={14} strokeWidth={2.5} />
                                          </button>
                                          <button 
                                            onClick={() => handleDelete(row.id)} 
                                            className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all border border-rose-500/20 active:scale-90"
                                          >
                                            <Trash2 size={14} strokeWidth={2.5} />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

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
                          {currentPage} <span className="text-gray-600 font-bold text-sm mx-1">of</span> {Math.max(1, Math.ceil((modalFund.sellRows.filter((row) => row?.type !== "charges")).length / pageSize))}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const totalPages = Math.max(1, Math.ceil((modalFund.sellRows.filter((row) => row?.type !== "charges")).length / pageSize));
                          setCurrentPage(Math.min(totalPages, currentPage + 1));
                        }}
                        disabled={currentPage === Math.max(1, Math.ceil((modalFund.sellRows.filter((row) => row?.type !== "charges")).length / pageSize))}
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
              value={editValues.transaction_type || "sell"}
              onChange={(e) => setEditValues({ ...editValues, transaction_type: e.target.value })}
            >
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
              step="0.0001"
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
            className="flex-1 px-6 py-4 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 transition-all active:scale-95"
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

export default NPSClosedHoldings;