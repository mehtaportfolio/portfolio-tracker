import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import assetAPI from "../../api/assetAPI.js";
import BdmForm from "./Forms/BdmForm.jsx";
import { Edit, Trash, Save, X, ArrowUpCircle, ArrowDownCircle, PieChart, Wallet, ChevronLeft, ChevronRight, IndianRupee } from "lucide-react";

import { useAuth } from "../../context/AuthContext.jsx";

const transactionTypeOptions = ["Credit", "Debit"];
const categoryOptions = ["Deposit", "Withdrawal", "Expense"];

const formatCurrency = (value, allowK = true) => {
  const amount = Number(value) || 0;
  const absAmount = Math.abs(amount);
  let formatted;

  if (absAmount >= 1_00_00_000) {
    formatted = (amount / 1_00_00_000).toFixed(2).replace(/\.00$/, "") + " Cr";
  } else if (absAmount >= 1_00_000) {
    formatted = (amount / 1_00_000).toFixed(2).replace(/\.00$/, "") + " L";
  } else if (allowK && absAmount >= 1_000) {
    formatted = (amount / 1_000).toFixed(2).replace(/\.00$/, "") + " K";
  } else {
    formatted = amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  return `₹${formatted}`;
};

const formatDate = (isoDate) => {
  if (!isoDate) return "-";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "-";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  return `${day}-${month}-${year}`;
};


const toInputDate = (isoDate) => {
  if (!isoDate) return "";
  if (isoDate.includes("T")) {
    return isoDate.split("T")[0];
  }
  return isoDate;
};

const createDefaultDateRange = () => {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const from = "2025-06-15";
  return { from, to };
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

const BDMSummary = ({ isTrialMode = false }) => {
  const { session } = useAuth();
  const token = session?.access_token;
  const [{ from: fromDate, to: toDate }, setDateRange] = useState(createDefaultDateRange);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [modalCurrentPage, setModalCurrentPage] = useState(1);

  const topScrollRef = useRef(null);
  const tableContainerRef = useRef(null);
  const tableHeaderRef = useRef(null);

  const handleTopScroll = () => {
    if (tableContainerRef.current && topScrollRef.current) {
      tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleTableScroll = () => {
    if (tableContainerRef.current && topScrollRef.current) {
      topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
  };

  const defaultSummary = useMemo(
    () => ({
      netAmount: 0,
      totalDeposit: 0,
      totalExpense: 0,
      totalWithdrawal: 0,
    }),
    []
  );

  const [editingRows, setEditingRows] = useState({});
  const [changedRows, setChangedRows] = useState({});
  const [modalType, setModalType] = useState(null);

  useEffect(() => {
    setModalCurrentPage(1);
  }, [modalType]);

  const fetchTransactions = useCallback(
    async (range) => {
      const { from, to } = range;
      if (!from || !to || !token) {
        setTransactions([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await assetAPI.getTransactionsByRange('bdm', from, to, 'date', token);
        setTransactions(data || []);
      } catch (err) {
        console.error("Failed to fetch BDM transactions", err.message);
        setError("Unable to fetch BDM transactions. Please try again.");
        setTransactions([]);
      }

      setLoading(false);
    },
    [token]
  );

  useEffect(() => {
    // Only fetch if dates are valid and fully typed (YYYY-MM-DD = 10 chars)
    if (fromDate?.length === 10 && toDate?.length === 10) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      if (start <= end) {
        void fetchTransactions({ from: fromDate, to: toDate });
      }
    }
  }, [fetchTransactions, fromDate, toDate]);

  useEffect(() => {
    const updateTopScrollWidth = () => {
      if (tableContainerRef.current && topScrollRef.current) {
        const child = topScrollRef.current.firstChild;
        if (child) {
          child.style.width = `${tableContainerRef.current.scrollWidth}px`;
        }
      }
    };

    updateTopScrollWidth();
    const resizeObserver = new ResizeObserver(updateTopScrollWidth);
    if (tableContainerRef.current) {
      resizeObserver.observe(tableContainerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [transactions, currentPage]); // Re-run when data or page changes

  const summaryMetrics = useMemo(() => {
    if (!transactions.length) return defaultSummary;
    return calculateSummaryMetrics(transactions);
  }, [transactions, defaultSummary]);

  const filteredExpenses = useMemo(() => transactions.filter(txn => txn.category === 'Expense'), [transactions]);
  const filteredWithdrawals = useMemo(() => transactions.filter(txn => txn.category === 'Withdrawal'), [transactions]);

  const handleDateChange = (event) => {
    const { name, value } = event.target;
    setDateRange((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddSuccess = () => {
    void fetchTransactions({ from: fromDate, to: toDate });
  };

  const toggleEditRow = (id, initialData) => {
    setEditingRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
    setChangedRows((prev) => {
      const next = { ...prev };
      if (!editingRows[id]) {
        next[id] = {
          id,
          date: toInputDate(initialData.date),
          transaction_type: initialData.transaction_type,
          category: initialData.category,
          account_name: initialData.account_name,
          description: initialData.description ?? "",
          amount: initialData.amount,
        };
      } else {
        delete next[id];
      }
      return next;
    });
  };

  const handleFieldChange = (id, name, value) => {
    setChangedRows((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [name]: value,
      },
    }));
  };

  const handleCancelEdit = (id) => {
    setEditingRows((prev) => ({
      ...prev,
      [id]: false,
    }));
    setChangedRows((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleDelete = async (id) => {
    if (!token) return;
    setIsDeletingId(id);
    try {
      await assetAPI.deleteTransaction('bdm', id, token);
      window.alert("✅ Transaction deleted successfully!");
      await assetAPI.invalidateCache('bdm', token);
      await new Promise(resolve => setTimeout(resolve, 500));
      setTransactions((prev) => prev.filter((row) => row.id !== id));
    } catch (err) {
      console.error("Failed to delete transaction", err.message);
      window.alert("Failed to delete transaction. Please try again.");
    }

    setIsDeletingId(null);
  };

  const validateRow = (row) => {
    if (!row.date) return "Date is required.";
    if (!row.transaction_type) return "Transaction type is required.";
    if (!transactionTypeOptions.includes(row.transaction_type)) {
      return "Invalid transaction type.";
    }
    if (!row.category) return "Category is required.";
    if (!categoryOptions.includes(row.category)) {
      return "Invalid category.";
    }
    if (!row.account_name) return "Account name is required.";
    const amountValue = Number(row.amount);
    if (!Number.isFinite(amountValue)) {
      return "Amount must be a number.";
    }
    return null;
  };

  const handleSave = async (id) => {
    if (!token) return;
    const row = changedRows[id];
    if (!row) return;

    const validationError = validateRow(row);
    if (validationError) {
      window.alert(validationError);
      return;
    }

    setIsSaving(true);
    const payload = {
      date: row.date,
      transaction_type: row.transaction_type,
      category: row.category,
      account_name: row.account_name,
      description: row.description || null,
      amount: Number(row.amount) || 0,
    };

    try {
      await assetAPI.updateTransaction('bdm', id, payload, token);
      window.alert("✅ Transaction updated successfully!");
      await assetAPI.invalidateCache('bdm', token);
      await new Promise(resolve => setTimeout(resolve, 500));
      setTransactions((prev) =>
        prev.map((txn) => (txn.id === id ? { ...txn, ...payload } : txn))
      );
      toggleEditRow(id, payload);
    } catch (err) {
      console.error("Failed to update transaction", err.message);
      window.alert("Failed to save changes. Please try again.");
    }

    setIsSaving(false);
  };

  const renderSummaryCards = () => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard 
        title="Net Amount" 
        value={isTrialMode ? 0 : summaryMetrics.netAmount} 
        gradient="from-indigo-600 via-violet-600 to-purple-700"
        icon={<Wallet size={20} className="text-white" />}
        shadow="shadow-[0_20px_50px_rgba(79,70,229,0.3)]"
      />
      <SummaryCard 
        title="Total Deposits" 
        value={isTrialMode ? 0 : summaryMetrics.totalDeposit} 
        gradient="from-emerald-600 to-teal-700"
        icon={<ArrowUpCircle size={20} className="text-white" />}
        shadow="shadow-[0_20px_50px_rgba(16,185,129,0.2)]"
      />
      <SummaryCard 
        title="Total Expenses" 
        value={isTrialMode ? 0 : summaryMetrics.totalExpense} 
        gradient="from-rose-600 to-pink-700"
        icon={<PieChart size={20} className="text-white" />}
        shadow="shadow-[0_20px_50px_rgba(244,63,94,0.2)]"
        onClick={() => setModalType('expenses')}
      />
      <SummaryCard 
        title="Total Withdrawals" 
        value={isTrialMode ? 0 : summaryMetrics.totalWithdrawal} 
        gradient="from-amber-600 to-orange-700"
        icon={<ArrowDownCircle size={20} className="text-white" />}
        shadow="shadow-[0_20px_50px_rgba(245,158,11,0.2)]"
        onClick={() => setModalType('withdrawals')}
      />
    </div>
  );

  const renderTable = (txns = transactions, isModal = false) => {
    const isMainTable = !isModal;
    const currentRowsPerPage = isModal ? 5 : 7;
    const activePage = isModal ? modalCurrentPage : currentPage;
    const setActivePage = isModal ? setModalCurrentPage : setCurrentPage;

    const currentTxns = txns.slice((activePage - 1) * currentRowsPerPage, activePage * currentRowsPerPage);
    const totalPages = Math.ceil(txns.length / currentRowsPerPage);

    if (loading && isMainTable) {
      return (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      );
    }

    if (!txns.length) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-gray-900/20 rounded-[2.5rem] border border-dashed border-white/10">
          <div className="p-4 bg-white/5 rounded-full mb-4">
            <PieChart className="text-gray-600" size={32} />
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No transactions found</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Top Scrollbar */}
        <div 
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="overflow-x-auto h-2 mb-[-1rem] invisible sm:visible scrollbar-hide hover:scrollbar-default"
        >
          <div style={{ width: tableContainerRef.current?.scrollWidth || '100%', height: '1px' }}></div>
        </div>

        <div 
          ref={tableContainerRef}
          onScroll={handleTableScroll}
          className="overflow-x-auto rounded-[2rem] bg-gray-900/40 backdrop-blur-xl border border-white/5 shadow-2xl transition-all duration-300"
        >
          <table className="min-w-full divide-y divide-white/5">
            <thead>
              <tr>
                <TableHeader>Date</TableHeader>
                <TableHeader>Type</TableHeader>
                <TableHeader>Category</TableHeader>
                <TableHeader>Account</TableHeader>
                <TableHeader>Description</TableHeader>
                <TableHeader align="right">Amount</TableHeader>
                <TableHeader align="center">Actions</TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {currentTxns.map((txn) => {
                const isEditing = Boolean(editingRows[txn.id]);
                const draft = changedRows[txn.id];
                return (
                  <tr key={txn.id} className="hover:bg-white/[0.02] transition-colors group">
                    <TableCell>
                      {isEditing ? (
                        <input
                          type="date"
                          name="date"
                          value={draft?.date || ""}
                          onChange={(event) => handleFieldChange(txn.id, "date", event.target.value)}
                          className="bg-gray-800 text-white rounded-xl border border-white/10 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none w-full"
                        />
                      ) : (
                        <span className="font-mono text-gray-400 text-xs">{formatDate(txn.date)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <select
                          name="transaction_type"
                          value={draft?.transaction_type || ""}
                          onChange={(event) => handleFieldChange(txn.id, "transaction_type", event.target.value)}
                          className="bg-gray-800 text-white rounded-xl border border-white/10 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none w-full"
                        >
                          {transactionTypeOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          txn.transaction_type === "Credit" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                        }`}>
                          {txn.transaction_type}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <select
                          name="category"
                          value={draft?.category || ""}
                          onChange={(event) => handleFieldChange(txn.id, "category", event.target.value)}
                          className="bg-gray-800 text-white rounded-xl border border-white/10 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none w-full"
                        >
                          {categoryOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-300 font-semibold">{txn.category}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <input
                          type="text"
                          name="account_name"
                          value={draft?.account_name || ""}
                          onChange={(event) => handleFieldChange(txn.id, "account_name", event.target.value)}
                          className="bg-gray-800 text-white rounded-xl border border-white/10 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none w-full"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs font-medium">{txn.account_name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <input
                          type="text"
                          name="description"
                          value={draft?.description || ""}
                          onChange={(event) => handleFieldChange(txn.id, "description", event.target.value)}
                          className="bg-gray-800 text-white rounded-xl border border-white/10 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none w-full"
                        />
                      ) : (
                        <span className="text-gray-500 text-xs truncate max-w-[150px] block" title={txn.description}>{txn.description || "-"}</span>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          name="amount"
                          value={draft?.amount ?? ""}
                          onChange={(event) => handleFieldChange(txn.id, "amount", event.target.value)}
                          className="bg-gray-800 text-white rounded-xl border border-white/10 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none w-full text-right"
                        />
                      ) : (
                        <span className="font-black text-white maskable-number">
                          {formatCurrency(isTrialMode ? 0 : txn.amount, false)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <div className="flex items-center justify-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSave(txn.id)}
                              disabled={isSaving}
                              className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all"
                            >
                              <Save size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelEdit(txn.id)}
                              className="p-2 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 transition-all"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleEditRow(txn.id, txn)}
                              className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(txn.id)}
                              disabled={isDeletingId === txn.id}
                              className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
                            >
                              {isDeletingId === txn.id ? (
                                <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent animate-spin rounded-full" />
                              ) : (
                                <Trash size={14} />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-gray-900/40 backdrop-blur-xl rounded-[2rem] border border-white/5">
            <button
              onClick={() => {
                setActivePage(p => Math.max(1, p - 1));
                if (isMainTable) {
                  tableHeaderRef.current?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  tableContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              disabled={activePage === 1}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-xs font-bold text-gray-400 hover:bg-white/10 disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Page</span>
               <span className="text-sm font-black text-white">{activePage}</span>
               <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">of</span>
               <span className="text-sm font-black text-white">{totalPages}</span>
            </div>
            <button
              onClick={() => {
                setActivePage(p => Math.min(totalPages, p + 1));
                if (isMainTable) {
                  tableHeaderRef.current?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  tableContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              disabled={activePage === totalPages}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-xs font-bold text-gray-400 hover:bg-white/10 disabled:opacity-30 transition-all"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative space-y-8 bg-[#111827] p-1 rounded-[2.5rem] min-h-screen">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between px-2">
        <div className="flex flex-wrap items-end gap-4">
          <label className="group">
            <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">
              From Date
            </span>
            <input
              type="date"
              name="from"
              value={fromDate}
              max={toDate}
              onChange={handleDateChange}
              className="bg-gray-900/40 backdrop-blur-xl border border-white/5 text-white text-xs font-bold rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition-all"
            />
          </label>
          <label className="group">
            <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">
              To Date
            </span>
            <input
              type="date"
              name="to"
              value={toDate}
              min={fromDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={handleDateChange}
              className="bg-gray-900/40 backdrop-blur-xl border border-white/5 text-white text-xs font-bold rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition-all"
            />
          </label>
        </div>
      </div>

      <div className="px-2">
        {renderSummaryCards()}
      </div>

      <section ref={tableHeaderRef} className="space-y-6 px-2">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl">
              <PieChart className="text-indigo-500" size={18} />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">Recent Transactions</h3>
          </div>
          <div className="px-3 py-1 bg-white/5 rounded-full border border-white/5">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              {transactions.length} Records Found
            </p>
          </div>
        </header>
        {error && (
          <div className="rounded-[2rem] border border-rose-500/20 bg-rose-500/10 px-6 py-4 text-sm text-rose-400 backdrop-blur-xl">
            {error}
          </div>
        )}
        {renderTable()}
      </section>

       {showForm && (
        <BdmForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            handleAddSuccess();
          }}
        />
      )}

      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/80 backdrop-blur-md p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[2.5rem] bg-[#111827] border border-white/10 shadow-2xl flex flex-col">
            <div className="p-2 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-white/5 to-transparent">
              <div className="flex items-center gap-4">
                <div className="p-1 bg-indigo-500/10 rounded-2xl">
                   <PieChart className="text-indigo-500" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    {modalType === 'expenses' ? 'Total Expenses' : 'Total Withdrawals'}
                  </h2>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">
                    Detailed Transaction History
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setModalType(null)} 
                className="p-1 hover:bg-white/5 rounded-2xl transition-all text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-1 overflow-auto flex-1 custom-scrollbar">
              {renderTable(modalType === 'expenses' ? filteredExpenses : filteredWithdrawals, true)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ title, value, gradient, shadow, icon, onClick }) => (
  <div 
    className={`relative overflow-hidden p-5 rounded-[2rem] bg-gradient-to-br ${gradient} ${shadow} border border-white/20 transition-all duration-300 hover:scale-[1.02] ${onClick ? 'cursor-pointer' : ''}`} 
    onClick={onClick}
  >
    <div className="absolute -right-6 -top-6 bg-white/10 w-24 h-24 rounded-full blur-2xl"></div>
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl shadow-lg">
          {icon}
        </div>
        <div className="p-1.5 bg-white/10 rounded-full">
           <IndianRupee className="text-white/60" size={14} />
        </div>
      </div>
      <p className="text-xs font-bold text-white/80 uppercase tracking-widest mb-1">{title}</p>
      <p className="text-2xl font-black text-white tracking-tight maskable-number">{formatCurrency(value)}</p>
    </div>
  </div>
);

const TableHeader = ({ children, align = "left" }) => (
  <th scope="col" className={`px-4 py-4 text-left text-[10px] bg-gray-800/60 font-black uppercase tracking-[0.2em] text-gray-400 border-b border-white/5 ${align === "right" ? "text-right" : ""} ${align === "center" ? "text-center" : ""}`}>
    {children}
  </th>
);

const TableCell = ({ children, align = "left" }) => (
  <td className={`px-4 py-4 text-sm text-gray-300 border-b border-white/5 whitespace-nowrap ${align === "right" ? "text-right" : ""} ${align === "center" ? "text-center" : ""}`}>
    {children}
  </td>
);

export default BDMSummary;