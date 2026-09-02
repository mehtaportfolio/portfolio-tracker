import React, { useState } from "react";
import { Edit, Trash2, ChevronUp, ChevronDown, Download, Calendar } from "lucide-react";
import { useMFTrialMode } from "../../../utils/MFTrialMode.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import mfAPI from "../../../api/mfAPI.js";
import { exportMFHoldingsToExcel } from "../../../utils/excelExporter.js";

export default function MFSIP({ sipDetails = [], fundMaster = [], accountSummaries = [], onEditSip, onAddSip, setIsAnyFormOpen }) {
  const { isTrialMode } = useMFTrialMode();
  const { session } = useAuth();

  const [sortColumn, setSortColumn] = useState('account_name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [accountFilter, setAccountFilter] = useState('All');
  const [amcFilter, setAmcFilter] = useState('All');
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [modalMonth, setModalMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [modalYear, setModalYear] = useState(new Date().getFullYear());
  const [selectedMonthYear, setSelectedMonthYear] = useState('All');

  // Create mapping for AMC names
  const fundToAmcMap = fundMaster.reduce((acc, fund) => {
    acc[fund.fund_short_name] = fund.amc_name;
    return acc;
  }, {});

  // Add AMC name to each SIP for easier filtering and display
  const sipsWithAmc = sipDetails.map(sip => ({
    ...sip,
    amc_name: fundToAmcMap[sip.fund_short_name] || 'Unknown'
  }));

  // Get unique filter options
  const accountOptions = ['All', ...new Set(sipsWithAmc.map(s => s.account_name))].sort();
  const amcOptions = ['All', ...new Set(sipsWithAmc.map(s => s.amc_name))].sort();

  // (removed unused getRecentMonths to satisfy lint)

  // Filter SIPs (month filter applies to display of SIP list as well)
  const sipOccursInMonth = (sip, monthYear) => {
    if (!monthYear || monthYear === 'All') return true;
    try {
      const sipStr = (sip.sip_date || '').toString().trim();
      if (sipStr.includes('-') || sipStr.includes('/')) {
        const sipDate = new Date(sipStr);
        if (!isNaN(sipDate.getTime())) {
          const y = sipDate.getFullYear();
          const m = String(sipDate.getMonth() + 1).padStart(2, '0');
          return `${y}-${m}` === monthYear;
        }
      }
      // day-of-month SIP counts for every month
      const sipDay = parseInt(sipStr, 10);
      if (!isNaN(sipDay)) return true;
      return false;
    } catch (e) {
      return false;
    }
  };

  const filteredSips = sipsWithAmc.filter(sip => {
    const matchesAccount = accountFilter === 'All' || sip.account_name === accountFilter;
    const matchesAmc = amcFilter === 'All' || sip.amc_name === amcFilter;
    const matchesMonth = sipOccursInMonth(sip, selectedMonthYear);
    return matchesAccount && matchesAmc && matchesMonth;
  });

  const summaryRows = accountSummaries.length > 0 ? accountSummaries : [];

  // Compute summary rows from SIPs (used when accountSummaries not provided)
  const computeSummaryFromSips = (sips) => {
    const map = {};
    sips.forEach(s => {
      const acct = s.account_name || 'Unknown';
      const amt = parseFloat(s.amount) || 0;
      if (!map[acct]) map[acct] = { account_name: acct, totalAmount: 0, sipAmount: 0, currentMonth: 0 };
      map[acct].totalAmount += amt;
      map[acct].sipAmount += amt;
      // currentMonth placeholder; real currentMonth updated when month-year selected
    });
    return Object.values(map);
  };

  const summaryRowsComputed = (summaryRows.length > 0) ? summaryRows : computeSummaryFromSips(sipsWithAmc);

  // Update currentMonth values using transactions for a selected month-year
  const updateCurrentMonthFromTxns = React.useCallback(async (monthYear) => {
    if (!monthYear || monthYear === 'All') return summaryRowsComputed;
    if (!session) return summaryRowsComputed;
    try {
      const data = await mfAPI.getMFData(session?.access_token);
      const transactions = data.transactions || [];
      const [yearStr, monthStr] = monthYear.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1; // JS month 0-index
      const currentMonthAmountByAccount = {};
      transactions.forEach(txn => {
        const txnDate = new Date(txn.date);
        if (!Number.isFinite(txnDate.getTime())) return;
        if (txnDate.getFullYear() !== year || txnDate.getMonth() !== month) return;
        const accName = txn.account_name || 'Unknown';
        const amount = (parseFloat(txn.units) || 0) * (parseFloat(txn.nav) || 0);
        currentMonthAmountByAccount[accName] = (currentMonthAmountByAccount[accName] || 0) + amount;
      });

      // Merge into summaryRowsComputed
      const merged = summaryRowsComputed.map(r => ({
        ...r,
        currentMonth: currentMonthAmountByAccount[r.account_name] || 0
      }));
      return merged;
    } catch (error) {
      console.error('Error fetching MF transactions for month filter:', error);
      return summaryRowsComputed;
    }
  }, [session, summaryRowsComputed]);

  const [summaryRowsToShow, setSummaryRowsToShow] = useState(summaryRowsComputed);

  React.useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      if (selectedMonthYear && selectedMonthYear !== 'All') {
        const updated = await updateCurrentMonthFromTxns(selectedMonthYear);
        if (mounted) setSummaryRowsToShow(updated);
      } else {
        if (mounted) setSummaryRowsToShow(summaryRowsComputed);
      }
    };
    refresh();
    return () => { mounted = false; };
  }, [selectedMonthYear, sipDetails.length, accountSummaries.length, summaryRowsComputed, updateCurrentMonthFromTxns]);

  // Compute SIP status: 'Completed' if SIP day is before today's date, otherwise 'Pending'
  const computeSipStatus = (sip) => {
    try {
      const sipStr = (sip.sip_date || '').toString().trim();
      const today = new Date();

      // If sip_date looks like a full date, compare full dates
      if (sipStr.includes('-') || sipStr.includes('/')) {
        const sipDate = new Date(sipStr);
        if (!isNaN(sipDate.getTime())) {
          // Compare only date portion (ignore time)
          const sipYMD = new Date(sipDate.getFullYear(), sipDate.getMonth(), sipDate.getDate()).getTime();
          const todayYMD = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
          return sipYMD < todayYMD ? 'Completed' : 'Pending';
        }
      }

      // Otherwise treat sip_date as day-of-month
      const sipDay = parseInt(sipStr, 10);
      if (!isNaN(sipDay)) {
        const todayDay = today.getDate();
        return sipDay < todayDay ? 'Completed' : 'Pending';
      }

      return 'Pending';
    } catch (e) {
      return 'Pending';
    }
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedSipDetails = [...filteredSips].sort((a, b) => {
    let aVal = a[sortColumn];
    let bVal = b[sortColumn];

    if (sortColumn === 'amount') {
      aVal = parseFloat(aVal) || 0;
      bVal = parseFloat(bVal) || 0;
    } else if (sortColumn === 'created_at') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    } else {
      aVal = (aVal || '').toString().toLowerCase();
      bVal = (bVal || '').toString().toLowerCase();
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleEdit = (sip) => {
    onEditSip(sip);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this SIP?")) return;

    try {
      await mfAPI.deleteSIP(id, session);
      // Dispatch refresh event instead of reload
      window.dispatchEvent(new CustomEvent('portfolio-cache-invalidated', { detail: { assetType: 'mf' } }));
    } catch (error) {
      console.error('Error deleting SIP:', error);
      alert('Failed to delete SIP');
    }
  };

  const handleExportToExcel = async () => {
    const exportData = sortedSipDetails.map(sip => ({
      'Account': sip.account_name,
      'AMC': sip.amc_name,
      'Fund Name': sip.fund_short_name,
      'Amount': parseFloat(sip.amount) || 0,
      'SIP Day': sip.sip_date,
      'Status': computeSipStatus(sip),
    }));

    const columns = [
      { key: 'Account', label: 'Account', width: 20 },
      { key: 'AMC', label: 'AMC', width: 25 },
      { key: 'Fund Name', label: 'Fund Name', width: 30 },
      { key: 'Amount', label: 'Amount (₹)', width: 12 },
      { key: 'SIP Day', label: 'SIP Day', width: 10 },
      { key: 'Status', label: 'Status', width: 12 },
    ];

    await exportMFHoldingsToExcel(exportData, 'MF_SIP_Details', columns);
  };

  // Open modal apply handler
  const applyMonthYear = async () => {
    const y = String(modalYear).padStart(4, '0');
    const m = String(modalMonth).padStart(2, '0');
    const monthYear = `${y}-${m}`;
    setSelectedMonthYear(monthYear);
    setShowMonthModal(false);
    const updated = await updateCurrentMonthFromTxns(monthYear);
    setSummaryRowsToShow(updated);
  };

  const clearMonthYear = async () => {
    setSelectedMonthYear('All');
    setShowMonthModal(false);
    setSummaryRowsToShow(summaryRowsComputed);
  };

  return (
    <div className="w-full max-w-screen-xl mx-auto p-3 sm:p-6">
      {showMonthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-4 w-80 max-w-full">
            <h3 className="text-gray-900 font-semibold mb-3">Select Month & Year</h3>
            <div className="flex gap-2 items-center mb-3">
              <select value={modalMonth} onChange={(e) => setModalMonth(parseInt(e.target.value, 10))} className="flex-1 border rounded px-2 py-1">
                <option value={1}>January</option>
                <option value={2}>February</option>
                <option value={3}>March</option>
                <option value={4}>April</option>
                <option value={5}>May</option>
                <option value={6}>June</option>
                <option value={7}>July</option>
                <option value={8}>August</option>
                <option value={9}>September</option>
                <option value={10}>October</option>
                <option value={11}>November</option>
                <option value={12}>December</option>
              </select>
              <input type="number" value={modalYear} onChange={(e) => setModalYear(e.target.value)} className="w-24 border rounded px-2 py-1" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowMonthModal(false); }} className="px-3 py-1 rounded border">Cancel</button>
              <button onClick={clearMonthYear} className="px-3 py-1 rounded border">Clear</button>
              <button onClick={applyMonthYear} className="px-3 py-1 rounded bg-indigo-600 text-white">Apply</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 flex-nowrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account</label>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="bg-gray-800 text-gray-100 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 transition-all min-w-[100px]"
            >
              {accountOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AMC Name</label>
            <div className="flex items-center gap-2">
              <select
                value={amcFilter}
                onChange={(e) => setAmcFilter(e.target.value)}
                className="bg-gray-800 text-gray-100 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 transition-all min-w-[100px]"
              >
                {amcOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <button
                onClick={handleExportToExcel}
                className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center shadow-lg border border-green-500/30"
                title="Download Excel"
              >
                <Download size={20} />
              </button>
              <button
                onClick={() => setShowMonthModal(true)}
                className="p-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center shadow-sm border border-gray-600/30"
                title="Select Month"
              >
                <Calendar size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-700 to-indigo-800 rounded-xl p-4 shadow-lg min-w-[200px] border border-purple-500/30 overflow-x-auto">
          <div className="text-purple-200 text-xs font-bold uppercase tracking-widest mb-3">Account Summary</div>
          <table className="min-w-full text-sm text-white/90">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left font-semibold uppercase tracking-wide text-purple-100">Account</th>
                <th className="px-2 py-2 text-right font-semibold uppercase tracking-wide text-purple-100">Total Amount</th>
                <th className="px-2 py-2 text-right font-semibold uppercase tracking-wide text-purple-100">SIP Amount</th>
                <th className="px-2 py-2 text-right font-semibold uppercase tracking-wide text-purple-100">Current Month</th>
              </tr>
            </thead>
            <tbody>
                {(!summaryRowsToShow || summaryRowsToShow.length === 0) ? (
                  <tr>
                    <td colSpan="4" className="px-2 py-3 text-center text-white/70">No account summary available</td>
                  </tr>
                ) : summaryRowsToShow.map((row) => (
                  <tr key={row.account_name} className="border-t border-white/10">
                    <td className="px-2 py-2 truncate">{row.account_name || 'Unknown'}</td>
                    <td className="px-2 py-2 text-right font-semibold">₹{isTrialMode ? '0' : (row.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    <td className="px-2 py-2 text-right">₹{isTrialMode ? '0' : (row.sipAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    <td className="px-2 py-2 text-right">₹{isTrialMode ? '0' : (row.currentMonth || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="text-lg text-gray-100 font-bold mb-4">SIP Details {selectedMonthYear && selectedMonthYear !== 'All' ? `for ${new Date(selectedMonthYear + '-01').toLocaleString(undefined, { month: 'long', year: 'numeric' })}` : ''}</h2>

      <div className="overflow-auto max-h-96">
        <table className="min-w-full bg-white border border-gray-300 rounded-lg table-fixed">
          <thead className="bg-orange-500">
            <tr>
              <th className="px-4 py-2 text-left whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort('account_name')}>
                Account {sortColumn === 'account_name' && (sortDirection === 'asc' ? <ChevronUp size={16} className="inline ml-1" /> : <ChevronDown size={16} className="inline ml-1" />)}
              </th>
              <th className="px-4 py-2 text-left whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort('amc_name')}>
                AMC {sortColumn === 'amc_name' && (sortDirection === 'asc' ? <ChevronUp size={16} className="inline ml-1" /> : <ChevronDown size={16} className="inline ml-1" />)}
              </th>
              <th className="px-4 py-2 text-left whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort('fund_short_name')}>
                Fund Name {sortColumn === 'fund_short_name' && (sortDirection === 'asc' ? <ChevronUp size={16} className="inline ml-1" /> : <ChevronDown size={16} className="inline ml-1" />)}
              </th>
              <th className="px-4 py-2 text-left whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort('amount')}>
                Amount {sortColumn === 'amount' && (sortDirection === 'asc' ? <ChevronUp size={16} className="inline ml-1" /> : <ChevronDown size={16} className="inline ml-1" />)}
              </th>
              <th className="px-4 py-2 text-left whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort('sip_date')}>
                SIP Day {sortColumn === 'sip_date' && (sortDirection === 'asc' ? <ChevronUp size={16} className="inline ml-1" /> : <ChevronDown size={16} className="inline ml-1" />)}
              </th>
              <th className="px-4 py-2 text-left whitespace-nowrap">Status</th>
              <th className="px-4 py-2 text-left whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedSipDetails.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-2 text-center text-gray-500 whitespace-nowrap">
                  No SIP details available
                </td>
              </tr>
            ) : (
              sortedSipDetails.map((sip) => (
                <tr key={sip.id} className="border-t border-gray-200">
                  <td className="px-4 py-2 whitespace-nowrap">{sip.account_name}</td>
                  <td className="px-4 py-2 whitespace-nowrap truncate" title={sip.amc_name}>{sip.amc_name}</td>
                  <td className="px-4 py-2 whitespace-nowrap truncate" title={sip.fund_short_name}>{sip.fund_short_name}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{isTrialMode ? 0 : sip.amount}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{sip.sip_date}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {(() => {
                      const status = computeSipStatus(sip);
                      return (
                        <span className={"font-medium " + (status === 'Completed' ? 'text-green-600' : 'text-yellow-500')}>{status}</span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2 flex gap-2 whitespace-nowrap">
                    <button
                      onClick={() => handleEdit(sip)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(sip.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
