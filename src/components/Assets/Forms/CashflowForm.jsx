import React, { useState, useEffect } from "react";
import assetAPI from "../../../api/assetAPI.js";
import { stockAPI } from "../../../api/stockAPI.js";
import { Upload, Download, Plus, Trash2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { useNavigation } from "../../../context/NavigationContext.jsx";

const CashflowForm = ({ onClose, refreshData }) => {
  const { setIsBottomBarHidden } = useNavigation();
  const [formData, setFormData] = useState({
    account_name: "PM",
    transaction_type: "deposit",
    amount: "",
    date: "",
    stock_name: null,
    notes: "",
  });

  useEffect(() => {
    setIsBottomBarHidden(true);
    return () => setIsBottomBarHidden(false);
  }, [setIsBottomBarHidden]);

  const [loading, setLoading] = useState(false);
  const [stockSearch, setStockSearch] = useState("");
  const [stockResults, setStockResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [accountOptions, setAccountOptions] = useState([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");

  const [isMultiModalOpen, setIsMultiModalOpen] = useState(false);
  const [multiModalRows, setMultiModalRows] = useState([
    { account_name: "PM", date: new Date().toISOString().split('T')[0], stock_name: "", amount: "", transaction_type: "dividend" }
  ]);
  const [allStockNames, setAllStockNames] = useState([]);



  // --- download handler (Excel with 2 sheets) ---
  const handleDownloadTemplate = async () => {
    try {
      const stockData = await stockAPI.fetchStockMaster();
      const stockNames = stockData.map((row) => row.stock_name);

      // Transactions sheet (headers + date format note)
      const transactionHeaders = [
        [
          "account_name",
          "transaction_type",
          "amount",
          "date (YYYY-MM-DD)",
          "stock_name",
          "notes",
        ],
      ];
      const transactionWS = XLSX.utils.aoa_to_sheet(transactionHeaders);

      // Allowed Values sheet
      const allowedValues = [["account_name", "transaction_type", "stock_name"]];
      
      const accountNames = await assetAPI.getDistinctNames('cashflow', 'account_name');

      const transactionTypes = ["deposit", "withdrawal", "dividend"];

      accountNames.forEach((acc, i) => {
        allowedValues.push([acc, transactionTypes[i] || "", stockNames[i] || ""]);
      });

      stockNames.forEach((name) => {
        allowedValues.push(["", "", name]);
      });

      const allowedWS = XLSX.utils.aoa_to_sheet(allowedValues);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, transactionWS, "Transactions");
      XLSX.utils.book_append_sheet(wb, allowedWS, "Allowed Values");

      XLSX.writeFile(wb, "cashflow_template.xlsx");
    } catch (err) {
      console.error("Error generating template:", err.message);
    }
  };


const handleUploadTemplate = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const data = rows
      .map(row => {
        let formattedDate = row["date (YYYY-MM-DD)"] || row.date;

        if (formattedDate instanceof Date) {
          formattedDate = formattedDate.toISOString().split("T")[0];
        } else if (!isNaN(formattedDate)) {
          const dateObj = XLSX.SSF.parse_date_code(formattedDate);
          formattedDate = new Date(dateObj.y, dateObj.m - 1, dateObj.d)
            .toISOString()
            .split("T")[0];
        }

        return {
          account_name: row.account_name?.toString().trim(),
          transaction_type: row.transaction_type?.toString().trim().toLowerCase(),
          amount: Number(row.amount) || 0,
          date: formattedDate,
          stock_name: row.stock_name ? row.stock_name.toString().trim() : null,
          notes: row.notes ? row.notes.toString().trim() : null
        };
      })
      .filter(r => r.account_name && r.transaction_type && r.amount && r.date);

    await assetAPI.addBulkTransactions('cashflow', data);

    window.alert(`✅ Bulk upload complete! Inserted ${data.length} rows.`);
    await assetAPI.invalidateCache('cashflow');
    await new Promise(resolve => setTimeout(resolve, 500));
    if (refreshData) refreshData();
    onClose();

  } catch (err) {
    console.error("Bulk upload failed:", err);
    window.alert("❌ Bulk upload failed: " + err.message);
  }
};

  // --- live stock search ---
  useEffect(() => {
    const fetchStocks = async () => {
      if (stockSearch.length < 2) {
        setStockResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const data = await stockAPI.fetchStockMaster();
        const filtered = data
          .filter(s => (s.stock_name || "").toLowerCase().includes(stockSearch.toLowerCase()))
          .map(s => s.stock_name)
          .slice(0, 10);
        setStockResults(filtered);
      } catch (error) {
        console.error("Error fetching stocks:", error);
      }
      setSearchLoading(false);
    };

    const delayDebounce = setTimeout(fetchStocks, 300);
    return () => clearTimeout(delayDebounce);
  }, [stockSearch]);

  useEffect(() => {
    const fetchAllStockNames = async () => {
      try {
        const data = await stockAPI.fetchDistinctValues('stock_name');
        const normalized = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.values)
              ? data.values
              : [];

        const unique = normalized
          .map((value) => (typeof value === "string" ? value.trim() : value))
          .filter(Boolean)
          .sort();

        setAllStockNames(unique);
      } catch (error) {
        console.error("Error fetching all stock names:", error);
      }
    };
    fetchAllStockNames();
  }, []);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const data = await assetAPI.getDistinctNames('cashflow', 'account_name');
        if (data) {
          setAccountOptions(data);
        }
      } catch (error) {
        console.error("Error fetching accounts:", error);
      }
    };
    fetchAccounts();
  }, []);


  const handleSaveMultiModal = async () => {
    setLoading(true);
    try {
      const payload = multiModalRows.map(row => ({
        account_name: row.account_name,
        transaction_type: "dividend",
        amount: Number(row.amount),
        date: row.date,
        stock_name: row.stock_name,
        notes: "Bulk dividend entry"
      })).filter(row => row.amount > 0 && row.stock_name && row.date && row.account_name);

      if (payload.length === 0) {
        alert("No valid rows to save. Ensure Account, Date, Stock, and Amount are filled.");
        setLoading(false);
        return;
      }

      await assetAPI.addBulkTransactions('cashflow', payload);

      alert(`Successfully saved ${payload.length} transactions`);
      await assetAPI.invalidateCache('cashflow');
      if (refreshData) refreshData();
      setIsMultiModalOpen(false);
      setMultiModalRows([{ account_name: "PM", date: new Date().toISOString().split('T')[0], stock_name: "", amount: "", transaction_type: "dividend" }]);
    } catch (err) {
      console.error("Error saving bulk dividends:", err);
      alert("Error saving: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "stock_name") setStockSearch(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        stock_name:
          formData.transaction_type === "dividend" ? formData.stock_name : null,
      };

      await assetAPI.addTransaction('cashflow', payload);

      alert("Transaction saved successfully");
      await assetAPI.invalidateCache('cashflow');
      await new Promise(resolve => setTimeout(resolve, 500));

      if (refreshData) refreshData();
      onClose();
    } catch (err) {
      console.error("Error inserting cashflow:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-[2rem] shadow-2xl p-6 w-full max-w-md max-h-[85vh] flex flex-col transform transition-all animate-in fade-in zoom-in-95 duration-300">
        <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-6 flex-shrink-0" />
        <div className="flex flex-col gap-4 mb-6 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">Add Stock Investment</h2>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsMultiModalOpen(true)}
              className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 hover:bg-blue-600 hover:text-white transition-all duration-200"
              title="Add Multiple Dividends"
            >
              <Plus size={20} />
            </button>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="w-9 h-9 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-blue-400 hover:border-blue-500/50 transition-all duration-200"
              title="Download Template"
            >
              <Download size={18} />
            </button>
            <label
              className="w-9 h-9 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-green-400 hover:border-green-500/50 cursor-pointer transition-all duration-200"
              title="Upload Template"
            >
              <Upload size={18} />
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleUploadTemplate}
              />
            </label>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-red-400 hover:border-red-500/50 transition-all duration-200"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 flex-grow flex flex-col overflow-hidden">
          <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">Account Name</label>
            {isAddingNew ? (
              <input
                type="text"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="Enter new account name"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                onBlur={() => {
                  const trimmed = newAccountName.trim();
                  if (trimmed) {
                    setFormData((prev) => ({ ...prev, account_name: trimmed }));
                    setAccountOptions((prev) => [...new Set([...prev, trimmed])]);
                  }
                  setIsAddingNew(false);
                }}
                autoFocus
              />
            ) : (
              <select
                value={formData.account_name}
                onChange={(e) => {
                  if (e.target.value === "__add_new__") {
                    setIsAddingNew(true);
                    setNewAccountName("");
                  } else {
                    setFormData((prev) => ({ ...prev, account_name: e.target.value }));
                  }
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
                required
              >
                <option value="">Select Account</option>
                {accountOptions.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
                <option value="__add_new__">➕ Add New Account</option>
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Transaction Type</label>
            <select
              name="transaction_type"
              value={formData.transaction_type}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
            >
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="dividend">Dividend</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Amount</label>
            <input
              type="number"
              name="amount"
              placeholder="0.00"
              value={formData.amount}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Date</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all [color-scheme:dark]"
              required
            />
          </div>

          {formData.transaction_type === "dividend" && (
            <div className="space-y-1.5 relative">
              <label className="block text-sm font-medium text-gray-400 ml-1">Stock Name</label>
              <input
                type="text"
                name="stock_name"
                placeholder="Search Stock..."
                value={formData.stock_name}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                required
              />
              {searchLoading && (
                <div className="absolute right-3 top-10 text-gray-500 text-xs">
                  Searching...
                </div>
              )}
              {stockResults.length > 0 && (
                <ul className="absolute z-10 bg-gray-800 border border-gray-700 rounded-xl w-full mt-1 max-h-40 overflow-y-auto shadow-2xl overflow-hidden">
                  {stockResults.map((stock) => (
                    <li
                      key={stock}
                      className="px-4 py-3 text-gray-300 hover:bg-gray-700 hover:text-white cursor-pointer transition-colors"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, stock_name: stock }));
                        setStockResults([]);
                      }}
                    >
                      {stock}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Notes</label>
            <textarea
              name="notes"
              placeholder="Optional notes..."
              value={formData.notes}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[80px]"
            />
          </div>
        </div>

        <div className="flex space-x-3 pt-4 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-all border border-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20 transition-all"
          >
            {loading ? "Saving..." : "Save Transaction"}
          </button>
        </div>
      </form>
    </div>

      {isMultiModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-[2rem] shadow-2xl p-6 w-full max-w-5xl max-h-[90vh] flex flex-col transform transition-all animate-in fade-in zoom-in-95 duration-300">
            <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Add Multiple Dividends</h2>
                <p className="text-gray-400 text-sm mt-1">Quickly add multiple dividend transactions at once</p>
              </div>
              <button 
                onClick={() => setIsMultiModalOpen(false)} 
                className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-red-400 hover:border-red-500/50 transition-all"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="overflow-x-auto flex-grow rounded-xl border border-gray-800 bg-gray-950/50">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-800/50">
                    <th className="py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Account</th>
                    <th className="py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Stock Name</th>
                    <th className="py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                    <th className="py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {multiModalRows.map((row, index) => (
                    <tr key={index} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3">
                        <select 
                          value={row.account_name} 
                          onChange={(e) => {
                            const updated = [...multiModalRows];
                            updated[index].account_name = e.target.value;
                            setMultiModalRows(updated);
                          }}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none appearance-none"
                          required
                        >
                          <option value="">Select Account</option>
                          {accountOptions.map((acc) => (
                            <option key={acc} value={acc}>
                              {acc}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        <input 
                          type="date" 
                          value={row.date} 
                          onChange={(e) => {
                            const updated = [...multiModalRows];
                            updated[index].date = e.target.value;
                            setMultiModalRows(updated);
                          }}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none [color-scheme:dark]"
                          required
                        />
                      </td>
                      <td className="py-3 px-3 relative">
                        <input 
                          type="text" 
                          value={row.stock_name} 
                          onChange={(e) => {
                            const updated = [...multiModalRows];
                            updated[index].stock_name = e.target.value;
                            setMultiModalRows(updated);
                          }}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                          placeholder="Search stock..."
                          required
                        />
                        {row.stock_name && 
                         allStockNames.filter(s => s.toLowerCase().includes(row.stock_name.toLowerCase())).length > 0 && 
                         allStockNames.find(s => s === row.stock_name) !== row.stock_name && (
                          <ul className="absolute z-[70] bg-gray-800 border border-gray-700 rounded-lg w-[calc(100%-1.5rem)] mt-1 max-h-40 overflow-y-auto shadow-2xl">
                            {allStockNames
                              .filter(s => s.toLowerCase().includes(row.stock_name.toLowerCase()))
                              .slice(0, 20)
                              .map((stock) => (
                                <li
                                  key={stock}
                                  className="px-3 py-2 hover:bg-gray-700 text-gray-300 hover:text-white cursor-pointer text-xs"
                                  onClick={() => {
                                    const updated = [...multiModalRows];
                                    updated[index].stock_name = stock;
                                    setMultiModalRows(updated);
                                  }}
                                >
                                  {stock}
                                </li>
                              ))}
                          </ul>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <input 
                          type="number" 
                          value={row.amount} 
                          onChange={(e) => {
                            const updated = [...multiModalRows];
                            updated[index].amount = e.target.value;
                            setMultiModalRows(updated);
                          }}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                          placeholder="0.00"
                          required
                        />
                      </td>
                      <td className="py-3 px-3">
                        <div className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg p-2 text-gray-500 text-xs font-medium text-center">
                          DIVIDEND
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center space-x-2">
                          <button 
                            type="button"
                            onClick={() => {
                              const lastRow = multiModalRows[multiModalRows.length - 1];
                              setMultiModalRows([...multiModalRows, { 
                                account_name: lastRow ? lastRow.account_name : "PM",
                                date: new Date().toISOString().split('T')[0], 
                                stock_name: "", 
                                amount: "", 
                                transaction_type: "dividend" 
                              }]);
                            }} 
                            className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg transition-colors border border-transparent hover:border-green-400/20"
                            title="Add Row"
                          >
                            <Plus size={18} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => {
                              const updated = multiModalRows.filter((_, i) => i !== index);
                              setMultiModalRows(updated.length > 0 ? updated : [{ 
                                account_name: "PM",
                                date: new Date().toISOString().split('T')[0], 
                                stock_name: "", 
                                amount: "", 
                                transaction_type: "dividend" 
                              }]);
                            }} 
                            className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors border border-transparent hover:border-red-400/20"
                            title="Delete Row"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button 
                type="button"
                onClick={() => {
                  const lastRow = multiModalRows[multiModalRows.length - 1];
                  setMultiModalRows([...multiModalRows, { 
                    account_name: lastRow ? lastRow.account_name : "PM",
                    date: new Date().toISOString().split('T')[0], 
                    stock_name: "", 
                    amount: "", 
                    transaction_type: "dividend" 
                  }]);
                }}
                className="w-full py-4 text-sm text-gray-500 hover:text-blue-400 hover:bg-blue-400/[0.02] flex items-center justify-center space-x-2 transition-all"
              >
                <Plus size={16} />
                <span>Add another row</span>
              </button>
            </div>

            <div className="flex items-center justify-between mt-6">
              <p className="text-gray-500 text-sm">
                Total Rows: <span className="text-white font-medium">{multiModalRows.length}</span>
              </p>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setIsMultiModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-all border border-gray-700"
                >
                  Minimize
                </button>
                <button
                  type="button"
                  onClick={handleSaveMultiModal}
                  disabled={loading}
                  className="px-8 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20 transition-all"
                >
                  {loading ? "Saving Transactions..." : "Save All Records"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashflowForm;
