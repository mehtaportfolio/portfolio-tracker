import React, { useState, useEffect } from "react";
import { useNavigation } from "../../../context/NavigationContext.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import assetAPI from "../../../api/assetAPI.js";
import { useMFTrialMode } from "../../../utils/MFTrialMode.js";
import { Edit, Trash2, X, Download } from "lucide-react";
import { exportMFTransactionsToExcel, exportMFHoldingsToExcel } from "../../../utils/excelExporter.js";

// 🔹 XIRR calculation helper
const calculateXIRR = (cashflows) => {
  if (!cashflows || cashflows.length < 2) return null;

  const npv = (rate) =>
    cashflows.reduce(
      (acc, cf) =>
        acc +
        cf.amount /
          Math.pow(1 + rate, (cf.date - cashflows[0].date) / (1000 * 60 * 60 * 24 * 365)),
      0
    );

  let low = -0.9999,
    high = 100,
    guess = 0.1;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const val = npv(mid);
    if (Math.abs(val) < 1e-6) return mid * 100; // %
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
  const year = String(d.getFullYear()).slice(-2); // last 2 digits
  return `${day}-${month}-${year}`;
};



const MFHoldings = ({ txns: propTxns = [], funds: propFunds = [], setIsAnyFormOpen }) => {
  const { isTrialMode } = useMFTrialMode();
  const { session } = useAuth();
  const { refreshDashboard, refreshAssets } = useNavigation();

  const [funds, setFunds] = useState([]);
  const originalFundsRef = React.useRef([]);
  const [selectedFundName, setSelectedFundName] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [buyDateFrom, setBuyDateFrom] = useState("");
  const [buyDateTo, setBuyDateTo] = useState("");
  const [amcFilter, setAmcFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;
  const [sortColumn, setSortColumn] = useState('fund_short_name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [modalSortColumn, setModalSortColumn] = useState('buy_date');
  const [modalSortDirection, setModalSortDirection] = useState('desc');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const handleCloseDetails = () => setSelectedFundName(null);

  const handleFundRowClick = (fundName) => {
    if (!fundName) return;
    setSelectedFundName(fundName);
  };

  const handleFundRowKeyDown = (event, fundName) => {
    if (!fundName) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedFundName(fundName);
    }
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc'); // First click: descending
    }
  };

  const handleModalSort = (column) => {
    if (modalSortColumn === column) {
      setModalSortDirection(modalSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setModalSortColumn(column);
      setModalSortDirection('desc');
    }
  };

  // Fetch MF data (new schema) and compute open positions via FIFO
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

    const normName = (s) => (s || "").trim();
    const masterMap = {};
    masters.forEach((m) => (masterMap[normName(m.fund_short_name)] = m));

    // Fetch SIP details
    let sipDetails = [];
    try {
      const data = await assetAPI.getMFData(session?.access_token);
      sipDetails = data.sipDetails || [];
    } catch (error) {
      console.error("Error fetching SIP details:", error);
    }

    const sipMap = {};
    sipDetails.forEach((sip) => {
      sipMap[normName(sip.fund_short_name)] = sip;
    });

    // Colors for categories
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

    // Group transactions by normalized fund name and build open lots via FIFO per fund
    const grouped = {};
    transactions.forEach((txn) => {
      const fsn = normName(txn.fund_short_name);
      // also normalize on the transaction object for downstream
      const normalizedTxn = { ...txn, fund_short_name: fsn };
      if (!grouped[fsn]) {
        grouped[fsn] = {
          transactions: [],
          cmp: masterMap[fsn]?.cmp ?? null,
          lcp: masterMap[fsn]?.lcp ?? null,
        };
      }
      grouped[fsn].transactions.push(normalizedTxn);
    });

    const fundList = Object.entries(grouped)
      .map(([fund_short_name, info]) => {
        const txns = (info.transactions || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
        // Build open lots per account via FIFO
        const lotsByAccount = new Map(); // acc -> array of lots { id, units, nav, date, account_name }
        txns.forEach((t) => {
          const type = String(t.transaction_type || "").toLowerCase();
          const units = Number(t.units) || 0;
          const nav = Number(t.nav) || 0;
          const dt = t.date;
          const acc = t.account_name || "";
          if (!units || !nav || !dt) return;
          if (type === "buy") {
            const arr = lotsByAccount.get(acc) || [];
            arr.push({ id: t.id, units, nav, date: dt, account_name: acc });
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
        const openLots = Array.from(lotsByAccount.values()).flat();
        const openUnits = openLots.reduce((s, l) => s + (Number(l.units) || 0), 0);
        const invested = openLots.reduce((s, l) => s + (Number(l.units) || 0) * (Number(l.nav) || 0), 0);
        const marketPrice = Number(info.cmp || info.lcp || 0) || 0;
        const marketValue = openUnits * marketPrice;
        const urp = marketValue - invested;
        const urpPct = invested > 0 ? (urp / invested) * 100 : 0;
        const avgBuy = openUnits > 0 ? invested / openUnits : 0;

        // XIRR: buys as negative, current MV as positive today
        const cashflows = [];
        openLots.forEach((l) => {
          cashflows.push({ amount: -(l.units * l.nav), date: new Date(l.date) });
        });
        if (marketValue > 0) cashflows.push({ amount: marketValue, date: new Date() });
        const xirr = calculateXIRR(cashflows);

        const sip = sipMap[fund_short_name] || null;
        const accounts = Array.from(new Set(info.transactions.map((t) => t.account_name).filter(Boolean)));
        const account_name = accounts.length === 1 ? accounts[0] : "Multiple Accounts";

        // For the table details, use open lots per account (after FIFO sells)
        const buyTransactions = openLots.map((l) => ({
          id: l.id,
          fund_short_name,
          account_name: l.account_name,
          buy_date: l.date,
          buy_nav: l.nav,
          units: l.units,
        }));

        const fundData = {
          fund_short_name,
          fund_full_name: masterMap[fund_short_name]?.fund_full_name ?? null,
          category: masterMap[fund_short_name]?.category ?? null,
          amc: masterMap[fund_short_name]?.amc_name ?? "Unknown AMC",
          account_name,
          cmp: info.cmp,
          lcp: info.lcp,
          units: isTrialMode ? 0 : openUnits,
          avgBuy: isTrialMode ? 0 : avgBuy,
          marketValue: isTrialMode ? 0 : marketValue,
          invested: isTrialMode ? 0 : invested,
          urp: isTrialMode ? 0 : urp,
          urpPct: isTrialMode ? 0 : urpPct,
          xirr: xirr,
          transactions: buyTransactions,
          sip_amount: isTrialMode ? 0 : (sip?.amount || null),
          sip_date: sip?.sip_date || null,
        };
        return fundData;
      })
      .filter((fund) => fund.units > 0);

    setFunds(fundList);
    originalFundsRef.current = fundList;
  }, [propTxns, propFunds, isTrialMode, session]);

  useEffect(() => {
    fetchFunds();
  }, [fetchFunds]);

  // Reset to page 1 when filters or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, buyDateFrom, buyDateTo, amcFilter, accountFilter, sortColumn, sortDirection]);

  // Hide main page scroll when modal is open and notify parent
  useEffect(() => {
    if (selectedFundName || isEditModalOpen) {
      document.body.style.overflow = 'hidden';
      setIsAnyFormOpen?.(true);
    } else {
      document.body.style.overflow = 'unset';
      setIsAnyFormOpen?.(false);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedFundName, isEditModalOpen, setIsAnyFormOpen]);


const amcList = React.useMemo(() => {
  return Array.from(new Set(funds.map(f => f.amc))).sort();
}, [funds]);

// Assuming you have all transactions in `allTransactions`
const accountList = React.useMemo(() => {
  return Array.from(
    new Set(funds.flatMap(f => f.transactions.map(t => t.account_name).filter(Boolean)))
  ).sort();
}, [funds]);

const getSortValue = (fund, column) => {
  switch(column) {
    case 'fund_short_name': return fund.fund_short_name;
    case 'units': return fund.units;
    case 'avgBuy': return fund.avgBuy;
    case 'cmp': return fund.cmp;
    case 'invested': return fund.invested;
    case 'marketValue': return fund.marketValue;
    case 'urp': return fund.urp;
    case 'urpPct': return fund.urpPct;
    case 'xirr': return fund.xirr;
    default: return fund.fund_short_name;
  }
};

const getModalSortValue = (txn, column, cmp) => {
  const invested = txn.units * (txn.nav ?? txn.buy_nav);
  const marketValue = txn.units * (cmp || 0);
  switch (column) {
    case 'buy_date': return txn.buy_date;
    case 'account_name': return txn.account_name;
    case 'units': return txn.units;
    case 'buy_nav': return txn.nav ?? txn.buy_nav;
    case 'invested': return invested;
    case 'marketValue': return marketValue;
    case 'urp': return marketValue - invested;
    case 'urpPct': return invested > 0 ? (marketValue - invested) / invested : 0;
    case 'xirr':
      const cf = [];
      if (txn.buy_date && (txn.nav ?? txn.buy_nav) != null) {
        cf.push({ amount: -invested, date: new Date(txn.buy_date) });
      }
      if (marketValue > 0) cf.push({ amount: marketValue, date: new Date() });
      return calculateXIRR(cf);
    default: return txn.buy_date;
  }
};

const compareValues = (a, b, direction) => {
  // Handle null/undefined (sort nulls last)
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'string' && typeof b === 'string') {
    return direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
  } else {
    return direction === 'asc' ? (a - b) : (b - a);
  }
};

  // Filter
const filteredFunds = funds
  .slice()
  .sort((a, b) => compareValues(getSortValue(a, sortColumn), getSortValue(b, sortColumn), sortDirection))

.map(fund => {
  const filteredTxns = accountFilter 
    ? fund.transactions.filter(t => t.account_name === accountFilter) 
    : fund.transactions;

  // Recalculate metrics based on filtered transactions
  const openUnits = filteredTxns.reduce((s, l) => s + (Number(l.units) || 0), 0);
  const invested = filteredTxns.reduce((s, l) => s + (Number(l.units) || 0) * (Number(l.buy_nav) || 0), 0);
  const marketPrice = Number(fund.cmp || fund.lcp || 0) || 0;
  const marketValue = openUnits * marketPrice;
  const urp = marketValue - invested;
  const urpPct = invested > 0 ? (urp / invested) * 100 : 0;
  const avgBuy = openUnits > 0 ? invested / openUnits : 0;

  // Recalculate XIRR based on filtered transactions
  const cashflows = [];
  filteredTxns.forEach((l) => {
    cashflows.push({ amount: -(l.units * l.buy_nav), date: new Date(l.buy_date) });
  });
  if (marketValue > 0) cashflows.push({ amount: marketValue, date: new Date() });
  const xirr = calculateXIRR(cashflows);

  return { 
    ...fund, 
    transactions: filteredTxns,
    units: openUnits,
    invested: invested,
    marketValue: marketValue,
    urp: urp,
    urpPct: urpPct,
    avgBuy: avgBuy,
    xirr: xirr
  };
})
.filter(fund => {
  const nameMatch = fund.fund_short_name.toLowerCase().includes(searchQuery.toLowerCase());
  const accountMatch = fund.transactions.length > 0;
  const fundBuyDates = fund.transactions
    .map(t => t.buy_date?.slice(0, 10))
    .filter(Boolean);
  const fromDate = buyDateFrom ? buyDateFrom : null;
  const toDate = buyDateTo ? buyDateTo : null;
  const hasBuyInRange = fundBuyDates.length > 0 && (
    (!fromDate && !toDate) ||
    (fromDate && !toDate && fundBuyDates.some(date => date >= fromDate)) ||
    (!fromDate && toDate && fundBuyDates.some(date => date <= toDate)) ||
    (fromDate && toDate && fundBuyDates.some(date => date >= fromDate && date <= toDate))
  );
  const matchesAmc = amcFilter ? fund.amc === amcFilter : true;

  return nameMatch && accountMatch && hasBuyInRange && matchesAmc;
});

  // Pagination
  const totalPages = Math.ceil(filteredFunds.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const displayedFunds = filteredFunds.slice(startIndex, startIndex + pageSize);

  const selectedFund = selectedFundName
    ? displayedFunds.find(f => f.fund_short_name === selectedFundName) ||
      originalFundsRef.current.find(f => f.fund_short_name === selectedFundName)
    : null;

  // Edit/Delete/Sell handlers (similar to table version)
  const handleDelete = async (id) => {
    try {
      await assetAPI.deleteTransaction('mf', id, session?.access_token);
      alert("Transaction deleted successfully!");
      await assetAPI.invalidateCache('mf', session?.access_token);
      window.dispatchEvent(new CustomEvent('portfolio-cache-invalidated', { detail: { assetType: 'mf' } }));
      await new Promise(resolve => setTimeout(resolve, 500));
      fetchFunds();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      alert("Failed to delete transaction");
    }
  };
  const handleOpenEditModal = (txn) => {
    setSelectedTransaction(txn);
    setEditValues({
      id: txn.id,
      units: txn.units,
      date: txn.buy_date || txn.date,
      nav: txn.nav ?? txn.buy_nav,
      account_name: txn.account_name || "",
    });
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedTransaction(null);
    setEditValues({});
  };


  const handleSave = async () => {
    const { id, ...updateValues } = editValues;
    try {
      await assetAPI.updateTransaction('mf', id, updateValues, session);
      alert("Transaction updated successfully!");
      setEditValues({});
      handleCloseEditModal();
      setIsEditModalOpen(true);
      await assetAPI.invalidateCache('mf', session);
      window.dispatchEvent(new CustomEvent('portfolio-cache-invalidated', { detail: { assetType: 'mf' } }));
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchFunds();
      setIsEditModalOpen(false);
      refreshDashboard();
      refreshAssets();
    } catch (error) {
      console.error("Error updating transaction:", error);
      alert("Failed to update transaction");
    }
  };

  const handleExportToExcel = async () => {
    if (!selectedFund) return;

    const exportData = selectedFund.transactions.map(txn => ({
      'Buy Date': formatDateDDMMYY(txn.buy_date),
      'Account': txn.account_name || "-",
      'Units': txn.units?.toFixed(3),
      'NAV': txn.buy_nav?.toFixed(2),
      'Invested': (txn.units * txn.buy_nav)?.toFixed(0),
      'Market Value': (txn.units * (selectedFund.cmp || 0))?.toFixed(0),
      'P/L': ((txn.units * (selectedFund.cmp || 0)) - (txn.units * txn.buy_nav))?.toFixed(0),
      'P/L %': (((txn.units * (selectedFund.cmp || 0)) - (txn.units * txn.buy_nav)) / (txn.units * txn.buy_nav) * 100)?.toFixed(1),
    }));

    const columns = [
      { key: 'Buy Date', label: 'Buy Date', width: 12 },
      { key: 'Account', label: 'Account', width: 15 },
      { key: 'Units', label: 'Units', width: 12 },
      { key: 'NAV', label: 'NAV', width: 12 },
      { key: 'Invested', label: 'Invested (₹)', width: 12 },
      { key: 'Market Value', label: 'Market Value (₹)', width: 15 },
      { key: 'P/L', label: 'P/L (₹)', width: 12 },
      { key: 'P/L %', label: 'P/L %', width: 12 },
    ];

    await exportMFTransactionsToExcel(exportData, selectedFund.fund_short_name, columns);
  };

  const handleMainExportToExcel = async () => {
    const exportData = filteredFunds.map(fund => ({
      'Fund': fund.fund_short_name,
      'Units': fund.units?.toFixed(3),
      'Avg Buy': fund.avgBuy?.toFixed(2),
      'CMP': fund.cmp?.toFixed(2),
      'Invested': fund.invested?.toFixed(0),
      'Market Value': fund.marketValue?.toFixed(0),
      'P/L': fund.urp?.toFixed(0),
      'P/L %': fund.urpPct?.toFixed(2),
      'XIRR': typeof fund.xirr === "number" ? fund.xirr.toFixed(2) : "-",
    }));

    const columns = [
      { key: 'Fund', label: 'Fund', width: 25 },
      { key: 'Units', label: 'Units', width: 12 },
      { key: 'Avg Buy', label: 'Avg Buy (₹)', width: 12 },
      { key: 'CMP', label: 'CMP (₹)', width: 12 },
      { key: 'Invested', label: 'Invested (₹)', width: 15 },
      { key: 'Market Value', label: 'Market Value (₹)', width: 15 },
      { key: 'P/L', label: 'P/L (₹)', width: 12 },
      { key: 'P/L %', label: 'P/L %', width: 12 },
      { key: 'XIRR', label: 'XIRR %', width: 12 },
    ];

    await exportMFHoldingsToExcel(exportData, 'MF_Holdings', columns);
  };

  return (
    <div className="w-full max-w-screen-xl mx-auto p-3 sm:p-4 space-y-4">
      {!isEditModalOpen && (
      <>
      {/* Filters */}
      <div className="flex flex-col gap-2 sm:gap-4">
        {/* Line 1: Search + Download */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4 w-full">
          <div className="flex items-center gap-2 w-full">
            <input
              type="text"
              placeholder="Search funds..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 p-2 border rounded"
            />
            <button
              onClick={handleMainExportToExcel}
              className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center"
              title="Download Excel"
            >
              <Download size={20} />
            </button>
          </div>
        </div>

        {/* Line 2: Buy Date Range */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col">
            <label htmlFor="buyDateFrom" className="text-xs text-gray-100 mb-1">
              From
            </label>
            <input
              id="buyDateFrom"
              type="date"
              value={buyDateFrom}
              onChange={(e) => setBuyDateFrom(e.target.value)}
              className="w-full p-2 border rounded"
              title="Filter by Buy Date from"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="buyDateTo" className="text-xs text-gray-100 mb-1">
              To
            </label>
            <input
              id="buyDateTo"
              type="date"
              value={buyDateTo}
              onChange={(e) => setBuyDateTo(e.target.value)}
              className="w-full p-2 border rounded"
              title="Filter by Buy Date to"
            />
          </div>
        </div>

        {/* Line 3: AMC + Account */}
        <div className="grid grid-cols-2 gap-2">
          {/* AMC Filter */}
          <div className="flex flex-col">
            <label className="text-xs sm:text-sm text-white font-medium mb-1">AMC</label>
            <select
              value={amcFilter}
              onChange={e => setAmcFilter(e.target.value)}
              className="w-full p-2 border rounded text-sm"
            >
              <option value="">All AMCs</option>
              {amcList.map(amc => (
                <option key={amc} value={amc}>{amc}</option>
              ))}
            </select>
          </div>

          {/* Account Name Filter */}
          <div className="flex flex-col">
            <label className="text-xs sm:text-sm text-white font-medium mb-1">Account</label>
            <select
              value={accountFilter}
              onChange={e => setAccountFilter(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">All Accounts</option>
              {accountList.map(acc => (
                <option key={acc} value={acc}>{acc}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Holdings table */}
     <div className="overflow-x-auto rounded-lg shadow">
       <table className="min-w-full divide-y divide-orange-200">
         <thead className="bg-orange-200">
           <tr className="text-left text-xs sm:text-sm font-semibold text-gray-800">
             <th className="px-2 sm:px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('fund_short_name')}>Fund{sortColumn === 'fund_short_name' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
             <th className="px-2 sm:px-3 py-3 whitespace-nowrap text-right cursor-pointer" onClick={() => handleSort('units')}>Units{sortColumn === 'units' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
             <th className="px-2 sm:px-3 py-3 whitespace-nowrap text-right cursor-pointer" onClick={() => handleSort('avgBuy')}>Avg Buy{sortColumn === 'avgBuy' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
             <th className="px-2 sm:px-3 py-3 whitespace-nowrap text-right cursor-pointer" onClick={() => handleSort('cmp')}>CMP{sortColumn === 'cmp' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
             <th className="px-2 sm:px-3 py-3 whitespace-nowrap text-right cursor-pointer" onClick={() => handleSort('invested')}>Invested{sortColumn === 'invested' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
             <th className="px-2 sm:px-3 py-3 whitespace-nowrap text-right cursor-pointer" onClick={() => handleSort('marketValue')}>Market Value{sortColumn === 'marketValue' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
             <th className="px-2 sm:px-3 py-3 whitespace-nowrap text-right cursor-pointer" onClick={() => handleSort('urp')}>P/L{sortColumn === 'urp' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
             <th className="px-2 sm:px-3 py-3 whitespace-nowrap text-right cursor-pointer" onClick={() => handleSort('urpPct')}>P/L %{sortColumn === 'urpPct' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
             <th className="px-2 sm:px-3 py-3 whitespace-nowrap text-right cursor-pointer" onClick={() => handleSort('xirr')}>XIRR{sortColumn === 'xirr' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
           </tr>
         </thead>
         <tbody className="bg-white divide-y divide-gray-200">
           {displayedFunds.map((fund) => {
             const isSelected = selectedFundName === fund.fund_short_name;
             const plClass = fund.urp >= 0 ? "text-green-600" : "text-red-600";
             const plPctClass = fund.urpPct >= 0 ? "text-green-600" : "text-red-600";

             return (
               <tr
                 key={fund.fund_short_name}
                 tabIndex={0}
                 onClick={() => handleFundRowClick(fund.fund_short_name)}
                 onKeyDown={(event) => handleFundRowKeyDown(event, fund.fund_short_name)}
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
                 <td className="px-2 sm:px-3 py-3 text-right text-sm">{fund.units?.toFixed(0) ?? "-"}</td>
                 <td className="px-2 sm:px-3 py-3 text-right text-sm">₹{fund.avgBuy?.toFixed(1) ?? "-"}</td>
                 <td className="px-2 sm:px-3 py-3 text-right text-sm">{fund.cmp?.toFixed(1) ?? "-"}</td>
                 <td className="px-2 sm:px-3 py-3 text-right text-sm">₹{fund.invested.toFixed(0)}</td>
                 <td className="px-2 sm:px-3 py-3 text-right text-sm">
                   <span className="font-semibold text-gray-900">₹{fund.marketValue?.toFixed(0) ?? "-"}</span>
                 </td>
                 <td className={`px-2 sm:px-3 py-3 text-right text-sm font-semibold ${plClass}`}>
                   ₹{fund.urp.toFixed(0)}
                 </td>
                 <td className={`px-2 sm:px-3 py-3 text-right text-sm font-semibold ${plPctClass}`}>
                   {(isTrialMode ? 0 : fund.urpPct).toFixed(1)}%
                 </td>
                 <td className="px-2 sm:px-3 py-3 text-right text-sm font-semibold text-gray-900">
                   {typeof fund.xirr === "number" ? `${(isTrialMode ? 0 : fund.xirr).toFixed(1)}%` : "-"}
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
      </>
      )}

     {/* Transactions Modal */}
     {selectedFund && (
       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
         <div className="bg-white rounded-lg shadow-lg w-11/12 max-w-4xl h-[60vh] overflow-hidden flex flex-col">
           <div className="flex justify-between items-center p-4 border-b">
             <h2 className="text-lg font-semibold">{selectedFund.fund_full_name}</h2>
             <div className="flex items-center gap-2">
               <button 
                 onClick={handleExportToExcel}
                 className="text-green-600 hover:text-green-700 transition"
                 title="Download as Excel"
               >
                 <Download size={24} />
               </button>
               <button onClick={handleCloseDetails} className="text-red-600 hover:text-red-700">
                 <X size={24} />
               </button>
             </div>
           </div>
           <div className="p-4 overflow-y-auto overflow-x-scroll flex-1">
             <div className="rounded-lg border">
               <table className="min-w-full divide-y divide-orange-200">
                 <thead className="bg-orange-200">
                   <tr>
                     <th className="px-2 sm:px-3 py-2 text-left text-[12px] sm:text-xs font-medium text-black-500 tracking-wider cursor-pointer" onClick={() => handleModalSort('buy_date')}>Buy Date{modalSortColumn === 'buy_date' && (modalSortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
                     <th className="px-2 sm:px-3 py-2 text-left text-[12px] sm:text-xs font-medium text-black-500 tracking-wider cursor-pointer" onClick={() => handleModalSort('account_name')}>Account{modalSortColumn === 'account_name' && (modalSortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
                     <th className="px-2 sm:px-3 py-2 text-left text-[12px] sm:text-xs font-medium text-black-500  tracking-wider cursor-pointer" onClick={() => handleModalSort('units')}>Units{modalSortColumn === 'units' && (modalSortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
                     <th className="px-2 sm:px-3 py-2 text-left text-[12px] sm:text-xs font-medium text-black-500  tracking-wider cursor-pointer" onClick={() => handleModalSort('buy_nav')}>NAV{modalSortColumn === 'buy_nav' && (modalSortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
                     <th className="px-2 sm:px-3 py-2 text-left text-[12px] sm:text-xs font-medium text-black-500 tracking-wider cursor-pointer" onClick={() => handleModalSort('invested')}>Invested{modalSortColumn === 'invested' && (modalSortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
                     <th className="px-2 sm:px-3 py-2 text-left text-[12px] sm:text-xs font-medium text-black-500 tracking-wider cursor-pointer" onClick={() => handleModalSort('marketValue')}>Mkt Value{modalSortColumn === 'marketValue' && (modalSortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
                     <th className="px-2 sm:px-3 py-2 text-left text-[12px] sm:text-xs font-medium text-black-500 tracking-wider cursor-pointer" onClick={() => handleModalSort('urp')}>P/L{modalSortColumn === 'urp' && (modalSortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
                     <th className="px-2 sm:px-3 py-2 text-left text-[12px] sm:text-xs font-medium text-black-500 tracking-wider cursor-pointer" onClick={() => handleModalSort('urpPct')}>P/L %{modalSortColumn === 'urpPct' && (modalSortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
                     <th className="px-2 sm:px-3 py-2 text-left text-[12px] sm:text-xs font-medium text-black-500 tracking-wider cursor-pointer" onClick={() => handleModalSort('xirr')}>XIRR{modalSortColumn === 'xirr' && (modalSortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
                     <th className="px-2 sm:px-3 py-2 text-left text-[12px] sm:text-xs font-medium text-black-500 tracking-wider">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="bg-white divide-y divide-gray-200">
                   {selectedFund.transactions
                     .slice()
                     .sort((a, b) => compareValues(getModalSortValue(a, modalSortColumn, selectedFund.cmp), getModalSortValue(b, modalSortColumn, selectedFund.cmp), modalSortDirection))
                     .map(txn => {
                     if (txn.sell_date) return null;

                     const invested = txn.units * (txn.nav ?? txn.buy_nav);
                     const unitsVal = txn.units;
                     const buyNavVal = txn.nav ?? txn.buy_nav;
                     const marketValue = unitsVal * (selectedFund.cmp || 0);
                     const urp = marketValue - invested;
                     const urpPct = invested > 0 ? (urp / invested) * 100 : 0;

                     const cf = [];
                     if (txn.buy_date && buyNavVal != null) cf.push({ amount: -(unitsVal * buyNavVal), date: new Date(txn.buy_date) });
                     if (marketValue > 0) cf.push({ amount: marketValue, date: new Date() });
                     const txnXirr = calculateXIRR(cf);

                     return (
                       <tr key={txn.id} className="hover:bg-gray-50">
                         <td className="px-3 py-2 whitespace-nowrap">
                           {formatDateDDMMYY(txn.buy_date)}
                         </td>
                         <td className="px-3 py-2 whitespace-nowrap">
                           {txn.account_name || "-"}
                         </td>
                         <td className="px-3 py-2 whitespace-nowrap">
                           {txn.units}
                         </td>
                         <td className="px-3 py-2 whitespace-nowrap">
                           {(txn.nav ?? txn.buy_nav)?.toFixed(2)}
                         </td>
                         <td className="px-3 py-2 whitespace-nowrap">₹{invested.toFixed(0)}</td>
                         <td className="px-3 py-2 whitespace-nowrap">₹{marketValue.toFixed(0)}</td>
                         <td className={`px-3 py-2 whitespace-nowrap ${urp >= 0 ? "text-green-600" : "text-red-600"}`}>₹{urp.toFixed(0)}</td>
                         <td className={`px-3 py-2 whitespace-nowrap ${urpPct >= 0 ? "text-green-600" : "text-red-600"}`}>{(isTrialMode ? 0 : urpPct).toFixed(1)}%</td>
                         <td className="px-3 py-2 whitespace-nowrap">{typeof txnXirr === "number" ? (isTrialMode ? 0 : txnXirr).toFixed(1) + "%" : "-"}</td>
<td className="px-3 py-2 whitespace-nowrap">
  <div className="flex items-center space-x-2 text-xs sm:text-sm">
    <button
      onClick={() => handleOpenEditModal(txn)}
      className="text-blue-600 hover:text-blue-800"
      title="Edit"
    >
      <Edit size={16} />
    </button>

    <button
      onClick={() => handleDelete(txn.id)}
      className="text-red-600 hover:text-red-800"
      title="Delete"
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
           </div>
         </div>
       </div>
     )}

     {/* Edit Modal */}
     {isEditModalOpen && selectedTransaction && selectedFund && (
       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
         <div className="bg-white rounded-lg shadow-lg w-11/12 max-w-md overflow-hidden flex flex-col">
           <div className="flex justify-between items-center p-4 border-b bg-orange-50">
             <h2 className="text-lg font-semibold">{selectedFund.fund_short_name}</h2>
             <button onClick={handleCloseEditModal} className="text-red-600 hover:text-red-700">
               <X size={24} />
             </button>
           </div>
           <div className="p-6 space-y-4">
             <div className="space-y-1">
               <label className="block text-sm font-medium text-gray-700">Date</label>
               <input
                 type="date"
                 className="w-full p-2 border rounded"
                 value={editValues.date ? editValues.date.slice(0, 10) : ""}
                 onChange={(e) => setEditValues({ ...editValues, date: e.target.value })}
               />
             </div>

             <div className="space-y-1">
               <label className="block text-sm font-medium text-gray-700">NAV</label>
               <input
                 type="number"
                 step="0.01"
                 className="w-full p-2 border rounded"
                 value={editValues.nav || ""}
                 onChange={(e) => setEditValues({ ...editValues, nav: e.target.value })}
               />
             </div>

             <div className="space-y-1">
               <label className="block text-sm font-medium text-gray-700">Units</label>
               <input
                 type="number"
                 step="0.01"
                 className="w-full p-2 border rounded"
                 value={editValues.units || ""}
                 onChange={(e) => setEditValues({ ...editValues, units: e.target.value })}
               />
             </div>

             <div className="space-y-1">
               <label className="block text-sm font-medium text-gray-700">Account Name</label>
               <select
                 value={editValues.account_name || ""}
                 onChange={(e) => setEditValues({ ...editValues, account_name: e.target.value })}
                 className="w-full p-2 border rounded"
               >
                 <option value="">Select Account</option>
                 {accountList.map(acc => (
                   <option key={acc} value={acc}>{acc}</option>
                 ))}
               </select>
             </div>

             <div className="flex gap-3 justify-end pt-4">
               <button
                 onClick={handleCloseEditModal}
                 className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
               >
                 Cancel
               </button>
               <button
                 onClick={handleSave}
                 className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
               >
                 Save
               </button>
             </div>
           </div>
         </div>
       </div>
     )}


   </div>
);
 };

export default MFHoldings;
