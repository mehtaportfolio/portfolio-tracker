import React, { useEffect, useState, useCallback } from "react";
import { useTrialMode } from "../../../hooks/useTrialMode.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { BACKEND_URL } from "../../../config/apiConfig.js";
import { Trash2, Edit2, X, Save } from "lucide-react";
import { invalidateBulkCache } from "../../../utils/supabasePagination.js";

const BankTransactionsModal = ({ isOpen, onClose, onRefresh }) => {
  const { isTrialMode } = useTrialMode();
  const { session } = useAuth();
  const token = session?.access_token;

  const invalidateBackendCache = async () => {
    try {
      if (!token) return;
      const response = await fetch(`${BACKEND_URL}/api/assets/bank/invalidate-cache`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        console.log("✅ Backend cache invalidated");
        invalidateBulkCache();
      }
    } catch (error) {
      console.error("⚠️ Failed to invalidate cache:", error);
    }
  };

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);

  // Filters state
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      // Calculate date range for the selected month/year
      const startDate = `${filterYear}-${String(filterMonth).padStart(2, "0")}-01`;
      const endDate = new Date(filterYear, filterMonth, 0).toISOString().split("T")[0];

      const filters = [
        { column: "txn_date", value: startDate, operator: "gte" },
        { column: "txn_date", value: endDate, operator: "lte" }
      ];

      if (!token) {
        setLoading(false);
        return;
      }
      const url = new URL(`${BACKEND_URL}/api/assets/bank/transactions`);
      url.searchParams.append('filters', JSON.stringify(filters));
      url.searchParams.append('order', JSON.stringify({ column: 'txn_date', ascending: false }));

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      setTransactions(data || []);
    } catch (err) {
      console.error("Error fetching transactions via backend:", err);
      alert("An error occurred while fetching transactions");
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear, token]);

  useEffect(() => {
    if (isOpen) {
      fetchTransactions();
    }
  }, [isOpen, fetchTransactions]);

  const handleEdit = (transaction) => {
    setEditingId(transaction.id);
    setEditData({ ...transaction });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!token) throw new Error("Authentication required");
      const response = await fetch(`${BACKEND_URL}/api/assets/bank/transaction/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          account_name: editData.account_name,
          bank_name: editData.bank_name,
          account_type: editData.account_type,
          txn_date: editData.txn_date,
          amount: parseFloat(editData.amount),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update transaction');
      }

      alert("✅ Transaction updated successfully!");
      await invalidateBackendCache();
      await new Promise(resolve => setTimeout(resolve, 500));
      setEditingId(null);
      setEditData({});
      fetchTransactions();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Error:", err);
      alert("An error occurred while updating transaction");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) {
      return;
    }

    try {
      if (!token) throw new Error("Authentication required");
      const response = await fetch(`${BACKEND_URL}/api/assets/bank/transaction/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete transaction');
      }

      alert("✅ Transaction deleted successfully!");
      await invalidateBackendCache();
      await new Promise(resolve => setTimeout(resolve, 500));
      fetchTransactions();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Error:", err);
      alert("An error occurred while deleting transaction");
    }
  };

  const handleFieldChange = (field, value) => {
    setEditData({ ...editData, [field]: value });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md px-4 py-6 animate-in fade-in duration-300">
      <div className="relative w-full max-w-6xl rounded-[2.5rem] bg-gray-900 border border-white/10 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden backdrop-blur-2xl">
        
        {/* Header */}
        <div className="sticky top-0 p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 z-10 bg-gray-900 backdrop-blur-xl">
          <div className="flex items-center space-x-4">
            <div>
              <h3 className="text-2xl font-black text-white tracking-tighter leading-none">Transactions Details</h3>

              <p className="mt-1.5 text-[10px] font-black text-gray-500 uppercase tracking-widest">History of all bank activities</p>
            </div>
             <button onClick={onClose} className="p-3 rounded-2xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all border border-white/5 group">
              <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
          </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-black/40 border border-white/10 rounded-2xl p-1 shadow-inner">
              <select 
                value={filterMonth}
                onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                className="bg-transparent text-xs font-bold text-white px-4 py-2 outline-none cursor-pointer hover:text-blue-400 transition-colors"
              >
                {[
                  "January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"
                ].map((m, i) => (
                  <option key={m} value={i + 1} className="bg-gray-900 text-white">{m}</option>
                ))}
              </select>
              <select 
                value={filterYear}
                onChange={(e) => setFilterYear(parseInt(e.target.value))}
                className="bg-transparent text-xs font-bold text-white px-4 py-2 outline-none cursor-pointer hover:text-blue-400 transition-colors"
              >
                {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                  <option key={y} value={y} className="bg-gray-900 text-white">{y}</option>
                ))}
              </select>
            </div>


          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Fetching Transactions…</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 opacity-50">No transactions found for this period</p>
            </div>
          ) : (
            <div className="px-6 pb-8">
              <div className="rounded-[2rem]">
                <div className="">
                  <table className="w-full border-collapse text-sm">
                    <thead className="border-b border-white/5">
                      <tr>
                        <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Date</th>
                        <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Account Name</th>
                        <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Bank Name</th>
                        <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Type</th>
                        <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Amount</th>
                        <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {transactions.map((txn) =>
                        editingId === txn.id ? (
                          <tr key={txn.id} className="bg-white/5">
                            <td className="px-6 py-6 whitespace-nowrap">
                              <input
                                type="date"
                                value={editData.txn_date ? editData.txn_date.split("T")[0] : ""}
                                onChange={(e) => handleFieldChange("txn_date", e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                              />
                            </td>
                            <td className="px-6 py-6 whitespace-nowrap">
                              <input
                                type="text"
                                value={editData.account_name || ""}
                                onChange={(e) => handleFieldChange("account_name", e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner font-bold"
                              />
                            </td>
                            <td className="px-6 py-6 whitespace-nowrap">
                              <input
                                type="text"
                                value={editData.bank_name || ""}
                                onChange={(e) => handleFieldChange("bank_name", e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                              />
                            </td>
                            <td className="px-6 py-6 whitespace-nowrap">
                              <select
                                value={editData.account_type || ""}
                                onChange={(e) => handleFieldChange("account_type", e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                              >
                                <option value="">Select</option>
                                <option value="Savings">Savings</option>
                                <option value="Demat">Demat</option>
                              </select>
                            </td>
                            <td className="px-6 py-6 whitespace-nowrap">
                              <input
                                type="number"
                                step="0.01"
                                value={editData.amount || ""}
                                onChange={(e) => handleFieldChange("amount", e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-right focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner font-black"
                              />
                            </td>
                            <td className="px-6 py-6 text-right whitespace-nowrap">
                              <div className="flex justify-end space-x-3">
                                <button
                                  onClick={handleSave}
                                  disabled={saving}
                                  className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:opacity-50 transition-all shadow-lg shadow-blue-600/20"
                                >
                                  <Save size={18} />
                                </button>
                                <button
                                  onClick={handleCancel}
                                  className="p-3 bg-white/5 text-white rounded-xl hover:bg-white/10 border border-white/10 transition-all"
                                >
                                  <X size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={txn.id} className="hover:bg-white/5 transition-all group">
                            <td className="px-6 py-6 text-gray-500 font-bold whitespace-nowrap text-xs">
                              {txn.txn_date
                                ? new Date(txn.txn_date).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "2-digit",
                                  }).replace(/\//g, "-")
                                : ""}
                            </td>
                            <td className="px-6 py-6 font-black text-gray-200 whitespace-nowrap tracking-tight">{txn.account_name}</td>
                            <td className="px-6 py-6 text-gray-400 font-bold whitespace-nowrap text-xs tracking-wide">{txn.bank_name}</td>
                            <td className="px-6 py-6 whitespace-nowrap">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                txn.account_type === "Savings" ? "bg-blue-500/10 text-blue-400" : "bg-emerald-500/10 text-emerald-400"
                              } border border-current/10`}>
                                {txn.account_type}
                              </span>
                            </td>
                            <td className="px-6 py-6 text-right font-black text-white whitespace-nowrap text-base tracking-tighter">
                              ₹{Number(isTrialMode ? 0 : txn.amount).toLocaleString("en-IN")}
                            </td>
                            <td className="px-6 py-6 text-right whitespace-nowrap">
                              <div className="flex justify-end space-x-3 transition-opacity duration-300">
                                <button
                                  onClick={() => handleEdit(txn)}
                                  className="p-2.5 bg-white/5 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all border border-white/5"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleDelete(txn.id)}
                                  className="p-2.5 bg-white/5 text-gray-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all border border-white/5"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BankTransactionsModal;
