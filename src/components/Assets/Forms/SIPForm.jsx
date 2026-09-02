// src/components/forms/SIPForm.js
import React, { useEffect, useState, useCallback } from "react";
import mfAPI from "../../../api/mfAPI.js";
import { useNavigation } from "../../../context/NavigationContext.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";

const SIPForm = ({ onClose, onSuccess, editingSip = null }) => {
  const { setIsBottomBarHidden } = useNavigation();
  const { session } = useAuth();
  // --- STATES ---
  const [accountName, setAccountName] = useState(editingSip?.account_name || "");
  const [fundShortName, setFundShortName] = useState(editingSip?.fund_short_name || "");
  const [amount, setAmount] = useState(editingSip?.amount || "");
  const [sipDate, setSipDate] = useState(editingSip?.sip_date || "");

  useEffect(() => {
    setIsBottomBarHidden(true);
    return () => setIsBottomBarHidden(false);
  }, [setIsBottomBarHidden]);

  const [fundOptions, setFundOptions] = useState([]);
  const [accountOptions, setAccountOptions] = useState([]);
  const [newAccountName, setNewAccountName] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [loading, setLoading] = useState(false);

  // Close on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // --- FETCH FUND NAMES ---
  const fetchFundNames = useCallback(async () => {
    try {
      const data = await mfAPI.getMFData(session?.access_token);
      if (data && data.fundMaster) {
        const uniqueFunds = [...new Set(data.fundMaster.map(f => f.fund_short_name).filter(Boolean))].sort();
        setFundOptions(uniqueFunds);
      }
    } catch (error) {
      console.error("Error fetching fund names:", error);
    }
  }, [session?.access_token]);

  // --- FETCH ACCOUNT NAMES ---
  const fetchAccountNames = useCallback(async () => {
    try {
      const data = await mfAPI.getMFAccountNames(session?.access_token);
      if (data) {
        setAccountOptions(data);
      }
    } catch (error) {
      console.error("Error fetching account names:", error);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchFundNames();
    fetchAccountNames();
  }, [fetchFundNames, fetchAccountNames]);

  // --- SUBMIT ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const sipData = {
        account_name: accountName,
        fund_short_name: fundShortName,
        amount: parseFloat(amount),
        sip_date: sipDate,
      };

      if (editingSip) {
        await mfAPI.updateSIP(editingSip.id, sipData, session?.access_token);
      } else {
        await mfAPI.addSIP(sipData, session?.access_token);
      }

      alert('SIP saved successfully');
      await mfAPI.invalidateCache(session?.access_token);
      window.dispatchEvent(new CustomEvent('portfolio-cache-invalidated', { detail: { assetType: 'mf' } }));
      await new Promise(resolve => setTimeout(resolve, 500));

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error saving SIP:', error);
      alert('Failed to save SIP: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-1">
      <div className="bg-gray-900 border border-gray-800 rounded-[2rem] shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mt-2 mb-2" />
        <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-center">
          <h2 className="text-2xl font-bold text-white tracking-tight">{editingSip ? 'Edit SIP' : 'Add SIP'}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-2">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Account Name */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">
                Account Name
              </label>
              {isAddingNew ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder="Enter new account name"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    required
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (newAccountName.trim()) {
                          setAccountName(newAccountName.trim());
                          setIsAddingNew(false);
                          setNewAccountName("");
                        }
                      }}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNew(false);
                        setNewAccountName("");
                      }}
                      className="px-4 py-2 text-sm bg-gray-800 text-gray-400 rounded-xl hover:bg-gray-700 transition-colors border border-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer"
                    required
                  >
                    <option value="">Select Account</option>
                    {accountOptions.map((acc) => (
                      <option key={acc} value={acc}>{acc}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(true)}
                    className="text-blue-400 text-sm hover:text-blue-300 transition-colors ml-1"
                  >
                    + Add New Account
                  </button>
                </div>
              )}
            </div>

            {/* Fund Short Name */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">
                Fund Short Name
              </label>
              <select
                value={fundShortName}
                onChange={(e) => setFundShortName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer"
                required
              >
                <option value="">Select Fund</option>
                {fundOptions.map((fund) => (
                  <option key={fund} value={fund}>{fund}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Amount */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-400 ml-1">
                  Amount
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="0.00"
                  step="0.01"
                  required
                />
              </div>

              {/* SIP Date */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-400 ml-1">
                  SIP Date (e.g., 4th)
                </label>
                <input
                  type="text"
                  value={sipDate}
                  onChange={(e) => setSipDate(e.target.value)}
                  placeholder="e.g., 4th"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  required
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-6 border-t border-gray-800">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3.5 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-all border border-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20"
              >
                {loading ? 'Saving...' : (editingSip ? 'Update SIP' : 'Add SIP')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SIPForm;