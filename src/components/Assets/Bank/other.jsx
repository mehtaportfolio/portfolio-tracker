import React, { useEffect, useState } from "react";
import { useTrialMode } from "../../../hooks/useTrialMode.js";
import { Pencil, Trash2, X, Check, ArrowUpRight, ArrowDownLeft, Minus, Users } from 'lucide-react';
import { invalidateBulkCache } from "../../../utils/supabasePagination.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import assetAPI from "../../../api/assetAPI.js";

const invalidateBackendCache = async (token) => {
  try {
    await assetAPI.invalidateCache('bank', token);
    invalidateBulkCache();
    console.log('✅ Backend cache invalidated');
  } catch (error) {
    console.error('⚠️ Failed to invalidate cache:', error);
  }
};

const Other = ({ refreshToken = 0, onModalOpen }) => {
  const { isTrialMode } = useTrialMode();
  const { session } = useAuth();
  const token = session?.access_token;
  const [netAmounts, setNetAmounts] = useState({});
  const [hiddenNetAmounts, setHiddenNetAmounts] = useState({});
  const [showHidden, setShowHidden] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accountTransactions, setAccountTransactions] = useState([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [modalError, setModalError] = useState("");
  const [savingTransactionId, setSavingTransactionId] = useState(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState(null);

  useEffect(() => {
    fetchOtherTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken, token]);

  const mapTransactionsForState = (records) => {
    return (records || []).map((txn) => {
      const normalizedDate = txn.date ? txn.date.split("T")[0] : "";
      return {
        ...txn,
        isEditing: false,
        draft: {
          date: normalizedDate,
          transaction_type: txn.transaction_type || "",
          amount: txn.amount ?? "",
          note: txn.note ?? "",
        },
      };
    });
  };

  const fetchOtherTransactions = async () => {
    if (!token) return;
    try {
      const data = await assetAPI.getOtherTransactions({ select: 'account_name,transaction_type,amount' }, token);

      const nets = {};
      data.forEach((txn) => {
        const account = txn.account_name;
        const type = txn.transaction_type?.toLowerCase();
        const amt = Number(txn.amount) || 0;

        if (!nets[account]) nets[account] = 0;

        if (type === "debit") {
          nets[account] += amt;
        } else if (type === "credit") {
          nets[account] -= amt;
        }
      });

      const visibleNets = {};
      const zeroBalanceNets = {};

      Object.entries(nets).forEach(([account, net]) => {
        if (net === 0) {
          zeroBalanceNets[account] = net;
        } else {
          visibleNets[account] = net;
        }
      });

      setNetAmounts(visibleNets);
      setHiddenNetAmounts(zeroBalanceNets);
      setShowHidden(false);
    } catch (error) {
      console.error("Error fetching other transactions from backend:", error);
    }
  };

  const openAccountModal = async (account) => {
    if (!token) return;
    setSelectedAccount(account);
    setIsModalOpen(true);
    onModalOpen && onModalOpen(true);
    setIsLoadingTransactions(true);
    setModalError("");

    try {
      const filters = JSON.stringify([{ column: 'account_name', value: account, operator: 'eq' }]);
      const data = await assetAPI.getOtherTransactions({
        select: 'id,date,transaction_type,amount,note',
        filters
      }, token);
      setAccountTransactions(mapTransactionsForState(data));
    } catch (error) {
      console.error("Error fetching account transactions from backend:", error);
      setModalError("Unable to load transactions. Please try again.");
      setAccountTransactions([]);
    }

    setIsLoadingTransactions(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    onModalOpen && onModalOpen(false);
    setSelectedAccount(null);
    setAccountTransactions([]);
    setModalError("");
  };

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  };

  const startEditingTransaction = (id) => {
    setAccountTransactions((prev) =>
      prev.map((txn) =>
        txn.id === id
          ? {
              ...txn,
              isEditing: true,
              draft: {
                date: txn.date ? txn.date.split("T")[0] : "",
                transaction_type: txn.transaction_type || "",
                amount: txn.amount ?? "",
                note: txn.note ?? "",
              },
            }
          : txn
      )
    );
    setModalError("");
  };

  const cancelEditingTransaction = (id) => {
    setAccountTransactions((prev) =>
      prev.map((txn) =>
        txn.id === id
          ? {
              ...txn,
              isEditing: false,
              draft: {
                date: txn.date ? txn.date.split("T")[0] : "",
                transaction_type: txn.transaction_type || "",
                amount: txn.amount ?? "",
                note: txn.note ?? "",
              },
            }
          : txn
      )
    );
    setModalError("");
  };

  const updateTransactionDraft = (id, field, value) => {
    setAccountTransactions((prev) =>
      prev.map((txn) =>
        txn.id === id
          ? { ...txn, draft: { ...txn.draft, [field]: value } }
          : txn
      )
    );
  };

  const saveTransaction = async (id) => {
    const txn = accountTransactions.find((item) => item.id === id);
    if (!txn) return;

    const { date, transaction_type, amount, note } = txn.draft;

    if (!date || !transaction_type || amount === "") {
      setModalError("Please fill in all required fields before saving.");
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount)) {
      setModalError("Please enter a valid amount.");
      return;
    }

    setSavingTransactionId(id);
    setModalError("");

    const updates = {
      date,
      transaction_type,
      amount: parsedAmount,
      note: note?.toString().trim() || null,
    };

    try {
      await assetAPI.updateOtherTransaction(id, updates, token);

      setAccountTransactions((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                ...updates,
                note: updates.note,
                isEditing: false,
                draft: {
                  date: updates.date,
                  transaction_type: updates.transaction_type,
                  amount: updates.amount,
                  note: updates.note || "",
                },
              }
            : item
        )
      );

      fetchOtherTransactions();
      await invalidateBackendCache(token);
    } catch (error) {
      console.error("Error updating transaction via backend:", error);
      setModalError("Failed to save transaction. Please try again.");
    } finally {
      setSavingTransactionId(null);
    }
  };

  const deleteTransaction = async (id) => {
    if (!token) return;
    const confirmation = window.confirm("Are you sure you want to delete this transaction?");
    if (!confirmation) return;

    setDeletingTransactionId(id);
    setModalError("");

    try {
      await assetAPI.deleteOtherTransaction(id, token);

      setAccountTransactions((prev) => prev.filter((txn) => txn.id !== id));
      fetchOtherTransactions();
      await invalidateBackendCache(token);
    } catch (error) {
      console.error("Error deleting transaction via backend:", error);
      setModalError("Failed to delete transaction. Please try again.");
    } finally {
      setDeletingTransactionId(null);
    }
  };

  useEffect(() => {
    if (!isModalOpen) return;
    if (accountTransactions.length === 0 && !isLoadingTransactions && !modalError) {
      // Close modal if no transactions remain after deletion
      closeModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountTransactions, isModalOpen, isLoadingTransactions, modalError]);

 const formatDateForDisplay = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  return `${day}\u2011${month}\u2011${year}`; // non-breaking hyphens
};


  const formatAmount = (value) => {
    const numericValue = Number(value) || 0;
    return `₹${numericValue.toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  const renderTransactionCard = (account, net, index) => {
    // Dynamic color selection based on index for a premium "glass" look
    const cardColors = [
      "bg-indigo-600/10 border-indigo-500/20 text-indigo-400",
      "bg-emerald-600/10 border-emerald-500/20 text-emerald-400",
      "bg-rose-600/10 border-rose-500/20 text-rose-400",
      "bg-amber-600/10 border-amber-500/20 text-amber-400",
      "bg-blue-600/10 border-blue-500/20 text-blue-400",
      "bg-violet-600/10 border-violet-500/20 text-violet-400",
      "bg-cyan-600/10 border-cyan-500/20 text-cyan-400",
      "bg-fuchsia-600/10 border-fuchsia-500/20 text-fuchsia-400"
    ];
    const colorClass = cardColors[index % cardColors.length];
    const cardBg = colorClass.split(' ').slice(0, 2).join(' ');

    return (
    <button
      key={account}
      type="button"
      onClick={() => openAccountModal(account)}
      className={`group p-6 rounded-[2rem] ${cardBg} flex flex-col items-start border text-left hover:bg-white/10 transition-all active:scale-[0.98] shadow-xl relative overflow-hidden backdrop-blur-md`}
    >
      <div className={`absolute -right-4 -top-4 w-12 h-12 blur-2xl rounded-full transition-all duration-500 ${colorClass.split(' ')[0].replace('/10', '/20')} group-hover:scale-150`}></div>

      <div className="flex items-center space-x-2.5 mb-4 relative z-10">
        <div className={`p-2 rounded-xl border transition-all ${colorClass}`}>
          {net > 0 ? <ArrowUpRight size={18} /> : net < 0 ? <ArrowDownLeft size={18} /> : <Minus size={18} />}
        </div>
        <span className="font-bold text-gray-200 truncate text-[13px] tracking-tight group-hover:text-white transition-colors uppercase leading-tight">{account}</span>
      </div>

      <span
        className={`text-xl font-black tracking-tighter relative z-10 ${
          net >= 0 ? "text-emerald-400" : "text-rose-400"
        }`}
      >
        ₹{Math.abs(isTrialMode ? 0 : net).toLocaleString("en-IN")}
      </span>

      <div className="mt-4 flex items-center relative z-10">
        {net < 0 ? (
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20">Borrowed</span>
        ) : net > 0 ? (
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Lent</span>
        ) : (
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-gray-500/10 text-gray-400 border border-gray-500/20">Settled</span>
        )}
      </div>
    </button>
    );
  };

  const hasVisibleTransactions = Object.keys(netAmounts).length > 0;
  const hasHiddenTransactions = Object.keys(hiddenNetAmounts).length > 0;
  const totalNetBalance = Object.values(netAmounts).concat(Object.values(hiddenNetAmounts))
  .reduce((sum, val) => sum + val, 0);


  return (
    <div className="text-white animate-in fade-in slide-in-from-bottom-4 duration-500">


{/* Total Net Balance Card - Apple Glass Style */}
<div className="mb-10 p-6 rounded-[2.5rem] bg-purple-600/10 border border-purple-500/20 flex items-center justify-between shadow-2xl relative overflow-hidden">
  <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-purple-500/10 blur-[80px] rounded-full"></div>
  
  <div className="flex items-center space-x-4 relative z-10">

    <div>
      <p className="text-[15px] font-black text-purple-400 uppercase tracking-[0.2em]">Net Balance</p>
    </div>
  </div>

  <div className="text-right relative z-10">
    <p className={`text-3xl font-black tracking-tighter ${
      totalNetBalance >= 0 ? "text-emerald-400" : "text-rose-400"
    }`}>
      {totalNetBalance >= 0 ? "+" : "-"} ₹{Math.abs(isTrialMode ? 0 : totalNetBalance).toLocaleString("en-IN")} 
    </p>
  </div>
</div>



      <div className="flex items-center space-x-2 mb-6 px-1">
        <Users size={18} className="text-gray-500" />
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500">Other Transactions</h3>
      </div>

      {hasVisibleTransactions && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Object.entries(netAmounts).map(([account, net], index) =>
            renderTransactionCard(account, net, index)
          )}
        </div>
      )}

      {!hasVisibleTransactions && !hasHiddenTransactions && (
        <p className="text-center text-gray-500 mt-12 py-16 bg-white/5 rounded-[2rem] border border-dashed border-white/10 font-bold tracking-tight">
          No transactions to display.
        </p>
      )}

      {hasHiddenTransactions && (
        <div className="mt-12">
          <button
            type="button"
            className="w-full text-left py-2 flex items-center justify-between group px-1"
            onClick={() => setShowHidden((prev) => !prev)}
            aria-expanded={showHidden}
          >
            <div className="flex items-center space-x-2">
              <div className="w-1 h-1 rounded-full bg-gray-600"></div>
              <span className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] group-hover:text-gray-300 transition-colors">Closed Transactions ({Object.keys(hiddenNetAmounts).length})</span>
            </div>
            <span className="text-gray-600 group-hover:text-gray-400 transition-all transform duration-300">
              {showHidden ? "▲" : "▼"}
            </span>
          </button>

          {showHidden && (
            <div className="mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(hiddenNetAmounts).map(([account, net], index) =>
                  renderTransactionCard(account, net, index)
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md px-4 py-6 animate-in fade-in duration-300"
          role="dialog"
          aria-modal="true"
          onClick={handleOverlayClick}
        >
          <div className="relative w-full max-w-4xl rounded-[2.5rem] bg-[#0a0a0b]/90 border border-white/10 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden backdrop-blur-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 opacity-50"></div>
            <div className="sticky top-0 p-8 border-b border-white/5 flex justify-between items-center z-10 bg-white/5 backdrop-blur-xl">
              <div>
                <h3 className="text-2xl font-black text-white tracking-tighter truncate max-w-[200px] sm:max-w-md">
                  {selectedAccount}
                </h3>
                <p className="mt-1 text-[10px] font-black text-gray-500 uppercase tracking-widest">Transaction History</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-3 rounded-2xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all border border-white/5 group"
              >
                <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>

            <div className="flex-1 overflow-auto px-4 py-6">
              {isLoadingTransactions ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-400 text-sm">Loading transactions…</p>
                </div>
              ) : modalError ? (
                <p className="text-center text-red-500 py-12">{modalError}</p>
              ) : accountTransactions.length === 0 ? (
                <p className="text-center text-gray-500 py-12">
                  No transactions available for this account.
                </p>
              ) : (
                <div className="min-w-max px-4">
                  <table className="min-w-full divide-y divide-[#2c2c2e]">
                    <thead>
                      <tr>
                        <th className="px-4 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">
                          Date
                        </th>
                        <th className="px-4 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">
                          Type
                        </th>
                        <th className="px-4 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">
                          Amount
                        </th>
                        <th className="px-4 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">
                          Note
                        </th>
                        <th className="px-4 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-gray-500">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2c2c2e]">
                      {accountTransactions.map((txn) => (
                        <tr key={txn.id} className="align-middle hover:bg-[#2c2c2e]/30 transition-colors">
                          <td className="px-4 py-4 text-sm text-gray-300">
                            {txn.isEditing ? (
                              <input
                                type="date"
                                className="w-32 rounded-lg bg-[#2c2c2e] border border-[#3a3a3c] px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                value={txn.draft.date}
                                onChange={(event) =>
                                  updateTransactionDraft(txn.id, "date", event.target.value)
                                }
                                required
                              />
                            ) : (
                              formatDateForDisplay(txn.date)
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm">
                            {txn.isEditing ? (
                              <select
                                className="w-28 rounded-lg bg-[#2c2c2e] border border-[#3a3a3c] px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                value={txn.draft.transaction_type}
                                onChange={(event) =>
                                  updateTransactionDraft(txn.id, "transaction_type", event.target.value)
                                }
                                required
                              >
                                <option value="">Select</option>
                                <option value="debit">Debit</option>
                                <option value="credit">Credit</option>
                              </select>
                            ) : (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                txn.transaction_type?.toLowerCase() === 'debit' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
                              }`}>
                                {txn.transaction_type || "-"}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm font-semibold text-white">
                            {txn.isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                className="w-24 rounded-lg bg-[#2c2c2e] border border-[#3a3a3c] px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                value={txn.draft.amount}
                                onChange={(event) =>
                                  updateTransactionDraft(txn.id, "amount", event.target.value)
                                }
                                required
                              />
                            ) : (
                              formatAmount(txn.amount)
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-400">
                            {txn.isEditing ? (
                              <textarea
                                rows={1}
                                className="w-32 rounded-lg bg-[#2c2c2e] border border-[#3a3a3c] px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                value={txn.draft.note || ""}
                                onChange={(event) =>
                                  updateTransactionDraft(txn.id, "note", event.target.value)
                                }
                              />
                            ) : (
                              txn.note ? txn.note : <span className="text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex justify-end space-x-2">
                              {txn.isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    className="p-2 rounded-lg bg-[#3a3a3c] text-gray-300 hover:text-white transition-colors"
                                    onClick={() => cancelEditingTransaction(txn.id)}
                                    disabled={savingTransactionId === txn.id}
                                  >
                                    <X size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                                    onClick={() => saveTransaction(txn.id)}
                                    disabled={savingTransactionId === txn.id}
                                  >
                                    <Check size={16} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="p-2 rounded-lg bg-[#2c2c2e] text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 transition-all"
                                    onClick={() => startEditingTransaction(txn.id)}
                                  >
                                    <Pencil size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    className="p-2 rounded-lg bg-[#2c2c2e] text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                    onClick={() => deleteTransaction(txn.id)}
                                    disabled={deletingTransactionId === txn.id}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            </div>

        </div>
      )}
    </div>
  );
};

export default Other;