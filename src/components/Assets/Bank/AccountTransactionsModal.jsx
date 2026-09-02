import React, { useCallback, useEffect, useState } from "react";
import { useTrialMode } from "../../../hooks/useTrialMode.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { BACKEND_URL } from "../../../config/apiConfig.js";
import { Trash2, Edit2, X, Save } from "lucide-react";
import { invalidateBulkCache } from "../../../utils/supabasePagination.js";

const AccountTransactionsModal = ({ isOpen, onClose, onRefresh, accountName, month, bankName, accountType }) => {
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

  const fetchTransactions = useCallback(async () => {
    if (!accountName || !month) return;

    setLoading(true);
    try {
      const [year, monthPart] = month.split("-");
      const startDate = `${year}-${monthPart}-01`;
      
      const endDate = new Date(year, parseInt(monthPart, 10), 0)
        .toISOString()
        .split("T")[0];

      const filters = [
        { column: "account_name", value: accountName, operator: "eq" },
        { column: "txn_date", value: startDate, operator: "gte" },
        { column: "txn_date", value: endDate, operator: "lte" }
      ];

      if (bankName) {
        filters.push({ column: "bank_name", value: bankName, operator: "eq" });
      }
      if (accountType) {
        filters.push({ column: "account_type", value: accountType, operator: "eq" });
      }

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
  }, [accountName, month, bankName, accountType, token]);

  useEffect(() => {
    if (isOpen && accountName && month) {
      fetchTransactions();
    }
  }, [isOpen, accountName, month, fetchTransactions]);

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
        <div className="sticky top-0 p-8 border-b border-white/5 flex justify-between items-center z-10 bg-gray-900 backdrop-blur-xl">
          <div className="min-w-0">
            <h3 className="text-2xl font-black text-white tracking-tighter truncate">
              {accountName}
            </h3>
            <div className="mt-2 flex items-center space-x-3 overflow-hidden">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest truncate">{bankName}</span>
              {accountType && (
                <>
                  <span className="w-1 h-1 rounded-full bg-gray-600 flex-shrink-0"></span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    accountType === "Savings" ? "bg-blue-500/10 text-blue-400" : "bg-emerald-500/10 text-emerald-400"
                  } border border-current/10 flex-shrink-0`}>{accountType}</span>
                </>
              )}
              {month && (
                <>
                  <span className="w-1 h-1 rounded-full bg-gray-600 flex-shrink-0"></span>
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-widest flex-shrink-0">{month}</span>
                </>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-3 rounded-2xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all border border-white/5 group ml-4 flex-shrink-0">
            <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-400 text-sm">Loading transactions…</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No transactions found for this account in the selected month</div>
          ) : (
            <div className="px-6">
              <table className="w-full border-collapse text-sm">
                <thead className="border-b border-white/5">
                  <tr>
                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Date</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Account Name</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Bank Name</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Type</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Amount</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Actions</th>
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
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountTransactionsModal;
