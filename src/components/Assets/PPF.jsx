// src/components/Assets/PPF.js
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import assetAPI from "../../api/assetAPI.js";
import { useTrialMode } from "../../hooks/useTrialMode.js";
import PPFForm from "./Forms/PPFForm.jsx";
import { 
  Plus, 
  FileText, 
  FileSpreadsheet, 
  Pencil, 
  Trash,
  Wallet,
  Landmark,
  TrendingUp,
  Activity,
  Calendar,
  IndianRupee,
  Target, 
  ChevronRight
} from "lucide-react";

import { useAuth } from "../../context/AuthContext.jsx";

// Format amounts in Indian system with short units (Cr, L).
function formatINRShort(value) {
  const num = Number(value) || 0;
  const abs = Math.abs(num);

  const CRORE = 1e7; // 1,00,00,000
  const LAKH = 1e5;  // 1,00,000
  const THOUSAND = 1e3; // 1,000

  if (abs >= CRORE) return `₹${(num / CRORE).toFixed(2)} Cr`;
  if (abs >= LAKH) return `₹${(num / LAKH).toFixed(2)} L`;
  if (abs >= THOUSAND) return `₹${(num / THOUSAND).toFixed(2)} K`;
  
  return `₹${num.toLocaleString("en-IN")}`;
}

const ExcelFormulas = {
  DaysBetween: function (date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
  },
  PVIF: function (rate, nper) {
    return Math.pow(1 + rate, nper);
  },
  FVIFA: function (rate, nper) {
    return rate === 0 ? nper : (this.PVIF(rate, nper) - 1) / rate;
  },
  XNPV: function (rate, values) {
    let xnpv = 0.0;
    const firstDate = values[0].Date;
    for (let i = 0; i < values.length; i++) {
      const value = values[i].Flow;
      const date = values[i].Date;
      xnpv += value / Math.pow(1 + rate, this.DaysBetween(firstDate, date) / 365);
    }
    return xnpv;
  },
  XIRR: function (values, guess) {
    if (!guess) guess = 0.05;
    let x1 = 0.0;
    let x2 = guess;
    let f1 = this.XNPV(x1, values);
    let f2 = this.XNPV(x2, values);

    for (let j = 0; j < 100; j++) {
      if (f1 * f2 < 0.0) break;
      if (Math.abs(f1) < Math.abs(f2)) {
        x1 += 1.6 * (x1 - x2);
        f1 = this.XNPV(x1, values);
      } else {
        x2 += 1.6 * (x2 - x1);
        f2 = this.XNPV(x2, values);
      }
    }

    if (f1 * f2 > 0.0) return null;

    let f = this.XNPV(x2, values);
    let xl, xh;
    if (f < 0.0) {
      xl = x2;
      xh = x1;
    } else {
      xl = x1;
      xh = x2;
    }

    let x;
    for (let k = 0; k < 100; k++) {
      x = (xl + xh) / 2;
      if (this.XNPV(x, values) > 0.0) {
        xh = x;
      } else {
        xl = x;
      }
      if (Math.abs(xh - xl) < 1e-7) break;
    }

    return x;
  },
};

// --- PPF Projection (monthly compounding, annuity-due) ---
export function calculateProjectedPPFMaturity(currentBalance, prefs) {
  const {
    currentCorpus,
    monthlyDeposit,
    years,
    interestRate,
    excludeCorpusFromInvested = true,
  } = prefs || {};

  const months = Math.max(0, Math.round((Number(years) || 0) * 12));
  const monthlyRate = (Number(interestRate) || 0) / 100 / 12;

  // If excluding corpus, projection starts at zero corpus and invested, otherwise include current corpus
  let corpus = excludeCorpusFromInvested ? 0 : (Number(currentCorpus ?? currentBalance) || 0);
  let invested = excludeCorpusFromInvested ? 0 : (Number(currentCorpus ?? currentBalance) || 0);

  const mDep = Number(monthlyDeposit) || 0;

  for (let m = 1; m <= months; m++) {
    corpus = (corpus + mDep) * (1 + monthlyRate);
    invested += mDep;
  }

  return { invested, profit: corpus - invested, totalValue: corpus };
}

const PPF = () => {
  const { isTrialMode } = useTrialMode();
  const { session } = useAuth();
  const token = session?.access_token;
  // eslint-disable-next-line no-unused-vars
  const [assets, setAssets] = useState([]);
  const [userMasterData, setUserMasterData] = useState([]);

  // Fetch Master Data (Account Details)
  const fetchUserMaster = useCallback(async () => {
    if (!token) return;
    try {
      const data = await assetAPI.getUserMaster('PPF', token);
      setUserMasterData(data || []);
    } catch (err) {
      console.error("❌ Error fetching account data:", err);
    }
  }, [token]);

  // eslint-disable-next-line no-unused-vars
  const [summary, setSummary] = useState({ PPF: { current: 0, diff: 0 } });
  const [ppfTotals, setPpfTotals] = useState({ currentBalance: 0, investment: 0, interestEarned: 0 });
  const [fdTotals, setFdTotals] = useState({ currentBalance: 0, investment: 0, interestEarned: 0 });
  const [totals, setTotals] = useState({ currentBalance: 0, investment: 0, interestEarned: 0 }); // for compatibility
  // eslint-disable-next-line no-unused-vars
  const [diffByAccount, setDiffByAccount] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [activeTab, setActiveTab] = useState("Dashboard"); // "Dashboard" | "Account Details" | "Summary"
  // Projection state (like EPF)
  const [showProjectionForm, setShowProjectionForm] = useState(false);
  const defaultProjectionPrefs = {
    currentCorpus: null,
    monthlyDeposit: 0,
    years: 15,
    interestRate: 7.1,
    excludeCorpusFromInvested: true,
  };
  const [projectionPrefs, setProjectionPrefs] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ppf_projection_prefs_v1') || 'null');
      return saved ? { ...defaultProjectionPrefs, ...saved } : defaultProjectionPrefs;
    } catch {
      return defaultProjectionPrefs;
    }
  });

  const [ppfXirr, setPpfXirr] = useState(null);
  const [fdXirr, setFdXirr] = useState(null);

  // Account details editing state
  const [editingAccount, setEditingAccount] = useState(null);
  const [showEditAccountForm, setShowEditAccountForm] = useState(false);

  const [showEditFdAccountForm, setShowEditFdAccountForm] = useState(false);

  // Add new account modal state
  const [showAddAccountForm, setShowAddAccountForm] = useState(false);
  const [showFyMenu, setShowFyMenu] = useState(false);
  const fyMenuRef = useRef(null);

  useEffect(() => {
    if (!showFyMenu) return undefined;

    const handleClickOutside = (event) => {
      if (fyMenuRef.current && !fyMenuRef.current.contains(event.target)) {
        setShowFyMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFyMenu]);

  const [newAccountData, setNewAccountData] = useState({
    account_name: '',
    asset_type: '',
    uan: '',
    epf_number: '',
    date_of_joining: '',
    pran_number: '',
    account_number: '',
    bank_name: '',
    company_name: '',
    broker_name: '',
    date_of_left: ''
  });

  // Helper for toNumber
  const toNumber = useCallback((val) => {
    if (typeof val === "number") return val;
    const n = parseFloat(String(val ?? "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
 }, []);

  // Helper function to calculate totals considering withdrawals reduce from interest and deposits
  const calculateTotals = useCallback((rows) => {
    // Group by account_name
    const grouped = rows.reduce((acc, txn) => {
      const key = txn.account_name || 'unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(txn);
      return acc;
    }, {});

    let totalDeposit = 0;
    let totalInterest = 0;
    let totalWithdrawal = 0;
    let totalCurrentBalance = 0;
    let totalInvestment = 0;
    let totalInterestEarned = 0;

    Object.values(grouped).forEach(accountTxns => {
      // Sort by txn_date ascending
      accountTxns.sort((a, b) => new Date(a.txn_date) - new Date(b.txn_date));

      let dep = 0, intr = 0, wdr = 0;
      accountTxns.forEach(txn => {
        const amt = toNumber(txn.amount);
        const tt = String(txn.transaction_type || "").toLowerCase();
        if (tt === 'deposit') {
          dep += amt;
        } else if (tt === 'interest') {
          intr += amt;
        } else if (tt === 'withdrawal') {
          wdr += amt;
          // reduce from intr first
          let remaining = amt;
          const reduceIntr = Math.min(remaining, intr);
          intr -= reduceIntr;
          remaining -= reduceIntr;
          // then from dep
          const reduceDep = Math.min(remaining, dep);
          dep -= reduceDep;
          remaining -= reduceDep;
          // if remaining > 0, ignore as invalid
        }
      });
      totalDeposit += dep;
      totalInterest += intr;
      totalWithdrawal += wdr;
      totalCurrentBalance += dep + intr;
      totalInvestment += dep;
      totalInterestEarned += intr;
    });

    return { deposit: totalDeposit, interest: totalInterest, withdrawal: totalWithdrawal, total: totalCurrentBalance, currentBalance: totalCurrentBalance, investment: totalInvestment, interestEarned: totalInterestEarned };
}, [toNumber]);

  // EPF-like Summary tab support for PPF
  const [records, setRecords] = useState([]);

  // FY helpers (Apr–Mar)
  const getFY = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // Jan=1
    return month < 4 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
  };
  const currentFY = getFY(new Date());

  const [filters, setFilters] = useState({
    // fy is an array of selected fiscal years (Apr–Mar). default to current FY
    fy: [currentFY],
    account: "",
    type: "",
    account_type: "",
  });

  // Ref for PDF content capture in Summary tab
  const pdfRef = useRef(null);
  const pdfSummaryRef = useRef(null);
  const pdfFontLoadedRef = useRef(false);
  async function ensurePdfFont(pdf) {
    if (pdfFontLoadedRef.current) return;
    try {
      const res = await fetch('/fonts/NotoSans-Regular.ttf');
      if (!res.ok) throw new Error('Font not found');
      const buf = await res.arrayBuffer();
      const u8 = new Uint8Array(buf);
      const chunkSize = 0x8000;
      let binary = '';
      for (let i = 0; i < u8.length; i += chunkSize) {
        const chunk = u8.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
      }
      const base64 = btoa(binary);
      pdf.addFileToVFS('NotoSans-Regular.ttf', base64);
      pdf.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
      try {
        pdf.setFont('NotoSans', 'normal');
        void pdf.getTextWidth('₹ 100');
        pdfFontLoadedRef.current = true;
      } catch (err) {
        pdfFontLoadedRef.current = false;
        pdf.setFont('helvetica', 'normal');
        console.warn('Custom font registration failed, using Helvetica.', err);
      }
    } catch (e) {
      console.warn('Failed to load custom PDF font. Falling back to Helvetica.', e);
    }
  }

  // Build a compact summary of selected filters for inclusion in the PDF
  const filtersSummaryText = useMemo(() => {
    const parts = [];
    if (filters.fy && Array.isArray(filters.fy) && filters.fy.length) parts.push(`FY: ${filters.fy.join(', ')}`);
    if (filters.type) parts.push(`Type: ${filters.type}`);
    if (filters.account) parts.push(`Account: ${filters.account}`);
    if (filters.account_type) parts.push(`Account Type: ${filters.account_type}`);
    return parts.join(" | ") || "None";
  }, [filters]);

  // Generate a PDF from the Summary section using jsPDF + autotable (no html2pdf)
  const handleDownloadPdf = async () => {
    const pdf = new jsPDF('landscape', 'pt', 'a4');
    await ensurePdfFont(pdf);
    pdf.setFont(pdfFontLoadedRef.current ? 'NotoSans' : 'helvetica', 'normal');

    // Build title and subtitle
    const title = 'PPF Summary Report';
    const subtitle = `Filters: ${filtersSummaryText}`;

    // Extract table to export
    const tableEl = document.getElementById('ppfSummaryTable');
    if (!tableEl) return;

    // Prepare head/body, strip currency in amount columns (Deposit, Interest, Withdrawal, Total)
    const stripCurrency = (txt) => (txt || '').toString().replace(/^\s*(₹|rs\.?|inr)\s*/i, '');
    const headers = Array.from(tableEl.querySelectorAll('thead th')).map(th => th.innerText.trim());
    const actionsIdx = headers.findIndex(h => h === 'Actions');

    const head = [headers.filter((_, i) => i !== actionsIdx)];
    const body = Array.from(tableEl.querySelectorAll('tbody tr')).map(tr =>
      Array.from(tr.cells)
        .filter((_, i) => i !== actionsIdx)
        .map((td, idx) => {
          const text = td.innerText.trim();
          const header = head[0][idx].toLowerCase();
          // Strip currency for amount columns
          if (['deposit', 'interest', 'withdrawal', 'total'].includes(header)) {
            return stripCurrency(text);
          }
          return text;
        })
    );

    // Column alignment; amounts centered
    const columnStyles = {};
    head[0].forEach((h, i) => {
      const header = h.toLowerCase();
      if (['deposit', 'interest', 'withdrawal', 'total'].includes(header)) {
        columnStyles[i] = { halign: 'center' };
      }
    });

    const left = 40;
    pdf.setFont(pdfFontLoadedRef.current ? 'NotoSans' : 'helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(204, 0, 0);
    pdf.text(title, left, 28);

    pdf.setFont(pdfFontLoadedRef.current ? 'NotoSans' : 'helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text(subtitle, left, 44);

    autoTable(pdf, {
      head,
      body,
      startY: 58,
      theme: 'grid',
      styles: { font: pdfFontLoadedRef.current ? 'NotoSans' : 'helvetica', fontSize: 9, cellPadding: 3, halign: 'center', valign: 'middle', lineColor: [128,128,128], lineWidth: 0.3, textColor: [0,0,0] },
      headStyles: { fillColor: [204,0,0], textColor: 255, fontStyle: 'bold', fontSize: 10 },
      columnStyles,
      didDrawPage: (data) => {
        pdf.setFont(pdfFontLoadedRef.current ? 'NotoSans' : 'helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(204, 0, 0);
        pdf.text(title, left, 28);

        pdf.setFont(pdfFontLoadedRef.current ? 'NotoSans' : 'helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        pdf.text(subtitle, left, 44);
      },
    });

    pdf.save('ppf-summary.pdf');
  };

  const handleDownloadExcel = () => {
    const tableEl = document.getElementById('ppfSummaryTable');
    if (!tableEl) return;

    const headers = Array.from(tableEl.querySelectorAll('thead th')).map(th => th.innerText.trim());
    const actionsIdx = headers.findIndex(h => h === 'Actions');

    const head = headers.filter((_, i) => i !== actionsIdx);

    const parseAmount = (txt) => {
      const cleaned = (txt || '').toString().replace(/[^0-9.-]/g, '');
      const n = parseFloat(cleaned);
      return Number.isFinite(n) ? n : 0;
    };

    const body = Array.from(tableEl.querySelectorAll('tbody tr')).map(tr =>
      Array.from(tr.cells)
        .filter((_, i) => i !== actionsIdx)
        .map((td, idx) => {
          const text = td.innerText.trim();
          const header = head[idx].toLowerCase();
          if (['deposit', 'interest', 'withdrawal', 'total'].includes(header)) {
            return parseAmount(text);
          }
          return text;
        })
    );

    const ws = XLSX.utils.aoa_to_sheet([head, ...body]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
    XLSX.writeFile(wb, 'ppf-summary.xlsx');
  };

  // Format date like EPF card (DD-MM-YYYY)
  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  // Calculate account age similar to EPF service duration
  const calculateAccountAge = (openingDate) => {
    if (!openingDate) return "";
    const start = new Date(openingDate);
    const today = new Date();

    let years = today.getFullYear() - start.getFullYear();
    let months = today.getMonth() - start.getMonth();
    let days = today.getDate() - start.getDate();

    if (days < 0) {
      months--;
      days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    return `${years} years ${months} months ${days} days`;
  };

  const handleSaveAccountDetails = async () => {
    try {
      if (editingAccount) {
        // Update existing record
        const record = userMasterData.find(r => r.id === editingAccount);
        if (record) {
          await assetAPI.updateUserMaster(editingAccount, {
            account_name: record.account_name,
            account_number: record.account_number,
            bank_name: record.bank_name,
            date_of_joining: record.date_of_joining
          });
          fetchUserMaster(); // Refresh data
        }
      } else {
        // Create new record (PPF or FD based on the temporary record)
        const newRecord = userMasterData[0]; // Get the data from the temporary state
        if (newRecord && (newRecord.account_name || newRecord.account_number || newRecord.bank_name || newRecord.date_of_joining)) {
          await assetAPI.addUserMaster({
            asset_type: newRecord.asset_type || 'PPF', // Use the asset_type from the temporary record
            account_name: newRecord.account_name || null,
            account_number: newRecord.account_number || null,
            bank_name: newRecord.bank_name || null,
            date_of_joining: newRecord.date_of_joining || null
          });
          fetchUserMaster(); // Refresh data
        }
      }
    } catch (error) {
      console.error("Error saving user master:", error);
      alert("Failed to save changes");
    }
    setShowEditAccountForm(false);
    setEditingAccount(null);
  };

  const handleSaveNewAccount = async () => {
    try {
      // Create new record with all fields
      await assetAPI.addUserMaster({
        asset_type: newAccountData.asset_type || null,
        account_name: newAccountData.account_name || null,
        account_number: newAccountData.account_number || null,
        bank_name: newAccountData.bank_name || null,
        company_name: newAccountData.company_name || null,
        broker_name: newAccountData.broker_name || null,
        uan: newAccountData.uan || null,
        epf_number: newAccountData.epf_number || null,
        pran_number: newAccountData.pran_number || null,
        date_of_joining: newAccountData.date_of_joining || null,
        date_of_left: newAccountData.date_of_left || null
      });

      fetchUserMaster(); // Refresh data
      setShowAddAccountForm(false);
      setNewAccountData({
        account_name: '',
        asset_type: '',
        uan: '',
        epf_number: '',
        date_of_joining: '',
        pran_number: '',
        account_number: '',
        bank_name: '',
        company_name: '',
        broker_name: '',
        date_of_left: ''
      });
    } catch (error) {
      console.error("Error inserting new user master record:", error);
      alert("Failed to add new account");
    }
  };

  const resetFilters = () => {
    setFilters({ fy: [currentFY], account: "", type: "", account_type: "" });
  };



  useEffect(() => {
    try { localStorage.setItem('ppf_projection_prefs_v1', JSON.stringify(projectionPrefs)); } catch {}
  }, [projectionPrefs]);

  // Memoize projection so it persists across renders and recalculates only when inputs change
  const projected = useMemo(() => {
    return calculateProjectedPPFMaturity(ppfTotals.currentBalance, projectionPrefs);
  }, [ppfTotals.currentBalance, projectionPrefs]);
  const projectedTotal = projected?.totalValue || 0;

  const ppfInterestPct = ppfTotals.investment > 0 ? (ppfTotals.interestEarned / ppfTotals.investment) * 100 : 0;
  const fdInterestPct = fdTotals.investment > 0 ? (fdTotals.interestEarned / fdTotals.investment) * 100 : 0;

  // Persist account details when changed


  // Memoize subtitle line
  const projectionSubtitle = useMemo(() => {
    const md = Number(projectionPrefs?.monthlyDeposit) || 0;
    const ir = Number(projectionPrefs?.interestRate) || 0;
    const yrs = Number(projectionPrefs?.years) || 0;
    const ty = new Date().getFullYear() + yrs;
    const mdStr = md ? `₹${md.toLocaleString('en-IN')}/month, ` : '';
    return `Using ${mdStr}${ir}% interest, until year ${ty}`;
  }, [projectionPrefs]);

  const fetchAssets = useCallback(async () => {
    if (!token) return;
    try {
      const data = await assetAPI.getTransactions('ppf', token);

      // Store full transaction list for Summary tab computations
      setRecords(data.transactions || []);

      const today = new Date();
      const parseDate = (v) => {
        if (!v) return null;
        try { return new Date(v); } catch { return null; }
      };

      const rowsUptoToday = (data.transactions || []).filter((txn) => {
        const d = parseDate(txn.txn_date);
        return d && d <= today;
      });

      // Separate rows by account_type
      const ppfRows = rowsUptoToday.filter(t => String(t.account_type || '').toLowerCase() === 'ppf');
      const fdRows = rowsUptoToday.filter(t => String(t.account_type || '').toLowerCase() === 'fd');

      // PPF Totals
      const ppfTotals = calculateTotals(ppfRows);
      setPpfTotals(ppfTotals);

      // FD Totals
      const fdTotals = calculateTotals(fdRows);
      setFdTotals(fdTotals);

      // Totals for compatibility (PPF)
      setTotals(ppfTotals);

      // Latest per account (in case multiple accounts exist; safe for single-account too)
      const latestBalances = {};
      (data.transactions || []).forEach((txn) => {
        const key = `${txn.account_name}`;
        if (!latestBalances[key]) {
          latestBalances[key] = { ...txn, amount: toNumber(txn.amount) };
        }
      });

      // Grouped by month YYYY-MM for monthly diff
      const groupedByMonth = {};
      (data.transactions || []).forEach((txn) => {
        const dateStr = typeof txn.txn_date === "string" ? txn.txn_date : txn.txn_date?.toISOString?.() || "";
        const ym = dateStr.slice(0, 7);
        if (!groupedByMonth[ym]) groupedByMonth[ym] = {};
        const key = `${txn.account_name}`;
        if (!groupedByMonth[ym][key]) {
          groupedByMonth[ym][key] = { ...txn, amount: toNumber(txn.amount) };
        }
      });

      const months = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));
      const currentMonth = months[0] || null;
      const prevMonth = months[1] || null;

      const sumForMonth = (month) => {
        if (!month || !groupedByMonth[month]) return 0;
        return Object.values(groupedByMonth[month]).reduce((acc, t) => acc + toNumber(t.amount), 0);
      };

      const now = sumForMonth(currentMonth);
      const prev = sumForMonth(prevMonth);

      setSummary({ PPF: { current: now, diff: now - (prev || 0) } });

      // Per-account diffs
      const computedDiffs = {};
      Object.keys(latestBalances).forEach((key) => {
        const currentAmt =
          currentMonth && groupedByMonth[currentMonth] && groupedByMonth[currentMonth][key]
            ? toNumber(groupedByMonth[currentMonth][key].amount)
            : toNumber(latestBalances[key].amount);
        const prevAmt =
          prevMonth && groupedByMonth[prevMonth] && groupedByMonth[prevMonth][key]
            ? toNumber(groupedByMonth[prevMonth][key].amount)
            : undefined;

        computedDiffs[key] = typeof prevAmt === "number" ? currentAmt - prevAmt : undefined;
      });

      setDiffByAccount(computedDiffs);
      setAssets(Object.values(latestBalances));


    } catch (error) {
      console.error("Error fetching PPF transactions:", error);
    }
}, [calculateTotals, toNumber, token]);

  // Delete transaction
  const handleDeleteTransaction = async (id) => {
    if (!window.confirm("Delete this transaction? This cannot be undone.")) return;
    try {
      await assetAPI.deleteTransaction('ppf', id);
      alert("Transaction deleted successfully");
      await assetAPI.invalidateCache('ppf');
      await new Promise(resolve => setTimeout(resolve, 500));
      fetchAssets();
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete transaction");
    }
  };

  // Update transaction (called from the inline modal)
  const handleUpdateTransaction = async (updated) => {
    const { id, ...payload } = updated;
    try {
      // ensure amount is numeric and date is ISO string
      const body = {
        ...payload,
        amount: Number(payload.amount) || 0,
        txn_date: payload.txn_date,
      };
      await assetAPI.updateTransaction('ppf', id, body);
      alert("Transaction updated successfully");
      setEditingTx(null);
      await assetAPI.invalidateCache('ppf');
      await new Promise(resolve => setTimeout(resolve, 500));
      fetchAssets();
    } catch (error) {
      console.error("Update failed:", error);
      alert("Failed to update transaction");
    }
  };

// ...existing code...
  // Inline Edit Transaction Modal (moved to component scope)
  const EditTransactionModal = ({ tx, onClose, onSave }) => {
    const [local, setLocal] = useState({ ...tx });
    useEffect(() => setLocal({ ...tx }), [tx]);
    if (!tx) return null;

    const accountOptions = Array.from(new Set(records.map(r => r.account_name).filter(Boolean)));
    const typeOptions = Array.from(new Set(records.map(r => r.transaction_type).filter(Boolean)));
    const accountTypeOptions = Array.from(new Set(records.map(r => r.account_type).filter(Boolean)));

    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="w-full max-w-md bg-gray-900 border border-gray-700/50 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300" onClick={(e) => e.stopPropagation()}>
          <div className="p-8 space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Pencil className="text-green-400 w-5 h-5" />
              </div>
              <h4 className="text-xl font-black text-white tracking-tight">Edit Transaction</h4>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Transaction Date</p>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="date"
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                    value={local.txn_date?.slice?.(0,10) || local.txn_date || ""}
                    onChange={(e) => setLocal({ ...local, txn_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Select Account</p>
                <select
                  className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all appearance-none cursor-pointer"
                  value={local.account_name || ""}
                  onChange={(e) => setLocal({ ...local, account_name: e.target.value })}
                >
                  <option value="">-- Select Account --</option>
                  {accountOptions.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Txn Type</p>
                  <select
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all appearance-none cursor-pointer"
                    value={local.transaction_type || ""}
                    onChange={(e) => setLocal({ ...local, transaction_type: e.target.value })}
                  >
                    <option value="">-- Select Type --</option>
                    {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Asset Type</p>
                  <select
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all appearance-none cursor-pointer"
                    value={local.account_type || ""}
                    onChange={(e) => setLocal({ ...local, account_type: e.target.value })}
                  >
                    <option value="">-- Select Account Type --</option>
                    {accountTypeOptions.map(at => <option key={at} value={at}>{at}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Amount (₹)</p>
                <div className="relative">
                  <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="number"
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                    value={local.amount || 0}
                    onChange={(e) => setLocal({ ...local, amount: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3.5 rounded-xl transition-all text-[10px] uppercase tracking-widest" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-900/20 text-[10px] uppercase tracking-widest"
                onClick={() => onSave(local)}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
 // ...existing code...


  useEffect(() => {
    fetchAssets();
    fetchUserMaster();
  }, [fetchAssets, fetchUserMaster]);

  useEffect(() => {
    const handleCacheInvalidation = (e) => {
      if (e.detail?.assetType === 'ppf') {
        fetchAssets();
      }
    };

    window.addEventListener('portfolio-cache-invalidated', handleCacheInvalidation);
    return () => window.removeEventListener('portfolio-cache-invalidated', handleCacheInvalidation);
  }, [fetchAssets]);

  useEffect(() => {
    if (records.length === 0) {
      setPpfXirr(null);
      setFdXirr(null);
      return;
    }

    const ppfCashFlows = [];
    const fdCashFlows = [];
    let ppfCurrentValue = 0;
    let fdCurrentValue = 0;

    records.forEach(r => {
      const amount = parseFloat(r.amount) || 0;
      const accountType = String(r.account_type || '').toLowerCase();
      const transactionType = String(r.transaction_type || '').toLowerCase();

      if (accountType === 'ppf') {
        let flow = 0;
        if (transactionType === 'deposit') {
          flow = -amount;
          ppfCurrentValue += amount;
        } else if (transactionType === 'interest') {
          flow = amount;
          ppfCurrentValue += amount;
        } else if (transactionType === 'withdrawal') {
          flow = amount;
          ppfCurrentValue -= amount;
        }
        if (r.txn_date && flow !== 0) {
          ppfCashFlows.push({ Date: new Date(r.txn_date), Flow: flow });
        }
      } else if (accountType === 'fd') {
        let flow = 0;
        if (transactionType === 'deposit') {
          flow = -amount;
          fdCurrentValue += amount;
        } else if (transactionType === 'interest') {
          flow = amount;
          fdCurrentValue += amount;
        } else if (transactionType === 'withdrawal') {
          flow = amount;
          fdCurrentValue -= amount;
        }
        if (r.txn_date && flow !== 0) {
          fdCashFlows.push({ Date: new Date(r.txn_date), Flow: flow });
        }
      }
    });

    if (ppfCurrentValue > 0) {
      ppfCashFlows.push({ Date: new Date(), Flow: ppfCurrentValue });
    }
    if (fdCurrentValue > 0) {
      fdCashFlows.push({ Date: new Date(), Flow: fdCurrentValue });
    }

    ppfCashFlows.sort((a, b) => a.Date - b.Date);
    fdCashFlows.sort((a, b) => a.Date - b.Date);

    const filteredPpfFlows = ppfCashFlows.filter(cf => cf.Flow !== 0);
    const filteredFdFlows = fdCashFlows.filter(cf => cf.Flow !== 0);

    if (filteredPpfFlows.length > 1) {
      const xirrValue = ExcelFormulas.XIRR(filteredPpfFlows);
      setPpfXirr(xirrValue);
    } else {
      setPpfXirr(null);
    }

    if (filteredFdFlows.length > 1) {
      const xirrValue = ExcelFormulas.XIRR(filteredFdFlows);
      setFdXirr(xirrValue);
    } else {
      setFdXirr(null);
    }
  }, [records]);

  // --- PPF Projection (monthly compounding, annuity-due) ---
  function calculateProjectedPPFMaturity(currentBalance, prefs) {
    const {
      currentCorpus,
      monthlyDeposit,
      years,
      interestRate,
      excludeCorpusFromInvested = true,
    } = prefs || {};

    const normalizedYears = Number(years);
    const months = Math.max(0, Math.round((Number.isFinite(normalizedYears) ? normalizedYears : 0) * 12));
    const monthlyRate = (Number(interestRate) || 0) / 100 / 12;

    // If excluding corpus, projection starts at zero corpus and invested, otherwise include current corpus
    let corpus = excludeCorpusFromInvested ? 0 : (Number(currentCorpus ?? currentBalance) || 0);
    let invested = excludeCorpusFromInvested ? 0 : (Number(currentCorpus ?? currentBalance) || 0);

    const mDep = Number(monthlyDeposit) || 0;

    for (let m = 1; m <= months; m++) {
      corpus = (corpus + mDep) * (1 + monthlyRate);
      invested += mDep;
    }

    return { invested, profit: corpus - invested, totalValue: corpus };
  }

  // ---- Summary helpers (EPF-like) ----
  const formatIndianNumber = (num) => {
    if (num == null || isNaN(num)) return "0";
    return new Intl.NumberFormat("en-IN").format(Number(num) || 0);
  };
  const formatMonthYear = (dateStr) => {
    if (!dateStr) return "";
  const d = new Date(dateStr);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0"); // months are 0-based
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
};

  const filteredRecords = records.filter((r) => {
    let pass = true;
    if (filters.fy && Array.isArray(filters.fy) && filters.fy.length > 0) {
      const fy = getFY(r.txn_date);
      if (!filters.fy.includes(fy)) pass = false;
    }
    if (filters.account && r.account_name !== filters.account) pass = false;
    if (filters.type && r.transaction_type !== filters.type) pass = false;
    if (filters.account_type && r.account_type !== filters.account_type) pass = false;
    return pass;
  });

  // parseFYRange removed — multi-FY selection handled differently

  const nonDateFiltered = records.filter((r) => {
    if (filters.account && r.account_name !== filters.account) return false;
    if (filters.type && r.transaction_type !== filters.type) return false;
    if (filters.account_type && r.account_type !== filters.account_type) return false;
    return true;
  });

  // sumParts replaced with calculateTotals for proper withdrawal handling

  // For multi-FY selection: compute totals for selected FYs as current; previous totals left empty
  let totalsCurrFY = { deposit: 0, interest: 0, withdrawal: 0, total: 0 };
  let totalsOverall3 = { deposit: 0, interest: 0, withdrawal: 0, total: 0 };
  if (filters.fy && Array.isArray(filters.fy) && filters.fy.length > 0) {
    const currRows = nonDateFiltered.filter((r) => {
      const fy = getFY(r.txn_date);
      return filters.fy.includes(fy);
    });
    totalsCurrFY = calculateTotals(currRows);
    totalsOverall3 = { ...totalsCurrFY };
  }

 return (
    <div className="px-4 py-6 sm:p-8 max-w-7xl mx-auto bg-gray-950 min-h-screen text-gray-100">
      {/* iOS Segmented Control - Main Tabs */}
      <div className="flex justify-center mb-10 px-2">
        <div className="bg-gray-900/40 backdrop-blur-2xl p-1.5 rounded-[1.5rem] flex w-full max-w-lg shadow-inner border border-gray-800/50">
          {["Dashboard", "Summary", "Account Details"].map((tab) => (
            <button
              key={tab}
              className={`flex-1 py-2.5 text-sm font-bold rounded-[1.25rem] transition-all duration-500 ease-out ${
                activeTab === tab
                  ? "bg-white text-gray-950 shadow-2xl scale-[1.02] translate-y-[-1px]"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5 active:scale-95"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "Account Details" ? "Account" : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard Tab */}
      {activeTab === "Dashboard" && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Portfolio Summary Hero Card */}
          <div className="space-y-4">
            <div className="px-1">
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 whitespace-nowrap">
                <Activity className="w-5 h-5 text-blue-400" />
                Portfolio Overview
              </h2>
            </div>

            <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 rounded-[2.5rem] shadow-2xl p-8 text-white relative overflow-hidden group text-center">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700" />
              <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-black/20 rounded-full blur-3xl" />
              
              <div className="relative z-10 flex flex-col items-center gap-8">
                <div>
                  <p className="text-blue-100 text-sm font-bold uppercase tracking-widest mb-1">Total Assets Value</p>
                  <h1 className="text-5xl sm:text-6xl font-black tracking-tighter">
                    {formatINRShort(isTrialMode ? 0 : ppfTotals.currentBalance + fdTotals.currentBalance)}
                  </h1>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-200" />
                      <span className="text-xs font-black tracking-widest uppercase">PROFIT: {formatINRShort(isTrialMode ? 0 : ppfTotals.interestEarned + fdTotals.interestEarned)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                  <div className="bg-black/20 backdrop-blur-md rounded-[1.5rem] p-4 border border-white/10">
                    <p className="text-blue-200 text-[10px] font-black uppercase tracking-widest mb-1">PPF Portion</p>
                    <p className="text-xl font-black tracking-tight">{formatINRShort(isTrialMode ? 0 : ppfTotals.currentBalance)}</p>
                  </div>
                  <div className="bg-black/20 backdrop-blur-md rounded-[1.5rem] p-4 border border-white/10">
                    <p className="text-blue-200 text-[10px] font-black uppercase tracking-widest mb-1">FD Portion</p>
                    <p className="text-xl font-black tracking-tight">{formatINRShort(isTrialMode ? 0 : fdTotals.currentBalance)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* PPF Card */}
            <div className="group bg-gray-900/50 border border-gray-800/50 rounded-[2.5rem] p-6 hover:bg-gray-800/50 transition-all duration-500 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <Wallet className="text-blue-400 w-6 h-6" />
                </div>
                <div className="text-[10px] font-black text-blue-400 bg-blue-500/5 px-3 py-1.5 rounded-full border border-blue-500/10 uppercase tracking-widest">
                  PPF Returns
                </div>
              </div>
              <div className="space-y-1 mb-6">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em] ml-1">Current Balance</p>
                <h3 className="text-3xl font-black text-white tracking-tight">{formatINRShort(isTrialMode ? 0 : ppfTotals.currentBalance)}</h3>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-6 border-t border-gray-800/50">
                <div>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">XIRR</p>
                  <p className="text-xs font-black text-blue-400">{ppfXirr !== null ? (isTrialMode ? "0.0" : (ppfXirr * 100).toFixed(1)) : '-'}%</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">IRR</p>
                  <p className="text-xs font-black text-blue-200">{isTrialMode ? "0.0" : ppfInterestPct.toFixed(1)}%</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Interest</p>
                  <p className="text-xs font-black text-green-400">+{formatINRShort(isTrialMode ? 0 : ppfTotals.interestEarned)}</p>
                </div>
              </div>
            </div>

            {/* FD Card */}
            <div className="group bg-gray-900/50 border border-gray-800/50 rounded-[2.5rem] p-6 hover:bg-gray-800/50 transition-all duration-500 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <Landmark className="text-emerald-400 w-6 h-6" />
                </div>
                <div className="text-[10px] font-black text-emerald-400 bg-emerald-500/5 px-3 py-1.5 rounded-full border border-emerald-500/10 uppercase tracking-widest">
                  FD Returns
                </div>
              </div>
              <div className="space-y-1 mb-6">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em] ml-1">Current Balance</p>
                <h3 className="text-3xl font-black text-white tracking-tight">{formatINRShort(isTrialMode ? 0 : fdTotals.currentBalance)}</h3>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-6 border-t border-gray-800/50">
                <div>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">XIRR</p>
                  <p className="text-xs font-black text-emerald-400">{fdXirr !== null ? (isTrialMode ? "0.0" : (fdXirr * 100).toFixed(1)) : '-'}%</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">IRR</p>
                  <p className="text-xs font-black text-emerald-200">{isTrialMode ? "0.0" : fdInterestPct.toFixed(1)}%</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Interest</p>
                  <p className="text-sm font-black text-emerald-400">+{formatINRShort(isTrialMode ? 0 : fdTotals.interestEarned)}</p>
                </div>
              </div>
            </div>

            {/* Projection Card */}
            <div className="group bg-gray-900/50 border border-gray-800/50 rounded-[2.5rem] p-6 hover:bg-gray-800/50 transition-all duration-500 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-all duration-700" />
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <Target className="text-blue-400 w-6 h-6" />
                </div>
                <button
                  onClick={() => setShowProjectionForm(true)}
                  className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-400 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-lg active:scale-95 border border-blue-500/20"
                >
                  <Plus size={18} />
                </button>
              </div>
              <div className="space-y-1 mb-6 relative z-10">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em] ml-1">Projected Maturity</p>
                <h3 className="text-3xl font-black text-white tracking-tight">{formatINRShort(isTrialMode ? 0 : projectedTotal)}</h3>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-tight ml-1">{projectionSubtitle}</p>
              </div>
              <button 
                onClick={() => setShowProjectionForm(true)}
                className="w-full py-4 bg-gray-800/50 hover:bg-gray-700 text-gray-300 rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all relative z-10 flex items-center justify-center gap-2 border border-gray-700/50"
              >
                Configure Goal <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Details Tab */}
      {activeTab === "Account Details" && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Landmark className="w-5 h-5 text-blue-400" />
              Registered Accounts
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Dynamic Account Details Cards */}
            {userMasterData.length > 0 ? (
              userMasterData.map(record => {
                const assetType = String(record.asset_type || '').toUpperCase();
                const accountName = record.account_name || 'Unknown Account';
                
                return (
                  <div key={record.id} className="group bg-gray-900/50 border border-gray-800/50 rounded-[2.5rem] p-8 hover:bg-gray-800/50 transition-all duration-500 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-6">
                      <button
                        className="w-10 h-10 rounded-xl bg-gray-800 text-gray-400 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all active:scale-95 shadow-lg"
                        onClick={() => {
                          setEditingAccount(record.id);
                          if (assetType === 'FD') {
                            setShowEditFdAccountForm(true);
                          } else {
                            setShowEditAccountForm(true);
                          }
                        }}
                      >
                        <Pencil size={18} />
                      </button>
                    </div>

                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                        {assetType === 'FD' ? <Landmark className="text-emerald-400 w-7 h-7" /> : <Wallet className="text-blue-400 w-7 h-7" />}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{assetType} ASSET</p>
                        <h3 className="text-2xl font-black text-white tracking-tight">{accountName}</h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Account Number</p>
                        <p className="text-sm font-bold text-gray-200">{record.account_number || "N/A"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Bank Name</p>
                        <p className="text-sm font-bold text-gray-200">{record.bank_name || "N/A"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Opening Date</p>
                        <p className="text-sm font-bold text-gray-200">{formatDateForDisplay(record.date_of_joining)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Account Age</p>
                        <p className="text-sm font-bold text-blue-400">{calculateAccountAge(record.date_of_joining)}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : null}

            {/* Add New Account Card */}
            <button
              onClick={() => setShowAddAccountForm(true)}
              className="group border-2 border-dashed border-gray-800 rounded-[2.5rem] p-8 flex flex-col items-center justify-center gap-4 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all duration-500 min-h-[250px]"
            >
              <div className="w-16 h-16 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center group-hover:scale-110 group-hover:border-blue-500/50 transition-all duration-500">
                <Plus size={32} className="text-gray-600 group-hover:text-blue-400" />
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-gray-400 group-hover:text-white transition-colors">Add New Asset</p>
                <p className="text-sm font-medium text-gray-600">Register a new PPF or FD account</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Summary Tab - aligned with EPF style using ppf_transactions schema */}
      {activeTab === "Summary" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="px-1">
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-400" />
              Transaction History
            </h2>
          </div>

          {/* Filters */}
          <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800/50 rounded-[2rem] p-6 shadow-2xl">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* FY multi-select (checkbox list) */}
                <div className="relative" ref={fyMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowFyMenu((s) => !s)}
                    className="bg-gray-900 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-w-[160px] text-left flex items-center gap-2"
                  >
                    <span className="text-xs font-bold">FY</span>
                    <span className="ml-2 text-[11px] text-gray-300 truncate">{(filters.fy && filters.fy.length) ? filters.fy.join(', ') : 'All FY'}</span>
                  </button>

                  {showFyMenu && (
                    <div className="absolute z-50 mt-2 w-56 bg-gray-900 border border-gray-700/50 rounded-xl p-3 shadow-2xl">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          id="fy_all"
                          type="checkbox"
                          checked={!(filters.fy && filters.fy.length)}
                          onChange={(e) => setFilters((prev) => ({ ...prev, fy: e.target.checked ? [] : [currentFY] }))}
                          className="w-4 h-4"
                        />
                        <label htmlFor="fy_all" className="text-sm text-gray-300">All FY</label>
                      </div>
                      <div className="max-h-48 overflow-auto">
                        {Array.from(new Set(records.map((r) => getFY(r.txn_date)))).filter(Boolean).sort((a,b)=>b.localeCompare(a)).map((fy) => (
                          <label key={fy} className="flex items-center gap-2 mb-2 block text-sm text-gray-200">
                            <input
                              type="checkbox"
                              checked={Array.isArray(filters.fy) ? filters.fy.includes(fy) : false}
                              onChange={() => {
                                setFilters((prev) => {
                                  const cur = Array.isArray(prev.fy) ? [...prev.fy] : [];
                                  const idx = cur.indexOf(fy);
                                  if (idx >= 0) cur.splice(idx, 1);
                                  else cur.push(fy);
                                  return { ...prev, fy: cur };
                                });
                              }}
                              className="w-4 h-4"
                            />
                            <span className="ml-1">{fy}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDownloadPdf}
                    className="group relative flex items-center justify-center w-10 h-10 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg active:scale-95"
                    title="Download PDF"
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleDownloadExcel}
                    className="group relative flex items-center justify-center w-10 h-10 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl hover:bg-green-500 hover:text-white transition-all shadow-lg active:scale-95"
                    title="Download Excel"
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 items-center">
                <select
                  className="bg-gray-900 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-w-[120px]"
                  value={filters.type}
                  onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
                >
                  <option value="" className="bg-gray-900">All Types</option>
                  {Array.from(new Set(records.map((r) => r.transaction_type))).map((t) => (
                    <option key={t} value={t} className="bg-gray-900">{t}</option>
                  ))}
                </select>

                <select
                  className="bg-gray-900 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-w-[120px]"
                  value={filters.account}
                  onChange={(e) => setFilters((prev) => ({ ...prev, account: e.target.value }))}
                >
                  <option value="" className="bg-gray-900">All Accounts</option>
                  {Array.from(new Set(records.map((r) => r.account_name))).filter(Boolean).map((an) => (
                    <option key={an} value={an} className="bg-gray-900">{an}</option>
                  ))}
                </select>

                <select
                  className="bg-gray-900 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-w-[120px]"
                  value={filters.account_type}
                  onChange={(e) => setFilters((prev) => ({ ...prev, account_type: e.target.value }))}
                >
                  <option value="" className="bg-gray-900">All Asset Types</option>
                  {Array.from(new Set(records.map((r) => r.account_type))).filter(Boolean).map((at) => (
                    <option key={at} value={at} className="bg-gray-900">{at.toUpperCase()}</option>
                  ))}
                </select>

                <button
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold px-6 py-2.5 rounded-xl transition-all text-xs uppercase tracking-widest"
                  onClick={resetFilters}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          <div ref={pdfRef} className="bg-gray-900/40 backdrop-blur-xl border border-gray-800/50 rounded-[2rem] overflow-hidden shadow-2xl">
            <style>{`
              .ppf-pdf-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              #ppfSummaryTable th, #ppfSummaryTable td { border-color: rgba(255,255,255,0.05) !important; }
            `}</style>

            <div ref={pdfSummaryRef} className="ppf-pdf-root p-6 bg-blue-600/5 border-b border-gray-800/50 flex flex-col gap-2">
              <span className="text-xs font-black text-blue-400 uppercase tracking-[0.2em] whitespace-nowrap">Active Filters: {filtersSummaryText}</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{filteredRecords.length} Transactions Found</span>
            </div>

            <div className="w-full overflow-x-auto">
              <table id="ppfSummaryTable" className="ppf-pdf-root w-full border-collapse">
                <thead>
                  <tr className="bg-gray-900/80 text-gray-400">
                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest border-b border-gray-800/50 whitespace-nowrap">Period</th>
                    {filters.account === "" && (
                      <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest border-b border-gray-800/50 whitespace-nowrap">Account</th>
                    )}
                    <th className="px-6 py-5 text-center text-[10px] font-black uppercase tracking-widest border-b border-gray-800/50">Type</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest border-b border-gray-800/50">Deposit</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest border-b border-gray-800/50">Interest</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest border-b border-gray-800/50">Total</th>
                    <th className="px-6 py-5 text-center text-[10px] font-black uppercase tracking-widest border-b border-gray-800/50">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/30">
                  {/* Summary Totals */}
                  {filteredRecords.length > 0 && (
                    <tr className="bg-blue-500/5 font-bold italic">
                      <td className="px-6 py-4 text-blue-400 text-xs uppercase tracking-tighter whitespace-nowrap">Current Balance</td>
                      {filters.account === "" && <td className="px-6 py-4 text-center text-gray-600">-</td>}
                      <td className="px-6 py-4 text-center text-gray-600">-</td>                      
                      <td className="px-6 py-4 text-right text-xs text-white">₹{formatIndianNumber(isTrialMode ? 0 : totalsOverall3.deposit)}</td>
                      <td className="px-6 py-4 text-right text-xs text-green-400">₹{formatIndianNumber(isTrialMode ? 0 : totalsOverall3.interest)}</td>
                      <td className="px-6 py-4 text-right text-xs text-blue-400">₹{formatIndianNumber(isTrialMode ? 0 : totalsOverall3.total)}</td>
                      <td className="px-6 py-4 text-center text-gray-600">-</td>
                    </tr>
                  )}

                  {filteredRecords.map((r) => {
                    const tt = String(r.transaction_type || "").toLowerCase();
                    const dep = tt === "deposit" ? Number(r.amount) || 0 : 0;
                    const intr = tt === "interest" ? Number(r.amount) || 0 : 0;
                    const tot = tt === "withdrawal" ? -(Number(r.amount) || 0) : (Number(r.amount) || 0);
                    return (
                      <tr key={r.id} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-gray-300 whitespace-nowrap">{formatMonthYear(r.txn_date)}</td>
                        {filters.account === "" && (
                          <td className="px-6 py-4 text-xs text-gray-400 font-medium whitespace-nowrap">{r.account_name || "-"}</td>
                        )}
                        <td className="px-6 py-4 text-center">
                          <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest ${
                            tt === 'deposit' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                            tt === 'interest' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                            'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                            {r.transaction_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-xs font-bold text-gray-300">₹{formatIndianNumber(isTrialMode ? 0 : dep)}</td>
                        <td className="px-6 py-4 text-right text-xs font-bold text-green-400">₹{formatIndianNumber(isTrialMode ? 0 : intr)}</td>
                        <td className="px-6 py-4 text-right text-xs font-black text-white">₹{formatIndianNumber(isTrialMode ? 0 : tot)}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => setEditingTx(r)} className="p-2 rounded-lg bg-gray-800/50 text-blue-400 hover:bg-blue-500 hover:text-white transition-all shadow-lg active:scale-95 border border-blue-500/20">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteTransaction(r.id)} className="p-2 rounded-lg bg-gray-800/50 text-red-400 hover:bg-red-500 hover:text-white transition-all shadow-lg active:scale-95 border border-red-500/20">
                              <Trash className="w-3.5 h-3.5" />
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
      )}


      {/* Floating + button */}
      <button
        className={`fixed z-[60] right-6 bottom-8 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-[1.25rem] w-14 h-14 flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 ${(showModal || showProjectionForm || showAddAccountForm) ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        onClick={() => setShowModal(true)}
      >
        <Plus className="w-7 h-7" />
      </button>



      {/* Modal */}
      {showModal && (
        <PPFForm
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchAssets();
          }}
        />
      )}

      {/* Projection nested form */}
      {showProjectionForm && (
        <PPFProjectionForm
          onClose={() => setShowProjectionForm(false)}
          currentBalance={totals.currentBalance}
          prefs={projectionPrefs}
          onSave={(next) => setProjectionPrefs(next)}
        />
      )}

{/* Inline Edit Transaction Modal */}
      {editingTx && (
        <EditTransactionModal
          tx={editingTx}
          onClose={() => setEditingTx(null)}
          onSave={handleUpdateTransaction}
        />
      )}

      {/* Edit Account Details Modal */}
      {showEditAccountForm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4" onClick={() => { setShowEditAccountForm(false); setEditingAccount(null); }}>
          <div className="w-full max-w-md bg-gray-900 border border-gray-700/50 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300" onClick={(e)=>e.stopPropagation()}>
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Pencil className="text-blue-400 w-5 h-5" />
                </div>
                <h4 className="text-xl font-black text-white tracking-tight">Edit PPF Account</h4>
              </div>

              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSaveAccountDetails(); }}>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Account Name</p>
                  <input
                    type="text"
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    value={editingAccount ? userMasterData.find(r => r.id === editingAccount)?.account_name || '' : (userMasterData[0]?.account_name || '')}
                    onChange={(e) => {
                      if (editingAccount) {
                        setUserMasterData(prev => prev.map(r => r.id === editingAccount ? { ...r, account_name: e.target.value } : r));
                      } else {
                        setUserMasterData(prev => prev.map((r, idx) => idx === 0 ? { ...r, account_name: e.target.value } : r));
                      }
                    }}
                  />
                </div>

                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Account Number</p>
                  <input
                    type="text"
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    value={editingAccount ? userMasterData.find(r => r.id === editingAccount)?.account_number || '' : (userMasterData[0]?.account_number || '')}
                    onChange={(e) => {
                      if (editingAccount) {
                        setUserMasterData(prev => prev.map(r => r.id === editingAccount ? { ...r, account_number: e.target.value } : r));
                      } else {
                        setUserMasterData(prev => prev.map((r, idx) => idx === 0 ? { ...r, account_number: e.target.value } : r));
                      }
                    }}
                  />
                </div>

                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Bank Name</p>
                  <input
                    type="text"
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    value={editingAccount ? userMasterData.find(r => r.id === editingAccount)?.bank_name || '' : (userMasterData[0]?.bank_name || '')}
                    onChange={(e) => {
                      if (editingAccount) {
                        setUserMasterData(prev => prev.map(r => r.id === editingAccount ? { ...r, bank_name: e.target.value } : r));
                      } else {
                        setUserMasterData(prev => prev.map((r, idx) => idx === 0 ? { ...r, bank_name: e.target.value } : r));
                      }
                    }}
                  />
                </div>

                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Opening Date</p>
                  <input
                    type="date"
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    value={editingAccount ? userMasterData.find(r => r.id === editingAccount)?.date_of_joining || '' : (userMasterData[0]?.date_of_joining || '')}
                    onChange={(e) => {
                      if (editingAccount) {
                        setUserMasterData(prev => prev.map(r => r.id === editingAccount ? { ...r, date_of_joining: e.target.value } : r));
                      } else {
                        setUserMasterData(prev => prev.map((r, idx) => idx === 0 ? { ...r, date_of_joining: e.target.value } : r));
                      }
                    }}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition-all text-sm uppercase tracking-widest" onClick={() => { setShowEditAccountForm(false); setEditingAccount(null); }}>Cancel</button>
                  <button type="submit" className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 text-sm uppercase tracking-widest">Save</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit FD Account Details Modal */}
      {showEditFdAccountForm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4" onClick={() => { setShowEditFdAccountForm(false); setEditingAccount(null); }}>
          <div className="w-full max-w-md bg-gray-900 border border-gray-700/50 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300" onClick={(e)=>e.stopPropagation()}>
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Landmark className="text-emerald-400 w-5 h-5" />
                </div>
                <h4 className="text-xl font-black text-white tracking-tight">Edit FD Account</h4>
              </div>

              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSaveAccountDetails(); }}>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Account Name</p>
                  <input
                    type="text"
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    value={editingAccount ? userMasterData.find(r => r.id === editingAccount)?.account_name || '' : (userMasterData[0]?.account_name || '')}
                    onChange={(e) => {
                      if (editingAccount) {
                        setUserMasterData(prev => prev.map(r => r.id === editingAccount ? { ...r, account_name: e.target.value } : r));
                      } else {
                        setUserMasterData(prev => prev.map((r, idx) => idx === 0 ? { ...r, account_name: e.target.value } : r));
                      }
                    }}
                  />
                </div>

                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Account Number</p>
                  <input
                    type="text"
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    value={editingAccount ? userMasterData.find(r => r.id === editingAccount)?.account_number || '' : (userMasterData[0]?.account_number || '')}
                    onChange={(e) => {
                      if (editingAccount) {
                        setUserMasterData(prev => prev.map(r => r.id === editingAccount ? { ...r, account_number: e.target.value } : r));
                      } else {
                        setUserMasterData(prev => prev.map((r, idx) => idx === 0 ? { ...r, account_number: e.target.value } : r));
                      }
                    }}
                  />
                </div>

                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Bank Name</p>
                  <input
                    type="text"
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    value={editingAccount ? userMasterData.find(r => r.id === editingAccount)?.bank_name || '' : (userMasterData[0]?.bank_name || '')}
                    onChange={(e) => {
                      if (editingAccount) {
                        setUserMasterData(prev => prev.map(r => r.id === editingAccount ? { ...r, bank_name: e.target.value } : r));
                      } else {
                        setUserMasterData(prev => prev.map((r, idx) => idx === 0 ? { ...r, bank_name: e.target.value } : r));
                      }
                    }}
                  />
                </div>

                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Opening Date</p>
                  <input
                    type="date"
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    value={editingAccount ? userMasterData.find(r => r.id === editingAccount)?.date_of_joining || '' : (userMasterData[0]?.date_of_joining || '')}
                    onChange={(e) => {
                      if (editingAccount) {
                        setUserMasterData(prev => prev.map(r => r.id === editingAccount ? { ...r, date_of_joining: e.target.value } : r));
                      } else {
                        setUserMasterData(prev => prev.map((r, idx) => idx === 0 ? { ...r, date_of_joining: e.target.value } : r));
                      }
                    }}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition-all text-sm uppercase tracking-widest" onClick={() => { setShowEditFdAccountForm(false); setEditingAccount(null); }}>Cancel</button>
                  <button type="submit" className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/20 text-sm uppercase tracking-widest">Save</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add New Account Modal */}
      {showAddAccountForm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4" onClick={() => setShowAddAccountForm(false)}>
          <div className="w-full max-w-2xl bg-gray-900 border border-gray-700/50 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300" onClick={(e)=>e.stopPropagation()}>
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Plus className="text-blue-400 w-5 h-5" />
                </div>
                <h4 className="text-xl font-black text-white tracking-tight">Add New Asset</h4>
              </div>

              <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleSaveNewAccount(); }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Asset Type *</p>
                    <select
                      className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer"
                      value={newAccountData.asset_type}
                      onChange={(e) => setNewAccountData({ ...newAccountData, asset_type: e.target.value })}
                      required
                    >
                      <option value="">-- Select Asset Type --</option>
                      <option value="PPF">PPF</option>
                      <option value="FD">FD</option>
                    </select>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Account Name *</p>
                    <input
                      type="text"
                      className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                      value={newAccountData.account_name}
                      onChange={(e) => setNewAccountData({ ...newAccountData, account_name: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Account Number</p>
                    <input
                      type="text"
                      className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                      value={newAccountData.account_number}
                      onChange={(e) => setNewAccountData({ ...newAccountData, account_number: e.target.value })}
                    />
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Bank Name</p>
                    <input
                      type="text"
                      className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                      value={newAccountData.bank_name}
                      onChange={(e) => setNewAccountData({ ...newAccountData, bank_name: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Opening Date</p>
                    <input
                      type="date"
                      className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                      value={newAccountData.date_of_joining}
                      onChange={(e) => setNewAccountData({ ...newAccountData, date_of_joining: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition-all text-sm uppercase tracking-widest" onClick={() => setShowAddAccountForm(false)}>Cancel</button>
                  <button type="submit" className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 text-sm uppercase tracking-widest">Add Account</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Lightweight nested form similar to EPF ProjectionForm
function PPFProjectionForm({ onClose, currentBalance, prefs, onSave }) {
  const [local, setLocal] = useState({
    currentCorpus: prefs.currentCorpus ?? currentBalance,
    monthlyDeposit: prefs.monthlyDeposit ?? 0,
    years: prefs.years ?? 15,
    interestRate: prefs.interestRate ?? 7.1,
    excludeCorpusFromInvested: prefs.excludeCorpusFromInvested ?? true,
  });

  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const preview = calculateProjectedPPFMaturity(currentBalance, local);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-gray-900 border border-gray-700/50 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="p-8 space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Target className="text-blue-400 w-5 h-5" />
            </div>
            <h4 className="text-xl font-black text-white tracking-tight">PPF Projection</h4>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Current Corpus (₹)</p>
              <div className="relative">
                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="number"
                  className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  value={local.currentCorpus}
                  onChange={(e) => setLocal({ ...local, currentCorpus: Number(e.target.value) })}
                />
              </div>
            </div>

            <label className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-xl border border-gray-700/30 cursor-pointer group hover:bg-gray-800/50 transition-all">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500/50 focus:ring-offset-gray-900 transition-all cursor-pointer"
                checked={local.excludeCorpusFromInvested}
                onChange={(e) => setLocal({ ...local, excludeCorpusFromInvested: e.target.checked })}
              />
              <span className="text-xs font-medium text-gray-400 group-hover:text-gray-200 transition-colors">Exclude corpus from Invested</span>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Monthly Deposit</p>
                <input
                  type="number"
                  className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  value={local.monthlyDeposit}
                  onChange={(e) => setLocal({ ...local, monthlyDeposit: Number(e.target.value) })}
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Years</p>
                <input
                  type="number"
                  className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  value={local.years}
                  onChange={(e) => setLocal({ ...local, years: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Interest Rate (%)</p>
              <input
                type="number"
                step="0.1"
                className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                value={local.interestRate}
                onChange={(e) => setLocal({ ...local, interestRate: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Projected Total</span>
              <span className="text-xl font-black text-white">{formatINRShort(preview.totalValue)}</span>
            </div>
            <div className="h-px bg-gray-800" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Invested</span>
                <p className="text-xs font-bold text-gray-200">{formatINRShort(preview.invested)}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Est. Returns</span>
                <p className="text-xs font-black text-green-400">+{formatINRShort(preview.profit)}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3.5 rounded-xl transition-all text-[10px] uppercase tracking-widest" onClick={onClose}>Close</button>
            <button
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 text-[10px] uppercase tracking-widest"
              onClick={() => {
                const next = {
                  currentCorpus: Number(local.currentCorpus) || 0,
                  monthlyDeposit: Number(local.monthlyDeposit) || 0,
                  years: Number(local.years) || 0,
                  interestRate: Number(local.interestRate) || 0,
                  excludeCorpusFromInvested: !!local.excludeCorpusFromInvested,
                };
                onSave(next);
                try { localStorage.setItem('ppf_projection_prefs_v1', JSON.stringify(next)); } catch {}
                onClose();
              }}
            >
              Save Projection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PPF;