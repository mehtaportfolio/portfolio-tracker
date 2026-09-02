// src/components/Assets/Forms/OtherForm.js
import React, { useEffect, useState } from "react";
import assetAPI from "../../../api/assetAPI.js";
import { useNavigation } from "../../../context/NavigationContext.jsx";

const initialFormState = {
  account_name: "",
  date: "",
  transaction_type: "",
  amount: "",
  note: "",
};

const OtherForm = ({ onClose, onSuccess }) => {
  const { setIsBottomBarHidden } = useNavigation();
  const [form, setForm] = useState(initialFormState);
  const [accountNames, setAccountNames] = useState([]);
  const [showAddNew, setShowAddNew] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsBottomBarHidden(true);
    return () => setIsBottomBarHidden(false);
  }, [setIsBottomBarHidden]);

  useEffect(() => {
    const fetchAccountNames = async () => {
      try {
        const data = await assetAPI.getDistinctNames('other', 'account_name');
        if (data) {
          setAccountNames(data);
        }
      } catch (error) {
        console.error("Error fetching account names:", error.message);
      }
    };

    fetchAccountNames();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAccountNameChange = (event) => {
    const { value } = event.target;

    if (value === "__add_new__") {
      setShowAddNew(true);
      setForm((prev) => ({ ...prev, account_name: "" }));
    } else {
      setShowAddNew(false);
      setForm((prev) => ({ ...prev, account_name: value }));
    }
  };

  const handleSubmit = async () => {
    const accountName = showAddNew ? newAccountName.trim() : form.account_name.trim();
    const { date, transaction_type, amount, note } = form;

    if (!accountName || !date || !transaction_type || !amount) {
      alert("Please fill in all required fields.");
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount)) {
      alert("Please enter a valid amount.");
      return;
    }

    setIsSaving(true);

    const payload = {
      account_name: accountName,
      date,
      transaction_type,
      amount: parsedAmount,
      note: note.trim() || null,
      created_at: new Date().toISOString(),
    };

    try {
      await assetAPI.addTransaction('other', payload);
      setIsSaving(false);

      alert("Transaction saved successfully");
      await assetAPI.invalidateCache('other');
      await new Promise(resolve => setTimeout(resolve, 500));

      setForm(initialFormState);
      setNewAccountName("");
      setShowAddNew(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      setIsSaving(false);
      console.error("Error inserting other transaction:", error.message);
      alert("Failed to save transaction: " + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-1">
      <div className="bg-gray-900 border border-gray-800 rounded-[2rem] shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-2" />
        <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-center">
          <h3 className="text-2xl font-bold text-white tracking-tight text-center">Add Other Transaction</h3>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-2 space-y-5">
          {/* Account Name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Account Name</label>
            <select
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
              value={showAddNew ? "__add_new__" : form.account_name}
              onChange={handleAccountNameChange}
              required
            >
              <option value="">Select Account</option>
              {accountNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value="__add_new__">Add New Account</option>
            </select>
          </div>

          {showAddNew && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">New Account Name</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                type="text"
                placeholder="Enter new account name"
                value={newAccountName}
                onChange={(event) => setNewAccountName(event.target.value)}
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">Date</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all [color-scheme:dark]"
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                required
              />
            </div>

            {/* Transaction Type */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">Type</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer"
                name="transaction_type"
                value={form.transaction_type}
                onChange={handleChange}
                required
              >
                <option value="">Select Type</option>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Amount</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              type="number"
              step="0.01"
              name="amount"
              placeholder="0.00"
              value={form.amount}
              onChange={handleChange}
              required
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Note (optional)</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[80px]"
              name="note"
              placeholder="Add details..."
              value={form.note}
              onChange={handleChange}
            />
          </div>

          <div className="flex gap-3 pt-6 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-6 py-3.5 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-all border border-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex-1 px-6 py-3.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-900/20 transition-all"
            >
              {isSaving ? "Saving..." : "Save Record"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OtherForm;