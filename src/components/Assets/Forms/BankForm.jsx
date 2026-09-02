import React, { useState, useEffect } from "react";
import bankAPI from "../../../api/bankAPI.js";
import { Upload, Download, Plus, Trash2, Pencil } from "lucide-react";
import * as XLSX from "xlsx";
import { useNavigation } from "../../../context/NavigationContext.jsx";


const BankForm = ({ onClose, onSuccess }) => {
  const { setIsBottomBarHidden } = useNavigation();
  const [form, setForm] = useState({
    account_name: "",
    account_name_input: "",
    bank_name: "",
    bank_name_input: "",
    account_type: "",
    txn_date: "",
    amount: "",
  });

  const [accountNames, setAccountNames] = useState([]);
  const [bankNames, setBankNames] = useState([]);
  const accountTypes = ["Savings", "Demat"];
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkEditData, setBulkEditData] = useState([]);

  const [showSnapshotsModal, setShowSnapshotsModal] = useState(false);
  const [snapshotRows, setSnapshotRows] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState(null);
  const [snapshotDraft, setSnapshotDraft] = useState({});
  const [bankFilter, setBankFilter] = useState("SBI");



  useEffect(() => {
    setIsBottomBarHidden(true);
    return () => setIsBottomBarHidden(false);
  }, [setIsBottomBarHidden]);

  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const data = await bankAPI.getMetadata();
        setAccountNames(data.accounts);
        setBankNames(data.banks);
      } catch (error) {
        console.error("❌ Error fetching accounts/banks:", error.message);
      }
    };

    fetchDropdownData();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const fetchLastMonthEntries = async () => {
    const today = new Date();
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    
    const startDate = lastMonthStart.toISOString().split('T')[0];
    const endDate = lastMonthEnd.toISOString().split('T')[0];

    try {
      const data = await bankAPI.getTransactionsByRange(startDate, endDate);
      const currentMonthFirstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const year = currentMonthFirstDay.getFullYear();
      const month = String(currentMonthFirstDay.getMonth() + 1).padStart(2, '0');
      const day = String(currentMonthFirstDay.getDate()).padStart(2, '0');
      const currentMonthFirstDate = `${year}-${month}-${day}`;
      
      const editData = (data || []).map(entry => ({
        ...entry,
        txn_date: currentMonthFirstDate
      })).sort((a, b) => {
        // Sort by Account Type
        const typeA = (a.account_type || "").toLowerCase();
        const typeB = (b.account_type || "").toLowerCase();
        if (typeA < typeB) return -1;
        if (typeA > typeB) return 1;

        // Sort by Account Name
        const nameA = (a.account_name || "").toLowerCase();
        const nameB = (b.account_name || "").toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        
        // Sort by Bank Name
        const bankA = (a.bank_name || "").toLowerCase();
        const bankB = (b.bank_name || "").toLowerCase();
        if (bankA < bankB) return -1;
        if (bankA > bankB) return 1;
        
        return 0;
      });
      setBulkEditData(editData);
      setShowBulkModal(true);
    } catch (error) {
      console.error("❌ Error fetching last month entries:", error.message);
      alert("Failed to fetch last month entries: " + error.message);
    }
  };

  const fetchBankSnapshots = async () => {
    try {
      const data = await bankAPI.getBankSnapshots();
      const today = new Date();
      const currentMonthFirstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const year = currentMonthFirstDay.getFullYear();
      const month = String(currentMonthFirstDay.getMonth() + 1).padStart(2, '0');
      const day = String(currentMonthFirstDay.getDate()).padStart(2, '0');
      const currentMonthFirstDate = `${year}-${month}-${day}`;

      const editData = (data || []).map(entry => ({
        ...entry,
        txn_date: currentMonthFirstDate
      }));

      setBulkEditData(editData);
      setShowBulkModal(true);
    } catch (error) {
      console.error("❌ Error fetching bank snapshots:", error.message);
      alert("Failed to fetch bank snapshots: " + error.message);
    }
  };

  const handleBulkEditChange = (index, field, value) => {
    const updated = [...bulkEditData];
    updated[index] = { ...updated[index], [field]: value };
    setBulkEditData(updated);
  };

  const handleAddRow = () => {
    const today = new Date();
    const currentMonthFirstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const year = currentMonthFirstDay.getFullYear();
    const month = String(currentMonthFirstDay.getMonth() + 1).padStart(2, '0');
    const day = String(currentMonthFirstDay.getDate()).padStart(2, '0');
    const currentMonthFirstDate = `${year}-${month}-${day}`;

    setBulkEditData([
      ...bulkEditData,
      {
        account_name: "",
        bank_name: "",
        account_type: "",
        txn_date: currentMonthFirstDate,
        amount: "",
        isNew: true
      }
    ]);
  };

  const handleDeleteRow = (index) => {
    const updated = bulkEditData.filter((_, i) => i !== index);
    setBulkEditData(updated);
  };

  const handleBulkUpdate = async () => {
    // Basic validation
    const invalidRows = bulkEditData.filter(entry => 
      !entry.account_name || !entry.bank_name || !entry.account_type || !entry.txn_date || isNaN(parseFloat(entry.amount))
    );

    if (invalidRows.length > 0) {
      alert("Please fill all fields for all rows and ensure amount is a number.");
      return;
    }

    const recordsToInsert = bulkEditData.map(entry => ({
      account_name: entry.account_name,
      bank_name: entry.bank_name,
      account_type: entry.account_type,
      txn_date: entry.txn_date,
      amount: parseFloat(entry.amount),
    }));

    try {
      await bankAPI.addBulkTransactions(recordsToInsert);
      alert(`✅ Successfully added ${recordsToInsert.length} new records!`);
      await bankAPI.invalidateCache();
      setShowBulkModal(false);
      setBulkEditData([]);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("❌ Error inserting bulk records:", error.message);
      alert("Failed to add records: " + error.message);
    }
  };

  const handleSubmit = async () => {

    console.log("Submitting balance form:", form);

    let accountName = form.account_name;
    if (accountName === "new") {
      accountName = form.account_name_input?.trim();
      if (!accountName) return alert("Account name is required!");
    }

    let bankName = form.bank_name;
    if (bankName === "new") {
      bankName = form.bank_name_input?.trim();
      if (!bankName) return alert("Bank name is required!");
    }

    try {
      await bankAPI.addTransaction({
        account_name: accountName,
        bank_name: bankName,
        account_type: form.account_type,
        txn_date: form.txn_date,
        amount: parseFloat(form.amount),
      });

      alert("✅ Bank Balance successfully updated!");
      await bankAPI.invalidateCache();
      setForm({
        account_name: "",
        account_name_input: "",
        bank_name: "",
        bank_name_input: "",
        account_type: "",
        txn_date: "",
        amount: "",
      });
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("❌ Error inserting balance record:", error.message);
      alert("Failed to add balance: " + error.message);
    }
  };

  const fetchAndOpenSnapshots = async () => {
    // We must reuse auth token pattern from other modals (AuthContext)
    // and existing bankAPI helper methods.
    setShowSnapshotsModal(true);
    setSnapshotsLoading(true);
    try {
      const data = await bankAPI.getBankSnapshots();
      setSnapshotRows(data || []);
    } catch (e) {
      console.error(e);
      alert("Failed to fetch bank balance snapshots.");
    } finally {
      setSnapshotsLoading(false);
    }
  };


  const handleDownloadTemplate = () => {

    const balancesSheet = XLSX.utils.aoa_to_sheet([
      ["Account Name", "Bank Name", "Account Type", "Date (YYYY-MM-DD)", "Amount"],
      ["PM", "SBI", "Savings", "2025-12-01", 66768],
      ["PM", "AXIS", "Savings", "2025-12-01", 3223],
      ["PM", "PNB-RJ", "Savings", "2025-12-01", 3285],
      ["PM", "PNB-MP", "Savings", "2025-12-01", 156],
      ["BDM", "SBI", "Savings", "2025-12-01", 42182],
      ["PDM", "SBI", "Savings", "2025-12-01", 93683],
      ["PSM", "PNB-MP", "Savings", "2025-12-01", 21909],
      ["PM", "KITE", "Demat", "2025-12-01", 300],
      ["PDM", "KITE", "Demat", "2025-12-01", 18000],
      ["PSM", "KITE", "Demat", "2025-12-01", 600],
      ["PM", "ANGEL ONE", "Demat", "2025-12-01", 4600],
    ]);

    const allowedValues = [["Allowed Account Names", "Allowed Bank Names", "Allowed Account Types"]];
    const maxLen = Math.max(accountNames.length, bankNames.length, accountTypes.length);
    for (let i = 0; i < maxLen; i++) {
      allowedValues.push([
        accountNames[i] || "",
        bankNames[i] || "",
        accountTypes[i] || "",
      ]);
    }
    const allowedSheet = XLSX.utils.aoa_to_sheet(allowedValues);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, balancesSheet, "Balances");
    XLSX.utils.book_append_sheet(wb, allowedSheet, "Allowed Values");

    XLSX.writeFile(wb, "bank_balance_template.xlsx");
  };

  const convertExcelDateToString = (excelDate) => {
    if (!excelDate) return "";
    if (typeof excelDate === "number") {
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return String(excelDate).trim();
  };

  const handleUploadExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      const ws = wb.Sheets["Balances"];
      if (!ws) return alert("Balances sheet not found in file!");
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      console.log("📥 Parsed balances from Excel:", rows);

      if (rows.length === 0) return alert("No data found in Excel file!");

      const recordsToInsert = rows.map((row) => ({
        account_name: String(row["Account Name"] || "").trim(),
        bank_name: String(row["Bank Name"] || "").trim(),
        account_type: String(row["Account Type"] || "").trim(),
        txn_date: convertExcelDateToString(row["Date (YYYY-MM-DD)"]),
        amount: parseFloat(row["Amount"]),
      }));

      try {
        await bankAPI.addBulkTransactions(recordsToInsert);
        alert(`✅ Successfully uploaded ${rows.length} records!`);
        await bankAPI.invalidateCache();
        if (onSuccess) onSuccess();
      } catch (error) {
        console.error("❌ Error inserting Excel records:", error.message);
        alert("Failed to upload: " + error.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-8 flex-shrink-0" />
          <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
          <h3 className="text-xl font-bold text-white tracking-tight">Add Bank Balance</h3>
          <div className="flex space-x-3">
            <button
              onClick={fetchAndOpenSnapshots}
              className="w-8 h-8 rounded-xl bg-gray-600/10 text-gray-200 border border-gray-500/20 flex items-center justify-center hover:bg-gray-600 hover:text-white transition-all shadow-lg shadow-gray-900/10"
              title="Manage Bank Balance Snapshots"
            >
              <span className="text-xs font-black">+</span>
            </button>
            <button
              onClick={fetchLastMonthEntries}
              className="w-8 h-8 rounded-xl bg-purple-600/10 text-purple-400 border border-purple-500/20 flex items-center justify-center hover:bg-purple-600 hover:text-white transition-all shadow-lg shadow-purple-900/10"
              title="Add multiple entries from last month"
            >
              <span className="text-xs font-bold">PM</span>
            </button>

            <button
              onClick={fetchBankSnapshots}
              className="w-8 h-8 rounded-xl bg-orange-600/10 text-orange-400 border border-orange-500/20 flex items-center justify-center hover:bg-orange-600 hover:text-white transition-all shadow-lg shadow-orange-900/10"
              title="Bulk Statement"
            >
              <span className="text-xs font-bold">BS</span>
            </button>
            <label className="cursor-pointer">
              <div className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-lg shadow-blue-900/10">
                <Upload className="w-4 h-4" />
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleUploadExcel}
              />
            </label>
            <button 
              onClick={handleDownloadTemplate}
              className="w-8 h-8 rounded-xl bg-green-600/10 text-green-400 border border-green-500/20 flex items-center justify-center hover:bg-green-600 hover:text-white transition-all shadow-lg shadow-green-900/10"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Account Name</label>
            {form.account_name === "new" ? (
              <input
                className="w-full bg-gray-800 border border-gray-700 text-white p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-500"
                type="text"
                name="account_name_input"
                placeholder="Enter new account name"
                value={form.account_name_input}
                onChange={handleChange}
                required
              />
            ) : (
              <div className="relative">
                <select
                  className="w-full bg-gray-800 border border-gray-700 text-white p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                  name="account_name"
                  value={form.account_name}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Account</option>
                  {accountNames.map((name) => (
                    <option key={name} value={name} className="bg-gray-900">{name}</option>
                  ))}
                  <option value="new" className="bg-gray-900">➕ Add New Account</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                  <Plus size={16} className="rotate-45" />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Bank Name</label>
            {form.bank_name === "new" ? (
              <input
                className="w-full bg-gray-800 border border-gray-700 text-white p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-500"
                type="text"
                name="bank_name_input"
                placeholder="Enter new bank name"
                value={form.bank_name_input}
                onChange={handleChange}
                required
              />
            ) : (
              <div className="relative">
                <select
                  className="w-full bg-gray-800 border border-gray-700 text-white p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                  name="bank_name"
                  value={form.bank_name}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Bank</option>
                  {bankNames.map((name) => (
                    <option key={name} value={name} className="bg-gray-900">{name}</option>
                  ))}
                  <option value="new" className="bg-gray-900">➕ Add New Bank</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                  <Plus size={16} className="rotate-45" />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">Type</label>
              <div className="relative">
                <select
                  className="w-full bg-gray-800 border border-gray-700 text-white p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                  name="account_type"
                  value={form.account_type}
                  onChange={handleChange}
                  required
                >
                  <option value="" className="bg-gray-900">Select Type</option>
                  {accountTypes.map((type) => (
                    <option key={type} value={type} className="bg-gray-900">{type}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                  <Plus size={16} className="rotate-45" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">Date</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 text-white p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all [color-scheme:dark]"
                type="date"
                name="txn_date"
                value={form.txn_date}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Balance</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 text-white p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-500"
              type="number"
              step="0.01"
              name="amount"
              placeholder="0.00"
              value={form.amount}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="pt-8 border-t border-gray-800 flex justify-end space-x-3 mt-6">
          <button
            className="flex-1 px-6 py-3.5 bg-gray-800 text-gray-300 rounded-xl font-medium hover:bg-gray-700 transition-all border border-gray-700"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="flex-1 px-6 py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"
            onClick={handleSubmit}
          >
            Save Record
          </button>
        </div>
      </div>

      {showSnapshotsModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-2 sm:p-4"
          onClick={() => setShowSnapshotsModal(false)}
        >
          <div
            className="bg-gray-900 border border-gray-800 p-4 sm:p-6 rounded-[2rem] shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-4 flex-shrink-0" />

            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">Bank Balance Snapshots</h3>
              <button
                onClick={() => setShowSnapshotsModal(false)}
                className="p-2 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10 transition-all"
                title="Close"
              >
                ✕
              </button>
            </div>

            {snapshotsLoading ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">Loading…</div>
            ) : snapshotRows?.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-950/20 rounded-2xl border border-gray-800 border-dashed">
                <p className="text-lg italic">No snapshots found</p>
                <p className="text-sm mt-2">Add snapshots via the backend sync flow.</p>
              </div>
            ) : (
              (() => {
                const normalizedFilter = String(bankFilter || "").trim().toLowerCase();
                const filteredRows = (snapshotRows || []).filter((r) => {
                  const bank = String(r?.bank_name || "").trim().toLowerCase();
                  return normalizedFilter ? bank === normalizedFilter : true;
                });

                const bankOptions = Array.from(
                  new Set((snapshotRows || [])
                    .map((r) => String(r?.bank_name || "").trim())
                    .filter(Boolean))
                ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

                if (!bankOptions.includes("SBI")) bankOptions.unshift("SBI");

                return (
                  <>
                    <div className="flex items-center gap-3 mb-3 flex-shrink-0">
                      <label className="text-sm font-medium text-gray-300">Filter bank</label>
                      <select
                        className="bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer"
                        value={bankFilter}
                        onChange={(e) => setBankFilter(e.target.value)}
                      >
                        {bankOptions.map((b) => (
                          <option key={b} value={b} className="bg-gray-900">
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>

                    {filteredRows.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-950/20 rounded-2xl border border-gray-800 border-dashed">
                        <p className="text-lg italic">No snapshots found for selected bank</p>
                        <p className="text-sm mt-2">Try switching the bank filter.</p>
                      </div>
                    ) : (
                      <div className="overflow-auto mb-4 flex-1 border border-gray-800 rounded-2xl bg-gray-950/30 custom-scrollbar">
                        <table className="w-full border-collapse min-w-[900px]">
                          <thead className="sticky top-0 z-10">
                            <tr className="bg-gray-800 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                              <th className="p-3 text-left border-b border-gray-700">Account</th>
                              <th className="p-3 text-left border-b border-gray-700">Bank</th>
                              <th className="p-3 text-left border-b border-gray-700">Account Number</th>
                              <th className="p-3 text-left border-b border-gray-700">Balance</th>
                              <th className="p-3 text-left border-b border-gray-700">Captured At</th>
                              <th className="p-3 text-center border-b border-gray-700 w-24">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {filteredRows.map((row) => {
                              const isEditing = editingSnapshotId === row.id;
                              return (
                                <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                                  <td className="p-3">
                                    <input
                                      value={isEditing ? (snapshotDraft.account_name ?? "") : (row.account_name ?? "")}
                                      disabled={!isEditing}
                                      onChange={(e) => setSnapshotDraft((d) => ({ ...d, account_name: e.target.value }))}
                                      className={`w-full bg-gray-800/40 border border-gray-700/50 text-gray-200 rounded-xl p-2.5 text-sm ${isEditing ? "" : "cursor-not-allowed"}`}
                                    />
                                  </td>
                                  <td className="p-3">
                                    <input
                                      value={isEditing ? (snapshotDraft.bank_name ?? "") : (row.bank_name ?? "")}
                                      disabled={!isEditing}
                                      onChange={(e) => setSnapshotDraft((d) => ({ ...d, bank_name: e.target.value }))}
                                      className={`w-full bg-gray-800/40 border border-gray-700/50 text-gray-200 rounded-xl p-2.5 text-sm ${isEditing ? "" : "cursor-not-allowed"}`}
                                    />
                                  </td>
                                  <td className="p-3">
                                    <input
                                      value={isEditing ? (snapshotDraft.account_number ?? "") : (row.account_number ?? "")}
                                      disabled={!isEditing}
                                      onChange={(e) => setSnapshotDraft((d) => ({ ...d, account_number: e.target.value }))}
                                      className={`w-full bg-gray-800/40 border border-gray-700/50 text-gray-200 rounded-xl p-2.5 text-sm ${isEditing ? "" : "cursor-not-allowed"}`}
                                    />
                                  </td>
                                  <td className="p-3">
                                    {isEditing ? (
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={snapshotDraft.balance ?? ""}
                                        onChange={(e) => setSnapshotDraft((d) => ({ ...d, balance: e.target.value }))}
                                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                                      />
                                    ) : (
                                      <span className="text-white font-bold">₹{Number(row.balance || 0).toLocaleString("en-IN")}</span>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    {isEditing ? (
                                      <input
                                        type="datetime-local"
                                        value={(() => {
                                          if (!snapshotDraft.captured_at) return "";
                                          const d = new Date(snapshotDraft.captured_at);
                                          if (isNaN(d.getTime())) return "";
                                          return d.toISOString().slice(0, 16);
                                        })()}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setSnapshotDraft((d) => ({ ...d, captured_at: v ? new Date(v).toISOString() : null }));
                                        }}
                                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                                      />
                                    ) : (
                                      <span className="text-gray-300 text-sm">
                                        {row.captured_at ? new Date(row.captured_at).toLocaleString() : ""}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      {isEditing ? (
                                        <>
                                          <button
                                            onClick={async () => {
                                              try {
                                                await bankAPI.updateBankBalanceSnapshot(
                                                  editingSnapshotId,
                                                  {
                                                    balance: snapshotDraft.balance,
                                                    bank_name: snapshotDraft.bank_name,
                                                    account_number: snapshotDraft.account_number,
                                                    captured_at: snapshotDraft.captured_at,
                                                  },
                                                  undefined
                                                );

                                                await bankAPI.invalidateCache();
                                                const data = await bankAPI.getBankSnapshots();
                                                setSnapshotRows(data || []);

                                                setEditingSnapshotId(null);
                                                setSnapshotDraft({});
                                              } catch (e) {
                                                console.error(e);
                                                alert("Failed to update snapshot.");
                                              }
                                            }}
                                            className="p-2 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 rounded-xl transition-all"
                                            title="Save"
                                          >
                                            Save
                                          </button>

                                          <button
                                            onClick={() => {
                                              setEditingSnapshotId(null);
                                              setSnapshotDraft({});
                                            }}
                                            className="p-2 bg-white/5 text-gray-300 hover:bg-white/10 rounded-xl transition-all"
                                            title="Cancel"
                                          >
                                            ✕
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            onClick={() => {
                                              setEditingSnapshotId(row.id);
                                              setSnapshotDraft({ ...row });
                                            }}
                                            className="p-2 bg-white/5 text-gray-300 hover:bg-blue-500/10 hover:text-blue-400 rounded-xl transition-all"
                                            title="Edit"
                                          >
                                            <Pencil size={16} />
                                          </button>

                                          <button
                                            onClick={async () => {
                                              if (!window.confirm("Delete this snapshot?")) return;
                                              try {
                                                await bankAPI.deleteBankBalanceSnapshot(row.id);
                                                await bankAPI.invalidateCache();
                                                const refreshed = await bankAPI.getBankSnapshots();
                                                setSnapshotRows(refreshed || []);
                                              } catch (e) {
                                                console.error(e);
                                                alert("Failed to delete snapshot.");
                                              }
                                            }}
                                            className="p-2 bg-white/5 text-gray-300 hover:bg-rose-500/10 hover:text-rose-400 rounded-xl transition-all"
                                            title="Delete"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="flex justify-end space-x-3 mt-auto flex-shrink-0">
                      <button
                        onClick={() => {
                          setShowSnapshotsModal(false);
                          setEditingSnapshotId(null);
                          setSnapshotDraft({});
                        }}
                        className="px-6 py-3 bg-gray-800 text-gray-300 rounded-2xl font-medium hover:bg-gray-700 transition-all border border-gray-700 text-sm"
                      >
                        Close
                      </button>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}


      {showBulkModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-2 sm:p-4" onClick={() => setShowBulkModal(false)}>
          <div className="bg-gray-900 border border-gray-800 p-4 sm:p-6 rounded-[2rem] shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>

            <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-4 flex-shrink-0" />
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">Bulk Add Bank Records</h3>
              <button
                onClick={handleAddRow}
                className="flex items-center space-x-2 px-4 py-2 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-xl hover:bg-emerald-600 hover:text-white transition-all font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Row</span>
              </button>
            </div>
            
            {bulkEditData.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-950/20 rounded-2xl border border-gray-800 border-dashed mb-4">
                <p className="text-lg italic">No entries found</p>
                <p className="text-sm mt-2">Try adding rows manually using the button above.</p>
              </div>
            ) : (
              <div className="overflow-auto mb-4 flex-1 border border-gray-800 rounded-2xl bg-gray-950/30 custom-scrollbar">
                <table className="w-full border-collapse min-w-[800px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-800 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                      <th className="p-3 text-left border-b border-gray-700">Account</th>
                      <th className="p-3 text-left border-b border-gray-700">Bank Name</th>
                      <th className="p-3 text-left border-b border-gray-700">Type</th>
                      <th className="p-3 text-left border-b border-gray-700">Date</th>
                      <th className="p-3 text-left border-b border-gray-700">Amount</th>
                      <th className="p-3 text-center border-b border-gray-700 w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {bulkEditData.map((entry, index) => (
                      <tr key={index} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3">
                          {entry.isNew ? (
                            <div className="relative">
                              <select
                                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer"
                                value={entry.account_name}
                                onChange={(e) => handleBulkEditChange(index, 'account_name', e.target.value)}
                              >
                                <option value="" className="bg-gray-900">Select Account</option>
                                {accountNames.map((name) => (
                                  <option key={name} value={name} className="bg-gray-900">{name}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={entry.account_name}
                              disabled
                              className="w-full bg-gray-800/40 border border-gray-700/50 text-gray-500 rounded-xl p-2.5 text-sm cursor-not-allowed"
                            />
                          )}
                        </td>
                        <td className="p-3">
                          {entry.isNew ? (
                            <div className="relative">
                              <select
                                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer"
                                value={entry.bank_name}
                                onChange={(e) => handleBulkEditChange(index, 'bank_name', e.target.value)}
                              >
                                <option value="" className="bg-gray-900">Select Bank</option>
                                {bankNames.map((name) => (
                                  <option key={name} value={name} className="bg-gray-900">{name}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={entry.bank_name}
                              disabled
                              className="w-full bg-gray-800/40 border border-gray-700/50 text-gray-500 rounded-xl p-2.5 text-sm cursor-not-allowed"
                            />
                          )}
                        </td>
                        <td className="p-3">
                          <div className="relative">
                            <select
                              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer"
                              value={entry.account_type}
                              disabled={!entry.isNew}
                              onChange={(e) => handleBulkEditChange(index, 'account_type', e.target.value)}
                            >
                              <option value="" className="bg-gray-900">Select Type</option>
                              {accountTypes.map((type) => (
                                <option key={type} value={type} className="bg-gray-900">{type}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="p-3">
                          <input
                            type="date"
                            value={entry.txn_date}
                            disabled={!entry.isNew}
                            onChange={(e) => handleBulkEditChange(index, 'txn_date', e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all [color-scheme:dark]"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            step="0.01"
                            value={entry.amount}
                            onChange={(e) => handleBulkEditChange(index, 'amount', e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleDeleteRow(index)}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                            title="Delete Row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-auto flex-shrink-0">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-6 py-3 bg-gray-800 text-gray-300 rounded-2xl font-medium hover:bg-gray-700 transition-all border border-gray-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpdate}
                disabled={bulkEditData.length === 0}
                className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20 text-sm"
              >
                Save All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankForm;
