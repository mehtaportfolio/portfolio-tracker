import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { stockAPI } from "../../../api/stockAPI.js";
import { Plus, Upload, Download, PenSquare, Trash2, Settings, X, Copy } from "lucide-react";
import * as XLSX from "xlsx";
import usePersistentDraft from "../../../hooks/usePersistentDraft.jsx";
import { useNavigation } from "../../../context/NavigationContext.jsx";
import EPIcon from "./EPIcon.jsx";

const STOCK_FORM_STORAGE_KEY = "stock_transaction_form_draft_v1";
const STOCK_FORM_INITIAL_STATE = {
  stockName: "",
  accountName: "",
  accountType: "regular",
  equityType: "stock",
  brokerName: "",
  buyDate: "",
  quantity: "",
  buyPrice: "",
};

const ADD_STOCK_STORAGE_KEY = "stock_add_modal_draft_v1";
const ADD_STOCK_INITIAL_STATE = {
  symbol: "",
  stock_name: "",
  industry: "",
  sector: "",
  macro_sector: "",
  known_sector: "",
  basic_industry: "",
  equity_type: "stock",
  symbol_token: "",
  exchange: "nse",
  isin: "",
};

const RENAME_STOCK_STORAGE_KEY = "stock_rename_modal_draft_v1";
const RENAME_STOCK_INITIAL_STATE = {
  selectedSymbol: "",
  searchQuery: "",
  isinQuery: "",
  newStockName: "",
  newSymbol: "",
};

const BULK_ADD_STORAGE_KEY = "stock_bulk_add_modal_draft_v1";

const EQUITY_CHARGES_STORAGE_KEY = "equity_charges_modal_draft_v1";
const EQUITY_CHARGES_INITIAL_STATE = {
  view: "add",
  showTable: false,
  accountName: "",
  year: "",
  fy: "",
  dpCharges: "",
  otherCharges: "",
};

const StockForm = ({ onClose, onSuccess }) => {
  const { setIsBottomBarHidden } = useNavigation();
  // --- STATES ---
  const [formDraft, setFormDraft, resetFormDraft] = usePersistentDraft(
    STOCK_FORM_STORAGE_KEY,
    STOCK_FORM_INITIAL_STATE
  );

  const [showEPModal, setShowEPModal] = useState(false);

  useEffect(() => {
    setIsBottomBarHidden(true);
    return () => setIsBottomBarHidden(false);
  }, [setIsBottomBarHidden]);

  // Disable body scroll when EP Modal is open
  useEffect(() => {
    if (showEPModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showEPModal]);

  const {
    stockName,
    accountName,
    accountType,
    equityType,
    brokerName,
    buyDate,
    quantity,
    buyPrice,
  } = formDraft;
  const setStockName = (value) =>
    setFormDraft((prev) => ({ ...prev, stockName: value }));
  const setAccountName = (value) =>
    setFormDraft((prev) => ({ ...prev, accountName: value }));
  const setAccountType = (value) =>
    setFormDraft((prev) => ({ ...prev, accountType: value }));
  const setEquityType = (value) =>
    setFormDraft((prev) => ({ ...prev, equityType: value }));
  const setBrokerName = (value) =>
    setFormDraft((prev) => ({ ...prev, brokerName: value }));
  const setBuyDate = (value) =>
    setFormDraft((prev) => ({ ...prev, buyDate: value }));
  const setQuantity = (value) =>
    setFormDraft((prev) => ({ ...prev, quantity: value }));
  const setBuyPrice = (value) =>
    setFormDraft((prev) => ({ ...prev, buyPrice: value }));
  const [stockOptions, setStockOptions] = useState([]);
  const [filteredStocks, setFilteredStocks] = useState([]);
  const [showOptions, setShowOptions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showIsinMismatchModal, setShowIsinMismatchModal] = useState(false);
  const [showChargesModal, setShowChargesModal] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [accountOptions, setAccountOptions] = useState([]);
  const [brokerOptions, setBrokerOptions] = useState([]);
  const [stockMasterCache, setStockMasterCache] = useState([]);
  const [isinMismatches, setIsinMismatches] = useState([]);
  const [isinMismatchLoading, setIsinMismatchLoading] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Close on ESC
  const handleCloseModal = useCallback(() => {
    resetFormDraft();
    onClose?.();
  }, [onClose, resetFormDraft]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") handleCloseModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleCloseModal]);

  // --- FETCH STOCK NAMES ---
  const fetchStockNames = useCallback(async () => {
    try {
      const { data } = await stockAPI.fetchStockMaster();
      if (data) {
        const names = data.map((s) => s.stock_name).filter(Boolean);
        setStockOptions(names);
        setFilteredStocks(names);
        setStockMasterCache(data);
      }
    } catch (error) {
      console.error("Error fetching stock master:", error);
    }
  }, []);

  useEffect(() => {
    fetchStockNames();
  }, [fetchStockNames]);



useEffect(() => {
  const fetchAccounts = async () => {
    try {
      const { data } = await stockAPI.getAccountNames();
      if (data) {
        setAccountOptions(data);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  };
  const fetchBrokers = async () => {
    try {
      const { data } = await stockAPI.fetchDistinctValues("broker_name");
      if (data) {
        setBrokerOptions(data);
      }
    } catch (error) {
      console.error("Error fetching brokers:", error);
    }
  };
  fetchAccounts();
  fetchBrokers();
}, []);


  // --- HANDLE SUBMIT ---
  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    try {
      await stockAPI.addTransaction({
        stock_name: stockName,
        account_name: accountName,
        account_type: accountType,
        equity_type: equityType,
        broker_name: brokerName,
        buy_date: buyDate || null,
        quantity: quantity ? parseInt(quantity) : null,
        buy_price: buyPrice ? parseFloat(buyPrice) : null,
      });
      alert("Transaction added successfully");
      onSuccess?.();
      handleCloseModal();
    } catch (error) {
      alert("Error saving transaction: " + error.message);
    }
  };

  // --- KEYDOWN for autocomplete ---
  const handleKeyDown = (e) => {
    if (!showOptions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredStocks.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredStocks.length) {
        setStockName(filteredStocks[highlightedIndex]);
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
        stock_name: r.stock_name ?? null,
        account_name: r.account_name ?? null,
        account_type: r.account_type ?? null,
        equity_type: r.equity_type ?? null,
        broker_name: r.broker_name ?? null,
        buy_date: r.buy_date ? excelDateToISO(r.buy_date) : null,
        quantity:
          r.quantity !== undefined && r.quantity !== null
            ? parseInt(r.quantity)
            : null,
        buy_price:
          r.buy_price !== undefined && r.buy_price !== null
            ? parseFloat(r.buy_price)
            : null,
      }));

      const { error } = await stockAPI.bulkAddTransactions(formatted);
      if (error) {
        alert("Error uploading transactions: " + error.message);
        return;
      }

      alert("Transactions uploaded successfully!");
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
const handleDownloadSample = async () => {
  // 1. Sample transaction row
  const mainData = [
    {
      stock_name: "RELIANCE",
      account_name: "PM",
      account_type: "regular",
      equity_type: "stock",
      broker_name: "zerodha",
      buy_date: "2025-01-01",
      quantity: 10,
      buy_price: 2500.5,
    },
  ];


  // 2. Fetch stock_name list from stock_master
  const { data: stockList } = await stockAPI.fetchStockMaster();

  const stockData = stockList ? stockList.map((s) => ({ stock_name: s.stock_name })) : [];

// 3. Reference data for account names / types

    const referenceData = [
      { account_name: "PM", account_type: "regular", equity_type: "stock", broker_name: "zerodha" },
      { account_name: "PDM", account_type: "free", equity_type: "etf", broker_name: "angel" },
    ];
// 4. Build workbook

  const wb = XLSX.utils.book_new();
  const wsMain = XLSX.utils.json_to_sheet(mainData);
  const wsStocks = XLSX.utils.json_to_sheet(stockData.length ? stockData : [{ stock_name: "TCS" }]);
  const wsRef = XLSX.utils.json_to_sheet(referenceData);

  XLSX.utils.book_append_sheet(wb, wsMain, "SampleTransactions");
  XLSX.utils.book_append_sheet(wb, wsStocks, "StockNames");   // 👈 all stock_name values
  XLSX.utils.book_append_sheet(wb, wsRef, "AllowedValues");

  // 5. Save file
  XLSX.writeFile(wb, "sample_stock_transactions.xlsx");
  };

  // --- NESTED MODAL (Add Stock) ---
  const AddStockModal = ({ onClose, stockMasterCache, fetchStockNames }) => {
    const [draft, setDraft, resetDraft] = usePersistentDraft(
      ADD_STOCK_STORAGE_KEY,
      ADD_STOCK_INITIAL_STATE
    );
    const { symbol, stock_name, industry, sector, macro_sector, known_sector, basic_industry, equity_type, symbol_token, isin } = draft;
    const [exchange, setExchangeDraft] = useState(draft.exchange || 'nse');
    const [sectorOptions, setSectorOptions] = useState([]);
    const [industryOptions, setIndustryOptions] = useState([]);
    const [macroSectorOptions, setMacroSectorOptions] = useState([]);
    const [knownSectorOptions, setKnownSectorOptions] = useState([]);
    const [basicIndustryOptions, setBasicIndustryOptions] = useState([]);
    const [originalSymbol, setOriginalSymbol] = useState(null);
    const [duplicateError, setDuplicateError] = useState("");
    const [equityTypeOptions, setEquityTypeOptions] = useState(["stock", "etf", "other"]);
    const [stockSymbolsCache, setStockSymbolsCache] = useState(null);
    const [isIsinManual, setIsinManual] = useState(false);
    const symbolFetchRef = useRef(null);
    const isinFetchRef = useRef(null);
    const lastStockNameForIsin = useRef("");

    const setStockName = useCallback(
      (value) => {
        setDraft((prev) => ({ ...prev, stock_name: value }));
        setDuplicateError("");
      },
      [setDraft]
    );
    const setSector = useCallback(
      (value) => setDraft((prev) => ({ ...prev, sector: value })),
      [setDraft]
    );
    const setIndustry = useCallback(
      (value) => setDraft((prev) => ({ ...prev, industry: value })),
      [setDraft]
    );
    const setMacroSector = useCallback(
      (value) => setDraft((prev) => ({ ...prev, macro_sector: value })),
      [setDraft]
    );
    const setKnownSector = useCallback(
      (value) => setDraft((prev) => ({ ...prev, known_sector: value })),
      [setDraft]
    );
    const setBasicIndustry = useCallback(
      (value) => setDraft((prev) => ({ ...prev, basic_industry: value })),
      [setDraft]
    );

    const setSymbol = useCallback(
      (value) => {
        setDraft((prev) => ({ ...prev, symbol: value }));
      },
      [setDraft]
    );

    const setEquityType = useCallback(
      (value) => setDraft((prev) => ({ ...prev, equity_type: value ? String(value).toLowerCase() : value })),
      [setDraft]
    );

    const setIsin = useCallback(
      (value, manual = true) => {
        setDraft((prev) => ({ ...prev, isin: value }));
        if (manual) setIsinManual(true);
      },
      [setDraft]
    );

    const setExchange = useCallback(
      (value) => {
        setDraft((prev) => ({ ...prev, exchange: value }));
        setExchangeDraft(value);
      },
      [setDraft]
    );

    const setSymbolToken = useCallback(
      (value) => setDraft((prev) => ({ ...prev, symbol_token: value })),
      [setDraft]
    );

    const normalizeEquityType = useCallback((val) => {
      if (val === undefined || val === null) return val;
      const s = String(val).trim().toLowerCase();
      // map known variants to canonical forms
      const mapping = {
        stock: "stock",
        stocks: "stock",
        equity: "stock",
        etf: "etf",
        index: "index",
        other: "other",
      };
      return mapping[s] || s;
    }, []);

    const handleClose = useCallback(() => {
      resetDraft();
      setOriginalSymbol(null);
      setDuplicateError("");
      onClose?.();
    }, [onClose, resetDraft]);

    const handleAddOrUpdateStock = async () => {
      if (!stock_name) {
        alert("Stock Name is required");
        return;
      }

      if (!symbol) {
        alert("Symbol is required");
        return;
      }

      // Check for duplicates
      const exists = stockMasterCache.some(
        (item) => 
          item.stock_name?.toLowerCase() === stock_name?.trim().toLowerCase() &&
          item.symbol !== originalSymbol // Allow if we're updating the same stock
      );

      if (exists) {
        setDuplicateError(`Stock name "${stock_name}" already exists in the database.`);
        return;
      }

      const payload = {
        symbol,
        stock_name,
        industry: industry || null,
        sector: sector || null,
        macro_sector: macro_sector || null,
        known_sector: known_sector || null,
        basic_industry: basic_industry || null,
        equity_type: equity_type || null,
        symbol_token: symbol_token || null,
        exchange: String(draft.exchange || exchange || "").toLowerCase() || null,
        isin: isin || null,
      };

      try {
        if (originalSymbol) {
          await stockAPI.updateStockMaster(originalSymbol, payload);
        } else {
          await stockAPI.addStockMaster(payload);
        }
        alert(originalSymbol ? "Stock updated successfully!" : "Stock added successfully!");
        fetchStockNames();
        handleClose();
      } catch (error) {
        alert("Error saving stock: " + error.message);
      }
    };

    const handleStockNameChange = useCallback(
      (value) => {
        setStockName(value);
      },
      [setStockName]
    );

    useEffect(() => {
      const onKey = (e) => {
        if (e.key === "Escape") handleClose();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [handleClose]);

    useEffect(() => {
      const fetchSectors = async () => {
        try {
          const { data } = await stockAPI.fetchDistinctValues("sector");
          if (data) setSectorOptions(data);
        } catch (error) {
          console.error("Error fetching sectors:", error);
        }
      };
      fetchSectors();
    }, []);

    useEffect(() => {
      const fetchEquityTypes = async () => {
        try {
          const { data } = await stockAPI.fetchDistinctValues("equity_type");
          if (data && Array.isArray(data) && data.length) {
            const normalized = data.map((d) => normalizeEquityType(d));
            setEquityTypeOptions((prev) => {
              const base = prev.map((p) => normalizeEquityType(p));
              const combined = Array.from(new Set([...base, ...normalized]));
              // preferred ordering
              const order = ["stock", "etf", "index", "other"];
              combined.sort((a, b) => {
                const ai = order.indexOf(a);
                const bi = order.indexOf(b);
                if (ai === -1 && bi === -1) return a.localeCompare(b);
                if (ai === -1) return 1;
                if (bi === -1) return -1;
                return ai - bi;
              });
              return combined;
            });
          }
        } catch (error) {
          // ignore - fallback to defaults
        }
      };
      fetchEquityTypes();
    }, [normalizeEquityType]);

    useEffect(() => {
      const fetchIndustries = async () => {
        try {
          const { data } = await stockAPI.fetchDistinctValues("industry");
          if (data) setIndustryOptions(data);
        } catch (error) {
          console.error("Error fetching industries:", error);
        }
      };
      fetchIndustries();
    }, []);

    useEffect(() => {
      const fetchMacroSectors = async () => {
        try {
          const { data } = await stockAPI.fetchDistinctValues("macro_sector");
          if (data) setMacroSectorOptions(data);
        } catch (error) {
          console.error("Error fetching macro sectors:", error);
        }
      };
      fetchMacroSectors();
    }, []);

    useEffect(() => {
      const fetchKnownSectors = async () => {
        try {
          const { data } = await stockAPI.fetchDistinctValues("known_sector");
          if (data) setKnownSectorOptions(data);
        } catch (error) {
          console.error("Error fetching known sectors:", error);
        }
      };
      fetchKnownSectors();
    }, []);

    useEffect(() => {
      const fetchBasicIndustries = async () => {
        try {
          const { data } = await stockAPI.fetchDistinctValues("basic_industry");
          if (data) setBasicIndustryOptions(data);
        } catch (error) {
          console.error("Error fetching basic industries:", error);
        }
      };
      fetchBasicIndustries();
    }, []);
    // Fetch stock symbols cache when needed
    const ensureStockSymbols = useCallback(async () => {
      if (stockSymbolsCache) return stockSymbolsCache;
      try {
        const { data } = await stockAPI.fetchStockSymbols();
        if (data) {
          setStockSymbolsCache(data);
          return data;
        }
      } catch (err) {
        console.error('Error fetching stock symbols:', err);
      }
      return null;
    }, [stockSymbolsCache]);

    const findSymbolToken = useCallback((data, name, exch) => {
      if (!data || !name) return null;
      const targetName = String(name).trim().toLowerCase();
      const targetExch = exch ? String(exch).trim().toLowerCase() : null;

      // Try exact name + exchange match first
      let match = data.find((item) => {
        const n = (item.name || item.stock_name || item.symbol || item.symbol_gs || item.symbol_ao || "").toString().trim().toLowerCase();
        const e = (item.exchange || item.exch || item.market || "").toString().trim().toLowerCase();
        if (targetExch && e && e !== targetExch) return false;
        return n === targetName;
      });

      if (!match) {
        // fallback: includes
        match = data.find((item) => {
          const n = (item.name || item.stock_name || item.symbol || "").toString().trim().toLowerCase();
          const e = (item.exchange || item.exch || item.market || "").toString().trim().toLowerCase();
          if (targetExch && e && e !== targetExch) return false;
          return n.includes(targetName) || targetName.includes(n);
        });
      }

      if (!match) return null;
      return (match.symbol_token || match.token || match.symbol || match.symbol_ao || match.symbol_gs || match.id || null);
    }, []);

    // Auto-populate symbol_token when stock_name or exchange changes (debounced)
    useEffect(() => {
      if (symbolFetchRef.current) clearTimeout(symbolFetchRef.current);
      symbolFetchRef.current = setTimeout(async () => {
        try {
          const data = await ensureStockSymbols();
          const token = findSymbolToken(data, stock_name, draft.exchange || exchange);
          if (token) {
            setSymbolToken(token);
          }
        } catch (err) {
          // ignore
        }
      }, 350);
      return () => {
        if (symbolFetchRef.current) clearTimeout(symbolFetchRef.current);
      };
    }, [stock_name, draft.exchange, exchange, ensureStockSymbols, findSymbolToken, setSymbolToken]);

    useEffect(() => {
      if (!stock_name?.trim()) {
        lastStockNameForIsin.current = "";
        if (!isIsinManual) {
          setIsin("", false);
        }
        return;
      }

      if (stock_name === lastStockNameForIsin.current) {
        return;
      }

      lastStockNameForIsin.current = stock_name;
      setIsinManual(false);

      if (isinFetchRef.current) clearTimeout(isinFetchRef.current);
      isinFetchRef.current = setTimeout(async () => {
        try {
          const result = await stockAPI.fetchStockSurveillanceIsin(stock_name);
          if (result?.data?.isin) {
            setIsin(result.data.isin, false);
          } else if (!isIsinManual) {
            setIsin("", false);
          }
        } catch (err) {
          console.error("Error fetching stock surveillance ISIN:", err);
        }
      }, 350);

      return () => {
        if (isinFetchRef.current) clearTimeout(isinFetchRef.current);
      };
    }, [stock_name, setIsin, isIsinManual]);

    useEffect(() => {
      if (!basic_industry) {
        return;
      }

      const matchedRecords = stockMasterCache.filter(
        (item) => item.basic_industry?.toLowerCase() === basic_industry?.toLowerCase()
      );

      if (matchedRecords.length > 0) {
        const firstMatch = matchedRecords[0];
        setMacroSector(firstMatch.macro_sector ?? "");
        setKnownSector(firstMatch.known_sector ?? "");
        setSector(firstMatch.sector ?? "");
        setIndustry(firstMatch.industry ?? "");
      }
    }, [basic_industry, stockMasterCache, setMacroSector, setKnownSector, setSector, setIndustry]);

    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-[60] p-4"
        onClick={handleClose}
      >
        <div
          className="bg-[#1c1c1c] text-white rounded-[2rem] shadow-lg w-full max-w-2xl p-6 flex flex-col max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-300 border border-[#2d2d2d]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-12 h-1.5 bg-[#333333] rounded-full mx-auto mb-6 flex-shrink-0" />
          <h3 className="text-xl font-bold mb-4">Add New Stock</h3>

          <div className="space-y-3">


            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">Exchange</label>
                <select
                  value={draft.exchange || exchange}
                  onChange={(e) => setExchange(e.target.value)}
                  className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <option value="nse" className="bg-[#1c1c1c]">NSE</option>
                  <option value="bse" className="bg-[#1c1c1c]">BSE</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">Equity Type</label>
                <select
                  value={equity_type}
                  onChange={(e) => setEquityType(e.target.value)}
                  className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  {equityTypeOptions.map((opt) => (
                    <option key={opt} value={opt} className="bg-[#1c1c1c]">{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">Symbol Token</label>
                <input
                  placeholder="Symbol Token (exchange id)"
                  value={symbol_token}
                  onChange={(e) => setSymbolToken(e.target.value)}
                  className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium mb-1 text-gray-400">Stock Name</label>
              <input
                placeholder="Stock Name"
                value={stock_name}
                onChange={(e) => handleStockNameChange(e.target.value)}
                className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              {duplicateError && (
                <p className="mt-1 text-xs text-red-500">{duplicateError}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-400">ISIN</label>
              <input
                placeholder="Auto-fill from stock surveillance"
                value={isin}
                onChange={(e) => setIsin(e.target.value)}
                className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              <p className="mt-1 text-xs text-gray-500">
                Automatically populated from stock_surveillance when stock name matches.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-400">Symbol</label>
              <input
                placeholder="Symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-400">Basic Industry</label>
              <input
                list="basicIndustryOptions"
                placeholder="Basic Industry"
                value={basic_industry}
                onChange={(e) => setBasicIndustry(e.target.value)}
                className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              <datalist id="basicIndustryOptions">
                {basicIndustryOptions.map((s, idx) => (
                  <option key={idx} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-400">Macro Sector</label>
              <input
                list="macroSectorOptions"
                placeholder="Macro Sector"
                value={macro_sector}
                onChange={(e) => setMacroSector(e.target.value)}
                className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              <datalist id="macroSectorOptions">
                {macroSectorOptions.map((s, idx) => (
                  <option key={idx} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-400">Known Sector</label>
              <input
                list="knownSectorOptions"
                placeholder="Known Sector"
                value={known_sector}
                onChange={(e) => setKnownSector(e.target.value)}
                className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              <datalist id="knownSectorOptions">
                {knownSectorOptions.map((s, idx) => (
                  <option key={idx} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-400">Sector</label>
              <input
                list="sectorOptions"
                placeholder="Sector"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              <datalist id="sectorOptions">
                {sectorOptions.map((s, idx) => (
                  <option key={idx} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-400">Industry</label>
              <input
                list="industryOptions"
                placeholder="Industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              <datalist id="industryOptions">
                {industryOptions.map((s, idx) => (
                  <option key={idx} value={s} />
                ))}
              </datalist>
            </div>

          </div>

          <div className="flex justify-end space-x-3 mt-8">
            <button
              className="px-6 py-3 rounded-xl bg-[#262626] text-white hover:bg-[#333333] transition-colors font-medium"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              className="px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
              onClick={handleAddOrUpdateStock}
            >
              {originalSymbol ? "Update Stock" : "Add Stock"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const RenameStockModal = ({
    onClose,
    stockMasterCache,
    fetchStockNames,
    setStockMasterCache,
    setStockOptions,
    onOpenIsinMismatch,
    loading,
  }) => {
    const [draft, setDraft, resetDraft] = usePersistentDraft(
      RENAME_STOCK_STORAGE_KEY,
      RENAME_STOCK_INITIAL_STATE
    );
    const {
      selectedSymbol,
      newStockName,
      newSymbol,
      searchQuery,
      isinQuery,
    } = draft;

    const setSelectedSymbol = useCallback(
      (value) => setDraft((prev) => ({ ...prev, selectedSymbol: value })),
      [setDraft]
    );
    const setNewStockName = useCallback(
      (value) => setDraft((prev) => ({ ...prev, newStockName: value })),
      [setDraft]
    );
    const setNewSymbol = useCallback(
      (value) => setDraft((prev) => ({ ...prev, newSymbol: value })),
      [setDraft]
    );
    const setSearchQuery = useCallback(
      (value) => setDraft((prev) => ({ ...prev, searchQuery: value })),
      [setDraft]
    );
    const setIsinQuery = useCallback(
      (value) => setDraft((prev) => ({ ...prev, isinQuery: value })),
      [setDraft]
    );

    const [localCurrentDetails, setLocalCurrentDetails] = useState(null);

    const [showDropdown, setShowDropdown] = useState(false);

    const filteredStockOptions = useMemo(() => {
      if (!searchQuery?.trim()) return stockMasterCache;

      const query = searchQuery.trim().toLowerCase();
      return stockMasterCache.filter((stock) => {
        const nameMatch = stock.stock_name?.toLowerCase()?.includes(query);
        const symbolMatch = stock.symbol?.toLowerCase()?.includes(query);
        return nameMatch || symbolMatch;
      });
    }, [searchQuery, stockMasterCache]);

    const handleSelectStock = useCallback(
      (stock) => {
        setSelectedSymbol(stock.symbol);
        setSearchQuery(`${stock.stock_name} (${stock.symbol})`);
        setShowDropdown(false);
      },
      [setSelectedSymbol, setSearchQuery]
    );

    const handleClose = useCallback(() => {
      resetDraft();
      onClose?.();
    }, [onClose, resetDraft]);

    const [isinLookupLoading, setIsinLookupLoading] = useState(false);
    const [isinLookupError, setIsinLookupError] = useState(null);
    const [skipAutoNewStockName, setSkipAutoNewStockName] = useState(false);

    useEffect(() => {
      if (!selectedSymbol) {
        setLocalCurrentDetails(null);
        setNewSymbol("");
        if (!skipAutoNewStockName) {
          setNewStockName("");
        }
        setSearchQuery("");
        return;
      }

      const details = stockMasterCache.find((item) => item.symbol === selectedSymbol);
      setLocalCurrentDetails(details ?? null);

      if (details) {
        setNewSymbol(details.symbol ?? "");
        if (!skipAutoNewStockName) {
          setNewStockName(details.stock_name ?? "");
        } else {
          setSkipAutoNewStockName(false);
        }
        setSearchQuery(`${details.stock_name} (${details.symbol})`);
      }
    }, [
      selectedSymbol,
      setLocalCurrentDetails,
      setNewSymbol,
      setNewStockName,
      setSearchQuery,
      stockMasterCache,
    ]);

    useEffect(() => {
      const fetchIsinRecord = async () => {
        if (!isinQuery?.trim()) {
          setSelectedSymbol("");
          setSearchQuery("");
          setNewStockName("");
          setIsinLookupError(null);
          return;
        }

        setIsinLookupLoading(true);
        setIsinLookupError(null);

        try {
          const result = await stockAPI.fetchStockSurveillanceByIsin(isinQuery.trim());
          if (result?.data?.master) {
            const masterStock = result.data.master;
            setSelectedSymbol(masterStock.symbol || "");
            setSearchQuery(`${masterStock.stock_name || ''} (${masterStock.symbol || ''})`);
            setSkipAutoNewStockName(!!result?.data?.surveillance?.stock_name);
          } else {
            setSelectedSymbol("");
            setSearchQuery("");
          }

          if (result?.data?.surveillance?.stock_name) {
            setNewStockName(result.data.surveillance.stock_name);
          } else {
            setNewStockName("");
          }
        } catch (error) {
          setSelectedSymbol("");
          setSearchQuery("");
          setNewStockName("");
          setSkipAutoNewStockName(false);
          setIsinLookupError(error.message || 'Unable to lookup ISIN');
        } finally {
          setIsinLookupLoading(false);
        }
      };

      const timeout = setTimeout(fetchIsinRecord, 300);
      return () => clearTimeout(timeout);
    }, [isinQuery]);

    useEffect(() => {
      const onKey = (e) => {
        if (e.key === "Escape") handleClose();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [handleClose]);

    const handleSaveRename = async () => {
      if (!selectedSymbol) {
        alert("Select the existing stock to rename");
        return;
      }

      if (!newStockName) {
        alert("New stock name is required");
        return;
      }

      if (!newSymbol) {
        alert("New symbol is required");
        return;
      }

      try {
        await stockAPI.renameStock(selectedSymbol, {
          newStockName,
          newSymbol,
        });

        alert("Stock renamed successfully!");
        await fetchStockNames();
        handleClose();
      } catch (error) {
        alert("Error renaming stock: " + error.message);
      }
    };

    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-[60] p-4"
        onClick={handleClose}
      >
        <div
          className="bg-[#1c1c1c] text-white rounded-[2rem] shadow-lg w-full max-w-md max-h-[90vh] p-6 flex flex-col overflow-y-auto animate-in fade-in zoom-in-95 duration-300 border border-[#2d2d2d]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-12 h-1.5 bg-[#333333] rounded-full mx-auto mb-6 flex-shrink-0" />
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold">Rename Stock</h3>
            <button
              type="button"
              onClick={onOpenIsinMismatch}
              disabled={loading}
              className="rounded-xl bg-slate-700/90 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-600 transition-colors"
            >
              {loading ? 'Loading…' : 'ISIN'}
            </button>
          </div>

          <label className="block text-sm font-medium text-gray-400 mb-1">ISIN</label>
          <input
            value={isinQuery}
            onChange={(e) => setIsinQuery(e.target.value)}
            placeholder="Enter ISIN to lookup"
            className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 mb-3 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />

          {isinLookupError ? (
            <p className="text-sm text-rose-400 mb-3">{isinLookupError}</p>
          ) : null}

          {isinLookupLoading ? (
            <p className="text-sm text-gray-400 mb-3">Looking up ISIN…</p>
          ) : null}

          <label className="block text-sm font-medium text-gray-400 mb-1">Existing Stock</label>
          <div className="mb-4">
            <label className="sr-only" htmlFor="rename-stock-search">
              Search stock name or symbol
            </label>
            <div className="relative mb-2">
              <input
                id="rename-stock-search"
                type="text"
                placeholder="Search stock name or symbol"
                className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full pr-10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 120)}
              />
              <PenSquare className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            </div>
            <div className="relative">
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setShowDropdown(false)}
              >
                <option value="" className="bg-[#1c1c1c]">Select a stock</option>
                {filteredStockOptions.map((stock) => (
                  <option key={stock.symbol || stock.stock_name} value={stock.symbol} className="bg-[#1c1c1c]">
                    {stock.stock_name} ({stock.symbol})
                  </option>
                ))}
                {!filteredStockOptions.length && (
                  <option disabled value="" className="bg-[#1c1c1c]">
                    No matches found
                  </option>
                )}
              </select>
              {showDropdown && searchQuery && (
                <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-xl border border-[#3d3d3d] bg-[#262626] shadow-xl">
                  {filteredStockOptions.length ? (
                    filteredStockOptions.map((stock) => (
                      <button
                        key={stock.symbol || stock.stock_name}
                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-[#333333] transition-colors"
                        type="button"
                        onMouseDown={() => handleSelectStock(stock)}
                      >
                        <span className="text-white">{stock.stock_name}</span>
                        <span className="text-xs text-gray-500">{stock.symbol}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-gray-500">No matches found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {localCurrentDetails && (
            <div className="mb-4 space-y-1 text-sm text-gray-400 bg-[#262626]/50 p-3 rounded-xl border border-[#3d3d3d]/50">
              <div>
                <span className="font-medium text-gray-300">Current Name:</span> {localCurrentDetails.stock_name}
              </div>
              <div>
                <span className="font-medium text-gray-300">Current Symbol:</span> {localCurrentDetails.symbol}
              </div>
            </div>
          )}

          <label className="block text-sm font-medium text-gray-400 mb-1">New Stock Name</label>
          <input
            value={newStockName}
            onChange={(e) => setNewStockName(e.target.value)}
            className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 mb-3 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="Enter new stock name"
          />

          <label className="block text-sm font-medium text-gray-400 mb-1">New Symbol</label>
          <input
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 mb-6 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="Enter new symbol"
          />

          <div className="flex justify-end space-x-3 mt-2">
            <button
              className="px-6 py-3 rounded-xl bg-[#262626] text-white hover:bg-[#333333] transition-colors font-medium"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              className="px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
              onClick={handleSaveRename}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    );
  };

  const IsinMismatchModal = ({ onClose, mismatches, loading }) => {
    const copyToClipboard = async (value) => {
      try {
        await navigator.clipboard.writeText(value);
        alert('Copied: ' + value);
      } catch (err) {
        console.error('Clipboard copy failed:', err);
        alert('Unable to copy to clipboard.');
      }
    };

    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-[60] p-4"
        onClick={onClose}
      >
        <div
          className="bg-[#1c1c1c] text-white rounded-[2rem] shadow-lg w-full max-w-3xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-300 border border-[#2d2d2d]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-12 h-1.5 bg-[#333333] rounded-full mx-auto mb-6 flex-shrink-0" />
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-bold">ISIN Mismatch Review</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[#262626] px-4 py-2 text-sm text-white hover:bg-[#333333] transition-colors"
            >
              Close
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-400">Loading mismatch data...</div>
          ) : mismatches?.length ? (
            <div className="overflow-x-auto rounded-2xl border border-[#3d3d3d] bg-[#121212]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#1b1b1b] text-xs uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="px-4 py-3">ISIN</th>
                    <th className="px-4 py-3">Stock Master Name</th>
                    <th className="px-4 py-3">Surveillance Name</th>
                    <th className="px-4 py-3">Copy</th>
                  </tr>
                </thead>
                <tbody>
                  {mismatches.map((item, index) => (
                    <tr key={`${item.isin}-${index}`} className="border-t border-[#2c2c2c] hover:bg-white/5">
                      <td className="px-4 py-3 font-mono text-sm text-gray-100">{item.isin}</td>
                      <td className="px-4 py-3 text-gray-200">{item.stock_master_name}</td>
                      <td className="px-4 py-3 text-gray-200">{item.surveillance_name}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.isin)}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#3d3d3d] bg-[#262626] px-3 py-2 text-xs text-white hover:border-blue-500 hover:text-blue-100 transition-all"
                        >
                          <Copy size={14} />
                          Copy
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-400">
              No ISIN mismatches found for records present in both tables.
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[#262626] px-6 py-3 text-sm text-white hover:bg-[#333333] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

const EquityChargesModal = ({ onClose }) => {
  const [formData, setFormData, resetFormData] = usePersistentDraft(
    EQUITY_CHARGES_STORAGE_KEY,
    EQUITY_CHARGES_INITIAL_STATE
  );

  const { view, showTable, accountName, year, fy, otherCharges, dpCharges } = formData;
  const [charges, setCharges] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const setField = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, [setFormData]);

  const setView = (v) => setField("view", v);
  const setShowTable = useCallback((s) => setField("showTable", s), [setField]);

  const handleSave = async () => {
    const payload = {
      account_name: accountName,
      year: year ? parseInt(year) : null,
      fy,
      other_charges: otherCharges ? parseFloat(otherCharges) : null,
      dp_charges: dpCharges ? parseFloat(dpCharges) : null,
    };

    try {
      if (editingId) {
        await stockAPI.updateCharge(editingId, payload);
      } else {
        await stockAPI.addCharge(payload);
      }
      alert(editingId ? "Updated successfully!" : "Saved successfully!");
      if (editingId) {
        setEditingId(null);
        fetchCharges();
      } else {
        resetFormData();
      }
    } catch (error) {
      alert("Error saving: " + error.message);
    }
  };

  const fetchCharges = useCallback(async () => {
    try {
      const { data } = await stockAPI.fetchCharges();
      if (data) {
        // Apply client-side filtering if needed, though backend returns all
        let filtered = data;
        if (year) filtered = filtered.filter(c => c.year === parseInt(year));
        if (fy) filtered = filtered.filter(c => c.fy === fy);
        
        setCharges(filtered);
        setShowTable(true);
      }
    } catch (error) {
      alert("Error fetching charges: " + error.message);
    }
  }, [year, fy, setShowTable]);

  useEffect(() => {
    if (showTable) {
      fetchCharges();
    }
  }, [showTable, fetchCharges]); // Only on mount

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await stockAPI.deleteCharge(id);
      fetchCharges();
    } catch (error) {
      alert("Error deleting: " + error.message);
    }
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setFormData((prev) => ({
      ...prev,
      accountName: c.account_name || "",
      year: c.year?.toString() || "",
      fy: c.fy || "",
      otherCharges: c.other_charges?.toString() || "",
      dpCharges: c.dp_charges?.toString() || "",
    }));
  };

  const isManage = view === "manage";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-[70] p-4"
      onClick={onClose}
    >
      <div
        className={`bg-[#1c1c1c] text-white rounded-[2rem] shadow-lg w-full ${
          isManage && showTable ? "max-w-4xl" : "max-w-md"
        } p-6 flex flex-col max-h-[90vh] transition-all duration-300 animate-in fade-in zoom-in-95 border border-[#2d2d2d]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-[#333333] rounded-full mx-auto mb-6 flex-shrink-0" />
        <div className="flex justify-between items-center mb-6 border-b border-[#2d2d2d] pb-4">
          <h3 className="text-xl font-bold">
            {isManage ? "Manage Equity Charges" : "Add Equity Charges"}
          </h3>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setView(isManage ? "add" : "manage");
                setShowTable(false);
                setEditingId(null);
              }}
              className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-[#262626] transition-colors"
              title={isManage ? "Switch to Add" : "Switch to Manage"}
            >
              <Settings size={20} className={isManage ? "text-blue-500" : ""} />
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-[#262626] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {isManage && !showTable ? (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">Year</label>
                <input
                  type="number"
                  placeholder="Year"
                  value={year}
                  onChange={(e) => setField("year", e.target.value)}
                  className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">FY</label>
                <input
                  type="text"
                  placeholder="FY"
                  value={fy}
                  onChange={(e) => setField("fy", e.target.value)}
                  className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>
            <button
              onClick={fetchCharges}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors mt-4"
            >
              Fetch Records
            </button>
          </div>
        ) : isManage && showTable ? (
          <div className="flex flex-col h-full overflow-hidden">
            {editingId && (
              <div className="border border-blue-500/30 p-4 rounded-2xl mb-6 bg-blue-500/5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                <div className="flex flex-col">
                  <label className="text-xs font-bold mb-1 text-blue-400 uppercase tracking-wider">Account</label>
                  <select
                    value={accountName}
                    onChange={(e) => setField("accountName", e.target.value)}
                    className="bg-[#262626] border border-[#3d3d3d] p-2 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PM" className="bg-[#1c1c1c]">PM</option>
                    <option value="PDM" className="bg-[#1c1c1c]">PDM</option>
                    <option value="PSM" className="bg-[#1c1c1c]">PSM</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold mb-1 text-blue-400 uppercase tracking-wider">Year</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setField("year", e.target.value)}
                    className="bg-[#262626] border border-[#3d3d3d] p-2 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold mb-1 text-blue-400 uppercase tracking-wider">FY</label>
                  <input
                    type="text"
                    value={fy}
                    onChange={(e) => setField("fy", e.target.value)}
                    className="bg-[#262626] border border-[#3d3d3d] p-2 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold mb-1 text-blue-400 uppercase tracking-wider">DP</label>
                  <input
                    type="number"
                    value={dpCharges}
                    onChange={(e) => setField("dpCharges", e.target.value)}
                    className="bg-[#262626] border border-[#3d3d3d] p-2 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold mb-1 text-blue-400 uppercase tracking-wider">Other</label>
                  <input
                    type="number"
                    value={otherCharges}
                    onChange={(e) => setField("otherCharges", e.target.value)}
                    className="bg-[#262626] border border-[#3d3d3d] p-2 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleSave}
                    className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-700 flex-1"
                  >
                    Update
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      resetFormData();
                    }}
                    className="bg-[#333333] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#444444] flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <div className="overflow-auto border border-[#2d2d2d] rounded-2xl bg-[#262626]/20">
              <table className="min-w-full border-collapse">
                <thead className="bg-[#262626] sticky top-0 z-10">
                  <tr>
                    <th className="p-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Acc</th>
                    <th className="p-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Year</th>
                    <th className="p-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">FY</th>
                    <th className="p-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">DP</th>
                    <th className="p-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Other</th>
                    <th className="p-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {charges.map((c) => (
                    <tr key={c.id} className="hover:bg-[#262626]/40 transition-colors">
                      <td className="p-3 text-sm text-gray-300">{c.account_name}</td>
                      <td className="p-3 text-sm text-gray-300">{c.year}</td>
                      <td className="p-3 text-sm text-gray-300">{c.fy}</td>
                      <td className="p-3 text-sm text-right text-gray-300">{c.dp_charges}</td>
                      <td className="p-3 text-sm text-right text-gray-300">{c.other_charges}</td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center space-x-3">
                          <button
                            onClick={() => startEdit(c)}
                            className="text-blue-500 hover:text-blue-400 p-1 rounded-lg hover:bg-blue-500/10 transition-all"
                            title="Edit"
                          >
                            <PenSquare size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="text-red-500 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-all"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {charges.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-gray-500 italic">
                        No records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => setShowTable(false)}
              className="mt-6 text-blue-500 text-sm font-bold hover:text-blue-400 transition-colors w-fit flex items-center"
            >
              <span className="mr-2">&larr;</span> Back to filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-400">Account</label>
              <select
                value={accountName}
                onChange={(e) => setField("accountName", e.target.value)}
                className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <option value="" className="bg-[#1c1c1c]">Select Account</option>
                <option value="PM" className="bg-[#1c1c1c]">PM</option>
                <option value="PDM" className="bg-[#1c1c1c]">PDM</option>
                <option value="PSM" className="bg-[#1c1c1c]">PSM</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">Year</label>
                <input
                  type="number"
                  placeholder="2025"
                  value={year}
                  onChange={(e) => setField("year", e.target.value)}
                  className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">FY</label>
                <input
                  type="text"
                  placeholder="2025-26"
                  value={fy}
                  onChange={(e) => setField("fy", e.target.value)}
                  className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">DP Charges</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={dpCharges}
                  onChange={(e) => setField("dpCharges", e.target.value)}
                  className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">Other Charges</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={otherCharges}
                  onChange={(e) => setField("otherCharges", e.target.value)}
                  className="bg-[#262626] border border-[#3d3d3d] rounded-xl p-3 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-6">
              <button
                className="px-6 py-3 rounded-xl bg-[#262626] text-white hover:bg-[#333333] transition-colors font-medium flex-1"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors font-bold flex-1"
                onClick={handleSave}
              >
                Save Charges
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const BulkAddModal = ({ onClose, onSuccess, stockOptions, accountOptions, stockMasterCache }) => {
  const defaultState = useMemo(() => ([
    {
      id: Date.now(),
      stockName: "",
      quantity: "",
      buyPrice: "",
      buyDate: new Date().toISOString().split('T')[0],
      accountType: "regular",
      accountName: "PSM",
      equityType: "stock",
      status: "active",
    },
  ]), []);

  const [rows, setRows, resetRows] = usePersistentDraft(
    BULK_ADD_STORAGE_KEY,
    defaultState
  );

  const [showStockOptions, setShowStockOptions] = useState({});
  const [filteredStocks, setFilteredStocks] = useState({});

  useEffect(() => {
    const fetchEquityPositions = async () => {
      try {
        // 1. Fetch equity positions first
        const { data: epData } = await stockAPI.fetchEquityPositions();

        if (!epData || epData.length === 0) {
          setRows([]);
          return;
        }

        // 2. Get unique dates from equity positions to filter stock_transactions efficiently
        const uniqueDates = [...new Set(epData.map(pos => pos.position_date).filter(Boolean))];
        
        let txData = [];
        if (uniqueDates.length > 0) {
          // Fetch matching transactions for those specific dates
          const { data: matchedTx } = await stockAPI.fetchTransactionsByDates(uniqueDates);
          if (matchedTx) {
            txData = matchedTx;
          }
        }

        const mappedRows = epData.map((pos) => {
          const master = stockMasterCache.find(
            (s) => s.symbol === pos.symbol
          );
          let name = master ? master.stock_name : pos.symbol;
          if (name && typeof name === "string") {
            name = name.replace(/-EQ$/i, "");
          }

          const brokerLower = (pos.broker || "").toLowerCase();
          const isAngel = brokerLower.includes("angel");
          const equityType = isAngel ? "etf" : "stock";
          
          let accountName = pos.account_id || "";
          if (isAngel) {
            // Map specific Angel account ID to "PM"
            if (accountName === "P811882" || !accountName) {
              accountName = "PM";
            }
          }

          // Check for existing transaction (robust matching)
          const existingTx = txData?.find(tx => {
            const sameName = String(tx.stock_name || "").trim().toLowerCase() === String(name || "").trim().toLowerCase();
            
            // Robust date comparison: convert both to YYYY-MM-DD
            const txDate = tx.buy_date ? new Date(tx.buy_date).toISOString().split('T')[0] : null;
            const posDate = pos.position_date ? new Date(pos.position_date).toISOString().split('T')[0] : null;
            const sameDate = txDate === posDate;
            
            const sameAccount = String(tx.account_name || "").trim().toLowerCase() === String(accountName || "").trim().toLowerCase();
            const sameAccountType = String(tx.account_type || "").trim().toLowerCase() === "regular";
            
            return sameName && sameDate && sameAccount && sameAccountType;
          });

          let status = "active";
          let existingId = null;
          if (existingTx) {
            const sameQty = Number(existingTx.quantity) === Number(pos.quantity);
            const samePrice = Number(existingTx.buy_price) === Number(pos.average_price);
            if (sameQty && samePrice) {
              status = "inactive";
            } else {
              status = "update";
              existingId = existingTx.id;
            }
          }

          const brokerRaw = pos.broker || "";
          const brokerName = brokerRaw 
            ? brokerRaw.charAt(0).toUpperCase() + brokerRaw.slice(1).toLowerCase()
            : "";

          return {
            id: pos.id,
            existingId: existingId,
            stockName: name,
            quantity: pos.quantity,
            buyPrice: pos.average_price,
            buyDate: pos.position_date,
            accountType: "regular",
            accountName: accountName,
            equityType: equityType,
            brokerName: brokerName,
            status: status,
          };
        });
        setRows(mappedRows);
      } catch (error) {
        console.error("Error fetching equity positions:", error);
      }
    };

    fetchEquityPositions();
  }, [stockMasterCache, setRows]);

  const handleRowChange = (id, field, value) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );

    if (field === "stockName") {
      const filtered = stockOptions.filter((s) =>
        s && s.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredStocks((prev) => ({ ...prev, [id]: filtered }));
      setShowStockOptions((prev) => ({ ...prev, [id]: true }));
    }
  };

  const handleSelectStock = (id, stockName) => {
    handleRowChange(id, "stockName", stockName);
    setShowStockOptions((prev) => ({ ...prev, [id]: false }));
  };

  const handleAddRow = (id) => {
    const index = rows.findIndex((r) => r.id === id);
    const currentRow = rows[index];
    const newRow = {
      id: Date.now(),
      stockName: "",
      quantity: "",
      buyPrice: "",
      buyDate: currentRow.buyDate,
      accountType: currentRow.accountType,
      accountName: currentRow.accountName,
      equityType: currentRow.equityType,
      brokerName: currentRow.brokerName,
      status: "active",
    };
    setRows((prev) => [
      ...prev.slice(0, index + 1),
      newRow,
      ...prev.slice(index + 1),
    ]);
  };

  const handleDeleteRow = (id) => {
    if (rows.length > 1) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    } else {
      alert("You must keep at least one row");
    }
  };

  const handleClose = () => {
    resetRows();
    onClose?.();
  };

  const handleSubmit = async () => {
    if (rows.some((r) => !r.stockName || !r.accountName)) {
      alert("Please fill in stock name and account name for all rows");
      return;
    }

    const activeRows = rows.filter(r => r.status === "active");
    const updateRows = rows.filter(r => r.status === "update");

    try {
      // Handle Additions
      if (activeRows.length > 0) {
        const formatted = activeRows.map((r) => ({
          stock_name: r.stockName,
          account_name: r.accountName,
          account_type: r.accountType,
          equity_type: r.equityType,
          broker_name: r.brokerName,
          buy_date: r.buyDate || null,
          quantity: r.quantity ? parseInt(r.quantity) : null,
          buy_price: r.buyPrice ? parseFloat(r.buyPrice) : null,
        }));

        await stockAPI.bulkAddTransactions(formatted);
      }

      // Handle Updates
      if (updateRows.length > 0) {
        for (const r of updateRows) {
          if (r.existingId) {
            await stockAPI.updateTransaction(r.existingId, {
              quantity: r.quantity ? parseInt(r.quantity) : null,
              buy_price: r.buyPrice ? parseFloat(r.buyPrice) : null,
            });
          }
        }
      }

      // Delete from equity_positions for ALL rows processed (active, inactive, update)
      const idsToDelete = rows.map((r) => r.id).filter(id => typeof id === 'number');
      if (idsToDelete.length > 0) {
        await stockAPI.deleteEquityPositions(idsToDelete);
      }

      let message = "";
      if (activeRows.length > 0 && updateRows.length > 0) {
        message = "Transactions added and updated successfully!";
      } else if (activeRows.length > 0) {
        message = "Transactions added successfully!";
      } else if (updateRows.length > 0) {
        message = "Transactions updated successfully!";
      } else {
        message = "No changes were needed (all were duplicates)";
      }

      alert(message);
      resetRows();
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error("Error:", err);
      alert("An error occurred while saving transactions: " + err.message);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-[60] p-1"
      onClick={handleClose}
    >
      <div
        className="bg-[#1c1c1c] text-white border border-[#2d2d2d] rounded-[2rem] shadow-2xl w-full max-w-6xl max-h-[95vh] p-6 flex flex-col animate-in fade-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-[#333333] rounded-full mx-auto mb-6 flex-shrink-0" />
        <h3 className="text-xl font-bold mb-6 px-2">Add Multiple Stocks</h3>

        <div className="overflow-x-auto flex-1 border border-[#2d2d2d] rounded-2xl mb-6 pb-44 bg-[#262626]/20">
          <table className="w-full border-collapse">
            <thead className="bg-[#262626]/50 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="p-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider min-w-[200px]">Stock Name</th>
                <th className="p-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Quantity</th>
                <th className="p-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider min-w-[100px]">Buy Price</th>
                <th className="p-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Buy Date</th>
                <th className="p-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider min-w-[100px]">Account Type</th>
                <th className="p-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider min-w-[100px]">Equity Type</th>
                <th className="p-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider min-w-[100px]">Broker Name</th>
                <th className="p-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider min-w-[100px]">Account Name</th>
                <th className="p-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="p-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rows.map((row, idx) => (
                <tr key={row.id} className="hover:bg-[#262626]/30 transition-colors">
                  <td className="p-3 relative">
                    <input
                      type="text"
                      value={row.stockName}
                      onChange={(e) =>
                        handleRowChange(row.id, "stockName", e.target.value)
                      }
                      onFocus={() =>
                        setShowStockOptions((prev) => ({ ...prev, [row.id]: true }))
                      }
                      onBlur={() =>
                        setTimeout(
                          () =>
                            setShowStockOptions((prev) => ({ ...prev, [row.id]: false })),
                          150
                        )
                      }
                      placeholder="Type to search..."
                      className="w-full bg-[#262626] border border-[#3d3d3d] rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {showStockOptions[row.id] &&
                      filteredStocks[row.id]?.length > 0 && (
                        <ul className="absolute z-50 w-[calc(100%-1.5rem)] max-h-48 overflow-y-auto border border-[#3d3d3d] rounded-xl bg-[#262626] shadow-2xl mt-1 top-full left-3 p-1">
                          {filteredStocks[row.id].map((stock, sidx) => (
                            <li
                              key={sidx}
                              onMouseDown={() => handleSelectStock(row.id, stock)}
                              className="p-2.5 cursor-pointer hover:bg-[#333333] rounded-lg text-sm transition-colors text-gray-300"
                            >
                              {stock}
                            </li>
                          ))}
                        </ul>
                      )}
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      value={row.quantity}
                      onChange={(e) =>
                        handleRowChange(row.id, "quantity", e.target.value)
                      }
                      placeholder="Qty"
                      className="w-full bg-[#262626] border border-[#3d3d3d] rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      step="0.01"
                      value={row.buyPrice}
                      onChange={(e) =>
                        handleRowChange(row.id, "buyPrice", e.target.value)
                      }
                      placeholder="Price"
                      className="w-full bg-[#262626] border border-[#3d3d3d] rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="date"
                      value={row.buyDate}
                      onChange={(e) =>
                        handleRowChange(row.id, "buyDate", e.target.value)
                      }
                      className="w-full bg-[#262626] border border-[#3d3d3d] rounded-xl p-2.5 text-sm text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="p-3">
                    <select
                      value={row.accountType}
                      onChange={(e) =>
                        handleRowChange(row.id, "accountType", e.target.value)
                      }
                      className="w-full bg-[#262626] border border-[#3d3d3d] rounded-xl p-2.5 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="" className="bg-[#1c1c1c]">Select</option>
                      <option value="regular" className="bg-[#1c1c1c]">regular</option>
                      <option value="free" className="bg-[#1c1c1c]">free</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <select
                      value={row.equityType}
                      onChange={(e) =>
                        handleRowChange(row.id, "equityType", e.target.value)
                      }
                      className="w-full bg-[#262626] border border-[#3d3d3d] rounded-xl p-2.5 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="stock" className="bg-[#1c1c1c]">Stock</option>
                      <option value="etf" className="bg-[#1c1c1c]">ETF</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <select
                      value={row.brokerName}
                      onChange={(e) =>
                        handleRowChange(row.id, "brokerName", e.target.value)
                      }
                      className="w-full bg-[#262626] border border-[#3d3d3d] rounded-xl p-2.5 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="" className="bg-[#1c1c1c]">Select</option>
                      {brokerOptions.map((broker, bidx) => (
                        <option key={bidx} value={broker} className="bg-[#1c1c1c]">
                          {broker}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <select
                      value={row.accountName}
                      onChange={(e) =>
                        handleRowChange(row.id, "accountName", e.target.value)
                      }
                      className="w-full bg-[#262626] border border-[#3d3d3d] rounded-xl p-2.5 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="" className="bg-[#1c1c1c]">Select</option>
                      {accountOptions.map((acc, aidx) => (
                        <option key={aidx} value={acc} className="bg-[#1c1c1c]">
                          {acc}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                      row.status === "active" 
                        ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" 
                        : row.status === "update"
                        ? "text-blue-500 bg-blue-500/10 border-blue-500/20"
                        : "text-rose-500 bg-rose-500/10 border-rose-500/20 opacity-50"
                    }`}>
                      {row.status || "active"}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddRow(row.id)}
                        className="text-white bg-green-600 hover:bg-green-700 rounded-xl p-2 transition-colors shadow-lg shadow-green-900/20"
                        title="Add row below"
                      >
                        <Plus size={16} />
                      </button>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          className="text-white bg-red-600 hover:bg-red-700 rounded-xl p-2 transition-colors shadow-lg shadow-red-900/20"
                          title="Delete row"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end space-x-3 mt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-4 rounded-xl bg-[#262626] text-white hover:bg-[#333333] transition-all font-medium border border-[#3d3d3d]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-4 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-900/20"
          >
            Update Portfolio
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
        className="bg-[#1c1c1c] border border-[#2d2d2d] rounded-[2rem] shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-[#333333] rounded-full mx-auto mt-6 mb-2" />
        {/* Header */}
        <div className="px-8 py-2 border-b border-[#2d2d2d] flex flex-col gap-4">
          <h2 className="text-2xl font-bold text-white tracking-tight">Add Stock Entry</h2>
          <div className="flex items-center space-x-2">
            {/* Bulk Add Multiple (M in Circle) */}
            <button
              className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all font-bold shadow-lg shadow-indigo-900/10"
              onClick={() => setShowBulkAddModal(true)}
              title="Add Multiple Stocks"
              type="button"
            >
              M
            </button>

            {/* Add Stock */}
            <button
              className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all shadow-lg shadow-emerald-900/10"
              onClick={() => setShowAddStockModal(true)}
              title="Add New Stock (master)"
              type="button"
            >
              <Plus size={20} />
            </button>

            {/* Rename Stock */}
            <button
              className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-lg shadow-blue-900/10"
              onClick={() => setShowRenameModal(true)}
              title="Rename Stock"
              type="button"
            >
              <PenSquare size={20} />
            </button>

            {/* Upload Excel */}
            <button
              className="w-10 h-10 rounded-xl bg-cyan-600/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center hover:bg-cyan-600 hover:text-white transition-all shadow-lg shadow-cyan-900/10"
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
              className="w-10 h-10 rounded-xl bg-purple-600/10 text-purple-400 border border-purple-500/20 flex items-center justify-center hover:bg-purple-600 hover:text-white transition-all shadow-lg shadow-purple-900/10"
              onClick={handleDownloadSample}
              title="Download Sample Excel"
              type="button"
            >
              <Download size={20} />
            </button>

            {/* Equity Charges (C in Circle) */}
            <button
              className="w-10 h-10 rounded-xl bg-orange-600/10 text-orange-400 border border-orange-500/20 flex items-center justify-center hover:bg-orange-600 hover:text-white transition-all font-bold shadow-lg shadow-orange-900/10"
              onClick={() => setShowChargesModal(true)}
              title="Add Equity Charges"
              type="button"
            >
              C
            </button>

            {/* Extra Profits (EP in Circle) */}
            <button
              className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all font-bold shadow-lg shadow-blue-900/10"
              onClick={() => setShowEPModal(true)}
              title="Zerodha Login & Sync"
              type="button"
            >
              EP
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="px-8 py-6 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Stock Name */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Stock Name</label>
              <input
                ref={inputRef}
                value={stockName}
                onChange={(e) => {
                  const val = e.target.value;
                  setStockName(val);
                  setShowOptions(true);
                  setFilteredStocks(
                    stockOptions.filter((s) =>
                      s && s.toLowerCase().includes(val.toLowerCase())
                    )
                  );
                }}
                onFocus={() => setShowOptions(true)}
                onBlur={() => setTimeout(() => setShowOptions(false), 150)}
                onKeyDown={handleKeyDown}
                className="bg-[#262626] border border-[#3d3d3d] text-white rounded-xl p-3.5 w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="Type to search..."
                required
              />
              {showOptions && filteredStocks.length > 0 && (
                <ul className="absolute z-50 w-full max-h-48 overflow-y-auto border border-[#3d3d3d] rounded-xl bg-[#262626] shadow-2xl mt-1.5 backdrop-blur-sm overflow-hidden">
                  {filteredStocks.map((name, idx) => (
                    <li
                      key={idx}
                      onMouseDown={() => {
                        setStockName(name);
                        setShowOptions(false);
                      }}
                      className={`px-4 py-3.5 cursor-pointer hover:bg-white/[0.05] text-gray-200 transition-colors border-b border-[#3d3d3d]/50 last:border-0 ${
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
                  className="bg-[#262626] border border-[#3d3d3d] text-white rounded-xl p-3.5 w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  onBlur={() => {
                    if (newAccountName.trim()) {
                      setAccountName(newAccountName.trim());
                      setAccountOptions((prev) => [
                        ...new Set([...prev, newAccountName.trim()]),
                      ]);
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
                  className="bg-[#262626] border border-[#3d3d3d] text-white rounded-xl p-3.5 w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer transition-all"
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
              {/* Buy Date */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-400 ml-1">Buy Date</label>
                <input
                  type="date"
                  value={buyDate}
                  onChange={(e) => setBuyDate(e.target.value)}
                  className="bg-[#262626] border border-[#3d3d3d] text-white rounded-xl p-3.5 w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all [color-scheme:dark]"
                />
              </div>

              {/* Account Type */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-400 ml-1">Account Type</label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value)}
                  className="bg-[#262626] border border-[#3d3d3d] text-white rounded-xl p-3.5 w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer transition-all"
                  required
                >
                  <option value="">Select Type</option>
                  <option value="regular">regular</option>
                  <option value="free">free</option>
                </select>
              </div>

              {/* Equity Type */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-400 ml-1">Equity Type</label>
                <select
                  value={equityType}
                  onChange={(e) => setEquityType(e.target.value)}
                  className="bg-[#262626] border border-[#3d3d3d] text-white rounded-xl p-3.5 pr-10 w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer transition-all"
                  required
                >
                  <option value="">Select Type</option>
                  <option value="stock">Stock</option>
                  <option value="etf">ETF</option>
                </select>
              </div>

              {/* Broker Name */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-400 ml-1">Broker Name</label>
                <select
                  value={brokerName}
                  onChange={(e) => setBrokerName(e.target.value)}
                  className="bg-[#262626] border border-[#3d3d3d] text-white rounded-xl p-3.5 pr-10 w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer transition-all"
                  required
                >
                  <option value="">Broker</option>
                  {brokerOptions.map((broker, idx) => (
                    <option key={idx} value={broker}>
                      {broker}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-400 ml-1">Quantity</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="bg-[#262626] border border-[#3d3d3d] text-white rounded-xl p-3.5 w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              {/* Buy Price */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-400 ml-1">Buy Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  placeholder="0.00"
                  className="bg-[#262626] border border-[#3d3d3d] text-white rounded-xl p-3.5 w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-[#2d2d2d] flex justify-end space-x-3 bg-[#1c1c1c]/50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-[#262626] text-gray-300 font-medium hover:bg-[#333333] transition-all border border-[#3d3d3d]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-8 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"
          >
            Save Entry
          </button>
        </div>
      </div>

      {showAddStockModal && (
        <AddStockModal
          onClose={() => setShowAddStockModal(false)}
          stockMasterCache={stockMasterCache}
          fetchStockNames={fetchStockNames}
        />
      )}

      {showRenameModal && (
        <RenameStockModal
          onClose={() => setShowRenameModal(false)}
          stockMasterCache={stockMasterCache}
          fetchStockNames={fetchStockNames}
          setStockMasterCache={setStockMasterCache}
          setStockOptions={setStockOptions}
          onOpenIsinMismatch={async () => {
            setShowIsinMismatchModal(true);
            setIsinMismatchLoading(true);
            try {
              const result = await stockAPI.fetchStockSurveillanceIsinMismatch();
              setIsinMismatches(result?.data || []);
            } catch (err) {
              console.error('Error fetching ISIN mismatches:', err);
              setIsinMismatches([]);
            } finally {
              setIsinMismatchLoading(false);
            }
          }}
          isinMismatchLoading={isinMismatchLoading}
        />
      )}

      {showIsinMismatchModal && (
        <IsinMismatchModal
          onClose={() => setShowIsinMismatchModal(false)}
          mismatches={isinMismatches}
          loading={isinMismatchLoading}
        />
      )}

      {showChargesModal && (
        <EquityChargesModal onClose={() => setShowChargesModal(false)} />
      )}

      {showBulkAddModal && (
        <BulkAddModal
          onClose={() => setShowBulkAddModal(false)}
          onSuccess={onSuccess}
          stockOptions={stockOptions}
          accountOptions={accountOptions}
          stockMasterCache={stockMasterCache}
        />
      )}

      {showEPModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-[70] p-2"
          onClick={() => setShowEPModal(false)}
        >
          <div 
            className="bg-[#1c1c1c] border border-[#2d2d2d] rounded-[2rem] shadow-2xl w-full max-w-md p-4 max-h-[100vh] flex flex-col animate-in fade-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 px-2 flex-shrink-0">
              <h3 className="text-xl font-bold text-white tracking-tight">AMC Accounts</h3>
              <button 
                onClick={() => setShowEPModal(false)}
                className="p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            
            <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
              <EPIcon />
            </div>
            
            <div className="mt-8 flex justify-end flex-shrink-0">
              <button
                onClick={() => setShowEPModal(false)}
                className="px-8 py-2 rounded-2xl bg-[#262626] text-white font-medium hover:bg-[#333333] transition-all border border-[#3d3d3d]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockForm;
