import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Plus, Edit, Wallet, ArrowUpCircle, ArrowDownCircle, PieChart, Landmark, IndianRupee, Activity } from "lucide-react";
import { useTrialMode } from "../../hooks/useTrialMode.js";
import BDMSummary from "./BDMSummary.jsx";
import BdmForm from "./Forms/BdmForm.jsx";
import assetAPI from "../../api/assetAPI.js";

import { useAuth } from "../../context/AuthContext.jsx";

const formatCurrency = (value) => {
  const amount = Number(value) || 0;
  const absAmount = Math.abs(amount);
  let formatted;

  if (absAmount >= 1_00_00_000) {
    formatted = (amount / 1_00_00_000).toFixed(2).replace(/\.00$/, "") + " Cr";
  } else if (absAmount >= 1_00_000) {
    formatted = (amount / 1_00_000).toFixed(2).replace(/\.00$/, "") + " L";
  } else if (absAmount >= 1_000) {
    formatted = (amount / 1_000).toFixed(2).replace(/\.00$/, "") + " K";
  } else {
    formatted = amount.toFixed(0);
  }

  return `₹${formatted}`;
};

const calculateSummaryMetrics = (transactions = []) => {
  return transactions.reduce(
    (totals, txn) => {
      const amount = Number(txn.amount) || 0;
      const type = txn.transaction_type;
      const category = txn.category;

      if (type === "Credit") {
        totals.totalCredit += amount;
      } else if (type === "Debit") {
        totals.totalDebit += amount;
      }

      if (category === "Deposit") {
        totals.totalDeposit += amount;
      }
      if (category === "Withdrawal") {
        totals.totalWithdrawal += amount;
      }
      if (category === "Expense") {
        totals.totalExpense += amount;
      }

      totals.netAmount = totals.totalCredit - totals.totalDebit;
      return totals;
    },
    {
      netAmount: 0,
      totalCredit: 0,
      totalDebit: 0,
      totalDeposit: 0,
      totalWithdrawal: 0,
      totalExpense: 0,
    }
  );
};


const AccountDetailsSection = ({
  primaryAccountDetails,
  onEditPrimary,
}) => {
  return (
    <div className="bg-indigo-900/20 backdrop-blur-xl p-5 rounded-3xl border border-indigo-500/10 shadow-2xl transition-all duration-300">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 rounded-2xl shadow-inner">
            <Landmark className="text-orange-500" size={20} />
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight">Account Details</h3>
        </div>
        <button
          type="button"
          onClick={onEditPrimary}
          className="p-2.5 hover:bg-white/10 rounded-2xl transition-all duration-200 group"
        >
          <Edit size={18} className="text-gray-400 group-hover:text-white" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Account Name</p>
          <p className="text-sm font-semibold text-white truncate">{primaryAccountDetails.accountName || "-"}</p>
        </div>
        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Account Number</p>
          <p className="text-sm font-semibold text-white font-mono tracking-tighter">{primaryAccountDetails.accountNumber || "-"}</p>
        </div>
      </div>
    </div>
  );
};

const BDM = () => {
  const { isTrialMode } = useTrialMode();
  const { session } = useAuth();
  const token = session?.access_token;
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [primaryAccountDetails, setPrimaryAccountDetails] = useState({ 
    accountName: "", 
    accountNumber: "", 
    bankName: "", 
    openingDate: "" 
  });

  const [isEditingPrimary, setIsEditingPrimary] = useState(false);
  const fetchTransactions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const data = await assetAPI.getTransactions('bdm', token);
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error("Failed to fetch BDM transactions", err);
      setError("Unable to fetch BDM transactions. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    const handleCacheInvalidation = (e) => {
      if (e.detail?.assetType === 'bdm') {
        void fetchTransactions();
      }
    };
    window.addEventListener('portfolio-cache-invalidated', handleCacheInvalidation);
    return () => window.removeEventListener('portfolio-cache-invalidated', handleCacheInvalidation);
  }, [fetchTransactions]);


  useEffect(() => {
    const fetchAccountDetails = async () => {
      if (!token) return;
      try {
        const { account_number } = await assetAPI.getBDMAccountNumber(token);

        setPrimaryAccountDetails({
          accountName: "BDM",
          accountNumber: account_number || "-",
          bankName: "",
          openingDate: ""
        });
      } catch (err) {
        console.error('Unexpected error fetching BDM account details:', err);
        setPrimaryAccountDetails(prev => ({ ...prev, accountName: "BDM", accountNumber: "-" }));
      }
    };

    void fetchAccountDetails();
  }, [token]);

  const uniqueAccountNames = useMemo(() => {
    const names = new Set(transactions.map((txn) => txn.account_name));
    return Array.from(names).filter(Boolean).sort();
  }, [transactions]);

  const summaryMetrics = useMemo(
    () => calculateSummaryMetrics(transactions),
    [transactions]
  );

const renderDashboard = () => {
  return (
    <div className="space-y-6 p-1 bg-[#111827] min-h-screen rounded-3xl">
      {/* Account Details Section */}
      <div className="mt-2">
        {renderAccountDetails()}
      </div>

      {/* Net Amount Card - Prominent Apple Style */}
      <div className="relative overflow-hidden p-6 rounded-[2rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 shadow-[0_20px_50px_rgba(79,70,229,0.3)] border border-white/20">
        <div className="absolute -right-10 -top-10 bg-white/10 w-40 h-40 rounded-full blur-3xl"></div>
        <div className="absolute -left-10 -bottom-10 bg-indigo-400/20 w-32 h-32 rounded-full blur-2xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-xl">
                <Wallet className="text-white" size={24} />
              </div>
              <span className="text-lg font-bold text-white/90 tracking-tight">Net Balance</span>
            </div>
            <div className="p-2 bg-white/10 rounded-full">
               <IndianRupee className="text-white/60" size={20} />
            </div>
          </div>
          
          <div className="flex flex-col">
            <span className="text-4xl sm:text-5xl font-black text-white tracking-tighter maskable-number drop-shadow-lg">
              {formatCurrency(isTrialMode ? 0 : summaryMetrics.netAmount)}
            </span>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-[10px] font-bold text-indigo-100/70 uppercase tracking-widest">Live Portfolio Value</span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Deposits Card */}
        <div className="group bg-emerald-900/30 backdrop-blur-xl p-5 rounded-[2rem] border border-emerald-500/10 shadow-xl hover:border-green-500/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
              <ArrowUpCircle className="text-green-500" size={22} />
            </div>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Inflow</span>
          </div>
          <p className="text-sm font-bold text-gray-400 mb-1">Total Deposits</p>
          <p className="text-2xl font-black text-white tracking-tight maskable-number">
            {formatCurrency(isTrialMode ? 0 : summaryMetrics.totalDeposit)}
          </p>
        </div>

        {/* Withdrawals Card */}
        <div className="group bg-rose-900/30 backdrop-blur-xl p-5 rounded-[2rem] border border-rose-500/10 shadow-xl hover:border-red-500/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
              <ArrowDownCircle className="text-red-500" size={22} />
            </div>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Outflow</span>
          </div>
          <p className="text-sm font-bold text-gray-400 mb-1">Total Withdrawals</p>
          <p className="text-2xl font-black text-white tracking-tight maskable-number">
            {formatCurrency(isTrialMode ? 0 : summaryMetrics.totalWithdrawal)}
          </p>
        </div>

        {/* Expenses Card */}
        <div className="group bg-amber-900/30 backdrop-blur-xl p-5 rounded-[2rem] border border-amber-500/10 shadow-xl hover:border-orange-500/30 transition-all duration-300 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
              <PieChart className="text-orange-500" size={22} />
            </div>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Spend</span>
          </div>
          <p className="text-sm font-bold text-gray-400 mb-1">Total Expenses</p>
          <p className="text-2xl font-black text-white tracking-tight maskable-number">
            {formatCurrency(isTrialMode ? 0 : summaryMetrics.totalExpense)}
          </p>
        </div>
      </div>

      {!loading && transactions.length === 0 && (
        <div className="bg-gray-800/40 backdrop-blur-xl rounded-[2rem] border border-dashed border-white/10 p-12 text-center shadow-inner">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-white/5 rounded-full">
              <Activity className="text-gray-600" size={32} />
            </div>
            <div>
              <p className="text-base font-bold text-gray-300">No Activity Yet</p>
              <p className="text-xs text-gray-500 mt-1 max-w-[200px] mx-auto">Add your first transaction to start tracking your BDM assets</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


  const renderAccountDetails = () => (
    <AccountDetailsSection
      primaryAccountDetails={primaryAccountDetails}
      onEditPrimary={() => setIsEditingPrimary(true)}
    />
  );

  const renderSummary = () => <BDMSummary isTrialMode={isTrialMode} />;

  const handleSavePrimaryDetails = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const newDetails = {
      accountName: formData.get("accountName") || "BDM",
      accountNumber: formData.get("accountNumber") || "",
      bankName: formData.get("bankName") || "",
      openingDate: formData.get("openingDate") || "",
    };

    setLoading(true);
    try {
      const userMasters = await assetAPI.getUserMaster('bdm', token);
      if (userMasters && userMasters.length > 0) {
        await assetAPI.updateUserMaster(userMasters[0].id, {
          account_name: newDetails.accountName,
          account_number: newDetails.accountNumber,
          bank_name: newDetails.bankName,
          opening_date: newDetails.openingDate
        }, token);
      } else {
        await assetAPI.addUserMaster({
          asset_type: 'bdm',
          account_name: newDetails.accountName,
          account_number: newDetails.accountNumber,
          bank_name: newDetails.bankName,
          opening_date: newDetails.openingDate
        }, token);
      }
      setPrimaryAccountDetails(newDetails);
      setIsEditingPrimary(false);
      window.alert("✅ Account details updated successfully!");
    } catch (err) {
      console.error("Failed to save BDM account details", err);
      window.alert("Failed to save account details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const TabTrigger = ({ value, children }) => (
    <button
      type="button"
      onClick={() => setActiveTab(value)}
      className={`px-8 py-2 rounded-2xl text-sm font-bold transition-all duration-300 ${
        activeTab === value
          ? "bg-white text-black shadow-lg transform scale-105"
          : "text-gray-400 hover:text-white hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );

 // ⬇️ ⬇️ PLACE THIS useEffect RIGHT HERE
  useEffect(() => {
    if (showForm || isEditingPrimary) {
      // Disable background scroll when modal/form is open
      document.body.style.overflow = "hidden";
    } else {
      // Re-enable scrolling when all modals are closed
      document.body.style.overflow = "auto";
    }

    // Cleanup on unmount (always restore scroll)
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [showForm, isEditingPrimary]);


  return (
    <div className="space-y-6 bg-[#111827] p-2 rounded-[2.5rem] shadow-2xl min-h-screen"> 
      <div className="flex items-center p-1.5 bg-gray-800/40 backdrop-blur-xl rounded-[1.5rem] w-fit border border-white/5 shadow-inner mb-2">
        <TabTrigger value="Dashboard">Dashboard</TabTrigger>
        <TabTrigger value="Summary">Summary</TabTrigger>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-6 py-4 rounded-2xl backdrop-blur-md mb-6">
          {error}
        </div>
      )}

      {activeTab === "Dashboard" && renderDashboard()}
      {activeTab === "Summary" && renderSummary()}

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 inline-flex items-center justify-center rounded-full bg-blue-600 text-white shadow-lg h-10 w-10 sm:h-12 sm:w-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Add BDM Transaction"
        >
          <Plus size={24} />
        </button>
      )}

      {showForm && (
        <BdmForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            fetchTransactions();
          }}
          existingAccountNames={uniqueAccountNames}
        />
      )}

      {isEditingPrimary && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gray-900/90 backdrop-blur-2xl rounded-[2rem] border border-white/10 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-8 py-6 border-b border-white/5">
              <h3 className="text-xl font-bold text-white tracking-tight">Account Details</h3>
            </div>

            <form onSubmit={handleSavePrimaryDetails} className="px-8 py-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                  Account Name
                </label>
                <input
                  className="w-full bg-white/5 rounded-2xl border border-white/5 p-4 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  name="accountName"
                  type="text"
                  defaultValue={primaryAccountDetails.accountName}
                  placeholder="Enter Account Name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                  Account Number
                </label>
                <input
                  className="w-full bg-white/5 rounded-2xl border border-white/5 p-4 text-white font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  name="accountNumber"
                  type="text"
                  defaultValue={primaryAccountDetails.accountNumber}
                  placeholder="Enter Account Number"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditingPrimary(false)}
                  className="flex-1 px-6 py-4 rounded-2xl text-sm font-bold text-gray-400 bg-white/5 hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-[2] px-6 py-4 rounded-2xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      
    </div>
  );
};

export default BDM;
	    