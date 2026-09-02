// src/components/Assets/Forms/PPFForm.js
import React, { useState, useEffect } from "react";
import assetAPI from "../../../api/assetAPI.js";
import { useNavigation } from "../../../context/NavigationContext.jsx";
import { 
  Plus, 
  Calendar, 
  IndianRupee, 
  ChevronDown,
  X
} from "lucide-react";

const PPFForm = ({ onClose, onSuccess }) => {
  const { setIsBottomBarHidden } = useNavigation();
  const [form, setForm] = useState({
    account_name: "",
    account_type: "",
    txn_date: "",
    amount: "",
    transaction_type: "",
  });

  useEffect(() => {
    setIsBottomBarHidden(true);
    return () => setIsBottomBarHidden(false);
  }, [setIsBottomBarHidden]);
  const [accountNames, setAccountNames] = useState([]);
  const [showAddNew, setShowAddNew] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");

  useEffect(() => {
    const fetchAccountNames = async () => {
      try {
        const uniqueNames = await assetAPI.getDistinctNames('ppf', 'account_name');
        setAccountNames(uniqueNames);
      } catch (error) {
        console.error("Error fetching account names:", error.message);
      }
    };
    fetchAccountNames();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAccountNameChange = (e) => {
    const val = e.target.value;
    if (val === "Add New Account") {
      setShowAddNew(true);
      setForm({ ...form, account_name: "" });
    } else {
      setShowAddNew(false);
      setForm({ ...form, account_name: val });
    }
  };

  const handleSubmit = async () => {
    const accountName = showAddNew ? newAccountName.trim() : form.account_name;
    if (!accountName || !form.account_type || !form.txn_date || !form.amount || !form.transaction_type) {
      alert("Please fill all required fields");
      return;
    }

    const payload = {
      account_name: accountName,
      account_type: form.account_type,
      txn_date: form.txn_date,
      amount: parseFloat(form.amount),
      transaction_type: form.transaction_type,
      created_at: new Date().toISOString(),
    };

    try {
      await assetAPI.addTransaction('ppf', payload);
      alert("Transaction saved successfully");
      await assetAPI.invalidateCache('ppf');

      setForm({ account_name: "", account_type: "", txn_date: "", amount: "", transaction_type: "" });
      setNewAccountName("");
      setShowAddNew(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error inserting PPF transaction:", error.message);
      alert("Failed to save: " + error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-gray-900 border border-gray-700/50 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mt-6" />
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Plus className="text-blue-400 w-5 h-5" />
              </div>
              <h4 className="text-xl font-black text-white tracking-tight">Add PPF Transaction</h4>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {/* Account Name */}
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Account Name</p>
              <div className="relative">
                <select
                  className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer"
                  value={showAddNew ? "Add New Account" : form.account_name}
                  onChange={handleAccountNameChange}
                  required
                >
                  <option value="">Select Account</option>
                  {accountNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  <option value="Add New Account">+ Add New Account</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {showAddNew && (
              <div className="animate-in slide-in-from-top duration-200">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">New Account Name</p>
                <input
                  className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  type="text"
                  placeholder="Enter new account name"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Asset Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Asset Type</p>
                <div className="relative">
                  <select
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer"
                    name="account_type"
                    value={form.account_type}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Type</option>
                    <option value="ppf">PPF</option>
                    <option value="fd">FD</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Txn Type</p>
                <div className="relative">
                  <select
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer"
                    name="transaction_type"
                    value={form.transaction_type}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Type</option>
                    <option value="Deposit">Deposit</option>
                    <option value="Interest">Interest</option>
                    <option value="Withdrawal">Withdrawal</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Transaction Date */}
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Transaction Date</p>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  type="date"
                  name="txn_date"
                  value={form.txn_date}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Amount */}
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Amount (₹)</p>
              <div className="relative">
                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  type="number"
                  step="0.01"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3.5 rounded-xl transition-all text-[10px] uppercase tracking-widest"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 text-[10px] uppercase tracking-widest"
            >
              Save Transaction
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PPFForm;