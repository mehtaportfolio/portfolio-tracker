import React, { useEffect, useState } from "react";
import { stockAPI } from "../../../api/stockAPI.js";
import { Pencil, Trash2, RefreshCw, CheckCircle, RotateCcw, CheckCheck, Ban } from "lucide-react";
import { useNavigation } from "../../../context/NavigationContext.jsx";
import { invalidateBulkCache } from "../../../utils/supabasePagination.js";

const BonusSplit = () => {
  const [records, setRecords] = useState([]);
  const [stockMaster, setStockMaster] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    date: "",
    stock_name: "",
    ratio_x: "",
    ratio_y: "",
    type: "",
    status: "active",
    source: "",
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [filters, setFilters] = useState({
    source: "All",
    status: "All",
    type: "All",
    dateRange: "CurrentMonth",
  });
  const { refreshDashboard, refreshAssets } = useNavigation();
  
  const invalidateBackendCache = async () => {
    try {
      await stockAPI.invalidateCache();
      invalidateBulkCache();
    } catch (error) {
      console.error("Error invalidating cache:", error);
    }
  };

  // 🔹 Derived filtered records
  const filteredRecords = records.filter((r) => {
    const sourceMatch = filters.source === "All" || r.source === filters.source;
    const statusMatch = filters.status === "All" || r.status === filters.status;
    const typeMatch = filters.type === "All" || r.type === filters.type;

    let dateMatch = true;
    if (filters.dateRange !== "All" && r.date) {
      const recordDate = new Date(r.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (filters.dateRange === "Future") {
        dateMatch = recordDate > today;
      } else if (filters.dateRange === "CurrentMonth") {
        dateMatch =
          recordDate.getMonth() === today.getMonth() &&
          recordDate.getFullYear() === today.getFullYear();
      } else {
        const months = parseInt(filters.dateRange);
        const cutoffDate = new Date();
        cutoffDate.setMonth(today.getMonth() - months);
        dateMatch = recordDate >= cutoffDate && recordDate <= today;
      }
    }

    return sourceMatch && statusMatch && typeMatch && dateMatch;
  });

  // 🔹 Get unique filter options
  const sourceOptions = ["All", ...new Set(records.map((r) => r.source).filter(Boolean))];
  const typeOptions = ["All", ...new Set(records.map((r) => r.type).filter(Boolean))];
  const statusOptions = ["All", "active", "inactive"];

  // 🔹 Fetch existing bonus_split data
  const fetchData = async () => {
    try {
      const { data } = await stockAPI.fetchBonusSplits();
      setRecords(data || []);
    } catch (error) {
      console.error("Error fetching bonus splits:", error);
    }
  };

  // 🔹 Fetch stock_master for dropdown
  const fetchStockMaster = async () => {
    try {
      const { data } = await stockAPI.fetchStockMaster();
      if (data) setStockMaster(data);
    } catch (error) {
      console.error("Error fetching stock master:", error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchStockMaster();
  }, []);

  // 🔹 Refresh from corporate_actions
  const handleRefresh = async () => {
    setSyncing(true);
    try {
      const response = await stockAPI.syncCorporateActions();
      
      // Show user-friendly message
      if (response.success) {
        if (response.skippedDuplicates) {
          alert(`✓ Corporate actions fetched successfully from NSE/Yahoo.\n\nSome records were skipped because they already exist (same stock, date, and type).\n\nNew records added: ${response.count}`);
        } else if (response.count > 0) {
          alert(`✓ Successfully synced ${response.count} new corporate action(s).`);
          await fetchData();
        } else {
          alert(`ℹ No new corporate actions found.`);
        }
      } else {
        alert(`✗ Sync failed: ${response.message || 'Unknown error'}`);
      }
      
      // Refresh data if there were new records
      if (response.count > 0) {
        await fetchData();
      }
    } catch (error) {
      console.error("Refresh error:", error);
      alert(`✗ Failed to sync corporate actions: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // 🔹 Handle form field change
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 🔹 Save or update record
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const ratioString = `${formData.ratio_x}:${formData.ratio_y}`;

    try {
      if (formData.id) {
        await stockAPI.updateBonusSplit(formData.id, {
          date: formData.date,
          stock_name: formData.stock_name,
          ratio: ratioString,
          type: formData.type,
          status: formData.status,
          source: formData.source,
        });
        alert("Record updated successfully");
      } else {
        await stockAPI.addBonusSplit({
          date: formData.date,
          stock_name: formData.stock_name,
          ratio: ratioString,
          type: formData.type,
          status: "active",
          source: formData.source,
        });
        alert("Record added successfully");
      }
      
      setIsRefreshing(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchData();
      setIsRefreshing(false);

      setFormData({
        id: null,
        date: "",
        stock_name: "",
        ratio_x: "",
        ratio_y: "",
        type: "",
        status: "active",
        source: "",
      });
      setShowForm(false);
    } catch (error) {
      alert("Error saving record: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Edit record
  const handleEdit = (record) => {
    const [x, y] = record.ratio ? record.ratio.split(":") : ["", ""];
    setFormData({
      ...record,
      ratio_x: x || "",
      ratio_y: y || "",
    });
    setShowForm(true);
  };

  // 🔹 Delete record
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      await stockAPI.deleteBonusSplit(id);
      alert("Record deleted successfully");
      setIsRefreshing(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchData();
      setIsRefreshing(false);
    } catch (error) {
      alert("Error deleting record: " + error.message);
    }
  };

  // 🔹 Apply Bonus/Split Logic
  const applyBonusSplit = async (record) => {
    if (!window.confirm(`Apply ${record.type} for ${record.stock_name}?`)) return;

    try {
      await stockAPI.applyBonusSplit(record);
      alert(`${record.stock_name} updated and records marked inactive`);
      setIsRefreshing(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchData();
      setIsRefreshing(false);
      refreshDashboard();
      refreshAssets();
    } catch (error) {
      alert("Error applying action: " + error.message);
    }
  };

  // 🔹 Revert Logic
  const revertBonusSplit = async (record) => {
    if (!window.confirm(`Revert ${record.type} for ${record.stock_name}?`)) return;

    try {
      await stockAPI.revertBonusSplit(record);
      alert(`${record.stock_name} reverted and marked active`);
      setIsRefreshing(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchData();
      setIsRefreshing(false);
      refreshDashboard();
      refreshAssets();
    } catch (error) {
      alert("Error reverting action: " + error.message);
    }
  };

  const handleMarkInactive = async (record) => {
    if (!window.confirm(`Mark ${record.stock_name} ${record.type} as inactive?`)) return;

    try {
      await stockAPI.updateBonusSplit(record.id, { status: "inactive" });
      alert("Status updated to inactive");
      setIsRefreshing(true);
      await invalidateBackendCache();
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchData();
      setIsRefreshing(false);
    } catch (error) {
      alert("Failed to update status: " + error.message);
    }
  };

  const handleApplyAll = async () => {
    const activeRecords = filteredRecords.filter(r => r.status === "active");
    if (activeRecords.length === 0) return alert("No active records to apply.");
    if (!window.confirm(`Apply all ${activeRecords.length} filtered active records?`)) return;

    setLoading(true);
    setIsRefreshing(true);
    setProgress("Applying bulk actions...");

    try {
      const result = await stockAPI.applyBulkBonusSplits(activeRecords);
      
      const successCount = result.results.filter(r => r.success).length;
      alert(`Successfully applied ${successCount} unique actions.`);
      
      await invalidateBackendCache();
      setProgress("Cleaning up cache...");
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchData();
      refreshDashboard();
      refreshAssets();
    } catch (err) {
      console.error("Apply all error:", err);
      alert("Failed to apply all actions: " + err.message);
    } finally {
      setIsRefreshing(false);
      setProgress(null);
      setLoading(false);
    }
  };

  const handleInactiveAll = async () => {
    const activeRecords = filteredRecords.filter(r => r.status === "active");
    if (activeRecords.length === 0) return alert("No active records to mark inactive.");
    if (!window.confirm(`Mark all ${activeRecords.length} filtered records as inactive?`)) return;

    setLoading(true);
    setIsRefreshing(true);

    try {
      const ids = activeRecords.map(r => r.id);
      await stockAPI.updateBonusSplitStatusBulk(ids, "inactive");

      alert(`Successfully marked ${activeRecords.length} records as inactive.`);
      await invalidateBackendCache();
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchData();
    } catch (err) {
      console.error("Inactive all error:", err);
      alert("Failed to update status for all records: " + err.message);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  // 🔹 Revert All Filtered Inactive Records
  const handleRevertAll = async () => {
    const inactiveRecords = filteredRecords.filter(r => r.status === "inactive");
    if (inactiveRecords.length === 0) return alert("No inactive records to revert.");
    if (!window.confirm(`Revert all ${inactiveRecords.length} filtered inactive records?`)) return;

    setLoading(true);
    setIsRefreshing(true);
    setProgress("Reverting bulk actions...");

    try {
      const result = await stockAPI.revertBulkBonusSplits(inactiveRecords);
      
      const successCount = result.results.filter(r => r.success).length;
      alert(`Successfully reverted ${successCount} unique actions.`);
      
      await invalidateBackendCache();
      setProgress("Cleaning up cache...");
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchData();
      refreshDashboard();
      refreshAssets();
    } catch (err) {
      console.error("Revert all error:", err);
      alert("Failed to revert all actions: " + err.message);
    } finally {
      setIsRefreshing(false);
      setProgress(null);
      setLoading(false);
    }
  };

  return (
    <div className="p-2 sm:p-4 relative">
      {isRefreshing && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-yellow-300 border-t-yellow-600 rounded-full animate-spin"></div>
            <p className="text-lg font-semibold text-gray-700">
              {progress ? progress : "Refreshing data..."}
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-bold text-yellow-300">
          Bonus / Split Records
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={syncing}
            title="Refresh from Corporate Actions"
            className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-800 disabled:opacity-50"
          >
            <RefreshCw size={20} className={syncing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-800"
          >
            {showForm ? "Close" : "Add New"}
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-4 rounded-lg shadow-md mb-4 grid grid-cols-1 sm:grid-cols-5 gap-3"
        >
          {/* Date */}
          <div>
            <label className="block text-sm font-medium">Date</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
              className="border rounded-md p-2 w-full"
            />
          </div>

          {/* Stock Name Search */}
          <div className="relative">
            <label className="block text-sm font-medium">Stock Name</label>
            <input
              type="text"
              name="stock_name"
              value={formData.stock_name}
              onChange={(e) => {
                setFormData({ ...formData, stock_name: e.target.value });
                setShowSuggestions(true);
              }}
              placeholder="Type to search..."
              required
              autoComplete="off"
              className="border rounded-md p-2 w-full"
            />

            {showSuggestions &&
              formData.stock_name &&
              stockMaster.filter((s) =>
                s.stock_name
                  ?.toLowerCase()
                  .includes(formData.stock_name.toLowerCase())
              ).length > 0 && (
                <ul className="absolute z-10 bg-white border border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto w-full">
                  {stockMaster
                    .filter((s) =>
                      s.stock_name
                        ?.toLowerCase()
                        .includes(formData.stock_name.toLowerCase())
                    )
                    .slice(0, 10)
                    .map((s) => (
                      <li
                        key={s.stock_name}
                        onClick={() => {
                          setFormData({ ...formData, stock_name: s.stock_name });
                          setShowSuggestions(false);
                        }}
                        className="px-2 py-1 hover:bg-blue-100 cursor-pointer"
                      >
                        {s.stock_name}
                      </li>
                    ))}
                </ul>
              )}
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium">Type</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
              className="border rounded-md p-2 w-full"
            >
              <option value="">Select Type</option>
              <option value="Bonus">Bonus</option>
              <option value="Split">Split</option>
            </select>
          </div>

          {/* Ratio Inputs based on Type */}
          {formData.type === "Bonus" && (
            <>
              <div>
                <label className="block text-sm font-medium">Bonus Shares</label>
                <input
                  type="number"
                  name="ratio_x"
                  value={formData.ratio_x}
                  onChange={handleChange}
                  placeholder="e.g. 2"
                  required
                  className="border rounded-md p-2 w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">For Shares Held</label>
                <input
                  type="number"
                  name="ratio_y"
                  value={formData.ratio_y}
                  onChange={handleChange}
                  placeholder="e.g. 5"
                  required
                  className="border rounded-md p-2 w-full"
                />
              </div>
            </>
          )}

          {formData.type === "Split" && (
            <>
              <div>
                <label className="block text-sm font-medium">New Shares</label>
                <input
                  type="number"
                  name="ratio_x"
                  value={formData.ratio_x}
                  onChange={handleChange}
                  placeholder="e.g. 10"
                  required
                  className="border rounded-md p-2 w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">From Old Shares</label>
                <input
                  type="number"
                  name="ratio_y"
                  value={formData.ratio_y}
                  onChange={handleChange}
                  placeholder="e.g. 1"
                  required
                  className="border rounded-md p-2 w-full"
                />
              </div>
            </>
          )}

          {!formData.type && (
            <div>
              <label className="block text-sm font-medium">Ratio (X:Y)</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  disabled
                  placeholder="Select Type first"
                  className="border rounded-md p-2 w-full bg-gray-100"
                />
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex flex-col">
            <label className="block text-sm font-medium">Source</label>
            <input
              type="text"
              name="source"
              value={formData.source}
              onChange={handleChange}
              placeholder="e.g. NSE"
              className="border rounded-md p-2 w-full"
            />
          </div>

          {/* Status */}
          <div className="flex flex-col">
            <label className="block text-sm font-medium">Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              required
              className="border rounded-md p-2 w-full"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Action Button */}
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-green-600 text-white px-4 py-2 rounded-md w-full hover:bg-green-700"
            >
              {formData.id ? "Update" : "Save"}
            </button>
          </div>
        </form>
      )}

      {/* Filter Section */}
      <div className="bg-gray-800 p-3 rounded-lg mb-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">Source</label>
          <select
            value={filters.source}
            onChange={(e) => setFilters({ ...filters, source: e.target.value })}
            className="bg-gray-700 text-white border border-gray-600 rounded px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
          >
            {sourceOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">Type</label>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="bg-gray-700 text-white border border-gray-600 rounded px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
          >
            {typeOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="bg-gray-700 text-white border border-gray-600 rounded px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
          >
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">Period</label>
          <select
            value={filters.dateRange}
            onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
            className="bg-gray-700 text-white border border-gray-600 rounded px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
          >
            <option value="All">All Time</option>
            <option value="CurrentMonth">Current Month</option>
            <option value="1">Last Month</option>
            <option value="2">Last 2 Months</option>
            <option value="3">Last 3 Months</option>
            <option value="Future">Future</option>
          </select>
        </div>
        <div className="flex gap-2 pb-1">
          <button
            onClick={() => setFilters({ source: "All", status: "All", type: "All", dateRange: "CurrentMonth" })}
            className="text-xs text-yellow-500 hover:text-yellow-400 font-medium"
          >
            Reset Filters
          </button>
          <button
            onClick={handleApplyAll}
            className="text-green-500 hover:text-green-400 font-medium flex items-center gap-1"
            title="Apply All Filtered"
          >
            <CheckCheck size={16} />
          </button>
          <button
            onClick={handleInactiveAll}
            className="text-red-500 hover:text-red-400 font-medium flex items-center gap-1"
            title="Mark All Filtered Inactive"
          >
            <Ban size={16} />
          </button>
          <button
            onClick={handleRevertAll}
            className="text-yellow-500 hover:text-yellow-400 font-medium flex items-center gap-1"
            title="Revert All Filtered"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 rounded-lg">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="px-4 py-2 text-left whitespace-nowrap w-10">#</th>
              <th className="px-4 py-2 text-left whitespace-nowrap">Date</th>
              <th className="px-4 py-2 text-left whitespace-nowrap">
                Stock Name
              </th>
              <th className="px-4 py-2 text-left whitespace-nowrap">Ratio</th>
              {filters.type === "All" && (
                <th className="px-4 py-2 text-left whitespace-nowrap">Type</th>
              )}
              {filters.source === "All" && (
                <th className="px-4 py-2 text-left whitespace-nowrap">Source</th>
              )}
              {filters.status === "All" && (
                <th className="px-4 py-2 text-left whitespace-nowrap">Status</th>
              )}
              <th className="px-4 py-2 text-center whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredRecords.length > 0 ? (
              filteredRecords.map((r, i) => {
                const formattedDate = r.date
                  ? (() => {
                      const d = new Date(r.date);
                      const day = String(d.getDate()).padStart(2, "0");
                      const month = String(d.getMonth() + 1).padStart(2, "0");
                      const year = String(d.getFullYear()).slice(-2);
                      return `${day}-${month}-${year}`;
                    })()
                  : "";

                return (
                  <tr key={r.id} className="border-b bg-gray-100 hover:bg-gray-200">
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500 font-medium">
                      {i + 1}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {formattedDate}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{r.stock_name}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{r.ratio}</td>
                    {filters.type === "All" && (
                      <td className="px-4 py-2 whitespace-nowrap">{r.type}</td>
                    )}
                    {filters.source === "All" && (
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">{r.source || "-"}</td>
                    )}
                    {filters.status === "All" && (
                      <td
                        className={`px-4 py-2 whitespace-nowrap font-semibold ${
                          r.status === "inactive"
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {r.status}
                      </td>
                    )}
                    <td className="px-4 py-2 flex justify-center gap-3 whitespace-nowrap">
                      <button
                        onClick={() => handleEdit(r)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>

                      {r.status === "active" ? (
                        <div className="flex gap-3">
                          <button
                            onClick={() => applyBonusSplit(r)}
                            className="text-green-600 hover:text-green-800"
                            title="Apply Bonus/Split"
                          >
                            <RefreshCw size={18} />
                          </button>
                          <button
                            onClick={() => handleMarkInactive(r)}
                            className="text-orange-500 hover:text-orange-700"
                            title="Mark Inactive (Manual)"
                          >
                            <CheckCircle size={18} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => revertBonusSplit(r)}
                          className="text-yellow-600 hover:text-yellow-800"
                          title="Revert"
                        >
                          <RotateCcw size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={
                    5 + 
                    (filters.type === "All" ? 1 : 0) + 
                    (filters.source === "All" ? 1 : 0) + 
                    (filters.status === "All" ? 1 : 0)
                  }
                  className="text-center py-3 text-gray-500 whitespace-nowrap"
                >
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BonusSplit;
