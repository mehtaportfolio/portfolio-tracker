// src/components/forms/MutualFundForm.js
import React, { useEffect, useState, useRef, useCallback } from "react";
import mfAPI from "../../../api/mfAPI.js";
import { Plus, Upload, Download, Minus, Mail } from "lucide-react";
import * as XLSX from "xlsx";
import usePersistentDraft from "../../../hooks/usePersistentDraft.jsx";
import { useNavigation } from "../../../context/NavigationContext.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import CASImportModal from "../MF/CASImportModal.jsx";

const MF_FORM_STORAGE_KEY = "mf_transaction_form_draft_v1";
const MF_FORM_INITIAL_STATE = {
  fundShortName: "",
  accountName: "",
  transactionType: "buy",
  buyDate: "",
  units: "",
  buyNav: "",
};

const ADD_FUND_STORAGE_KEY = "mf_add_fund_modal_draft_v1";
const ADD_FUND_INITIAL_STATE = {
  fundFullName: "",
  fundShortName: "",
  schemeCode: "",
  schemeSearchTerm: "",
  amcName: "",
  category: "",
  isin: "",
};

const ADD_SIP_STORAGE_KEY = "mf_add_sip_modal_draft_v1";
const ADD_SIP_INITIAL_STATE = {
  fundShortName: "",
  sipAmount: "",
  sipDate: "",
};

const MF_MULTIPLE_ENTRIES_STORAGE_KEY = "mf_multiple_entries_draft_v1";
const MF_MULTIPLE_ENTRIES_INITIAL_STATE = [];

const MutualFundForm = ({ onClose, onSuccess }) => {
  const { setIsBottomBarHidden } = useNavigation();
  const { session } = useAuth();
  // --- STATES ---
  const [formDraft, setFormDraft, resetFormDraft] = usePersistentDraft(
    MF_FORM_STORAGE_KEY,
    MF_FORM_INITIAL_STATE
  );

  useEffect(() => {
    setIsBottomBarHidden(true);
    return () => setIsBottomBarHidden(false);
  }, [setIsBottomBarHidden]);

  const {
    fundShortName,
    accountName,
    transactionType,
    buyDate,
    units,
    buyNav,
  } = formDraft;
  const setFundShortName = (value) =>
    setFormDraft((prev) => ({ ...prev, fundShortName: value }));
  const setAccountName = (value) =>
    setFormDraft((prev) => ({ ...prev, accountName: value }));
  const setTransactionType = (value) =>
    setFormDraft((prev) => ({ ...prev, transactionType: value }));
  const setBuyDate = (value) =>
    setFormDraft((prev) => ({ ...prev, buyDate: value }));
  const setUnits = (value) =>
    setFormDraft((prev) => ({ ...prev, units: value }));
  const setBuyNav = (value) =>
    setFormDraft((prev) => ({ ...prev, buyNav: value }));

  const [fundOptions, setFundOptions] = useState([]);
  const [filteredFunds, setFilteredFunds] = useState([]);
  const [showOptions, setShowOptions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showAddFundModal, setShowAddFundModal] = usePersistentDraft("mf_show_add_fund_modal_v1", false);
  const [showSipModal, setShowSipModal] = usePersistentDraft("mf_show_sip_modal_v1", false);
  const [accountOptions, setAccountOptions] = useState([]);
  const [newAccountName, setNewAccountName] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [showMultipleEntriesModal, setShowMultipleEntriesModal] = usePersistentDraft("mf_show_multiple_entries_modal_v1", false);
  const [showCASImportModal, setShowCASImportModal] = usePersistentDraft("mf_show_cas_import_modal_v1", false);

  const handleCloseModal = useCallback(() => {
    resetFormDraft();
    onClose?.();
  }, [onClose, resetFormDraft]);

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Close on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") handleCloseModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleCloseModal]);

  // --- FETCH FUND NAMES ---
  const fetchFundNames = useCallback(async () => {
    try {
      const data = await mfAPI.getMFData(session?.access_token);
      if (data?.fundMaster) {
        const raw = (data.fundMaster || [])
          .map((f) => String(f.fund_short_name || "").trim())
          .filter(Boolean);
        const nameMap = new Map();
        raw.forEach((n) => {
          const key = n.toLowerCase();
          if (!nameMap.has(key)) nameMap.set(key, n);
        });
        const names = Array.from(nameMap.values()).sort((a, b) => a.localeCompare(b));
        setFundOptions(names);
        setFilteredFunds(names);
      }
    } catch (error) {
      console.error("Error fetching fund names:", error);
    }
  }, [session]);

  useEffect(() => {
    fetchFundNames();
  }, [fetchFundNames]);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const accounts = await mfAPI.getMFAccountNames(session?.access_token);
        setAccountOptions(accounts || []);
      } catch (error) {
        console.error("Error fetching accounts:", error);
      }
    };
    fetchAccounts();
  }, [session]);

  // --- HANDLE SUBMIT ---
  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    try {
      await mfAPI.addTransaction({
        fund_short_name: fundShortName?.trim(),
        account_name: accountName,
        date: buyDate || null,
        units: units ? parseFloat(units) : null,
        nav: buyNav ? parseFloat(buyNav) : null,
        transaction_type: transactionType || "buy",
      }, session?.access_token);

      alert("MF Transaction added successfully");
      await mfAPI.invalidateCache(session?.access_token);
      window.dispatchEvent(new CustomEvent('portfolio-cache-invalidated', { detail: { assetType: 'mf' } }));
      onSuccess?.();
      onClose?.();
      resetFormDraft();
    } catch (error) {
      alert("Error saving MF transaction: " + error.message);
    }
  };

  // --- KEYDOWN for autocomplete ---
  const handleKeyDown = (e) => {
    if (!showOptions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredFunds.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredFunds.length) {
        setFundShortName(filteredFunds[highlightedIndex]);
        setShowOptions(false);
      }
    }
  };

  // --- Excel date helper ---
  const excelDateToISO = (val) => {
    if (!val) return null;
    if (typeof val === "number") {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      return d.toISOString().slice(0, 10);
    }
    const d = new Date(val);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  };

  // --- BULK UPLOAD HANDLER ---
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);

      if (!rows.length) {
        alert("No rows found in the first sheet.");
        return;
      }

      const formatted = rows.map((r) => ({
        fund_short_name: (r.fund_short_name ?? "").trim() || null,
        account_name: r.account_name ?? null,
        date: r.date ? excelDateToISO(r.date) : (r.buy_date ? excelDateToISO(r.buy_date) : null),
        units: r.units ? parseFloat(r.units) : null,
        nav: r.nav != null ? parseFloat(r.nav) : (r.buy_nav != null ? parseFloat(r.buy_nav) : null),
        transaction_type: r.transaction_type || "buy",
      }));

      await mfAPI.addBulkTransactions(formatted, session?.access_token);
      alert("MF Transactions uploaded successfully!");
      await mfAPI.invalidateCache(session?.access_token);
      window.dispatchEvent(new CustomEvent('portfolio-cache-invalidated', { detail: { assetType: 'mf' } }));
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error("Excel upload error:", err);
      alert("Invalid Excel file or format. Please check the headers.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // --- DOWNLOAD SAMPLE EXCEL ---
// --- DOWNLOAD SAMPLE EXCEL ---
const handleDownloadSample = async () => {
  const mainData = [
    { fund_short_name: "Edelweiss Midcap", account_name: "PM", date: "2025-07-10", units: 50, nav: 100.5, transaction_type: "buy" },
    { fund_short_name: "JM Flexicap", account_name: "PM", date: "2025-07-22", units: 50, nav: 100.5, transaction_type: "buy" },
    { fund_short_name: "MO Midcap", account_name: "PM", date: "2025-07-07", units: 50, nav: 100.5, transaction_type: "buy" },
    { fund_short_name: "Nippon Smallcap", account_name: "PM", date: "2025-07-25", units: 50, nav: 100.5, transaction_type: "buy" },
    { fund_short_name: "PP Flexicap", account_name: "PM", date: "2025-07-18", units: 50, nav: 100.5, transaction_type: "buy" },
    { fund_short_name: "Quant Smallcap", account_name: "PM", date: "2025-07-14", units: 50, nav: 100.5, transaction_type: "buy" },
    { fund_short_name: "Quant Midcap", account_name: "PM", date: "2025-07-14", units: 50, nav: 100.5, transaction_type: "buy" },
    { fund_short_name: "Inveso Smallcap", account_name: "PM", date: "2025-07-22", units: 50, nav: 100.5, transaction_type: "buy" },
    { fund_short_name: "Tata Smallcap", account_name: "PM", date: "2025-07-21", units: 50, nav: 100.5, transaction_type: "buy" },
    { fund_short_name: "MO Midcap", account_name: "PSM", date: "2025-07-25", units: 50, nav: 100.5, transaction_type: "buy" },
    { fund_short_name: "Nippon Smallcap", account_name: "PSM", date: "2025-07-14", units: 50, nav: 100.5, transaction_type: "buy" },
    { fund_short_name: "Quant Midcap", account_name: "PSM", date: "2025-07-28", units: 50, nav: 100.5, transaction_type: "buy" },
    { fund_short_name: "Inveso Smallcap", account_name: "PSM", date: "2025-07-22", units: 50, nav: 100.5, transaction_type: "buy" },
    { fund_short_name: "Tata Smallcap", account_name: "PSM", date: "2025-07-21", units: 50, nav: 100.5, transaction_type: "buy" },
  ];

  // Fetch fund list alphabetically
  const data = await mfAPI.getMFData(session?.access_token);
  const fundList = data?.fundMaster || [];

  const fundData = fundList.map(f => ({ fund_short_name: f.fund_short_name }));

  // Reference data
  const referenceData = [
    { account_name: "PM", transaction_type: "buy" },
    { account_name: "PM", transaction_type: "sell" },
    { account_name: "PSM", transaction_type: "buy" },
    { account_name: "PSM", transaction_type: "sell" },
     ];

  const wb = XLSX.utils.book_new();
  const wsMain = XLSX.utils.json_to_sheet(mainData);
  const wsFunds = XLSX.utils.json_to_sheet(
    fundData.length ? fundData : [{ fund_short_name: "SBI_BLUECHIP" }]
  );
  const wsRef = XLSX.utils.json_to_sheet(referenceData);

  XLSX.utils.book_append_sheet(wb, wsMain, "SampleMFTransactions");
  XLSX.utils.book_append_sheet(wb, wsFunds, "FundNames");
  XLSX.utils.book_append_sheet(wb, wsRef, "AllowedValues");

  XLSX.writeFile(wb, "sample_mf_transactions.xlsx");
};


  // --- NESTED MODAL (Add Fund) ---
// Inside AddFundModal
const AddFundModal = ({ onClose }) => {
  const [draft, setDraft, resetDraft] = usePersistentDraft(
    ADD_FUND_STORAGE_KEY,
    ADD_FUND_INITIAL_STATE
  );
  const {
    fundFullName,
    fundShortName,
    schemeCode,
    schemeSearchTerm,
    amcName,
    category,
    isin,
  } = draft;
  const setFundFullName = (value) =>
    setDraft((prev) => ({ ...prev, fundFullName: value }));
  const setFundShortName = (value) =>
    setDraft((prev) => ({ ...prev, fundShortName: value }));
  const setSchemeCode = (value) =>
    setDraft((prev) => ({ ...prev, schemeCode: value }));
  const setSchemeSearchTerm = (value) =>
    setDraft((prev) => ({ ...prev, schemeSearchTerm: value }));
  const setAmcName = (value) =>
    setDraft((prev) => ({ ...prev, amcName: value }));
  const setCategory = (value) =>
    setDraft((prev) => ({ ...prev, category: value }));
  const setIsin = (value) =>
    setDraft((prev) => ({ ...prev, isin: value }));

  const handleClose = useCallback(() => {
    resetDraft();
    onClose?.();
  }, [onClose, resetDraft]);

  const [schemeOptions, setSchemeOptions] = useState([]);
  const [isSchemeLoading, setIsSchemeLoading] = useState(false);

  const [amcOptions, setAmcOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);

  const [showSchemeOptions, setShowSchemeOptions] = useState(false);
  const [showAmcOptions, setShowAmcOptions] = useState(false);
  const [showCategoryOptions, setShowCategoryOptions] = useState(false);

  const [highlightedSchemeIndex, setHighlightedSchemeIndex] = useState(-1);
  const [highlightedAmcIndex, setHighlightedAmcIndex] = useState(-1);
  const [highlightedCategoryIndex, setHighlightedCategoryIndex] = useState(-1);


  // Fetch unique AMC and Category values from fund_master and schemes from scheme_list
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const data = await mfAPI.getMFData(session?.access_token);
        if (data?.fundMaster) {
          const amcs = [...new Set(data.fundMaster.map((d) => d.amc_name).filter(Boolean))].sort((a, b) =>
            a.localeCompare(b)
          );
          const categories = [...new Set(data.fundMaster.map((d) => d.category).filter(Boolean))].sort((a, b) =>
            a.localeCompare(b)
          );
          setAmcOptions(amcs);
          setCategoryOptions(categories);
        }
      } catch (error) {
        console.error("Error fetching master data:", error);
      }
    };
    fetchMasterData();
  }, []);

  // --- Generic keydown handler for autocomplete ---
  const handleKeyDown = (e, field) => {
    let options;
    let highlightedSetter;
    let currentHighlightIndex;

    if (field === "scheme") {
      options = schemeOptions;
      highlightedSetter = setHighlightedSchemeIndex;
      currentHighlightIndex = highlightedSchemeIndex;
    } else if (field === "amc") {
      options = amcOptions;
      highlightedSetter = setHighlightedAmcIndex;
      currentHighlightIndex = highlightedAmcIndex;
    } else {
      options = categoryOptions;
      highlightedSetter = setHighlightedCategoryIndex;
      currentHighlightIndex = highlightedCategoryIndex;
    }

    if (!options.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightedSetter(currentHighlightIndex < options.length - 1 ? currentHighlightIndex + 1 : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightedSetter(currentHighlightIndex > 0 ? currentHighlightIndex - 1 : options.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (currentHighlightIndex >= 0 && currentHighlightIndex < options.length) {
        if (field === "scheme") {
          const selected = options[currentHighlightIndex];
          handleSchemeSelect(selected);
          highlightedSetter(-1);
          return;
        } else if (field === "amc") {
          setAmcName(options[currentHighlightIndex]);
          setShowAmcOptions(false);
        } else {
          setCategory(options[currentHighlightIndex]);
          setShowCategoryOptions(false);
        }
        highlightedSetter(-1);
      }
    }
  };

  const handleSchemeSelect = (scheme) => {
    setFundFullName(scheme.fund_full_name);
    setSchemeSearchTerm(scheme.fund_full_name);
    setSchemeCode(scheme.scheme_code || "");
    setShowSchemeOptions(false);
    setHighlightedSchemeIndex(-1);
  };

  const mapBackendSchemes = (rows = []) =>
    rows
      .filter((row) => row?.fund_full_name)
      .map((row) => ({
        fund_full_name: row.fund_full_name,
        scheme_code: row.scheme_code,
      }));

  const fetchSchemes = useCallback(
    async (query) => {
      if (!query?.trim()) {
        setSchemeOptions([]);
        setHighlightedSchemeIndex(-1);
        return;
      }

      try {
        setIsSchemeLoading(true);

        const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL;
        if (!backendUrl) {
          throw new Error('Missing VITE_BACKEND_URL/VITE_API_URL environment variable');
        }

        const backendResponse = await fetch(
          `${backendUrl.replace(/\/?$/, '')}/api/schemes/search?query=${encodeURIComponent(query)}`,
        );

        if (!backendResponse.ok) {
          throw new Error(`Backend search failed with status ${backendResponse.status}`);
        }

        const backendPayload = await backendResponse.json();
        const backendOptions = mapBackendSchemes(Array.isArray(backendPayload?.data) ? backendPayload.data : []);

        setSchemeOptions(backendOptions);
        setHighlightedSchemeIndex(backendOptions.length ? 0 : -1);
      } catch (err) {
        console.error('Error fetching schemes:', err);
        setSchemeOptions([]);
        setHighlightedSchemeIndex(-1);
      } finally {
        setIsSchemeLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const trimmed = schemeSearchTerm.trim();

    if (trimmed.length < 2) {
      setIsSchemeLoading(false);
      setSchemeOptions([]);
      setHighlightedSchemeIndex(-1);
      return;
    }

    const timer = setTimeout(() => {
      fetchSchemes(trimmed);
    }, 250);

    return () => clearTimeout(timer);
  }, [schemeSearchTerm, fetchSchemes]);

  const handleAddFund = async () => {
    if (!fundShortName || !fundFullName) {
      alert("Fund Short Name and Full Name are required");
      return;
    }

    try {
      await mfAPI.addMaster({
        fund_full_name: fundFullName,
        fund_short_name: fundShortName,
        scheme_code: schemeCode || null,
        amc_name: amcName,
        category,
        isin,
      }, session?.access_token);

      alert("Fund added successfully!");
      handleClose();
    } catch (error) {
      alert("Error adding fund: " + error.message);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-[2rem] shadow-2xl w-full max-w-md p-6 flex flex-col animate-in fade-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-lg font-bold mb-4 text-white">Add New Fund</h3>

        <input
          placeholder="Fund Short Name"
          value={fundShortName}
          onChange={(e) => setFundShortName(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-xl p-3 mb-3 w-full focus:ring-2 focus:ring-blue-500/20 outline-none"
        />
        <div className="relative mb-3">
          <input
            placeholder="Fund Full Name"
            value={fundFullName}
            onChange={(e) => {
              const value = e.target.value;
              setFundFullName(value);
              setSchemeSearchTerm(value);
              setSchemeCode("");
              const trimmed = value.trim();
              if (trimmed.length >= 2) {
                setShowSchemeOptions(true);
              } else {
                setShowSchemeOptions(false);
                setSchemeOptions([]);
                setHighlightedSchemeIndex(-1);
              }
            }}
            onFocus={() => {
              const trimmed = schemeSearchTerm.trim();
              if (trimmed.length >= 2) {
                fetchSchemes(trimmed);
              }
              setShowSchemeOptions(true);
            }}
            onBlur={() => setTimeout(() => setShowSchemeOptions(false), 150)}
            onKeyDown={(e) => handleKeyDown(e, "scheme")}
            className="bg-gray-800 border border-gray-700 text-white rounded-xl p-3 w-full focus:ring-2 focus:ring-blue-500/20 outline-none"
          />
          {showSchemeOptions && (
            <ul className="absolute z-50 w-full max-h-40 overflow-y-auto border border-gray-700 rounded-xl bg-gray-800 shadow-2xl mt-1">
              {isSchemeLoading ? (
                <li className="p-3 text-sm text-gray-500">Searching...</li>
              ) : schemeOptions.length > 0 ? (
                schemeOptions.map((scheme, idx) => (
                  <li
                    key={scheme.scheme_code || scheme.fund_full_name}
                    onMouseDown={() => handleSchemeSelect(scheme)}
                    className={`p-3 cursor-pointer hover:bg-white/[0.05] ${
                      idx === highlightedSchemeIndex ? "bg-white/[0.05]" : ""
                    }`}
                  >
                    <div className="font-medium text-gray-200">{scheme.fund_full_name}</div>
                    {scheme.scheme_code && (
                      <div className="text-xs text-gray-500">Scheme Code: {scheme.scheme_code}</div>
                    )}
                  </li>
                ))
              ) : schemeSearchTerm.trim().length >= 2 ? (
                <li className="p-3 text-sm text-gray-500">No matches found</li>
              ) : (
                <li className="p-3 text-sm text-gray-500">Type at least 2 characters</li>
              )}
            </ul>
          )}
        </div>

        <input
          placeholder="Scheme Code"
          value={schemeCode}
          onChange={(e) => setSchemeCode(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-xl p-3 mb-3 w-full focus:ring-2 focus:ring-blue-500/20 outline-none"
        />

        {/* AMC Name with autocomplete */}
        <div className="relative mb-3">
          <input
            placeholder="AMC Name"
            value={amcName}
            onChange={(e) => {
              setAmcName(e.target.value);
              setShowAmcOptions(true);
            }}
            onFocus={() => setShowAmcOptions(true)}
            onBlur={() => setTimeout(() => setShowAmcOptions(false), 150)}
            onKeyDown={(e) => handleKeyDown(e, "amc")}
            className="bg-gray-800 border border-gray-700 text-white rounded-xl p-3 w-full focus:ring-2 focus:ring-blue-500/20 outline-none"
          />
          {showAmcOptions && amcOptions.length > 0 && (
            <ul className="absolute z-50 w-full max-h-40 overflow-y-auto border border-gray-700 rounded-xl bg-gray-800 shadow-2xl mt-1">
              {amcOptions
                .filter((o) => o.toLowerCase().includes(amcName.toLowerCase()))
                .map((name, idx) => (
                  <li
                    key={idx}
                    onMouseDown={() => {
                      setAmcName(name);
                      setShowAmcOptions(false);
                    }}
                    className={`p-3 cursor-pointer hover:bg-white/[0.05] text-gray-200 ${
                      idx === highlightedAmcIndex ? "bg-white/[0.05]" : ""
                    }`}
                  >
                    {name}
                  </li>
                ))}
            </ul>
          )}
        </div>

        {/* Category with autocomplete */}
        <div className="relative mb-3">
          <input
            placeholder="Category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setShowCategoryOptions(true);
            }}
            onFocus={() => setShowCategoryOptions(true)}
            onBlur={() => setTimeout(() => setShowCategoryOptions(false), 150)}
            onKeyDown={(e) => handleKeyDown(e, "category")}
            className="bg-gray-800 border border-gray-700 text-white rounded-xl p-3 w-full focus:ring-2 focus:ring-blue-500/20 outline-none"
          />
          {showCategoryOptions && categoryOptions.length > 0 && (
            <ul className="absolute z-50 w-full max-h-40 overflow-y-auto border border-gray-700 rounded-xl bg-gray-800 shadow-2xl mt-1">
              {categoryOptions
                .filter((o) => o.toLowerCase().includes(category.toLowerCase()))
                .map((name, idx) => (
                  <li
                    key={idx}
                    onMouseDown={() => {
                      setCategory(name);
                      setShowCategoryOptions(false);
                    }}
                    className={`p-3 cursor-pointer hover:bg-white/[0.05] text-gray-200 ${
                      idx === highlightedCategoryIndex ? "bg-white/[0.05]" : ""
                    }`}
                  >
                    {name}
                  </li>
                ))}
            </ul>
          )}
        </div>

        <input
          placeholder="ISIN"
          value={isin}
          onChange={(e) => setIsin(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-xl p-3 mb-6 w-full focus:ring-2 focus:ring-blue-500/20 outline-none"
        />

        <div className="flex justify-end space-x-2 pt-4 border-t border-gray-800">
          <button
            className="px-6 py-2 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            className="px-6 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            onClick={handleAddFund}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

const AddSipModal = ({ onClose }) => {
  const { session } = useAuth();
  const [draft, setDraft, resetDraft] = usePersistentDraft(
    ADD_SIP_STORAGE_KEY,
    ADD_SIP_INITIAL_STATE
  );
  const { fundShortName, sipAmount, sipDate } = draft;
  const setFundShortName = (value) =>
    setDraft((prev) => ({ ...prev, fundShortName: value }));
  const setSipAmount = (value) =>
    setDraft((prev) => ({ ...prev, sipAmount: value }));
  const setSipDate = (value) =>
    setDraft((prev) => ({ ...prev, sipDate: value }));

  const [fundOptions, setFundOptions] = useState([]);
  const [filteredFunds, setFilteredFunds] = useState([]);
  const [showOptions, setShowOptions] = useState(false);
  const [highlightedOption, setHighlightedOption] = useState(-1);

  const handleClose = useCallback(() => {
    resetDraft();
    onClose?.();
  }, [onClose, resetDraft]);

  // Fetch funds for searchable input
  useEffect(() => {
    const fetchFunds = async () => {
      try {
        const data = await mfAPI.getMFData(session?.access_token);
        if (data?.fundMaster) {
          const raw = (data.fundMaster || [])
            .map((f) => String(f.fund_short_name || "").trim())
            .filter(Boolean);
          const nameMap = new Map();
          raw.forEach((n) => {
            const key = n.toLowerCase();
            if (!nameMap.has(key)) nameMap.set(key, n);
          });
          const names = Array.from(nameMap.values()).sort((a, b) =>
            a.localeCompare(b)
          );
          setFundOptions(names);
          setFilteredFunds(names);
        }
      } catch (error) {
        console.error("Error fetching funds:", error);
      }
    };
    fetchFunds();
  }, [session]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fundShortName || !sipAmount || !sipDate) {
      alert("All fields are required!");
      return;
    }

    try {
      await mfAPI.addSIP({
        account_name: "PM", // or make dropdown if multiple accounts
        fund_short_name: fundShortName,
        amount: parseFloat(sipAmount),
        sip_date: sipDate, // stored as text
      }, session?.access_token);

      alert("SIP added successfully!");
      handleClose();
    } catch (error) {
      alert("Error saving SIP: " + error.message);
    }
  };

  const handleKeyDown = (event) => {
    if (!showOptions || !filteredFunds.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedOption((prev) =>
        prev < filteredFunds.length - 1 ? prev + 1 : prev
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedOption((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (
        highlightedOption >= 0 &&
        highlightedOption < filteredFunds.length
      ) {
        setFundShortName(filteredFunds[highlightedOption]);
        setShowOptions(false);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-[70] p-4"
      onClick={handleClose}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-[2rem] shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-xl font-bold mb-4 text-white">Add New SIP</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fund Short Name (searchable input) */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-400 mb-1">Fund Short Name</label>
            <input
              value={fundShortName}
              onChange={(e) => {
                const value = e.target.value;
                setFundShortName(value);
                setShowOptions(true);
                const filtered = fundOptions.filter((option) =>
                  option.toLowerCase().includes(value.toLowerCase())
                );
                setFilteredFunds(filtered);
                setHighlightedOption(filtered.length ? 0 : -1);
              }}
              onFocus={() => {
                setShowOptions(true);
                setHighlightedOption(filteredFunds.length ? 0 : -1);
              }}
              onBlur={() => setTimeout(() => setShowOptions(false), 150)}
              onKeyDown={handleKeyDown}
              className="bg-gray-800 border border-gray-700 text-white rounded-xl p-3 w-full focus:ring-2 focus:ring-blue-500/20 outline-none"
              placeholder="Type to search..."
              required
            />
            {showOptions && filteredFunds.length > 0 && (
              <ul className="absolute z-50 w-full max-h-40 overflow-y-auto border border-gray-700 rounded-xl bg-gray-800 shadow-2xl mt-1">
                {filteredFunds.map((name, idx) => (
                  <li
                    key={idx}
                    onMouseDown={() => {
                      setFundShortName(name);
                      setShowOptions(false);
                    }}
                    className={`p-3 cursor-pointer hover:bg-white/[0.05] text-gray-200 ${
                      idx === highlightedOption ? "bg-white/[0.05]" : ""
                    }`}
                  >
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* SIP Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Amount</label>
            <input
              type="number"
              value={sipAmount}
              onChange={(e) => setSipAmount(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-xl p-3 w-full focus:ring-2 focus:ring-blue-500/20 outline-none"
              placeholder="0.00"
              required
            />
          </div>

          {/* SIP Date (text field, not date) */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">SIP Date (text)</label>
            <input
              type="text"
              value={sipDate}
              onChange={(e) => setSipDate(e.target.value)}
              placeholder="e.g. 10th, 15th"
              className="bg-gray-800 border border-gray-700 text-white rounded-xl p-3 w-full focus:ring-2 focus:ring-blue-500/20 outline-none"
              required
            />
          </div>

          <div className="flex justify-end space-x-2 pt-6 border-t border-gray-800">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition-colors"
            >
              Save SIP
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const MultipleEntriesModal = ({ onClose, onSuccess, accountOptions }) => {
  const { session } = useAuth();
  const [source, setSource] = useState("cas"); // "cas" or "raw"
  const [entries, setEntries, resetEntries] = usePersistentDraft(
    MF_MULTIPLE_ENTRIES_STORAGE_KEY,
    MF_MULTIPLE_ENTRIES_INITIAL_STATE
  );
  const [loading, setLoading] = useState(true);
  const [activeRowIndex, setActiveRowIndex] = useState(-1);
  const [highlightedFundIndex, setHighlightedFundIndex] = useState(-1);
  const [filteredRowFunds, setFilteredRowFunds] = useState([]);
  const [allFundNames, setAllFundNames] = useState([]);
  const [fundTotalUnits, setFundTotalUnits] = useState({});
  const [totals, setTotals] = useState({ buy: 0, sell: 0 });
  const [existingTransactions, setExistingTransactions] = useState([]);
  const fetchAttemptedRef = useRef(false);

  // Blinking animation style
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes blink {
        0% { opacity: 1; }
        50% { opacity: 0.4; }
        100% { opacity: 1; }
      }
      .animate-blink {
        animation: blink 1s infinite;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const handleFundKeyDown = (e, index) => {
    if (activeRowIndex !== index || !filteredRowFunds.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedFundIndex((prev) =>
        prev < filteredRowFunds.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedFundIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedFundIndex >= 0 && highlightedFundIndex < filteredRowFunds.length) {
        handleEntryChange(index, "fund_short_name", filteredRowFunds[highlightedFundIndex]);
        setActiveRowIndex(-1);
        setHighlightedFundIndex(-1);
      }
    } else if (e.key === "Escape") {
      setActiveRowIndex(-1);
      setHighlightedFundIndex(-1);
    }
  };

  const isAlreadyUploaded = useCallback((entry) => {
    return existingTransactions.some(txn => 
        (txn.fund_short_name || "").trim().toLowerCase() === (entry.fund_short_name || "").trim().toLowerCase() &&
        (txn.account_name || "").trim().toLowerCase() === (entry.account_name || "").trim().toLowerCase() &&
        txn.date === entry.date &&
        Math.abs(Number(txn.units) - Number(entry.units)) < 0.001 &&
        Math.abs(Number(txn.nav) - Number(entry.nav)) < 0.001
    );
  }, [existingTransactions]);

  useEffect(() => {
    const activeEntries = entries.filter(e => !isAlreadyUploaded(e));
    const buy = activeEntries.reduce((acc, curr) => {
      const amount = parseFloat(curr.nav) * parseFloat(curr.units);
      if (curr.transaction_type === 'buy' && !isNaN(amount)) {
        return acc + amount;
      }
      return acc;
    }, 0);
    const sell = activeEntries.reduce((acc, curr) => {
      const amount = parseFloat(curr.nav) * parseFloat(curr.units);
      if (curr.transaction_type === 'sell' && !isNaN(amount)) {
        return acc + amount;
      }
      return acc;
    }, 0);
    setTotals({ buy, sell });
  }, [entries, isAlreadyUploaded]);

  useEffect(() => {
    const fetchFundNames = async () => {
      try {
        const data = await mfAPI.getMFData();
        if (data?.fundMaster) {
          const raw = (data.fundMaster || [])
            .map((f) => String(f.fund_short_name || "").trim())
            .filter(Boolean);
          const nameMap = new Map();
          raw.forEach((n) => {
            const key = n.toLowerCase();
            if (!nameMap.has(key)) nameMap.set(key, n);
          });
          const names = Array.from(nameMap.values()).sort((a, b) => a.localeCompare(b));
          setAllFundNames(names);
        }
      } catch (error) {
        console.error("Error fetching fund names:", error);
      }
    };
    fetchFundNames();
  }, []);

  useEffect(() => {
    const calculateFundTotalUnits = async () => {
      try {
        const data = await mfAPI.getMFData();
        const transactions = data?.transactions || [];
        
        const normName = (s) => (s || "").trim();
        const grouped = {};
        
        transactions.forEach((txn) => {
          const fsn = normName(txn.fund_short_name);
          if (!fsn) return;
          
          if (!grouped[fsn]) {
            grouped[fsn] = [];
          }
          grouped[fsn].push(txn);
        });

        const fundUnits = {};

        Object.entries(grouped).forEach(([fundName, txns]) => {
          txns.sort((a, b) => new Date(a.date) - new Date(b.date));
          const lotsByAccount = new Map();

          txns.forEach((t) => {
            const type = String(t.transaction_type || "").toLowerCase().trim();
            const units = Number(t.units) || 0;
            const acc = (t.account_name || "").trim();
            
            if (type === "buy") {
              const arr = lotsByAccount.get(acc) || [];
              arr.push({ units });
              lotsByAccount.set(acc, arr);
            } else if (type === "sell") {
              let remaining = units;
              const arr = lotsByAccount.get(acc) || [];
              while (remaining > 0 && arr.length) {
                const lot = arr[0];
                const take = Math.min(remaining, lot.units);
                lot.units -= take;
                remaining -= take;
                if (lot.units <= 1e-8) arr.shift();
              }
              lotsByAccount.set(acc, arr);
            }
          });

          lotsByAccount.forEach((lots, accountName) => {
              const openUnits = lots.reduce((s, l) => s + (Number(l.units) || 0), 0);
              const key = `${fundName}|${accountName}`;
              fundUnits[key] = openUnits;
          });
        });
        
        setFundTotalUnits(fundUnits);
      } catch (error) {
        console.error("Error calculating fund units:", error);
      }
    };
    
    calculateFundTotalUnits();
  }, []);

  useEffect(() => {
    const fetchEntries = async () => {
      // Always fetch existing transactions to check status
      try {
          const mfData = await mfAPI.getMFData(session?.access_token);
          setExistingTransactions(mfData?.transactions || []);
      } catch (e) {
          console.error("Error fetching existing transactions:", e);
      }

      if (entries && entries.length > 0 && fetchAttemptedRef.current) {
        setLoading(false);
        return;
      }

      fetchAttemptedRef.current = true;
      setLoading(true);

      try {
        const casData = source === "cas" 
          ? await mfAPI.getCasEntries(session?.access_token)
          : await mfAPI.getRawCasEntries(session?.access_token);
          
        const mfData = await mfAPI.getMFData(session?.access_token);
        const fundMaster = mfData?.fundMaster || [];
        
        const isinToName = {};
        fundMaster.forEach(f => {
          if (f.isin) isinToName[f.isin] = f.fund_short_name;
        });

        let prepared = (casData || []).map(item => ({
            ...item,
            id: undefined, 
            fund_short_name: item.fund_short_name || isinToName[item.isin] || "",
            transaction_type: (item.transaction_type || "buy").toLowerCase(),
        }));

        prepared.sort((a, b) => {
            const accA = (a.account_name || "").toLowerCase();
            const accB = (b.account_name || "").toLowerCase();
            if (accA < accB) return -1;
            if (accA > accB) return 1;
            
            const fundA = (a.fund_short_name || "").toLowerCase();
            const fundB = (b.fund_short_name || "").toLowerCase();
            if (fundA < fundB) return -1;
            if (fundA > fundB) return 1;
            return 0;
        });

        setEntries(prepared);
      } catch (error) {
        console.error(`Error fetching ${source} entries:`, error);
        alert(`Failed to fetch entries from ${source === "cas" ? "CAS" : "Raw CAS"} table`);
      } finally {
        setLoading(false);
      }
    };
    fetchEntries();
  }, [source, session, entries, setEntries]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleEntryChange = (index, field, value) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
  };

  const handleRemoveEntry = (index) => {
    const newEntries = entries.filter((_, i) => i !== index);
    setEntries(newEntries);
  };

  const handleAddRow = (index) => {
    const newEntries = [...entries];
    const today = new Date().toISOString().split('T')[0];
    const newRow = {
        fund_short_name: "",
        account_name: "",
        transaction_type: "buy",
        date: today,
        units: "",
        nav: "",
    };
    // Insert after current index
    newEntries.splice(index + 1, 0, newRow);
    setEntries(newEntries);
  };

  const handleUpdate = async () => {
    if (entries.length === 0) {
        resetEntries();
        onClose();
        return;
    }
    
    const activeEntries = entries.filter(e => !isAlreadyUploaded(e));
    
    if (activeEntries.length === 0) {
        alert("No active entries to upload. All entries are already present in the transactions table.");
        return;
    }

    // Basic validation
    for (let i = 0; i < activeEntries.length; i++) {
        const e = activeEntries[i];
        if (!e.fund_short_name || !e.account_name || !e.date) {
            alert(`Row ${i + 1}: Fund, Account and Date are required.`);
            return;
        }
    }

    const payload = activeEntries.map(e => ({
        fund_short_name: e.fund_short_name,
        account_name: e.account_name,
        transaction_type: e.transaction_type,
        date: e.date,
        units: e.units ? parseFloat(e.units) : null,
        nav: e.nav ? parseFloat(e.nav) : null,
    }));

    try {
      await mfAPI.addBulkTransactions(payload, session?.access_token);
      alert(`${payload.length} active entries added successfully!`);
      await mfAPI.invalidateCache(session?.access_token);
      window.dispatchEvent(new CustomEvent('portfolio-cache-invalidated', { detail: { assetType: 'mf' } }));
      resetEntries();
      onSuccess?.();
      onClose();
    } catch (error) {
      alert("Error adding entries: " + error.message);
    }
  };

  const handleDeleteAllCAS = async () => {
    if (!window.confirm("Delete all entries from CAS table?")) return;
    try {
      await mfAPI.deleteAllCasEntries(session?.access_token);
      setEntries([]);
      resetEntries();
      alert("All CAS entries deleted.");
    } catch (error) {
      alert("Error deleting CAS entries: " + error.message);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-[80] p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-[2rem] shadow-2xl w-full max-w-6xl p-1 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-6" />
        <div className="flex items-center justify-between mb-4 px-4">
          <div className="flex items-center space-x-4">
            <h3 className="text-xl font-bold text-white">Bulk Add to MF Table</h3>
            <div className="flex items-center bg-gray-800 rounded-lg p-1 space-x-1">
              <button
                onClick={() => {
                  setSource("cas");
                  setEntries([]);
                  fetchAttemptedRef.current = false;
                }}
                className={`p-2 rounded-md transition-all ${
                  source === "cas" 
                    ? "bg-blue-600 text-white animate-blink" 
                    : "text-gray-400 hover:bg-gray-700"
                }`}
                title="CAS Entries (UP)"
              >
                <Upload size={18} />
              </button>
              <button
                onClick={() => {
                  setSource("raw");
                  setEntries([]);
                  fetchAttemptedRef.current = false;
                }}
                className={`p-2 rounded-md transition-all ${
                  source === "raw" 
                    ? "bg-red-600 text-white animate-blink" 
                    : "text-gray-400 hover:bg-gray-700"
                }`}
                title="Raw CAS Entries (GM)"
              >
                <Mail size={18} />
              </button>
            </div>
          </div>
          <button 
            onClick={handleDeleteAllCAS}
            className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
            title="Clear CAS Table"
          >
            <Minus size={20} />
          </button>
        </div>
        
        {/* Totals Summary */}
        {!loading && entries.length > 0 && (
          <div className="flex space-x-6 mb-6">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex-1">
              <div className="text-[10px] text-emerald-500 uppercase tracking-widest font-bold mb-1 opacity-70">Total Buy Amount</div>
              <div className="text-xl font-bold text-emerald-400">
                ₹{totals.buy.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex-1">
              <div className="text-[10px] text-rose-500 uppercase tracking-widest font-bold mb-1 opacity-70">Total Sell Amount</div>
              <div className="text-xl font-bold text-rose-400">
                ₹{totals.sell.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        )}
        
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            No entries found in CAS table. 
            <button 
              className="ml-2 text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-4"
              onClick={() => handleAddRow(-1)}
            >
              Add First Row
            </button>
          </div>
        ) : (
          <div className="overflow-auto flex-1 rounded-xl border border-gray-800 bg-gray-950/50">
            <table className="w-full text-sm text-left table-layout-fixed" style={{ tableLayout: 'fixed' }}>
              <thead className="text-xs text-gray-400 uppercase tracking-wider bg-gray-800/50 sticky top-0 backdrop-blur-sm z-10">
                <tr>
                  <th className="px-4 py-3 w-40">Fund Name</th>
                  <th className="px-4 py-3 w-36">Date</th>
                  <th className="px-4 py-3 w-32">Units</th>
                  <th className="px-4 py-3 w-32">NAV</th>
                  <th className="px-4 py-3 w-36">Account Name</th>
                  <th className="px-4 py-3 w-28">Type</th>
                  <th className="px-4 py-3 w-32">Total Units</th>
                  <th className="px-4 py-3 w-28">Status</th>
                  <th className="px-4 py-3 w-28 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {entries.map((entry, idx) => {
                  const fundName = (entry.fund_short_name || "").trim();
                  const accountName = (entry.account_name || "").trim();
                  const key = `${fundName}|${accountName}`;
                  const totalUnits = fundTotalUnits[key] ?? 0;
                  const openingBalance = entry.opening_balance ?? 0;
                  
                  // Highlight row if opening balance from CAS doesn't match current system total units
                  const isMismatch = Math.abs(parseFloat(totalUnits) - parseFloat(openingBalance)) > 0.01;
                  const active = !isAlreadyUploaded(entry);

                  if (!active) return null;
                  
                  return (
                    <tr key={idx} className={`hover:bg-white/[0.02] transition-colors ${isMismatch ? "bg-orange-500/10" : ""} ${!active ? "opacity-60" : ""}`}>
                      <td className="px-2 py-2 relative w-40">
                        <input 
                          type="text"
                          value={entry.fund_short_name}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleEntryChange(idx, "fund_short_name", val);
                            const filtered = allFundNames.filter((f) =>
                              f.toLowerCase().includes(val.toLowerCase())
                            );
                            setFilteredRowFunds(filtered);
                            setActiveRowIndex(idx);
                            setHighlightedFundIndex(filtered.length ? 0 : -1);
                          }}
                          onFocus={() => {
                            setActiveRowIndex(idx);
                            const val = (entry.fund_short_name || "").toLowerCase();
                            const filtered = allFundNames.filter((f) =>
                              f.toLowerCase().includes(val)
                            );
                            setFilteredRowFunds(filtered);
                            setHighlightedFundIndex(filtered.length ? 0 : -1);
                          }}
                          onBlur={() => setTimeout(() => setActiveRowIndex(-1), 200)}
                          onKeyDown={(e) => handleFundKeyDown(e, idx)}
                          className="bg-gray-800 border border-gray-700 text-white rounded-lg p-2 w-full text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                          placeholder="Select Fund"
                        />
                        {activeRowIndex === idx && filteredRowFunds.length > 0 && (
                          <ul className="absolute z-50 w-96 max-h-40 overflow-y-auto border border-gray-700 rounded-xl bg-gray-800 shadow-2xl top-full left-0 mt-1">
                            {filteredRowFunds.map((name, i) => (
                              <li
                                key={i}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleEntryChange(idx, "fund_short_name", name);
                                  setActiveRowIndex(-1);
                                }}
                                className={`p-3 cursor-pointer hover:bg-white/[0.05] text-gray-200 text-sm ${
                                  i === highlightedFundIndex ? "bg-white/[0.05]" : ""
                                }`}
                              >
                                {name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-2 py-2 w-36">
                        <input 
                          type="date" 
                          value={entry.date} 
                          onChange={e => handleEntryChange(idx, 'date', e.target.value)}
                          className="bg-gray-800 border border-gray-700 text-white rounded-lg p-2 w-full text-sm focus:ring-2 focus:ring-blue-500/20 outline-none [color-scheme:dark]"
                        />
                      </td>
                      <td className="px-2 py-2 w-32">
                        <input 
                          type="number" 
                          step="0.001"
                          value={entry.units} 
                          onChange={e => handleEntryChange(idx, 'units', e.target.value)}
                          className="bg-gray-800 border border-gray-700 text-white rounded-lg p-2 w-full text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                        />
                      </td>
                      <td className="px-2 py-2 w-32">
                        <input 
                          type="number" 
                          step="0.0001"
                          value={entry.nav} 
                          onChange={e => handleEntryChange(idx, 'nav', e.target.value)}
                          className="bg-gray-800 border border-gray-700 text-white rounded-lg p-2 w-full text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                        />
                      </td>
                      <td className="px-2 py-2 w-36">
                        <select
                          value={entry.account_name}
                          onChange={e => handleEntryChange(idx, 'account_name', e.target.value)}
                          className="bg-gray-800 border border-gray-700 text-white rounded-lg p-2 w-full text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                        >
                          <option value="">Select</option>
                          {accountOptions.map((acc, i) => (
                            <option key={i} value={acc}>{acc}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2 w-28">
                        <select
                          value={entry.transaction_type}
                          onChange={e => handleEntryChange(idx, 'transaction_type', e.target.value)}
                          className="bg-gray-800 border border-gray-700 text-white rounded-lg p-2 w-full text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                        >
                          <option value="buy">Buy</option>
                          <option value="sell">Sell</option>
                        </select>
                      </td>
                      <td className="px-2 py-2 w-32">
                        {(() => {
                          const formattedUnits = parseFloat(totalUnits).toFixed(2);
                          
                          return (
                            <input 
                              type="number" 
                              step="0.01"
                              value={formattedUnits}
                              disabled
                              className={`bg-gray-900 border border-gray-800 text-gray-500 rounded-lg p-2 w-full text-sm cursor-not-allowed ${isMismatch ? "border-orange-500/50 text-orange-500/70" : ""}`}
                            />
                          );
                        })()}
                      </td>
                      <td className="px-2 py-2 w-28">
                        {active ? (
                          <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-md bg-gray-500/10 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 w-28 text-center">
                        <div className="flex justify-center space-x-1">
                          <button 
                            onClick={() => handleAddRow(idx)}
                            className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-colors"
                            title="Add Row Below"
                          >
                            <Plus size={16} />
                          </button>
                          <button 
                            onClick={() => handleRemoveEntry(idx)}
                            className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
                            title="Remove Row"
                          >
                            <Minus size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-800">
          <button 
            className="px-6 py-2 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors" 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="px-6 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
            onClick={handleUpdate}
            disabled={loading || entries.length === 0 || entries.filter(e => !isAlreadyUploaded(e)).length === 0}
          >
            Upload {entries.filter(e => !isAlreadyUploaded(e)).length} Active Rows
          </button>
        </div>
      </div>
    </div>
  );
};


  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mt-6 mb-2" />
        {/* Header */}
        <div className="px-8 py-2 border-b border-gray-800 flex flex-col gap-4">
          <h2 className="text-2xl font-bold text-white tracking-tight">Add MF Transaction</h2>
          <div className="flex space-x-2">
            {/* Add Fund */}
            <button
              className="text-white bg-emerald-600 hover:bg-emerald-700 rounded-full p-2.5 transition-colors shadow-lg shadow-emerald-900/20"
              onClick={() => setShowAddFundModal(true)}
              title="Add New Fund"
              type="button"
            >
              <Plus size={20} />
            </button>

            {/* Upload Excel */}
            <button
              className="text-white bg-blue-600 hover:bg-blue-700 rounded-full p-2.5 transition-colors shadow-lg shadow-blue-900/20"
              onClick={() => fileInputRef.current?.click()}
              title="Upload Excel (bulk transactions)"
              type="button"
            >
              <Upload size={20} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Download Sample */}
            <button
              className="text-white bg-purple-600 hover:bg-purple-700 rounded-full p-2.5 transition-colors shadow-lg shadow-purple-900/20"
              onClick={handleDownloadSample}
              title="Download Sample Excel"
              type="button"
            >
              <Download size={20} />
            </button>

            {/* Add SIP */}
            <button
              className="w-10 h-10 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold flex items-center justify-center transition-colors shadow-lg shadow-orange-900/20"
              onClick={() => setShowSipModal(true)}
              title="Add New SIP"
              type="button"
            >
              SIP
            </button>

            {/* Multiple Entries */}
            <button
              className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center transition-colors shadow-lg shadow-indigo-900/20"
              onClick={() => setShowMultipleEntriesModal(true)}
              title="Add Multiple Entries (Last Month)"
              type="button"
            >
              ME
            </button>

            {/* CAS Import */}
            <button
              className="w-10 h-10 rounded-full bg-pink-600 hover:bg-pink-700 text-white font-bold flex items-center justify-center transition-colors shadow-lg shadow-pink-900/20"
              onClick={() => setShowCASImportModal(true)}
              title="Import CAS"
              type="button"
            >
              CAS
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="px-8 py-6 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Fund Short Name */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Fund Short Name</label>
              <input
                ref={inputRef}
                value={fundShortName}
                onChange={(e) => {
                  setFundShortName(e.target.value);
                  setShowOptions(true);
                  setFilteredFunds(
                    fundOptions.filter((f) =>
                      f.toLowerCase().includes(e.target.value.toLowerCase())
                    )
                  );
                }}
                onFocus={() => setShowOptions(true)}
                onBlur={() => setTimeout(() => setShowOptions(false), 150)}
                onKeyDown={handleKeyDown}
                className="bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 w-full focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                placeholder="Type to search..."
                required
              />
              {showOptions && filteredFunds.length > 0 && (
                <ul className="absolute z-50 w-full max-h-48 overflow-y-auto border border-gray-700 rounded-xl bg-gray-800 shadow-2xl mt-1.5 backdrop-blur-sm">
                  {filteredFunds.map((name, idx) => (
                    <li
                      key={idx}
                      onMouseDown={() => {
                        setFundShortName(name);
                        setShowOptions(false);
                      }}
                      className={`p-3.5 cursor-pointer hover:bg-white/[0.05] text-gray-200 transition-colors ${
                        idx === highlightedIndex ? "bg-white/[0.05]" : ""
                      }`}
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Account Name */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Account Name</label>
              {isAddingNew ? (
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Enter new account name"
                  className="bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 w-full focus:ring-2 focus:ring-blue-500/20 outline-none"
                  onBlur={() => {
                    if (newAccountName.trim()) {
                      setAccountName(newAccountName.trim());
                      setAccountOptions((prev) => [...new Set([...prev, newAccountName.trim()])]);
                    }
                    setIsAddingNew(false);
                  }}
                  autoFocus
                />
              ) : (
                <select
                  value={accountName}
                  onChange={(e) => {
                    if (e.target.value === "__add_new__") {
                      setIsAddingNew(true);
                      setNewAccountName("");
                    } else {
                      setAccountName(e.target.value);
                    }
                  }}
                  className="bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 w-full focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none cursor-pointer"
                  required
                >
                  <option value="">Select Account</option>
                  {accountOptions.map((acc, idx) => (
                    <option key={idx} value={acc}>
                      {acc}
                    </option>
                  ))}
                  <option value="__add_new__">➕ Add New Account</option>
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Transaction Type */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Type</label>
                <select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 w-full focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none cursor-pointer"
                  required
                >
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Date</label>
                <input
                  type="date"
                  value={buyDate}
                  onChange={(e) => setBuyDate(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 w-full focus:ring-2 focus:ring-blue-500/20 outline-none transition-all [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Units */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Units</label>
                <input
                  type="number"
                  step="0.01"
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 w-full focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  placeholder="0.00"
                />
              </div>

              {/* NAV */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">NAV</label>
                <input
                  type="number"
                  step="0.01"
                  value={buyNav}
                  onChange={(e) => setBuyNav(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 w-full focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  placeholder="0.00"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-gray-800 flex justify-end space-x-3 bg-gray-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!fundShortName || !accountName || !buyDate || (transactionType !== 'charges' && (!units || !buyNav))}
            className="px-8 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold shadow-lg shadow-blue-900/20"
          >
            Save Transaction
          </button>
        </div>
      </div>

      {showAddFundModal && (
        <AddFundModal onClose={() => setShowAddFundModal(false)} />
      )}

      {showSipModal && (
        <AddSipModal onClose={() => setShowSipModal(false)} />
      )}

      {showMultipleEntriesModal && (
        <MultipleEntriesModal 
          onClose={() => setShowMultipleEntriesModal(false)} 
          onSuccess={onSuccess}
          accountOptions={accountOptions}
        />
      )}

      {showCASImportModal && (
        <CASImportModal
          onClose={() => setShowCASImportModal(false)}
        />
      )}
    </div>
  );
};

export default MutualFundForm;
