import React, { useState, useEffect } from "react";
import { useNavigation } from "../../../context/NavigationContext.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import assetAPI from "../../../api/assetAPI.js";
import { useMFTrialMode } from "../../../utils/MFTrialMode.js";
import { Edit, Trash2, X, Download } from "lucide-react";
import { exportMFTransactionsToExcel, exportMFHoldingsToExcel } from "../../../utils/excelExporter.js";

const calculateXIRR = (cashflows) => {
  if (!cashflows || cashflows.length < 2) return null;
  const npv = (rate) =>
    cashflows.reduce(
      (acc, cf) =>
        acc + cf.amount / Math.pow(1 + rate, (cf.date - cashflows[0].date) / (1000 * 60 * 60 * 24 * 365)),
      0
    );
  let low = -0.9999,
    high = 100,
    guess = 0.1;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const val = npv(mid);
    if (Math.abs(val) < 1e-6) return mid * 100;
    if (val > 0) low = mid;
    else high = mid;
    guess = mid;
  }
  return guess * 100;
};

const formatDateDDMMYY = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

const NUMERIC_SORT_KEYS = new Set(["invested", "closedValue", "urp", "urpPct", "xirr", "units", "buy_nav", "sell_nav"]);

const getModalSortValue = (txn, key) => {
  const invested = txn.units * (txn.buy_nav || 0);
  const closedVal = txn.units * (txn.sell_nav || 0);
  const urp = closedVal - invested;
  const urpPct = invested > 0 ? (urp / invested) * 100 : 0;

  switch (key) {
    case 'buy_date': return txn.buy_date;
    case 'sell_date': return txn.sell_date;
    case 'account_name': return txn.account_name;
    case 'units': return txn.units;
    case 'buy_nav': return txn.buy_nav;
    case 'sell_nav': return txn.sell_nav;
    case 'invested': return invested;
    case 'closedValue': return closedVal;
    case 'urp': return urp;
    case 'urpPct': return urpPct;
    case 'xirr':
      const cf = [];
      if (txn.buy_date) cf.push({ amount: -invested, date: new Date(txn.buy_date) });
      if (txn.sell_date) cf.push({ amount: closedVal, date: new Date(txn.sell_date) });
      return calculateXIRR(cf);
    default: return txn.sell_date;
  }
};

const MFClosedHoldings = ({ txns: propTxns = [], funds: propFunds = [] }) => {
  const { isTrialMode } = useMFTrialMode();
  const { session } = useAuth();
  const { refreshDashboard, refreshAssets } = useNavigation();
  const [funds, setFunds] = useState([]);
  const [detailModalFund, setDetailModalFund] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [isFullEditOpen, setIsFullEditOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [buyDateFilter, setBuyDateFilter] = useState("");
  const [sellDateFilter, setSellDateFilter] = useState("");
  const [amcFilter, setAmcFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [accountList, setAccountList] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: "fund_short_name", direction: "asc" });
  const [modalSortConfig, setModalSortConfig] = useState({ key: "sell_date", direction: "desc" });
  const pageSize = 6; // Show 6 rows per page

  const handleModalSort = (key) => {
    setModalSortConfig((prev) => {
      if (prev?.key === key) {
        const nextDirection = prev.direction === "desc" ? "asc" : "desc";
        return { key, direction: nextDirection };
      }
      return { key, direction: "desc" };
    });
  };

  const handleModalHeaderKeyDown = (event, key) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleModalSort(key);
    }
  };



  const fetchFunds = React.useCallback(async () => {
    // Use props when provided; fallback to fetching
    let transactions = propTxns;
    let masters = propFunds;

    if (!propTxns.length || !propFunds.length) {
      if (!session) return;
      try {
        const data = await assetAPI.getMFData(session?.access_token);
        transactions = data.transactions || [];
        masters = data.fundMaster || [];
      } catch (error) {
        console.error("Error fetching MF data:", error);
        return;
      }
    }

    const uniqueAccounts = Array.from(new Set(transactions.map((t) => t.account_name).filter(Boolean))).sort();
    setAccountList(uniqueAccounts);

    const masterMap = {};
    masters.forEach((m) => (masterMap[(m.fund_short_name || "").trim()] = m));

    const categories = Array.from(new Set(masters.map((m) => m.category).filter(Boolean))).sort();
    const palette = [
      { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
      { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" },
      { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
      { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-200" },
      { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
      { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-200" },
      { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-200" },
      { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
      { bg: "bg-lime-100", text: "text-lime-700", border: "border-lime-200" },
      { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-200" },
      { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200" },
      { bg: "bg-sky-100", text: "text-sky-700", border: "border-sky-200" },
    ];
    const colorMap = {};
    categories.forEach((cat, idx) => {
      const c = palette[idx % palette.length];
      colorMap[cat] = `${c.bg} ${c.text} ${c.border}`;
    });

    // Build realized (closed) amounts using FIFO across buys and sells per fund
    const grouped = {};
    transactions.forEach((txn) => {
      const f = (txn.fund_short_name || "").trim();
      if (!grouped[f]) grouped[f] = [];
      grouped[f].push({ ...txn, fund_short_name: f });
    });

    const fundList = Object.entries(grouped)
      .map(([fund_short_name, arr]) => {
      const txns = arr.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
      // Maintain FIFO lots PER ACCOUNT
      const lotsByAccount = new Map(); // account_name -> array of lots
      let realizedCost = 0;
      let realizedValue = 0;
      const splits = []; // detailed FIFO splits for table

      txns.forEach((t) => {
        const type = String(t.transaction_type || "").toLowerCase();
        const units = Number(t.units) || 0;
        const nav = Number(t.nav) || 0;
        const dt = new Date(t.date);
        const acc = (t.account_name || "");
        if (!units || !nav) return;
        if (type === "buy") {
          const lots = lotsByAccount.get(acc) || [];
          lots.push({ units, nav, date: dt });
          lotsByAccount.set(acc, lots);
        } else if (type === "sell") {
          let rem = units;
          const lots = lotsByAccount.get(acc) || [];
          // Consume only from same-account lots
          while (rem > 0 && lots.length) {
            const lot = lots[0];
            const take = Math.min(rem, lot.units);
            realizedCost += take * lot.nav;
            realizedValue += take * nav;
            splits.push({
              id: `${t.id}-${splits.length + 1}`,
              sell_id: t.id,
              units: take,
              buy_nav: lot.nav,
              buy_date: lot.date.toISOString(),
              sell_nav: nav,
              sell_date: dt.toISOString(),
              account_name: acc,
            });
            lot.units -= take;
            rem -= take;
            if (lot.units <= 1e-8) lots.shift();
          }
          // If any remainder, record unmatched sell portion with blank buy fields
          if (rem > 0) {
            splits.push({
              id: `${t.id}-${splits.length + 1}`,
              sell_id: t.id,
              units: rem,
              buy_nav: null,
              buy_date: null,
              sell_nav: nav,
              sell_date: dt.toISOString(),
              account_name: acc,
            });
            // No cost added for unmatched portion (keeps invested/URP conservative)
          }
        }
      });

      const invested = realizedCost;
      const closedValue = realizedValue;
      const urp = closedValue - invested;
      const urpPct = invested > 0 ? (urp / invested) * 100 : 0;
      // Compute XIRR from realized FIFO split cashflows only
      const realizedFlows = [];
      for (const s of splits) {
        if (s.buy_date && s.buy_nav != null) realizedFlows.push({ amount: -(s.units * s.buy_nav), date: new Date(s.buy_date) });
        if (s.sell_date) realizedFlows.push({ amount: s.units * s.sell_nav, date: new Date(s.sell_date) });
      }
      const xirr = calculateXIRR(realizedFlows);

      const accounts = Array.from(new Set(txns.map((t) => t.account_name).filter(Boolean)));
      const account_name = accounts.length === 1 ? accounts[0] : "Multiple Accounts";

      // Use FIFO splits for detail table
      // Only keep funds with at least one sell split
      const detailTxns = splits;

      return {
        fund_short_name,
        fund_full_name: masterMap[fund_short_name]?.fund_full_name ?? null,
        category: masterMap[fund_short_name]?.category ?? null,
        amc_name: masterMap[fund_short_name]?.amc_name ?? "Unknown AMC",
        account_name,
        invested: isTrialMode ? 0 : invested,
        closedValue: isTrialMode ? 0 : closedValue,
        urp: isTrialMode ? 0 : urp,
        urpPct: isTrialMode ? 0 : urpPct,
        xirr: xirr,
        transactions: detailTxns,
      };
    })
    // Filter out funds with no sell splits (i.e., only buys)
    .filter(f => (f.transactions && f.transactions.length > 0));

    setFunds(fundList);
  }, [propTxns, propFunds, isTrialMode, session]);

  useEffect(() => { fetchFunds(); }, [fetchFunds]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, buyDateFilter, sellDateFilter, amcFilter, accountFilter]);

  // Hide main page scroll when modal is open
  useEffect(() => {
    if (detailModalFund) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [detailModalFund]);


const amcList = React.useMemo(() => {
  return Array.from(new Set(funds.map(f => f.amc_name || "Unknown AMC"))).sort();
}, [funds]);




const filteredFunds = isTrialMode ? [] : funds
  .slice()
  .sort((a, b) => {
    if (sortConfig?.key) {
      const aValue = sortConfig.key === "transactions" ? a.transactions.length : a[sortConfig.key];
      const bValue = sortConfig.key === "transactions" ? b.transactions.length : b[sortConfig.key];

      let comparison = 0;
      if (NUMERIC_SORT_KEYS.has(sortConfig.key)) {
        comparison = (Number(aValue) || 0) - (Number(bValue) || 0);
      } else {
        comparison = String(aValue ?? "").localeCompare(String(bValue ?? ""), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }

      return sortConfig.direction === "asc" ? comparison : -comparison;
    }
    return 0;
  })
  .filter(fund => {
    const nameMatch = fund.fund_short_name.toLowerCase().includes(searchQuery.toLowerCase());
    // Include the fund if ANY split row has the selected account
    const accountMatch = accountFilter ? fund.transactions.some(t => (t.account_name || "") === accountFilter) : true;
    const hasBuyOnDate = buyDateFilter ? fund.transactions.some(t => t.buy_date?.slice(0,10) === buyDateFilter) : true;
    const hasSellOnDate = sellDateFilter ? fund.transactions.some(t => t.sell_date?.slice(0,10) === sellDateFilter) : true;
    const matchesAmc = amcFilter ? fund.amc_name === amcFilter : true;

    return nameMatch && accountMatch && hasBuyOnDate && hasSellOnDate && matchesAmc;
  });

  // Pagination
  const totalPages = Math.ceil(filteredFunds.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const displayedFunds = filteredFunds.slice(startIndex, startIndex + pageSize);


  const handleDelete = async (id) => {
    try {
      await assetAPI.deleteTransaction('mf', id, session?.access_token);
      alert("Transaction deleted successfully!");
      await assetAPI.invalidateCache('mf', session?.access_token);
      window.dispatchEvent(new CustomEvent('portfolio-cache-invalidated', { detail: { assetType: 'mf' } }));
      await new Promise(resolve => setTimeout(resolve, 500));
      fetchFunds();
      refreshDashboard();
      refreshAssets();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      alert("Failed to delete transaction");
    }
  };

  const handleFundRowClick = (fund) => {
    if (!fund) return;
    setDetailModalFund(fund);
  };

  const handleFundRowKeyDown = (event, fund) => {
    if (!fund) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setDetailModalFund(fund);
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        const nextDirection = prev.direction === "desc" ? "asc" : "desc";
        return { key, direction: nextDirection };
      }
      return { key, direction: key === "fund_short_name" ? "asc" : "desc" };
    });
    setCurrentPage(1);
  };

  const handleHeaderKeyDown = (event, key) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSort(key);
    }
  };

  // Full-screen edit modal for SELL transaction (mirrors NPSClosedHoldings behavior)
  const FullEditModal = () => {
    if (!isFullEditOpen) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-3" onClick={() => { setIsFullEditOpen(false); setEditingId(null); }}>
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold">Edit Sell Transaction</h3>
            <button className="text-gray-600 hover:text-gray-800" onClick={() => { setIsFullEditOpen(false); setEditingId(null); }}>
              <X size={18} />
            </button>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Fund</label>
              <input type="text" className="w-full border rounded p-2 text-sm bg-gray-200" value={editValues.fund_short_name || ""} readOnly />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Type</label>
              <select className="w-full border rounded p-2 text-sm" value={editValues.transaction_type || "sell"} onChange={(e) => setEditValues({ ...editValues, transaction_type: e.target.value })}>
                <option value="sell">sell</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Date</label>
              <input type="date" className="w-full border rounded p-2 text-sm" value={(editValues.date || "").slice(0,10)} onChange={(e) => setEditValues({ ...editValues, date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Units</label>
              <input type="number" step="0.0001" className="w-full border rounded p-2 text-sm" value={editValues.units ?? ""} onChange={(e) => setEditValues({ ...editValues, units: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Sell NAV</label>
              <input type="number" step="0.01" className="w-full border rounded p-2 text-sm" value={editValues.nav ?? ""} onChange={(e) => setEditValues({ ...editValues, nav: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Account</label>
              <select className="w-full border rounded p-2 text-sm" value={editValues.account_name || ""} onChange={(e) => setEditValues({ ...editValues, account_name: e.target.value })}>
                <option value="">Select Account</option>
                {accountList.map((acc) => (
                  <option key={acc} value={acc}>{acc}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 p-4 border-t">
            <button className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200" onClick={() => { setIsFullEditOpen(false); setEditingId(null); }}>Cancel</button>
            <button
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              onClick={async () => {
                if (!editingId) return;
                const payload = {
                  date: editValues.date,
                  units: Number(editValues.units),
                  nav: Number(editValues.nav),
                  transaction_type: "sell",
                  account_name: editValues.account_name || null,
                };
                try {
                  await assetAPI.updateTransaction('mf', editingId, payload, session?.access_token);
                  setIsFullEditOpen(false);
                  setEditingId(null);
                  setEditValues({});
                  await assetAPI.invalidateCache('mf', session?.access_token);
                  window.dispatchEvent(new CustomEvent('portfolio-cache-invalidated', { detail: { assetType: 'mf' } }));
                  await new Promise(resolve => setTimeout(resolve, 500));
                  fetchFunds();
                } catch (error) {
                  console.error("Error updating transaction:", error);
                  alert("Failed to update transaction");
                }
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Modal to show fund details (replaces inline expansion)
  const handleExportClosedToExcel = async (fund) => {
    if (!fund) return;

    const exportData = fund.transactions
      .filter(t => accountFilter ? (t.account_name || "") === accountFilter : true)
      .map(txn => {
        const invested = txn.units * (txn.buy_nav || 0);
        const closedVal = txn.units * (txn.sell_nav || 0);
        const urp = closedVal - invested;
        const urpPct = invested > 0 ? (urp / invested) * 100 : 0;
        
        return {
          'Buy Date': txn.buy_date ? formatDateDDMMYY(txn.buy_date) : "-",
          'Sell Date': formatDateDDMMYY(txn.sell_date),
          'Account': txn.account_name || "-",
          'Units': txn.units?.toFixed(3),
          'Buy NAV': txn.buy_nav != null ? txn.buy_nav : "-",
          'Sell NAV': txn.sell_nav?.toFixed(2),
          'Invested': invested?.toFixed(0),
          'Closed Value': closedVal?.toFixed(0),
          'P/L': urp?.toFixed(0),
          'P/L %': urpPct?.toFixed(1),
        };
      });

    const columns = [
      { key: 'Buy Date', label: 'Buy Date', width: 12 },
      { key: 'Sell Date', label: 'Sell Date', width: 12 },
      { key: 'Account', label: 'Account', width: 15 },
      { key: 'Units', label: 'Units', width: 12 },
      { key: 'Buy NAV', label: 'Buy NAV', width: 12 },
      { key: 'Sell NAV', label: 'Sell NAV', width: 12 },
      { key: 'Invested', label: 'Invested (₹)', width: 12 },
      { key: 'Closed Value', label: 'Closed Value (₹)', width: 15 },
      { key: 'P/L', label: 'P/L (₹)', width: 12 },
      { key: 'P/L %', label: 'P/L %', width: 12 },
    ];

    await exportMFTransactionsToExcel(exportData, fund.fund_short_name, columns);
  };

  const handleMainExportToExcel = async () => {
    const exportData = filteredFunds.map(fund => ({
      'Fund': fund.fund_short_name,
      'Invested': fund.invested?.toFixed(0),
      'Closed Value': fund.closedValue?.toFixed(0),
      'P/L': fund.urp?.toFixed(0),
      'P/L %': fund.urpPct?.toFixed(2),
      'XIRR': typeof fund.xirr === "number" ? fund.xirr.toFixed(2) : "-",
    }));

    const columns = [
      { key: 'Fund', label: 'Fund', width: 25 },
      { key: 'Invested', label: 'Invested (₹)', width: 15 },
      { key: 'Closed Value', label: 'Closed Value (₹)', width: 15 },
      { key: 'P/L', label: 'P/L (₹)', width: 12 },
      { key: 'P/L %', label: 'P/L %', width: 12 },
      { key: 'XIRR', label: 'XIRR %', width: 12 },
    ];

    await exportMFHoldingsToExcel(exportData, 'MF_Closed_Holdings', columns);
  };

  const FundDetailModal = ({ fund, onClose }) => {
    if (!fund) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-3" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full h-[60vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold">{fund.fund_full_name} — Details</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportClosedToExcel(fund)}
                className="text-green-600 hover:text-green-700 transition"
                title="Download as Excel"
              >
                <Download size={18} />
              </button>
              <button className="text-red-600 hover:text-red-600" onClick={onClose}><X size={18} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-x-scroll overflow-y-auto p-4">
            <div className="rounded-lg border">
              <table className="min-w-full divide-y divide-orange-200 text-xs sm:text-sm">
                <thead className="bg-orange-200">
                  <tr>
                    <th className="px-2 sm:px-3 py-2 text-left text-[10px] sm:text-xs font-medium uppercase tracking-wider cursor-pointer" onClick={() => handleModalSort("buy_date")} onKeyDown={(e) => handleModalHeaderKeyDown(e, "buy_date")} tabIndex={0}>
                      Buy Date {modalSortConfig.key === "buy_date" && (modalSortConfig.direction === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="px-2 sm:px-3 py-2 text-left text-[10px] sm:text-xs font-medium uppercase tracking-wider cursor-pointer" onClick={() => handleModalSort("sell_date")} onKeyDown={(e) => handleModalHeaderKeyDown(e, "sell_date")} tabIndex={0}>
                      Sell Date {modalSortConfig.key === "sell_date" && (modalSortConfig.direction === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="px-2 sm:px-3 py-2 text-left text-[10px] sm:text-xs font-medium text-black-500 uppercase tracking-wider cursor-pointer" onClick={() => handleModalSort("account_name")} onKeyDown={(e) => handleModalHeaderKeyDown(e, "account_name")} tabIndex={0}>
                      Account {modalSortConfig.key === "account_name" && (modalSortConfig.direction === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="px-2 sm:px-3 py-2 text-left text-[10px] sm:text-xs font-medium uppercase tracking-wider cursor-pointer text-right" onClick={() => handleModalSort("units")} onKeyDown={(e) => handleModalHeaderKeyDown(e, "units")} tabIndex={0}>
                      Units {modalSortConfig.key === "units" && (modalSortConfig.direction === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="px-2 sm:px-3 py-2 text-left text-[10px] sm:text-xs font-medium uppercase tracking-wider cursor-pointer text-right" onClick={() => handleModalSort("buy_nav")} onKeyDown={(e) => handleModalHeaderKeyDown(e, "buy_nav")} tabIndex={0}>
                      Buy NAV {modalSortConfig.key === "buy_nav" && (modalSortConfig.direction === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="px-2 sm:px-3 py-2 text-left text-[10px] sm:text-xs font-medium uppercase tracking-wider cursor-pointer text-right" onClick={() => handleModalSort("sell_nav")} onKeyDown={(e) => handleModalHeaderKeyDown(e, "sell_nav")} tabIndex={0}>
                      Sell NAV {modalSortConfig.key === "sell_nav" && (modalSortConfig.direction === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="px-2 sm:px-3 py-2 text-left text-[10px] sm:text-xs font-medium uppercase tracking-wider cursor-pointer text-right" onClick={() => handleModalSort("invested")} onKeyDown={(e) => handleModalHeaderKeyDown(e, "invested")} tabIndex={0}>
                      Invested {modalSortConfig.key === "invested" && (modalSortConfig.direction === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="px-2 sm:px-3 py-2 text-left text-[10px] sm:text-xs font-medium uppercase tracking-wider cursor-pointer text-right" onClick={() => handleModalSort("closedValue")} onKeyDown={(e) => handleModalHeaderKeyDown(e, "closedValue")} tabIndex={0}>
                      Closed Value {modalSortConfig.key === "closedValue" && (modalSortConfig.direction === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="px-2 sm:px-3 py-2 text-left text-[10px] sm:text-xs font-medium uppercase tracking-wider cursor-pointer text-right" onClick={() => handleModalSort("urp")} onKeyDown={(e) => handleModalHeaderKeyDown(e, "urp")} tabIndex={0}>
                      P/L {modalSortConfig.key === "urp" && (modalSortConfig.direction === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="px-2 sm:px-3 py-2 text-left text-[10px] sm:text-xs font-medium uppercase tracking-wider cursor-pointer text-right" onClick={() => handleModalSort("urpPct")} onKeyDown={(e) => handleModalHeaderKeyDown(e, "urpPct")} tabIndex={0}>
                      P/L % {modalSortConfig.key === "urpPct" && (modalSortConfig.direction === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="px-2 sm:px-3 py-2 text-left text-[10px] sm:text-xs font-medium uppercase tracking-wider cursor-pointer text-right" onClick={() => handleModalSort("xirr")} onKeyDown={(e) => handleModalHeaderKeyDown(e, "xirr")} tabIndex={0}>
                      XIRR {modalSortConfig.key === "xirr" && (modalSortConfig.direction === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="px-2 sm:px-3 py-2 text-left text-[10px] sm:text-xs font-medium uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {fund.transactions
                    .filter(t => accountFilter ? (t.account_name || "") === accountFilter : true)
                    .slice()
                    .sort((a,b) => {
                      const aValue = getModalSortValue(a, modalSortConfig.key);
                      const bValue = getModalSortValue(b, modalSortConfig.key);
                      let comparison = 0;
                      if (NUMERIC_SORT_KEYS.has(modalSortConfig.key)) {
                        comparison = (Number(aValue) || 0) - (Number(bValue) || 0);
                      } else {
                        comparison = String(aValue ?? "").localeCompare(String(bValue ?? ""), undefined, {
                          numeric: true,
                          sensitivity: "base",
                        });
                      }
                      return modalSortConfig.direction === "asc" ? comparison : -comparison;
                    })
                    .map(txn => {
                      const rowId = String(txn.id);                      
                      const invested = txn.units * (txn.buy_nav || 0);
                      const closedVal = txn.units * (txn.sell_nav || 0);
                      const urp = closedVal - invested;
                      const urpPct = invested > 0 ? (urp / invested) * 100 : 0;
                      const cf = [];
                      if (txn.buy_date) cf.push({ amount: -invested, date: new Date(txn.buy_date) });
                      if (txn.sell_date) cf.push({ amount: closedVal, date: new Date(txn.sell_date) });
                      const txnXirr = calculateXIRR(cf);
                      return (
                        <tr key={rowId} className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap">{txn.buy_date ? formatDateDDMMYY(txn.buy_date) : "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatDateDDMMYY(txn.sell_date)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{txn.account_name || "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{txn.units.toFixed(3)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{txn.buy_nav != null ? txn.buy_nav : "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{txn.sell_nav}</td>
                          <td className="px-3 py-2 whitespace-nowrap">₹{(isTrialMode ? 0 : invested).toFixed(0)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">₹{(isTrialMode ? 0 : closedVal).toFixed(0)}</td>
                          <td className={`px-3 py-2 whitespace-nowrap ${(isTrialMode ? 0 : urp) >= 0 ? "text-green-600" : "text-red-600"}`}>₹{(isTrialMode ? 0 : urp).toFixed(0)}</td>
                          <td className={`px-3 py-2 whitespace-nowrap ${(isTrialMode ? 0 : urpPct) >= 0 ? "text-green-600" : "text-red-600"}`}>{(isTrialMode ? 0 : urpPct).toFixed(1)}%</td>
                          <td className="px-3 py-2 whitespace-nowrap">{typeof txnXirr === "number" ? (isTrialMode ? 0 : txnXirr).toFixed(1) + "%" : "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <button
                              className="text-blue-600 hover:text-blue-800 mr-1"
                              onClick={() => {
                                setEditingId(txn.sell_id);
                                setEditValues({
                                  date: (txn.sell_date || "").slice(0,10),
                                  nav: Number(txn.sell_nav) || 0,
                                  units: Number(txn.units) || 0,
                                  transaction_type: "sell",
                                  fund_short_name: fund.fund_short_name,
                                  account_name: txn.account_name || "",
                                });
                                setIsFullEditOpen(true);
                              }}
                              title="Edit sell"
                            >
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDelete(txn.sell_id)} className="text-red-600 hover:text-red-800" title="Delete">
                              <Trash2 size={16}/>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

 return (
  <div className="w-full max-w-screen-xl mx-auto p-3 sm:p-4 space-y-4">
    {/* Search + Date Filter */}
    <div className="flex flex-wrap gap-2 sm:gap-4 mb-4 items-end">
      {/* Fund Search */}
      <input
        type="text"
        placeholder="Search funds..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="p-2 border rounded flex-1 min-w-[220px]"
      />

      {/* Buy Date */}
      <div className="flex items-center gap-1 whitespace-nowrap">
    <span className="text-xs text-gray-100">Buy:</span>
    <input
      type="date"
      value={buyDateFilter}
      onChange={(e) => setBuyDateFilter(e.target.value)}
      className="p-2 border rounded w-32 sm:w-32"
      title="Filter by Buy Date"
    />
  </div>

{/* Account Name Filter */}
      <div className="flex flex-col">
        <label className="text-xs sm:text-sm font-medium mb-1"></label>
        <div className="flex items-center gap-2">
          <select
            value={accountFilter}
            onChange={e => setAccountFilter(e.target.value)}
            className="p-2 border rounded w-32 sm:w-32 text-sm"
          >
            <option value="">All Accounts</option>
            {accountList.map(account => (
              <option key={account} value={account}>{account}</option>
            ))}
          </select>
          <button
            onClick={handleMainExportToExcel}
            className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center"
            title="Download Excel"
          >
            <Download size={20} />
          </button>
        </div>
      </div>
</div>

{/* Filters Row */}
<div className="flex items-center gap-2">
  {/* Sell Date */}
  <div className="flex items-center gap-1 whitespace-nowrap">
    <span className="text-xs text-gray-100">Sell:</span>
    <input
      type="date"
      value={sellDateFilter}
      onChange={(e) => setSellDateFilter(e.target.value)}
      className="p-2 border rounded w-32 sm:w-32"
      title="Filter by Sell Date"
    />
  </div>

  {/* AMC Filter */}
  <div className="flex items-center gap-2">
    <label className="text-xs sm:text-sm font-medium whitespace-nowrap"></label>
    <select
      value={amcFilter}
      onChange={e => setAmcFilter(e.target.value)}
      className="p-2 border rounded w-32 sm:w-32 text-sm"
    >
      <option value="">All AMCs</option>
      {amcList.map(amc => (
        <option key={amc} value={amc}>{amc}</option>
      ))}
    </select>
  </div>
</div>

    {/* Holdings table */}
    <div className="overflow-x-auto rounded-lg shadow">
      <table className="min-w-full divide-y divide-orange-200">
        <thead className="bg-orange-200">
          <tr className="text-left text-xs sm:text-sm font-semibold text-gray-800">
            <th
              scope="col"
              role="button"
              tabIndex={0}
              onClick={() => handleSort("fund_short_name")}
              onKeyDown={(event) => handleHeaderKeyDown(event, "fund_short_name")}
              className="px-2 sm:px-3 py-3 whitespace-nowrap select-none cursor-pointer"
            >
              <span className="inline-flex items-center gap-1">
                Fund
                {sortConfig.key === "fund_short_name" && (
                  <span className="text-[10px] sm:text-xs text-gray-600">
                    {sortConfig.direction === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </span>
            </th>
            <th
              scope="col"
              role="button"
              tabIndex={0}
              onClick={() => handleSort("invested")}
              onKeyDown={(event) => handleHeaderKeyDown(event, "invested")}
              className="px-2 sm:px-3 py-3 whitespace-nowrap select-none cursor-pointer text-right"
            >
              <span className="inline-flex items-center justify-end gap-1 w-full">
                Invested
                {sortConfig.key === "invested" && (
                  <span className="text-[10px] sm:text-xs text-gray-600">
                    {sortConfig.direction === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </span>
            </th>
            <th
              scope="col"
              role="button"
              tabIndex={0}
              onClick={() => handleSort("closedValue")}
              onKeyDown={(event) => handleHeaderKeyDown(event, "closedValue")}
              className="px-2 sm:px-3 py-3 whitespace-nowrap select-none cursor-pointer text-right"
            >
              <span className="inline-flex items-center justify-end gap-1 w-full">
                Closed Value
                {sortConfig.key === "closedValue" && (
                  <span className="text-[10px] sm:text-xs text-gray-600">
                    {sortConfig.direction === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </span>
            </th>
            <th
              scope="col"
              role="button"
              tabIndex={0}
              onClick={() => handleSort("urp")}
              onKeyDown={(event) => handleHeaderKeyDown(event, "urp")}
              className="px-2 sm:px-3 py-3 whitespace-nowrap select-none cursor-pointer text-right"
            >
              <span className="inline-flex items-center justify-end gap-1 w-full">
                P/L
                {sortConfig.key === "urp" && (
                  <span className="text-[10px] sm:text-xs text-gray-600">
                    {sortConfig.direction === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </span>
            </th>
            <th
              scope="col"
              role="button"
              tabIndex={0}
              onClick={() => handleSort("urpPct")}
              onKeyDown={(event) => handleHeaderKeyDown(event, "urpPct")}
              className="px-2 sm:px-3 py-3 whitespace-nowrap select-none cursor-pointer text-right"
            >
              <span className="inline-flex items-center justify-end gap-1 w-full">
                P/L %
                {sortConfig.key === "urpPct" && (
                  <span className="text-[10px] sm:text-xs text-gray-600">
                    {sortConfig.direction === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </span>
            </th>
            <th
              scope="col"
              role="button"
              tabIndex={0}
              onClick={() => handleSort("xirr")}
              onKeyDown={(event) => handleHeaderKeyDown(event, "xirr")}
              className="px-2 sm:px-3 py-3 whitespace-nowrap select-none cursor-pointer text-right"
            >
              <span className="inline-flex items-center justify-end gap-1 w-full">
                XIRR
                {sortConfig.key === "xirr" && (
                  <span className="text-[10px] sm:text-xs text-gray-600">
                    {sortConfig.direction === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </span>
            </th>
            <th
              scope="col"
              role="button"
              tabIndex={0}
              onClick={() => handleSort("transactions")}
              onKeyDown={(event) => handleHeaderKeyDown(event, "transactions")}
              className="px-2 sm:px-3 py-3 whitespace-nowrap select-none cursor-pointer text-right"
            >
              <span className="inline-flex items-center justify-end gap-1 w-full">
                Transactions
                {sortConfig.key === "transactions" && (
                  <span className="text-[10px] sm:text-xs text-gray-600">
                    {sortConfig.direction === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {displayedFunds.map((fund) => {
            const transactionsCount = fund.transactions.length;
            const isSelected = detailModalFund?.fund_short_name === fund.fund_short_name;
            const plClass = fund.urp >= 0 ? "text-green-600" : "text-red-600";
            const plPctClass = fund.urpPct >= 0 ? "text-green-600" : "text-red-600";

            return (
              <tr
                key={fund.fund_short_name}
                tabIndex={0}
                onClick={() => handleFundRowClick(fund)}
                onKeyDown={(event) => handleFundRowKeyDown(event, fund)}
                className={`cursor-pointer hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-300 ${
                  isSelected ? "bg-orange-50" : ""
                }`}
              >
                <td className="px-2 sm:px-3 py-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-sm sm:text-base text-gray-900">
                      {fund.fund_short_name}
                    </span>
                  </div>
                </td>
                <td className="px-2 sm:px-3 py-3 text-right text-sm">₹{fund.invested.toFixed(0)}</td>
                <td className="px-2 sm:px-3 py-3 text-right text-sm">₹{fund.closedValue.toFixed(0)}</td>
                <td className={`px-2 sm:px-3 py-3 text-right text-sm font-semibold ${plClass}`}>
                  ₹{fund.urp.toFixed(0)}
                </td>
                <td className={`px-2 sm:px-3 py-3 text-right text-sm font-semibold ${plPctClass}`}>
                  {(isTrialMode ? 0 : fund.urpPct).toFixed(1)}%
                </td>
                <td className="px-2 sm:px-3 py-3 text-right text-sm font-semibold text-gray-900">
                  {typeof fund.xirr === "number" ? `${(isTrialMode ? 0 : fund.xirr).toFixed(1)}%` : "-"}
                </td>
                <td className="px-2 sm:px-3 py-3 text-right text-sm font-semibold text-gray-900">
                  {transactionsCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {/* Pagination */}
    <div className="flex justify-between items-center mt-4 px-2">
      <button
        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
      >
        Prev
      </button>
      <span className="text-white">Page {currentPage} of {totalPages}</span>
      <button
        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
      >
        Next
      </button>
    </div>
    <FundDetailModal fund={detailModalFund} onClose={() => setDetailModalFund(null)} />
    <FullEditModal />
  </div>
 );
};

export default MFClosedHoldings;
