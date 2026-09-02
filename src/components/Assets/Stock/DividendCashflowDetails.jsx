import React, { useEffect, useState } from "react";
import { stockAPI } from "../../../api/stockAPI.js";
import { X, Edit, Trash2, ArrowLeft, RefreshCw } from "lucide-react";

function DividendCashflowDetails({ onClose, refreshData }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("filter"); // "filter" or "table"
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [accountOptions, setAccountOptions] = useState([]);
  
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    accountName: "ALL"
  });

  const [editForm, setEditForm] = useState({
    date: "",
    transaction_type: "dividend",
    amount: "",
    account_name: "",
    stock_name: ""
  });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [sortColumn, setSortColumn] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const result = await stockAPI.fetchStockAccountNames("cashflow");
        if (result.success && result.data) {
          setAccountOptions(result.data.sort());
        }
      } catch (error) {
        console.error("Error fetching account options:", error);
      }
    };
    fetchAccounts();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const params = { transaction_type: "dividend" };
    
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (filters.accountName && filters.accountName !== "ALL") {
      params.account_name = filters.accountName;
    }

    try {
      const result = await stockAPI.fetchCashflow(params);
      if (result.success) {
        setTransactions(result.data || []);
        setView("table");
      }
    } catch (error) {
      console.error("Error fetching dividend history:", error);
    }
    
    setCurrentPage(1);
    setLoading(false);
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction.id);
    setEditForm({
      date: transaction.date ? transaction.date.split("T")[0] : "",
      transaction_type: transaction.transaction_type || "dividend",
      amount: transaction.amount,
      account_name: transaction.account_name || "",
      stock_name: transaction.stock_name || ""
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      setIsRefreshing(true);
      const result = await stockAPI.updateCashflow(editingTransaction, editForm);
      if (!result.success) throw new Error(result.error);

      setEditingTransaction(null);
      setIsEditModalOpen(false);
      
      refreshData();
      const updatedTransactions = transactions.map((t) =>
        t.id === editingTransaction ? { ...t, ...editForm } : t
      );
      setTransactions(updatedTransactions);
      setIsRefreshing(false);
    } catch (error) {
      console.error("Error updating transaction:", error);
      alert("Error updating transaction");
      setIsRefreshing(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmDelete(id);
  };

  const confirmDeleteAction = async () => {
    try {
      setIsRefreshing(true);
      const result = await stockAPI.deleteCashflow(confirmDelete);
      if (!result.success) throw new Error(result.error);

      refreshData();
      setTransactions(transactions.filter(t => t.id !== confirmDelete));
      setConfirmDelete(null);
      setIsRefreshing(false);
    } catch (error) {
      console.error("Error deleting transaction:", error);
      alert("Error deleting transaction");
      setConfirmDelete(null);
      setIsRefreshing(false);
    }
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedTransactions = [...transactions].sort((a, b) => {
    let aValue = a[sortColumn];
    let bValue = b[sortColumn];

    if (sortColumn === "amount") {
      aValue = parseFloat(aValue) || 0;
      bValue = parseFloat(bValue) || 0;
    } else if (sortColumn === "date") {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    } else {
      aValue = (aValue || "").toString().toLowerCase();
      bValue = (bValue || "").toString().toLowerCase();
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedTransactions.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedTransactions = sortedTransactions.slice(startIndex, endIndex);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-3 sm:p-6 text-gray-100">
      {isRefreshing && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center">
          <div className="bg-gray-800 rounded-2xl p-8 flex flex-col items-center gap-4 border border-gray-700 shadow-2xl">
            <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-lg font-bold text-gray-200">Updating records...</p>
          </div>
        </div>
      )}

      <div className="relative bg-gray-900 rounded-3xl p-4 sm:p-8 w-full max-w-[95vw] sm:max-w-[850px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-800">
        <div className="shrink-0 flex justify-between items-center mb-6 pb-4 border-b border-gray-800">
          <h2 className="text-xl sm:text-2xl font-black text-indigo-400 tracking-tight">
            Dividend History {filters.accountName !== "ALL" && <span className="text-gray-500 ml-2">/ {filters.accountName}</span>}
          </h2>
          <div className="flex gap-3">
            {view === "table" && (
              <button 
                onClick={() => setView("filter")}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-all border border-gray-700"
              >
                <ArrowLeft size={18} /> <span className="hidden sm:inline">Filters</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 bg-gray-800 hover:bg-rose-900/40 hover:text-rose-400 text-gray-400 rounded-xl transition-all border border-gray-700"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {view === "filter" ? (
            <div className="space-y-6 py-4 px-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Start Date</label>
                  <input 
                    type="date"
                    className="w-full bg-gray-800 border border-gray-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all [color-scheme:dark]"
                    value={filters.startDate}
                    onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest ml-1">End Date</label>
                  <input 
                    type="date"
                    className="w-full bg-gray-800 border border-gray-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all [color-scheme:dark]"
                    value={filters.endDate}
                    onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Account Owner</label>
                <select 
                  className="w-full bg-gray-800 border border-gray-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                  value={filters.accountName}
                  onChange={(e) => setFilters({...filters, accountName: e.target.value})}
                >
                  <option value="ALL">All Owners</option>
                  {accountOptions.map(acc => (
                    <option key={acc} value={acc} className="bg-gray-900">{acc}</option>
                  ))}
                </select>
              </div>
              <button 
                onClick={fetchData}
                disabled={loading}
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-indigo-900/40 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? <RefreshCw className="animate-spin" /> : "Apply Filters"}
              </button>
            </div>
          ) : (
            <>
              {confirmDelete && (
                <div className="mb-6 p-5 bg-rose-900/20 border border-rose-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="font-bold text-rose-200 text-center sm:text-left">Permanently delete this record?</p>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={confirmDeleteAction} className="flex-1 sm:flex-none px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95">
                      Delete
                    </button>
                    <button onClick={() => setConfirmDelete(null)} className="flex-1 sm:flex-none px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-gray-800 shadow-inner bg-gray-800/20">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-800/80 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                      {filters.accountName === "ALL" && (
                        <th className="p-4 cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => handleSort("account_name")}>
                          Acc {sortColumn === "account_name" && (sortDirection === "asc" ? "↑" : "↓")}
                        </th>
                      )}
                      <th className="p-4 cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => handleSort("stock_name")}>
                        Stock {sortColumn === "stock_name" && (sortDirection === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="p-4 text-center cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => handleSort("amount")}>
                        Amt {sortColumn === "amount" && (sortDirection === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="p-4 text-center cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => handleSort("date")}>
                        Date {sortColumn === "date" && (sortDirection === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="p-4 text-center">Opt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 text-sm">
                    {paginatedTransactions.length > 0 ? paginatedTransactions.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-800/40 transition-colors">
                        {filters.accountName === "ALL" && <td className="p-4 font-medium text-gray-400">{t.account_name}</td>}
                        <td className="p-4 font-black text-gray-200">{t.stock_name}</td>
                        <td className="p-4 text-center text-emerald-400 font-bold">₹{Number(t.amount).toLocaleString("en-IN")}</td>
                        <td className="p-4 text-center text-gray-400 whitespace-nowrap text-xs">
                          {(() => {
                            const d = new Date(t.date);
                            const day = String(d.getDate()).padStart(2, "0");
                            const month = String(d.getMonth() + 1).padStart(2, "0");
                            const year = String(d.getFullYear()).toString().slice(-2);
                            return `${day}-${month}-${year}`;
                          })()}
                        </td>
                        <td className="p-4 text-center whitespace-nowrap">
                          <div className="flex justify-center gap-1">
                            <button onClick={() => handleEdit(t)} className="p-2 bg-indigo-500/10 hover:bg-indigo-500/30 text-indigo-400 rounded-lg transition-all">
                              <Edit size={14} />
                            </button>
                            <button onClick={() => handleDelete(t.id)} className="p-2 bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 rounded-lg transition-all">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="5" className="p-12 text-center text-gray-500 italic">No records matching your criteria.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-8 mb-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl disabled:opacity-30 transition-all border border-gray-700"
                  >
                    Prev
                  </button>
                  <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Page {currentPage} / {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl disabled:opacity-30 transition-all border border-gray-700"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="shrink-0 pt-6 mt-2 border-t border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-2xl transition-all border border-gray-700 active:scale-95"
          >
            Close
          </button>
        </div>
      </div>

      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[120] p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-[500px] transform transition-all">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white tracking-tight">Edit Dividend</h3>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingTransaction(null);
                }}
                className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Account</label>
                <input
                  type="text"
                  value={editForm.account_name}
                  onChange={(e) => setEditForm({ ...editForm, account_name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Stock</label>
                <input
                  type="text"
                  value={editForm.stock_name}
                  onChange={(e) => setEditForm({ ...editForm, stock_name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Amount</label>
                  <input
                    type="number"
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Date</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-8 gap-3">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingTransaction(null);
                }}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-2xl transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-900/40 transition-all active:scale-95"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DividendCashflowDetails;
