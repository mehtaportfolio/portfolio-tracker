// src/components/Assets/Bank.js
import React, { useCallback, useEffect, useState } from "react";

import BankForm from "../Forms/BankForm.jsx";
import OtherForm from "../Forms/otherform.jsx";
import Other from "./other.jsx";
import BankTransactionsModal from "./BankTransactionsModal.jsx";
import AccountTransactionsModal from "./AccountTransactionsModal.jsx";
import { useTrialMode } from "../../../hooks/useTrialMode.js";
import { Plus, CreditCard, Landmark, PieChart, LayoutDashboard, RefreshCw, Sparkles } from "lucide-react";

import { useAuth } from "../../../context/AuthContext.jsx";
import bankAPI from "../../../api/bankAPI.js";

const ceilToWhole = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.ceil(n);
};

const formatINRNoDecimalsCeil = (value) => {
  const n = ceilToWhole(value);
  return `₹${n.toLocaleString("en-IN")}`;
};

const formatDiffINRNoDecimalsCeil = (value) => {
  const n = ceilToWhole(Math.abs(value));
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${n.toLocaleString("en-IN")}`;
};


const Bank = () => {
  const { isTrialMode } = useTrialMode();
  const { session } = useAuth();
  const token = session?.access_token;
  const [assets, setAssets] = useState([]);
  const [headerMonth, setHeaderMonth] = useState("");
  const [currentMonthYYYYMM, setCurrentMonthYYYYMM] = useState("");
  const [summary, setSummary] = useState({
    Savings: { current: 0, diff: 0 },
    Demat: { current: 0, diff: 0 },
  });
  const [showModal, setShowModal] = useState(false);
  const [showOtherForm, setShowOtherForm] = useState(false);
  const [otherRefreshToken, setOtherRefreshToken] = useState(0);
  const [otherModalOpen, setOtherModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard"); // "Dashboard" | "Summary"
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [selectedAccountName, setSelectedAccountName] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedBankName, setSelectedBankName] = useState("");
  const [selectedAccountType, setSelectedAccountType] = useState("");
  const [groupedByMonth, setGroupedByMonth] = useState({});

  const fetchAssets = useCallback(async () => {
    if (!token) return;
    try {
      const data = await bankAPI.getAssets(token);
      const { transactions, groupedByMonth: groupedByMonthFromBackend, summary: summaryFromBackend } = data;

      // Update state with data from backend
      setGroupedByMonth(groupedByMonthFromBackend);
      setSummary(summaryFromBackend);
      setAssets(Object.values(data.latestBalances));

      if (transactions.length > 0) {
        const newestDate = typeof transactions[0].txn_date === "string" ? transactions[0].txn_date : transactions[0].txn_date?.toISOString?.() || "";
        const d = new Date(newestDate);
        const month = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
        setHeaderMonth(month);
        
        // Store current month in YYYY-MM format for the account modal
        const yyyymm = newestDate.slice(0, 7);
        setCurrentMonthYYYYMM(yyyymm);
      }
    } catch (error) {
      console.error("Error fetching bank transactions from backend:", error);
    }
  }, [token]);

  const handleFundSync = async () => {
    if (!token) return;

    try {
      // Run both syncs sequentially so user gets deterministic message
      const baseUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "";
      const zerodhaRes = await fetch(`${baseUrl}/api/sync-funds/zerodha`, {

        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!zerodhaRes.ok) {
        const t = await zerodhaRes.text();
        throw new Error(`Zerodha sync failed: ${t}`);
      }

      const angelRes = await fetch(`${baseUrl}/api/sync-funds/angel-one`, {

        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!angelRes.ok) {
        const t = await angelRes.text();
        throw new Error(`Angel One sync failed: ${t}`);
      }

      alert("Kite and Angel One fund values have been synced.");
      await fetchAssets();
    } catch (err) {
      console.error("Fund sync error:", err);
      alert(err?.message || "Fund sync failed");
    }
  };

  const handleBankAdjustment = async () => {

    if (!token) return;
    try {
      const result = await bankAPI.processAdjustment(token);
      if (result.success) {
        alert(result.message);
        fetchAssets();
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error("Error processing bank adjustment:", err);
      alert("Failed to process adjustment.");
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets, token]);

  useEffect(() => {
    const handleCacheInvalidation = (e) => {
      if (e.detail?.assetType === 'bank') {
        fetchAssets();
      }
    };
    window.addEventListener('portfolio-cache-invalidated', handleCacheInvalidation);
    return () => window.removeEventListener('portfolio-cache-invalidated', handleCacheInvalidation);
  }, [fetchAssets, token]);

  const handleAccountCardClick = (accountName, bankName = "", accountType = "") => {
    setSelectedAccountName(accountName);
    setSelectedMonth(currentMonthYYYYMM);
    setSelectedBankName(bankName);
    setSelectedAccountType(accountType);
    setShowAccountModal(true);
  };

  // group by account_type for summary tab
  const groupedByType = assets.reduce((acc, a) => {
    const t = a.account_type || "Other";
    acc[t] = acc[t] || [];
    acc[t].push(a);
    return acc;
  }, {});

  return (
    <div className="p-2 sm:p-2 max-w-7xl mx-auto w-full min-h-screen text-white">
      {/* Tabs - Apple Style Glassmorphism */}
      <div className="flex p-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl mb-8 w-fit shadow-xl">
        <button
          className={`flex items-center space-x-2 px-2 py-2 text-sm font-semibold rounded-xl transition-all duration-300 ${activeTab === "Dashboard" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"}`}
          onClick={() => setActiveTab("Dashboard")}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </button>
        <button
          className={`flex items-center space-x-2 px-6 py-2 text-sm font-semibold rounded-xl transition-all duration-300 ${activeTab === "Summary" ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"}`}
          onClick={() => setActiveTab("Summary")}
        >
          <PieChart size={18} />
          <span>Summary</span>
        </button>
        <button
          className={`flex items-center space-x-2 px-6 py-2 text-sm font-semibold rounded-xl transition-all duration-300 ${activeTab === "Other" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"}`}
          onClick={() => setActiveTab("Other")}
        >
          <Landmark size={18} />
          <span>Other</span>
        </button>
      </div>

   {/* Dashboard Tab */}
{activeTab === "Dashboard" && (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex items-center justify-between mb-8">
      <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center">
        Bank Assets
        {headerMonth && <span className="ml-3 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-gray-400 uppercase tracking-widest">{headerMonth}</span>}
      </h2>
      
      <button
        onClick={handleBankAdjustment}
        className="p-2.5 bg-white/5 border border-white/10 rounded-2xl text-blue-400 hover:bg-white/10 hover:text-blue-300 transition-all shadow-lg"
        title="Add Monthly Adjustment"
      >
        <RefreshCw size={20} />
      </button>
    </div>

    {/* Main Cards - Different Background Colors */}
    <div className="grid grid-cols-2 gap-4 mb-10">
      {["Savings", "Demat"].map((type) => (
        <div key={type} className={`p-6 rounded-[2rem] flex flex-col items-start border shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] ${
          type === 'Savings' 
            ? 'bg-blue-600/10 border-blue-500/20 hover:border-blue-500/40 shadow-blue-900/10' 
            : 'bg-emerald-600/10 border-emerald-500/20 hover:border-emerald-500/40 shadow-emerald-900/10'
        }`}>
          <div className="flex items-center space-x-3 mb-4">

            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {type}
              </p>
              <p className="text-lg font-bold text-white tracking-tight leading-none">Balance</p>
            </div>
          </div>
          <p className="w-full overflow-hidden whitespace-nowrap leading-none text-[clamp(18px,4.2vw,30px)] font-black tracking-tighter text-white">
            {formatINRNoDecimalsCeil(isTrialMode ? 0 : (summary[type]?.current || 0))}
          </p>
        </div>
      ))}
    </div>

    {/* Account Name Header */}
    <div className="flex items-center space-x-2 mb-6 px-1">
      <CreditCard size={18} className="text-gray-500" />
      <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500">Linked Accounts</h3>
    </div>

    {/* Unique Account Name Cards - Two per row on mobile as requested */}
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
      {Array.from(
        assets.reduce((acc, asset) => {
          const name = asset.account_name;
          const currentMonthKey = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a))[0];
          let currentMonthAmount = 0;
          let currentMonthDiff = 0;
          
          if (currentMonthKey && groupedByMonth[currentMonthKey]) {
            const allKeysForThisName = Object.keys(groupedByMonth[currentMonthKey]).filter(
              k => k.split("___")[0] === name
            );
            currentMonthAmount = allKeysForThisName.reduce(
              (sum, k) => sum + (Number(groupedByMonth[currentMonthKey][k].amount) || 0),
              0
            );
            
            const prevMonthKey = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a))[1];
            let prevMonthAmount = 0;
            if (prevMonthKey && groupedByMonth[prevMonthKey]) {
              const allKeysForThisNamePrev = Object.keys(groupedByMonth[prevMonthKey]).filter(
                k => k.split("___")[0] === name
              );
              prevMonthAmount = allKeysForThisNamePrev.reduce(
                (sum, k) => sum + (Number(groupedByMonth[prevMonthKey][k].amount) || 0),
                0
              );
            }
            currentMonthDiff = currentMonthAmount - prevMonthAmount;
          }
          
          if (!acc.has(name)) {
            acc.set(name, { account_name: name, amount: currentMonthAmount, diff: currentMonthDiff });
          }
          return acc;
        }, new Map()).values()
      ).map((asset, index) => {
        // Apple-style color palette for variety
        const colors = [
          "bg-blue-500/10 border-blue-500/20 text-blue-400 glow-blue-500",
          "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 glow-emerald-500",
          "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 glow-indigo-500",
          "bg-rose-500/10 border-rose-500/20 text-rose-400 glow-rose-500",
          "bg-amber-500/10 border-amber-500/20 text-amber-400 glow-amber-500",
          "bg-violet-500/10 border-violet-500/20 text-violet-400 glow-violet-500",
          "bg-cyan-500/10 border-cyan-500/20 text-cyan-400 glow-cyan-500",
          "bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-400 glow-fuchsia-500"
        ];
        const colorClass = colors[index % colors.length];
        const glowColor = colorClass.split(' ').pop().replace('glow-', '');

        return (
        <div key={asset.account_name} 
             onClick={() => handleAccountCardClick(asset.account_name)}
             className={`p-5 rounded-[1.75rem] ${colorClass.split(' ').slice(0, 2).join(' ')} border cursor-pointer hover:bg-white/[0.08] transition-all group shadow-xl flex flex-col items-start relative overflow-hidden backdrop-blur-md`}>
          {/* Subtle background glow */}
          <div className={`absolute -right-4 -top-4 w-12 h-12 bg-${glowColor}/10 blur-2xl rounded-full group-hover:bg-${glowColor}/20 transition-all duration-500`}></div>
          
          <div className="flex items-center space-x-2.5 mb-4 relative z-10">
            <div className={`p-2 rounded-xl ${colorClass.split(' ').slice(0, 3).join(' ')} group-hover:scale-110 transition-all border`}>
              <CreditCard size={18} />
            </div>
            <span className="font-bold text-gray-200 truncate max-w-[100px] text-sm tracking-tight leading-tight">
              {asset.account_name}
            </span>
          </div>
          <span className="w-full overflow-hidden whitespace-nowrap leading-none text-[clamp(15px,3.3vw,22px)] font-extrabold tracking-tighter text-white relative z-10">
            {formatINRNoDecimalsCeil(isTrialMode ? 0 : asset.amount)}
          </span>
          {asset.diff !== 0 && (
            <div className={`mt-2.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest relative z-10 inline-flex items-center ${asset.diff > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
              {formatDiffINRNoDecimalsCeil(asset.diff)}
            </div>
          )}
        </div>
      );
    })}
    </div>
  </div>
)}


{/* Summary Tab */}
{activeTab === "Summary" && (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
      <h2 className="text-3xl font-extrabold text-white tracking-tight">
        Account Summary <span className="ml-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-gray-500 uppercase tracking-widest leading-none">{headerMonth && `(${headerMonth})`}</span>
      </h2>

      <button
        onClick={() => setShowTransactionsModal(true)}
        className="px-6 py-2.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 font-bold text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 active:scale-95"
      >
        <LayoutDashboard size={18} />
        <span>View Full History</span>
      </button>
    </div>

    {/* Demat Portfolio sync controls (manual trigger) */}
    <div className="mb-10">
      {""}
    </div>

    {Object.keys(groupedByType).map((type) => (

      <div key={type} className="mb-10">
        <div className="flex items-center space-x-2 mb-6 px-1">
          <Landmark size={18} className="text-gray-500" />
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500">{type} Portfolio</h3>

          {/* Sync Funds button (only for Demat) */}
          {type === "Demat" && (
            <button
              onClick={handleFundSync}
              className="ml-auto px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold text-xs transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 active:scale-95"
              title="Sync Zerodha + Angel One fund values"
            >
              <Sparkles size={14} />
              <span>Sync Funds</span>
            </button>
          )}

        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {groupedByType[type].map((asset, index) => {
            const key = `${asset.account_name}___${asset.bank_name}___${asset.account_type}`;
            const currentMonthKey = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a))[0];
            let currentMonthAmount = 0;
            
            if (currentMonthKey && groupedByMonth[currentMonthKey] && groupedByMonth[currentMonthKey][key]) {
              currentMonthAmount = Number(groupedByMonth[currentMonthKey][key].amount) || 0;
            }

            // Apple-style color palette for variety
            const colors = [
              "bg-blue-500/10 border-blue-500/20 text-blue-400",
              "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
              "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
              "bg-rose-500/10 border-rose-500/20 text-rose-400",
              "bg-amber-500/10 border-amber-500/20 text-amber-400",
              "bg-violet-500/10 border-violet-500/20 text-violet-400",
              "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
              "bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-400"
            ];
            const colorClass = colors[index % colors.length];

            return (
              <div key={asset.id} 
                   onClick={() => handleAccountCardClick(asset.account_name, asset.bank_name, asset.account_type)}
                   className={`p-5 rounded-[1.75rem] ${colorClass.split(' ').slice(0, 2).join(' ')} border cursor-pointer hover:bg-white/[0.08] transition-all group shadow-xl backdrop-blur-md`}>
                <div className="flex items-center space-x-3 mb-4 w-full">
                  <div className={`p-2.5 rounded-xl ${colorClass} group-hover:scale-110 transition-transform flex-shrink-0 border`}>
                    <Landmark size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-100 truncate text-[13px] tracking-tight leading-tight">
                      {asset.account_name}
                    </p>
                    <p className="text-[11px] font-bold text-gray-400/60 truncate uppercase tracking-wider mt-0.5">
                      {asset.bank_name}
                    </p>
                  </div>
                </div>

                <span className="w-full overflow-hidden whitespace-nowrap leading-none text-[clamp(14px,3vw,20px)] font-black tracking-tighter text-white">
                  {formatINRNoDecimalsCeil(isTrialMode ? 0 : currentMonthAmount)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    ))}
  </div>
)}

{/* Other Tab */}
{activeTab === "Other" && (
  <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
    <Other refreshToken={otherRefreshToken} onModalOpen={setOtherModalOpen} />
    <button
      className={`fixed z-[60] right-6 bottom-[80px] sm:bottom-10 
               bg-purple-600 text-white rounded-3xl w-14 h-14 flex items-center justify-center 
               shadow-2xl shadow-purple-600/40 hover:bg-purple-700 transition-all active:scale-90
               ${(showOtherForm || otherModalOpen) ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      onClick={() => setShowOtherForm(true)}
    >
      <Plus className="w-8 h-8" />
    </button>
  </div>
)}

{/* Floating + button */}
{activeTab !== "Other" && (
  <button
    className={`fixed z-[60] right-6 bottom-[80px] sm:bottom-10 
               bg-blue-600 text-white rounded-3xl w-14 h-14 flex items-center justify-center 
               shadow-2xl shadow-blue-600/40 hover:bg-blue-700 transition-all active:scale-90
               ${(showModal || showTransactionsModal || showAccountModal) ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
    onClick={() => setShowModal(true)}
  >
    <Plus className="w-8 h-8" />
  </button>
)}


{/* Modal */}
{showModal && (
  <BankForm
    onClose={() => setShowModal(false)}
    onSuccess={() => {
      setShowModal(false);
      fetchAssets();
    }}
  />
)}

{showOtherForm && (
  <OtherForm
    onClose={() => setShowOtherForm(false)}
    onSuccess={() => {
      setShowOtherForm(false);
      setOtherRefreshToken((prev) => prev + 1);
    }}
  />
)}

{/* Transactions Modal */}
<BankTransactionsModal
  isOpen={showTransactionsModal}
  onClose={() => setShowTransactionsModal(false)}
  onRefresh={fetchAssets}
/>

{/* Account Transactions Modal */}
<AccountTransactionsModal
  isOpen={showAccountModal}
  onClose={() => setShowAccountModal(false)}
  onRefresh={fetchAssets}
  accountName={selectedAccountName}
  month={selectedMonth}
  bankName={selectedBankName}
  accountType={selectedAccountType}
/>
  </div>
  );
};

export default Bank;
