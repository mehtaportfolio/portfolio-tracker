// src/components/Assets/Stock/DividendEventsModal.js
import React, { useEffect, useState, useCallback } from "react";
import { stockAPI } from "../../../api/stockAPI.js";
import { X, Edit, Trash2, CheckCircle, XCircle } from "lucide-react";

function DividendEventsModal({ onClose, refreshData }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Date Range Filters - Default to current month
  const [fromDate, setFromDate] = useState(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const yyyy = firstDay.getFullYear();
    const mm = String(firstDay.getMonth() + 1).padStart(2, '0');
    const dd = String(firstDay.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [toDate, setToDate] = useState(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const yyyy = lastDay.getFullYear();
    const mm = String(lastDay.getMonth() + 1).padStart(2, '0');
    const dd = String(lastDay.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [editForm, setEditForm] = useState({
    stock_name: "",
    symbol: "",
    ex_date: "",
    dividend_amount: "",
    status: "active"
  });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [sortColumn, setSortColumn] = useState("ex_date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await stockAPI.fetchDividendEvents();
      if (response.success) {
        // Filter by date client-side to maintain existing UI behavior 
        // while minimizing backend changes
        let filtered = response.data || [];
        if (fromDate) {
          filtered = filtered.filter(ev => ev.ex_date >= fromDate);
        }
        if (toDate) {
          filtered = filtered.filter(ev => ev.ex_date <= toDate);
        }
        setEvents(filtered);
      }
    } catch (error) {
      console.error("Error fetching dividend events:", error);
    }
    setLoading(false);
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Hide main scrollbar when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  const handleToggleStatus = async (event) => {
    const newStatus = event.status === "active" ? "inactive" : "active";
    try {
      const response = await stockAPI.updateDividendEvent(event.id, { status: newStatus });

      if (response.success) {
        setEvents(events.map(e => e.id === event.id ? { ...e, status: newStatus } : e));
      }
    } catch (error) {
      console.error("Error toggling status:", error);
      alert("Error updating status");
    }
  };

  const handleEdit = (event) => {
    setEditingEvent(event.id);
    setEditForm({
      stock_name: event.stock_name || "",
      symbol: event.symbol || "",
      ex_date: event.ex_date ? event.ex_date.split("T")[0] : "",
      dividend_amount: event.dividend_amount || "",
      status: event.status || "active"
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      const response = await stockAPI.updateDividendEvent(editingEvent, editForm);

      if (response.success) {
        setIsEditModalOpen(false);
        setEditingEvent(null);
        fetchEvents();
      }
    } catch (error) {
      console.error("Error updating event:", error);
      alert("Error updating event");
    }
  };

  const handleDelete = (id) => {
    setConfirmDelete(id);
  };

  const confirmDeleteAction = async () => {
    try {
      const response = await stockAPI.deleteDividendEvent(confirmDelete);

      if (response.success) {
        setEvents(events.filter(e => e.id !== confirmDelete));
        setConfirmDelete(null);
      }
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Error deleting event");
    }
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      const response = await stockAPI.applyDividendEvents();
      
      if (response.success) {
        if (response.count > 0) {
          alert(`Successfully generated ${response.count} new dividend cashflows.`);
          if (refreshData) refreshData();
          fetchEvents();
        } else {
          alert(response.message || "No new dividends to generate based on open transactions.");
        }
      }
    } catch (error) {
      console.error("Apply error:", error);
      alert("Failed to apply dividends: " + error.message);
    } finally {
      setIsApplying(false);
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

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  const sortedEvents = [...events].sort((a, b) => {
    let aValue = a[sortColumn];
    let bValue = b[sortColumn];

    if (sortColumn === "dividend_amount") {
      aValue = parseFloat(aValue) || 0;
      bValue = parseFloat(bValue) || 0;
    } else if (sortColumn === "ex_date") {
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

  const totalPages = Math.ceil(sortedEvents.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedEvents = sortedEvents.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-3 sm:p-6 text-gray-100">
      <div className="relative bg-gray-900 rounded-3xl p-4 sm:p-8 w-full max-w-[95vw] sm:max-w-[850px] max-h-[90vh] flex flex-col shadow-2xl border border-gray-800">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-800 hover:bg-rose-900/40 hover:text-rose-400 text-gray-400 rounded-xl transition-all border border-gray-700 z-10"
        >
          <X size={22} />
        </button>

        <div className="shrink-0 flex justify-between items-center mb-6 pb-4 border-b border-gray-800 pr-12">
          <h2 className="text-xl sm:text-2xl font-black text-indigo-400 tracking-tight">Dividend Events</h2>
          <button
            onClick={handleApply}
            disabled={isApplying || loading}
            className={`px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black shadow-lg shadow-emerald-900/40 transition-all active:scale-95 ${isApplying ? "opacity-50" : ""}`}
          >
            {isApplying ? "Applying..." : "Apply Events"}
          </button>
        </div>

        {/* Filters */}
        <div className="shrink-0 flex flex-wrap gap-4 mb-6 p-4 bg-gray-800/40 rounded-2xl border border-gray-800 items-end">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all [color-scheme:dark]"
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all [color-scheme:dark]"
            />
          </div>
          <button
            onClick={() => { setFromDate(""); setToDate(""); }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm font-bold transition-all active:scale-95 h-[38px]"
          >
            Clear
          </button>
        </div>

        {confirmDelete && (
          <div className="shrink-0 mb-6 p-5 bg-rose-900/20 border border-rose-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="font-bold text-rose-200 text-center sm:text-left">Delete this event permanently?</p>
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

        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="rounded-2xl border border-gray-800 bg-gray-800/20">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-gray-800 z-10">
                <tr className="text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-700">
                  <th className="p-4 cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => handleSort("stock_name")}>Stock {sortColumn === "stock_name" && (sortDirection === "asc" ? "↑" : "↓")}</th>
                  <th className="p-4 cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => handleSort("ex_date")}>Ex-Date {sortColumn === "ex_date" && (sortDirection === "asc" ? "↑" : "↓")}</th>
                  <th className="p-4 text-right cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => handleSort("dividend_amount")}>Amount {sortColumn === "dividend_amount" && (sortDirection === "asc" ? "↑" : "↓")}</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm">
                {loading ? (
                  <tr><td colSpan="5" className="p-12 text-center text-gray-500 animate-pulse font-bold italic">Fetching events...</td></tr>
                ) : paginatedEvents.length === 0 ? (
                  <tr><td colSpan="5" className="p-12 text-center text-gray-500 italic">No events found for this period.</td></tr>
                ) : (
                  paginatedEvents.map(ev => (
                    <tr key={ev.id} className="hover:bg-gray-800/40 transition-colors group">
                      <td className="p-4 font-black text-gray-200">{ev.stock_name || ev.symbol}</td>
                      <td className="p-4 text-gray-400 text-xs whitespace-nowrap">
                        {formatDate(ev.ex_date)}
                      </td>
                      <td className="p-4 text-right text-emerald-400 font-bold">₹{ev.dividend_amount}</td>
                      <td className="p-4 text-center">
                        <button onClick={() => handleToggleStatus(ev)} title={ev.status === "active" ? "Mark Inactive" : "Mark Active"} className="transition-transform active:scale-75">
                          {ev.status === "active" ? (
                            <CheckCircle size={20} className="text-emerald-500 mx-auto" />
                          ) : (
                            <XCircle size={20} className="text-gray-600 mx-auto" />
                          )}
                        </button>
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => handleEdit(ev)} className="p-2 bg-indigo-500/10 hover:bg-indigo-500/30 text-indigo-400 rounded-lg transition-all">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => handleDelete(ev.id)} className="p-2 bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 rounded-lg transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="shrink-0 flex items-center justify-between mt-6">
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
      </div>

      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[120] p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-[500px] transform transition-all">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white tracking-tight">Edit Event</h3>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingEvent(null);
                }}
                className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Stock Name</label>
                <input
                  type="text"
                  value={editForm.stock_name}
                  onChange={(e) => setEditForm({ ...editForm, stock_name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Symbol</label>
                  <input
                    type="text"
                    value={editForm.symbol}
                    onChange={(e) => setEditForm({ ...editForm, symbol: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Ex-Date</label>
                  <input
                    type="date"
                    value={editForm.ex_date}
                    onChange={(e) => setEditForm({ ...editForm, ex_date: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all [color-scheme:dark]"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Dividend Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.dividend_amount}
                  onChange={(e) => setEditForm({ ...editForm, dividend_amount: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end mt-8 gap-3">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingEvent(null);
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

export default DividendEventsModal;
