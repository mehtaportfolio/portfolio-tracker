import React, { useEffect, useMemo, useState } from "react";
import assetAPI from "../../../api/assetAPI.js";
import { useNavigation } from "../../../context/NavigationContext.jsx";
import { X } from "lucide-react";

const transactionTypeOptions = ["Credit", "Debit"];
const categoryOptions = ["Deposit", "Withdrawal", "Expense"];

const initialFormState = {
  date: "",
  transaction_type: "Credit",
  category: "Deposit",
  account_name: "",
  amount: "",
  description: "",
};

const sortLex = (values = []) => {
  return [...values]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
};

const BdmForm = ({ onClose, onSuccess, existingAccountNames = [] }) => {
  const { setIsBottomBarHidden } = useNavigation();
  const [form, setForm] = useState(initialFormState);
  const [accountNames, setAccountNames] = useState(() => sortLex(existingAccountNames));
  const [isAddingNewAccount, setIsAddingNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setIsBottomBarHidden(true);
    return () => setIsBottomBarHidden(false);
  }, [setIsBottomBarHidden]);

  useEffect(() => {
    setAccountNames((prev) => {
      const merged = new Set([...prev, ...existingAccountNames.filter(Boolean)]);
      return sortLex(Array.from(merged));
    });
  }, [existingAccountNames]);

  useEffect(() => {
    let isMounted = true;
    const fetchAccountNames = async () => {
      try {
        const data = await assetAPI.getDistinctNames('bdm', 'account_name');
        if (!isMounted) return;

        const unique = sortLex(data);
        setAccountNames((prev) => {
          const merged = new Set([...prev, ...unique]);
          return sortLex(Array.from(merged));
        });
      } catch (error) {
        console.error("Error fetching BDM account names:", error.message);
      }
    };

    fetchAccountNames();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAccountSelect = (event) => {
    const { value } = event.target;
    if (value === "__add_new__") {
      setIsAddingNewAccount(true);
      setNewAccountName("");
      setForm((prev) => ({ ...prev, account_name: "" }));
      return;
    }

    setIsAddingNewAccount(false);
    setForm((prev) => ({ ...prev, account_name: value }));
  };

  const handleSubmit = async (event) => {
    if (event) event.preventDefault();

    const accountName = isAddingNewAccount
      ? newAccountName.trim()
      : (form.account_name || "").trim();

    if (!accountName) {
      window.alert("Please provide an account name.");
      return;
    }

    if (!form.date) {
      window.alert("Please select a date.");
      return;
    }

    const amountValue = Number(form.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      window.alert("Amount should be a positive number.");
      return;
    }

    const payload = {
      date: form.date,
      transaction_type: form.transaction_type,
      category: form.category,
      account_name: accountName,
      description: form.description?.trim() || null,
      amount: amountValue,
      created_at: new Date().toISOString(),
    };

    setSubmitting(true);
    try {
      await assetAPI.addTransaction('bdm', payload);
      setSubmitting(false);

      window.alert("✅ Transaction added successfully!");
      await assetAPI.invalidateCache('bdm');
      await new Promise(resolve => setTimeout(resolve, 500));
      setForm(initialFormState);
      setNewAccountName("");
      setIsAddingNewAccount(false);
      setAccountNames((prev) => {
        if (prev.includes(accountName)) return prev;
        return sortLex([...prev, accountName]);
      });

      if (onSuccess) onSuccess();
    } catch (error) {
      setSubmitting(false);
      console.error("Error inserting BDM transaction:", error.message);
      window.alert(`Failed to save transaction: ${error.message}`);
    }
  };

  const mergedAccountNames = useMemo(() => sortLex(accountNames), [accountNames]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mt-6 mb-2 flex-shrink-0" />
        
        <div className="px-8 py-2 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-white tracking-tight">Add BDM Transaction</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-xl transition-colors text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Account Name</label>
            <div className="relative">
              <select
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                value={isAddingNewAccount ? "__add_new__" : form.account_name}
                onChange={handleAccountSelect}
                required={!isAddingNewAccount}
              >
                <option value="">Select Account</option>
                {mergedAccountNames.map((name) => (
                  <option key={name} value={name} className="bg-gray-900">{name}</option>
                ))}
                <option value="__add_new__" className="bg-gray-900">➕ Add New Account</option>
              </select>
            </div>
          </div>

          {isAddingNewAccount && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">New Account Name</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                type="text"
                value={newAccountName}
                onChange={(event) => setNewAccountName(event.target.value)}
                placeholder="Enter new account name"
                required
                autoFocus
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Date</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all [color-scheme:dark]"
              type="date"
              name="date"
              value={form.date}
              onChange={handleFieldChange}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">Type</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                name="transaction_type"
                value={form.transaction_type}
                onChange={handleFieldChange}
                required
              >
                {transactionTypeOptions.map((option) => (
                  <option key={option} value={option} className="bg-gray-900">{option}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">Category</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                name="category"
                value={form.category}
                onChange={handleFieldChange}
                required
              >
                {categoryOptions.map((option) => (
                  <option key={option} value={option} className="bg-gray-900">{option}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Amount</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              type="number"
              step="0.01"
              min="0"
              name="amount"
              value={form.amount}
              onChange={handleFieldChange}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Description</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none min-h-[80px]"
              name="description"
              value={form.description}
              onChange={handleFieldChange}
              placeholder="Add details..."
            />
          </div>
        </form>

        <div className="px-8 py-6 border-t border-gray-800 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3.5 rounded-xl text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-all border border-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20"
          >
            {submitting ? "Saving..." : "Save Record"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BdmForm;
