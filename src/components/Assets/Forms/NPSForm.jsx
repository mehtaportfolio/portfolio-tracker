// src/components/Assets/Forms/NPSForm.js
import React, { useEffect, useRef, useState } from "react";
import assetAPI from "../../../api/assetAPI.js";
import { Upload, Download, X, Plus, Trash2, FileText, Globe} from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { useNavigation } from "../../../context/NavigationContext.jsx";

const NPSForm = ({ onClose, onSuccess }) => {
  const { setIsBottomBarHidden } = useNavigation();
  const [schemeCode, setSchemeCode] = useState("");
  const [schemeName, setSchemeName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [buyDate, setBuyDate] = useState("");
  const [units, setUnits] = useState("");
  const [buyNav, setBuyNav] = useState("");
  const [transactionType, setTransactionType] = useState("buy");

  useEffect(() => {
    setIsBottomBarHidden(true);
    return () => setIsBottomBarHidden(false);
  }, [setIsBottomBarHidden]);

  // New: fund_name dropdown state
  const [fundName, setFundName] = useState("");
  const [fundOptions, setFundOptions] = useState([]); // current filtered list of fund names
  const [allFunds, setAllFunds] = useState([]); // all distinct fund names
  const [masterRows, setMasterRows] = useState([]); // full master rows for filtering by scheme

  const [schemeOptions, setSchemeOptions] = useState([]); // [{ scheme_code, scheme_name }]
  const [filteredSchemes, setFilteredSchemes] = useState([]);
  const [showOptions, setShowOptions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const [accountOptions, setAccountOptions] = useState([]);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [showContributionForm, setShowContributionForm] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showFetchModal, setShowFetchModal] = useState(false);
  const [fetchFy, setFetchFy] = useState("");
  const [isFetchingNps, setIsFetchingNps] = useState(false);
  const [captchaImage, setCaptchaImage] = useState(null);
  const [captchaValue, setCaptchaValue] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [step, setStep] = useState(1); // 1: FY, 2: Captcha
  const [fetchStatus, setFetchStatus] = useState("");
  const [fetchProgress, setFetchProgress] = useState(0);
  const [npsPdfFile, setNpsPdfFile] = useState(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  
  // Multiple Entry Modal State
  const [showMultipleEntryModal, setShowMultipleEntryModal] = useState(false);
  const [editableEntries, setEditableEntries] = useState([]);
  const [fundTotalUnits, setFundTotalUnits] = useState({});
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [activeBulkTab, setActiveBulkTab] = useState("");
  const [currentBulkPage, setCurrentBulkPage] = useState(1);
  const rowsPerPage = 5;

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Close on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Fetch schemes (unique list) and fund_name master
  useEffect(() => {
    const fetchSchemesAndFunds = async () => {
      try {
        const masterData = await assetAPI.getNPSMaster();
        if (masterData) {
          const unique = [];
          const seen = new Set();
          for (const r of masterData) {
            const key = (r.scheme_code || "").trim();
            if (key && !seen.has(key)) {
              seen.add(key);
              unique.push({ scheme_code: r.scheme_code, scheme_name: r.scheme_name });
            }
          }
          setSchemeOptions(unique);
          setFilteredSchemes(unique);
          setMasterRows(masterData);
          
          const all = Array.from(new Set(masterData.map((m) => (m.fund_name || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
          setAllFunds(all);
          setFundOptions(all);
        }
      } catch (error) {
        console.error("Error fetching schemes and funds:", error.message);
      }
    };
    fetchSchemesAndFunds();
  }, []);

  // Fetch existing account names
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const accounts = await assetAPI.getDistinctNames('nps', 'account_name');
        setAccountOptions(accounts || []);
      } catch (error) {
        console.error("Error fetching accounts:", error.message);
      }
    };
    fetchAccounts();
  }, []);

  useEffect(() => {
    const calculateFundTotalUnits = async () => {
      try {
        const data = await assetAPI.getTransactionsByRange('nps', '1900-01-01', '2100-12-31', 'date');
        
        const normName = (s) => (s || "").trim().toLowerCase();
        const grouped = {};
        
        (data || []).forEach((txn) => {
          const sn = normName(txn.scheme_name);
          if (!sn) return;
          
          if (!grouped[sn]) {
            grouped[sn] = [];
          }
          grouped[sn].push(txn);
        });

        const fundUnits = {};

        Object.entries(grouped).forEach(([schemeName, txns]) => {
          txns.sort((a, b) => new Date(a.date) - new Date(b.date));
          const lots = [];

          txns.forEach((t) => {
            const type = String(t.transaction_type || "").toLowerCase().trim();
            const units = Number(t.units) || 0;
            
            if (type === "buy") {
              lots.push({ units });
            } else if (type === "sell" || type === "charges") {
              let remaining = units;
              while (remaining > 0 && lots.length) {
                const lot = lots[0];
                const take = Math.min(remaining, lot.units);
                lot.units -= take;
                remaining -= take;
                if (lot.units <= 1e-8) lots.shift();
              }
            }
          });

          const openUnits = lots.reduce((s, l) => s + (Number(l.units) || 0), 0);
          fundUnits[schemeName] = openUnits;
        });
        
        setFundTotalUnits(fundUnits);
      } catch (error) {
        console.error("Error calculating fund units:", error);
      }
    };
    
    calculateFundTotalUnits();
  }, []);

  // When schemeCode changes, auto-set schemeName and filter fund options by master
  useEffect(() => {
    if (!schemeCode) {
      // reset fund list to all if no scheme selected
      setFundOptions(allFunds);
      return;
    }
    const found = schemeOptions.find((s) => s.scheme_code === schemeCode);
    if (found) setSchemeName(found.scheme_name || "");

    // Filter funds matching this scheme in master rows
    const relatedFunds = Array.from(
      new Set(
        masterRows
          .filter((m) => (m.scheme_code || "").trim() === schemeCode)
          .map((m) => (m.fund_name || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    // If none found, fallback to all funds
    const nextOptions = relatedFunds.length ? relatedFunds : allFunds;
    setFundOptions(nextOptions);
    // reset fundName if it is not in the next options
    if (!nextOptions.includes(fundName)) setFundName("");
  }, [schemeCode, schemeOptions, masterRows, allFunds, fundName]);

  const handleKeyDown = (e) => {
    if (!showOptions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredSchemes.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredSchemes.length) {
        const s = filteredSchemes[highlightedIndex];
        setSchemeCode(s.scheme_code);
        setSchemeName(s.scheme_name || "");
        setShowOptions(false);
      }
    }
  };

  const handleSchemeInput = (value) => {
    // Allow typing either code or name; filter by either
    const v = value.toLowerCase();
    const filtered = schemeOptions.filter(
      (s) => (s.scheme_code || "").toLowerCase().includes(v) || (s.scheme_name || "").toLowerCase().includes(v)
    );
    setFilteredSchemes(filtered);
  };

  const startAddAccount = () => {
    setIsAddingAccount(true);
    setNewAccountName("");
  };

  const cancelAddAccount = () => {
    setIsAddingAccount(false);
    setNewAccountName("");
  };

  const confirmAddAccount = () => {
    const trimmed = newAccountName.trim();
    if (!trimmed) {
      alert("Please enter an account name.");
      return;
    }

    if (!accountOptions.includes(trimmed)) {
      setAccountOptions((prev) => [...prev, trimmed].sort((a, b) => a.localeCompare(b)));
    }
    setAccountName(trimmed);
    setIsAddingAccount(false);
    setNewAccountName("");
  };

  const handleOpenMultipleEntryModal = async () => {
    setActiveBulkTab("LM");
    setIsBulkLoading(true);
    setCurrentBulkPage(1);
    try {
      // 1. Find the most recent transaction date
      const latest = await assetAPI.getLatestDate('nps');
      
      if (!latest || !latest.date) {
        alert("No existing transactions found to copy from.");
        setIsBulkLoading(false);
        return;
      }

      const latestDate = new Date(latest.date);
      
      // 2. Calculate start and end of that month
      const year = latestDate.getFullYear();
      const month = latestDate.getMonth(); // 0-indexed
      
      // Start of month: YYYY-MM-01
      const startOfMonth = new Date(year, month, 1);
      const startStr = startOfMonth.toISOString().slice(0, 10);
      
      // End of month: Last day of the month
      const endOfMonth = new Date(year, month + 1, 0);
      const endStr = endOfMonth.toISOString().slice(0, 10);

      // 3. Fetch all transactions in that month range
      const data = await assetAPI.getTransactionsByRange('nps', startStr, endStr);

      if (!data || data.length === 0) {
        alert("No entries found for the identified month.");
        setIsBulkLoading(false);
        return;
      }

      setEditableEntries(data.map(item => ({
        ...item,
        original_id: item.id, // Keep track of original ID if needed, though we are creating new rows
        status: "active" // LM entries are typically considered new to-be-added rows
      })));
      setShowMultipleEntryModal(true);
    } catch (error) {
      alert("Error opening multiple entry modal: " + error.message);
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleAMFetch = async () => {
    setActiveBulkTab("AM");
    setIsBulkLoading(true);
    setCurrentBulkPage(1);
    try {
      const [rawTxns, existingTxns] = await Promise.all([
        assetAPI.getRawNPSTransactions(),
        assetAPI.getTransactionsByRange('nps', '1900-01-01', '2100-12-31', 'date')
      ]);

      if (!rawTxns || rawTxns.length === 0) {
        alert("No raw transactions found in temp table.");
        setIsBulkLoading(false);
        return;
      }

      // Helper to convert DD-MMM-YYYY to YYYY-MM-DD
      const formatToISODate = (dateStr) => {
        if (!dateStr) return "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        
        const parts = dateStr.split("-");
        if (parts.length !== 3) return dateStr;

        const [day, monthStr, year] = parts;
        const months = {
          jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
          jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
        };
        const month = months[monthStr.toLowerCase()];
        if (!month) return dateStr;

        return `${year}-${month}-${day.padStart(2, "0")}`;
      };

      // Map raw transactions using masterRows
      const mapped = rawTxns.map(rt => {
        let rawScheme = (rt.scheme || "").trim();
        // Remove common prefixes and suffixes
        const cleanRaw = (str) => {
          let s = str.toUpperCase();
          // Regex to remove "NPS TRUST" variations at the start
          s = s.replace(/^NPS TRUST[\s-]*A\/C\s*/i, "");
          // Remove "POP" variations at the end
          s = s.replace(/\s+POP$/i, "");
          return s.trim().toLowerCase();
        };

        const rawSchemeCleaned = cleanRaw(rawScheme);
        
        // Find best match in masterRows using keyword overlap if direct match fails
        let match = masterRows.find(m => (m.scheme_name || "").trim().toLowerCase() === rawSchemeCleaned);
        
        if (!match) {
          // Tokenize and find highest overlap
          const getTokens = (s) => s.toLowerCase().split(/[\s\-_,]+/).filter(t => (t.length > 2 || /^[aceg]$/i.test(t)) && t !== "pension" && t !== "fund" && t !== "scheme" && t !== "limited" && t !== "management" && t !== "company");
          const rawTokens = getTokens(rawSchemeCleaned);
          const rawSchemeLetter = rawTokens.find(t => /^[aceg]$/i.test(t));
          
          let bestMatch = null;
          let maxOverlap = 0;

          masterRows.forEach(m => {
            const mName = (m.scheme_name || "").trim().toLowerCase();
            const mTokens = getTokens(mName);
            const mSchemeLetter = mTokens.find(t => /^[aceg]$/i.test(t));
            
            // If raw has a scheme letter, it MUST match the master's scheme letter if master has one
            if (rawSchemeLetter && mSchemeLetter && rawSchemeLetter !== mSchemeLetter) {
              return;
            }

            const overlap = rawTokens.filter(t => mTokens.includes(t)).length;
            
            if (overlap > maxOverlap) {
              maxOverlap = overlap;
              bestMatch = m;
            }
          });

          // Only accept if at least 2 tokens match or it's a very strong partial match
          if (maxOverlap >= 2) {
            match = bestMatch;
          }
        }

        const formattedDate = formatToISODate(rt.date);
        const type = (rt.type || "buy").toLowerCase().trim();
        const schemeName = match ? match.scheme_name : rt.scheme;

        // Check if exists in nps_transactions (Key variables: scheme_name, date, units & nav rounded to 2 decimal places)
        const exists = (existingTxns || []).some(et => {
          const etUnitsRounded = Math.round((parseFloat(et.units) || 0) * 100);
          const rtUnitsRounded = Math.round((parseFloat(rt.units) || 0) * 100);
          const etNavRounded = Math.round((parseFloat(et.nav) || 0) * 100);
          const rtNavRounded = Math.round((parseFloat(rt.nav) || 0) * 100);

          return et.date === formattedDate &&
                 (et.scheme_name || "").trim().toLowerCase() === (schemeName || "").trim().toLowerCase() &&
                 etUnitsRounded === rtUnitsRounded &&
                 etNavRounded === rtNavRounded;
        });

        return {
          scheme_name: schemeName,
          fund_name: match ? match.fund_name : "",
          account_name: "PM",
          date: formattedDate,
          transaction_type: type,
          units: rt.units,
          nav: rt.nav,
          status: exists ? "nonactive" : "active"
        };
      });

      setEditableEntries(mapped.filter(entry => entry.status === "active"));
      setShowMultipleEntryModal(true);
    } catch (error) {
      alert("Error fetching AM data: " + error.message);
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleUPFetch = async () => {
    setActiveBulkTab("UP");
    setIsBulkLoading(true);
    setCurrentBulkPage(1);
    try {
      const [pdfTxns, existingTxns] = await Promise.all([
        assetAPI.getNpsPdfTransactions(),
        assetAPI.getTransactionsByRange('nps', '1900-01-01', '2100-12-31', 'date')
      ]);

      if (!pdfTxns || pdfTxns.length === 0) {
        alert("No PDF transactions found in nps_pdf table.");
        setIsBulkLoading(false);
        return;
      }

      // Helper to convert DD-MMM-YYYY to YYYY-MM-DD
      const formatToISODate = (dateStr) => {
        if (!dateStr) return "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        
        const parts = dateStr.split("-");
        if (parts.length !== 3) return dateStr;

        const [day, monthStr, year] = parts;
        const months = {
          jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
          jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
        };
        const month = months[monthStr.toLowerCase()];
        if (!month) return dateStr;

        return `${year}-${month}-${day.padStart(2, "0")}`;
      };

      // Map PDF transactions using masterRows
      const mapped = pdfTxns.map(pt => {
        let rawScheme = (pt.scheme || "").trim();
        const cleanRaw = (str) => {
          let s = str.toUpperCase();
          s = s.replace(/^NPS TRUST[\s-]*A\/C\s*/i, "");
          s = s.replace(/\s+POP$/i, "");
          return s.trim().toLowerCase();
        };

        const rawSchemeCleaned = cleanRaw(rawScheme);
        let match = masterRows.find(m => (m.scheme_name || "").trim().toLowerCase() === rawSchemeCleaned);
        
        if (!match) {
          const getTokens = (s) => s.toLowerCase().split(/[\s\-_,]+/).filter(t => (t.length > 2 || /^[aceg]$/i.test(t)) && t !== "pension" && t !== "fund" && t !== "scheme" && t !== "limited" && t !== "management" && t !== "company");
          const rawTokens = getTokens(rawSchemeCleaned);
          const rawSchemeLetter = rawTokens.find(t => /^[aceg]$/i.test(t));

          let bestMatch = null;
          let maxOverlap = 0;

          masterRows.forEach(m => {
            const mName = (m.scheme_name || "").trim().toLowerCase();
            const mTokens = getTokens(mName);
            const mSchemeLetter = mTokens.find(t => /^[aceg]$/i.test(t));

            // If raw has a scheme letter, it MUST match the master's scheme letter if master has one
            if (rawSchemeLetter && mSchemeLetter && rawSchemeLetter !== mSchemeLetter) {
              return;
            }

            const overlap = rawTokens.filter(t => mTokens.includes(t)).length;
            if (overlap > maxOverlap) {
              maxOverlap = overlap;
              bestMatch = m;
            }
          });

          if (maxOverlap >= 2) {
            match = bestMatch;
          }
        }

        const formattedDate = formatToISODate(pt.date);
        const type = (pt.type || "buy").toLowerCase().trim();
        const schemeName = match ? match.scheme_name : pt.scheme;

        const exists = (existingTxns || []).some(et => {
          const etUnitsRounded = Math.round((parseFloat(et.units) || 0) * 100);
          const ptUnitsRounded = Math.round((parseFloat(pt.units) || 0) * 100);
          const etNavRounded = Math.round((parseFloat(et.nav) || 0) * 100);
          const ptNavRounded = Math.round((parseFloat(pt.nav) || 0) * 100);

          return et.date === formattedDate &&
                 (et.scheme_name || "").trim().toLowerCase() === (schemeName || "").trim().toLowerCase() &&
                 etUnitsRounded === ptUnitsRounded &&
                 etNavRounded === ptNavRounded;
        });

        return {
          scheme_name: schemeName,
          fund_name: match ? match.fund_name : "",
          account_name: "PM",
          date: formattedDate,
          transaction_type: type,
          units: pt.units,
          nav: pt.nav,
          status: exists ? "nonactive" : "active"
        };
      });

      setEditableEntries(mapped.filter(entry => entry.status === "active"));
      setShowMultipleEntryModal(true);
    } catch (error) {
      alert("Error fetching UP data: " + error.message);
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleEntryChange = (index, field, value) => {
    const newEntries = [...editableEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEditableEntries(newEntries);
  };

  const handleAddRow = () => {
    const newEntries = [
      ...editableEntries,
      {
        scheme_name: "",
        fund_name: "",
        account_name: "",
        date: new Date().toISOString().slice(0, 10),
        transaction_type: "buy",
        units: "",
        nav: "",
        status: "active",
      },
    ];
    setEditableEntries(newEntries);
    // Move to the last page where the new row is added
    const lastPage = Math.ceil(newEntries.length / rowsPerPage);
    setCurrentBulkPage(lastPage);
  };

  const handleMultipleEntryUpdate = async () => {
    try {
      const activeRows = editableEntries.filter(entry => (entry.status || 'active') === 'active');
      
      if (activeRows.length === 0) {
        alert("No active rows to save.");
        return;
      }

      const newRows = activeRows.map(entry => ({
        scheme_name: entry.scheme_name,
        fund_name: entry.fund_name,
        account_name: entry.account_name,
        date: entry.date,
        units: entry.units ? parseFloat(entry.units) : null,
        nav: entry.nav ? parseFloat(entry.nav) : null,
        transaction_type: (entry.transaction_type || "buy").toString().trim().toLowerCase(),
        created_at: new Date().toISOString(),
      }));

      await assetAPI.addBulkTransactions('nps', newRows);

      alert(`${newRows.length} transactions added successfully!`);
      await assetAPI.invalidateCache('nps');
      await new Promise(resolve => setTimeout(resolve, 500));
      setShowMultipleEntryModal(false);
      onSuccess?.();
      onClose?.();
    } catch (error) {
      alert("Error adding multiple transactions: " + error.message);
    }
  };

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!schemeName || !fundName || !accountName || !buyDate || !units || !buyNav) {
      alert("Please fill Scheme, Fund Name, Account Name, Date, Units and NAV");
      return;
    }

    try {
      const payload = {
        scheme_name: schemeName || null,
        fund_name: fundName || null,
        account_name: accountName || null,
        date: buyDate,
        units: units ? parseFloat(units) : null,
        nav: buyNav ? parseFloat(buyNav) : null,
        transaction_type: (transactionType || "buy").toString().trim().toLowerCase(),
        created_at: new Date().toISOString(),
      };

      await assetAPI.addTransaction('nps', payload);

      alert("NPS Transaction added successfully");
      await assetAPI.invalidateCache('nps');
      await new Promise(resolve => setTimeout(resolve, 500));
      onSuccess?.();
      onClose?.();
    } catch (error) {
      alert("Error saving NPS transaction: " + error.message);
    }
  };

  // Convert various Excel date representations to YYYY-MM-DD
  const excelDateToISO = (val) => {
    if (!val) return null;
    if (typeof val === "number") {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      return d.toISOString().slice(0, 10);
    }
    const d = new Date(val);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  };

  // Bulk upload from Excel (first worksheet)
  const handleNpsPdfProcess = async () => {
    if (!npsPdfFile) {
      alert("Please select a PDF file first.");
      return;
    }

    setIsProcessingPdf(true);
    try {
      const formData = new FormData();
      formData.append("file", npsPdfFile);

      const result = await assetAPI.uploadNpsPdf(formData);
      toast.success(`${result.added} transactions inserted successfully!`);
      
      setShowPdfModal(false);
      setNpsPdfFile(null);
      onSuccess?.();
    } catch (error) {
      console.error("Error processing NPS PDF:", error);
      toast.error(error.response?.data?.error || error.message || "Failed to process NPS PDF");
    } finally {
      setIsProcessingPdf(false);
    }
  };

  const handleFetchNps = async () => {
    if (!fetchFy) {
      toast.error("Please enter Financial Year (e.g., 2023-24)");
      return;
    }

    setIsFetchingNps(true);
    try {
      const result = await assetAPI.initNpsFetch();
      setCaptchaImage(result.captchaBase64);
      setSessionId(result.sessionId);
      setStep(2);
    } catch (error) {
      console.error("Error initializing NPS fetch:", error);
      toast.error(error.response?.data?.error || error.message || "Failed to start NPS session");
    } finally {
      setIsFetchingNps(false);
    }
  };

  const handleSubmitCaptcha = async () => {
    if (!captchaValue) {
      toast.error("Please enter captcha value");
      return;
    }

    setIsFetchingNps(true);
    setFetchProgress(10);
    setFetchStatus("Logging in and fetching transactions...");

    const messages = [
      "Authenticating session...",
      "Navigating to Transaction Statement...",
      "Selecting Financial Year...",
      "Generating transaction report...",
      "Extracting transaction details...",
      "Cleaning and normalizing data...",
      "Saving transactions to database..."
    ];

    let currentMsgIndex = 0;
    const progressTimer = setInterval(() => {
      setFetchProgress(prev => {
        if (prev < 95) return prev + Math.floor(Math.random() * 5 + 1);
        return prev;
      });
      if (currentMsgIndex < messages.length - 1) {
        currentMsgIndex++;
        setFetchStatus(messages[currentMsgIndex]);
      }
    }, 4000);

    try {
      const result = await assetAPI.submitNpsCaptcha({
        sessionId,
        captchaValue,
        fy: fetchFy
      });
      
      clearInterval(progressTimer);
      setFetchProgress(100);
      setFetchStatus("Successfully fetched and saved!");
      
      toast.success(result.message);
      
      // Delay closing to show 100% progress
      setTimeout(() => {
        setShowFetchModal(false);
        resetFetchState();
        onSuccess?.();
      }, 1500);
    } catch (error) {
      clearInterval(progressTimer);
      setFetchProgress(0);
      setFetchStatus("");
      
      console.error("Error submitting NPS captcha:", error);
      if (error.response?.data?.retry) {
          toast.error(error.response.data.error + ". Please try new captcha.");
          setCaptchaImage(error.response.data.captchaBase64);
          setCaptchaValue("");
      } else {
          toast.error(error.response?.data?.error || error.message || "Fetch failed");
          resetFetchState();
      }
    } finally {
      setIsFetchingNps(false);
    }
  };

  const resetFetchState = () => {
    setFetchFy("");
    setCaptchaImage(null);
    setCaptchaValue("");
    setSessionId(null);
    setStep(1);
    setFetchStatus("");
    setFetchProgress(0);
  };

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

      // Helper lookups
      const formatted = rows
        .map((r) => {
          const sn = (r.scheme_name || "").toString().trim();
          const fn = (r.fund_name || "").toString().trim() || null;
          const rawAccount = r.account_name ?? r.Account_Name ?? "";
          const account = rawAccount ? rawAccount.toString().trim() : "";
          return {
            scheme_name: sn || null,
            fund_name: fn,
            account_name: account || null,
            date: r.date ? excelDateToISO(r.date) : null,
            units: r.units ? parseFloat(r.units) : null,
            nav: r.nav ? parseFloat(r.nav) : null,
            transaction_type: (r.transaction_type || "buy").toString().trim().toLowerCase(),
            created_at: new Date().toISOString(),
          };
        })
        .filter((row) => row.scheme_name && row.date && row.units != null && row.nav != null);

      if (!formatted.length) {
        alert("No valid rows to upload. Ensure columns: scheme_name, account_name, date, units, nav, transaction_type (buy/sell/charges).");
        return;
      }

      await assetAPI.addBulkTransactions('nps', formatted);
      
      alert("NPS Transactions uploaded successfully!");
      await assetAPI.invalidateCache('nps');
      await new Promise(resolve => setTimeout(resolve, 500));
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error("Excel upload error:", err);
      alert("Invalid Excel file or format. Please check the headers.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Download a two-sheet Excel template
  const handleDownloadTemplate = async () => {
    // First sheet headers and example rows
    const mainData = [
      {
        scheme_name: "KOTAK PENSION FUND SCHEME E - TIER I",
        fund_name: "KOTAK-E",
        account_name: "PM",
        date: "2025-07-15",
        units: "",
        nav: "",
        transaction_type: "buy",
      },
      {
        scheme_name: "HDFC PENSION MANAGEMENT COMPANY LIMITED SCHEME C - TIER I",
        fund_name: "HDFC-C",
        account_name: "PM",
        date: "2025-07-15",
        units: 10.5,
        nav: 100.25,
        transaction_type: "buy",
      },
      {
        scheme_name: "KOTAK PENSION FUND SCHEME E - TIER I",
        fund_name: "KOTAK-E",
        account_name: "PM",
        date: "2025-07-15",
        units: "",
        nav: "",
        transaction_type: "charges",
      },
      {
        scheme_name: "HDFC PENSION MANAGEMENT COMPANY LIMITED SCHEME C - TIER I",
        fund_name: "HDFC-C",
        account_name: "PM",
        date: "2025-07-15",
        units: 10.5,
        nav: 100.25,
        transaction_type: "charges",
      },
    ];

    // Fetch allowed scheme and fund names from master
    const schemes = await assetAPI.getNPSMaster();

    // Allowed combinations include example account names for reference
    const allowed = (schemes || []).map((s) => ({
      scheme_name: s.scheme_name,
      fund_name: s.fund_name,
      account_name: "",
    }));

    const wb = XLSX.utils.book_new();
    const wsMain = XLSX.utils.json_to_sheet(mainData);
    const wsAllowed = XLSX.utils.json_to_sheet(
      allowed.length
        ? allowed
        : [
            {
              scheme_name: "SBI Pension Fund Scheme E-Tier I",
              fund_name: "SBI Pension Fund",
              account_name: "Tier I",
            },
          ]
    );

    XLSX.utils.book_append_sheet(wb, wsMain, "EnterTransactions");
    XLSX.utils.book_append_sheet(wb, wsAllowed, "AllowedSchemes");

    XLSX.writeFile(wb, "nps_transactions_template.xlsx");
  };

  return (
    <>
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-1">
      <div className="bg-gray-900 border border-gray-800 rounded-[2rem] shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mt-6 mb-2" />
        <div className="px-8 py-2 border-b border-gray-800 flex flex-col gap-4">
          <h3 className="text-2xl font-bold text-white tracking-tight">Add NPS Transaction</h3>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-pink-500/10 text-pink-500 hover:bg-pink-500 hover:text-white transition-all duration-200 border border-pink-500/20 shadow-lg shadow-pink-900/10"
              onClick={() => fileInputRef.current?.click()}
              title="Upload Excel (bulk)"
            >
              <Upload size={18} />
            </button>
            <button
              type="button"
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all duration-200 border border-indigo-500/20 shadow-lg shadow-indigo-900/10"
              onClick={handleDownloadTemplate}
              title="Download Excel template"
            >
              <Download size={18} />
            </button>
            <button
              type="button"
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all duration-200 border border-blue-500/20 shadow-lg shadow-blue-900/10 font-bold"
              onClick={handleOpenMultipleEntryModal}
              title="Add Multiple Entries"
            >
              M
            </button>
            <button
              type="button"
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all duration-200 border border-emerald-500/20 shadow-lg shadow-emerald-900/10 font-bold"
              onClick={() => setShowContributionForm(true)}
              title="Add Contribution"
            >
              C
            </button>
            <button
              type="button"
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white transition-all duration-200 border border-amber-500/20 shadow-lg shadow-amber-900/10 font-bold"
              onClick={() => setShowPdfModal(true)}
              title="Upload NPS PDF (CAS)"
            >
              <FileText size={18} />
            </button>
            <button
              type="button"
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500 hover:text-white transition-all duration-200 border border-cyan-500/20 shadow-lg shadow-cyan-900/10"
              onClick={() => setShowFetchModal(true)}
              title="Fetch NPS Online"
            >
              <Globe size={18} />
            </button>
          </div>
        </div>

        <form className="flex-1 overflow-y-auto px-8 py-6 space-y-5" onSubmit={handleSubmit}>
          {/* Scheme (autocomplete) */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Scheme</label>
            <div className="relative">
              <input
                ref={inputRef}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                type="text"
                placeholder="Type scheme name..."
                value={schemeName}
                onChange={(e) => {
                  setSchemeName(e.target.value);
                  handleSchemeInput(e.target.value);
                  setShowOptions(true);
                }}
                onFocus={() => setShowOptions(true)}
                onBlur={() => setTimeout(() => setShowOptions(false), 150)}
                onKeyDown={handleKeyDown}
                required
              />
              {showOptions && filteredSchemes.length > 0 && (
                <ul className="absolute z-50 w-full max-h-48 overflow-y-auto border border-gray-700 rounded-xl bg-gray-800 shadow-2xl mt-1.5 backdrop-blur-sm overflow-hidden">
                  {filteredSchemes.map((s, idx) => (
                    <li
                      key={s.scheme_name}
                      className={`px-4 py-3.5 cursor-pointer hover:bg-white/[0.05] transition-colors border-b border-gray-700/50 last:border-0 ${idx === highlightedIndex ? "bg-white/[0.05]" : ""}`}
                      onMouseDown={() => {
                        setSchemeCode(s.scheme_code);
                        setSchemeName(s.scheme_name || "");
                        setShowOptions(false);
                      }}
                    >
                      <div className="text-sm font-medium text-gray-200">{s.scheme_name}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Fund Name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Fund Name</label>
            <select
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
              value={fundName}
              onChange={(e) => setFundName(e.target.value)}
              required
            >
              <option value="" disabled>Select a fund</option>
              {fundOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

         {/* Account Name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Account Name</label>
            {isAddingAccount ? (
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="New account name..."
                  autoFocus
                />
                <button
                  type="button"
                  className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium"
                  onClick={confirmAddAccount}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="px-4 py-2 text-sm bg-gray-800 text-gray-400 rounded-xl hover:bg-gray-700 transition-colors border border-gray-700"
                  onClick={cancelAddAccount}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  required
                >
                  <option value="" disabled>Select account</option>
                  {accountOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="px-4 py-2 text-sm bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl hover:bg-blue-600 hover:text-white transition-all font-medium"
                  onClick={startAddAccount}
                >
                  + New
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">Date</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all [color-scheme:dark]"
                type="date"
                value={buyDate}
                onChange={(e) => setBuyDate(e.target.value)}
                required
              />
            </div>

            {/* Transaction Type */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">Type</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer"
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                required
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
                <option value="charges">Charges</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Units */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">Units</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                type="number"
                step="0.0001"
                placeholder="0.0000"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                required
              />
            </div>

            {/* NAV */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">NAV</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={buyNav}
                onChange={(e) => setBuyNav(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Footer */}
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
              className="flex-1 px-6 py-1 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-900/20"
            >
              Save Transaction
            </button>
          </div>
        </form>
      </div>
    </div>

    {showContributionForm && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-[2rem] shadow-2xl w-full max-w-sm p-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-6" />
          <h3 className="text-xl font-bold text-white mb-6">Add NPS Contribution</h3>
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              try {
                const payload = {
                  amount: parseFloat(formData.get("amount")) || 0,
                  date: formData.get("date"),
                  created_at: new Date().toISOString(),
                };

                await assetAPI.addContribution('nps', payload);
                alert("Contribution added successfully!");
                setShowContributionForm(false);
                onSuccess?.();
              } catch (error) {
                alert("Error saving contribution: " + error.message);
              }
            }}
          >
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">Date</label>
              <input
                name="date"
                type="date"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all [color-scheme:dark]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">Amount</label>
              <input
                name="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                required
              />
            </div>

            <div className="flex gap-3 pt-6 border-t border-gray-800">
              <button
                type="button"
                className="flex-1 px-6 py-3.5 bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors border border-gray-700 font-medium"
                onClick={() => setShowContributionForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-bold shadow-lg shadow-emerald-900/20"
              >
                Save Record
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {showMultipleEntryModal && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-0">
        <div className="bg-gray-900 border border-gray-800 rounded-[2rem] shadow-2xl w-full max-w-6xl max-h-[100vh] flex flex-col animate-in fade-in zoom-in-95 duration-300">
          <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mt-2 mb-2" />
          <div className="px-8 py-2 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-2xl font-bold text-white tracking-tight">Bulk Entries</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenMultipleEntryModal}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                    activeBulkTab === "LM" 
                      ? "bg-blue-500 text-white border-blue-400 animate-pulse ring-2 ring-blue-500/50" 
                      : "bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500 hover:text-white"
                  }`}
                  title="Last Month (LM)"
                >
                  LM
                </button>
                <button
                  onClick={handleAMFetch}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                    activeBulkTab === "AM" 
                      ? "bg-emerald-500 text-white border-emerald-400 animate-pulse ring-2 ring-emerald-500/50" 
                      : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white"
                  }`}
                  title="All Months (AM)"
                >
                  AM
                </button>
                <button
                  onClick={handleUPFetch}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                    activeBulkTab === "UP" 
                      ? "bg-amber-500 text-white border-amber-400 animate-pulse ring-2 ring-amber-500/50" 
                      : "bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500 hover:text-white"
                  }`}
                  title="Upload (UP)"
                >
                  UP
                </button>
              </div>
            </div>
            <button 
              onClick={() => setShowMultipleEntryModal(false)} 
              className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-red-400 hover:border-red-500/50 transition-all"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 relative">
            {isBulkLoading && (
              <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-blue-400 font-medium animate-pulse">Refreshing data...</p>
              </div>
            )}
            <div className="rounded-xl border border-gray-800 bg-gray-950/50 overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse min-w-[1100px]">
                <thead>
                  <tr className="bg-gray-800/50">
                    <th className="py-4 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center w-10">#</th>
                    <th className="py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider min-w-[10px]">Scheme Name</th>
                    <th className="py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider min-w-[100px]">Fund Name</th>
                    <th className="py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Account</th>
                    <th className="py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider min-w-[100px]">Units</th>
                    <th className="py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider min-w-[100px]">NAV</th>
                    <th className="py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider min-w-[100px]">Status</th>
                    <th className="py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider min-w-[100px]">Total Units</th>
                    <th className="py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {editableEntries
                    .slice((currentBulkPage - 1) * rowsPerPage, currentBulkPage * rowsPerPage)
                    .map((entry, pIdx) => {
                      const idx = (currentBulkPage - 1) * rowsPerPage + pIdx;
                      return (
                        <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-3 text-center text-gray-500 font-medium tabular-nums border-r border-gray-800/50">
                            {idx + 1}
                          </td>
                      <td className="py-3 px-3">
                        <select
                          value={entry.scheme_name || ""}
                          onChange={(e) => handleEntryChange(idx, "scheme_name", e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
                        >
                          <option value="">Select Scheme</option>
                          {schemeOptions.map((s) => (
                            <option key={s.scheme_code} value={s.scheme_name}>{s.scheme_name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={entry.fund_name || ""}
                          onChange={(e) => handleEntryChange(idx, "fund_name", e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
                        >
                          <option value="">Select Fund</option>
                          {allFunds.map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={entry.account_name || ""}
                          onChange={(e) => handleEntryChange(idx, "account_name", e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
                        >
                          <option value="">Select Account</option>
                          {accountOptions.map((acc) => (
                            <option key={acc} value={acc}>{acc}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        <input
                          type="date"
                          value={entry.date || ""}
                          onChange={(e) => handleEntryChange(idx, "date", e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none [color-scheme:dark]"
                        />
                      </td>
                      <td className="py-3 px-3">
                         <select
                          value={entry.transaction_type || "buy"}
                          onChange={(e) => handleEntryChange(idx, "transaction_type", e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
                        >
                          <option value="buy">Buy</option>
                          <option value="sell">Sell</option>
                          <option value="charges">Charges</option>
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          step="0.0001"
                          value={entry.units || ""}
                          onChange={(e) => handleEntryChange(idx, "units", e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                          placeholder="0.0000"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          step="0.01"
                          value={entry.nav || ""}
                          onChange={(e) => handleEntryChange(idx, "nav", e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          entry.status === 'active' 
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}>
                          {entry.status || 'active'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {(() => {
                          const schemeName = (entry.scheme_name || "").trim().toLowerCase();
                          const key = schemeName;
                          const totalUnits = fundTotalUnits[key] ?? 0;
                          const formattedUnits = parseFloat(totalUnits).toFixed(2);
                          
                          return (
                            <input 
                              type="number" 
                              step="0.01"
                              value={formattedUnits}
                              disabled
                              className="w-full bg-gray-900 border border-gray-800 text-gray-500 rounded-lg p-2 text-sm cursor-not-allowed"
                            />
                          );
                        })()}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={handleAddRow}
                            className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors border border-transparent hover:border-emerald-500/20"
                            title="Add Row"
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newEntries = editableEntries.filter((_, i) => i !== idx);
                              setEditableEntries(newEntries);
                              // Adjust page if the current page becomes empty
                              const maxPage = Math.max(1, Math.ceil(newEntries.length / rowsPerPage));
                              if (currentBulkPage > maxPage) {
                                setCurrentBulkPage(maxPage);
                              }
                            }}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                            title="Remove Row"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {editableEntries.length > rowsPerPage && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-900/30 rounded-xl mt-2 border border-gray-800">
                <button
                  onClick={() => setCurrentBulkPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentBulkPage === 1}
                  className="p-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <svg size={16} fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>

                <div className="text-xs text-gray-500">
                  Showing <span className="text-gray-300">{(currentBulkPage - 1) * rowsPerPage + 1}</span> to <span className="text-gray-300">{Math.min(currentBulkPage * rowsPerPage, editableEntries.length)}</span> of <span className="text-gray-300">{editableEntries.length}</span> entries
                </div>

                <button
                  onClick={() => setCurrentBulkPage(prev => Math.min(prev + 1, Math.ceil(editableEntries.length / rowsPerPage)))}
                  disabled={currentBulkPage === Math.ceil(editableEntries.length / rowsPerPage)}
                  className="p-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <svg size={16} fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}

            {editableEntries.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No entries to display. Click Add Row to start.
              </div>
            )}
          </div>

          <div className="px-8 py-6 border-t border-gray-800 flex flex-col gap-4 bg-gray-900/50">
            <p className="text-gray-500 text-sm">
              Total Transactions: <span className="text-white font-medium">{editableEntries.length}</span>
            </p>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setShowMultipleEntryModal(false)}
                className="px-6 py-2.5 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-all border border-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMultipleEntryUpdate}
                className="px-8 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={editableEntries.length === 0}
              >
                Save All Transactions
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    {showPdfModal && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-[2rem] shadow-2xl w-full max-w-sm p-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-6" />
          <h3 className="text-xl font-bold text-white mb-6">Process NPS PDF</h3>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">NPS PDF File</label>
              <input
                type="file"
                accept=".pdf"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                onChange={(e) => setNpsPdfFile(e.target.files?.[0])}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowPdfModal(false);
                  setNpsPdfFile(null);
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-all border border-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNpsPdfProcess}
                disabled={!npsPdfFile || isProcessingPdf}
                className="flex-1 px-4 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessingPdf ? "Processing..." : "Process PDF"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    {showFetchModal && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-[2rem] shadow-2xl w-full max-w-sm p-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-6" />
          <h3 className="text-xl font-bold text-white mb-6">Fetch NPS Online</h3>
          
          <div className="space-y-5">
            {step === 1 ? (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-400 ml-1">Financial Year (FY)</label>
                <input
                  type="text"
                  placeholder="e.g., 2023-24"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={fetchFy}
                  onChange={(e) => setFetchFy(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center shadow-inner">
                   <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider text-center">Enter Captcha Shown Below</p>
                   {captchaImage && (
                     <img 
                       src={`data:image/png;base64,${captchaImage}`} 
                       alt="Captcha" 
                       className="max-h-20 object-contain rounded-lg border border-gray-100 shadow-sm"
                     />
                   )}
                </div>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="Enter Captcha Answer"
                    className="w-full bg-gray-800 border border-gray-700 text-white text-center text-lg font-bold rounded-xl p-3.5 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                    value={captchaValue}
                    onChange={(e) => setCaptchaValue(e.target.value)}
                    autoFocus
                  />
                </div>
                {isFetchingNps && (
                  <div className="space-y-3 py-2">
                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden shadow-inner">
                      <div 
                        className="bg-gradient-to-r from-cyan-600 to-blue-500 h-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                        style={{ width: `${fetchProgress}%` }}
                      />
                    </div>
                    {fetchStatus && (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-cyan-400 font-medium animate-pulse tracking-wide uppercase">{fetchStatus}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowFetchModal(false);
                  resetFetchState();
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-all border border-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={step === 1 ? handleFetchNps : handleSubmitCaptcha}
                disabled={(step === 1 ? !fetchFy : !captchaValue) || isFetchingNps}
                className="flex-1 px-4 py-3 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-700 transition-all shadow-lg shadow-cyan-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isFetchingNps ? (step === 1 ? "Connecting..." : "Fetching...") : (step === 1 ? "Next" : "Submit & Fetch")}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};


export default NPSForm;