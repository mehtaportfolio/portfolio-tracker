import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import assetAPI from "../../api/assetAPI.js";
import { useTrialMode } from "../../hooks/useTrialMode.js";
import EpfForm from "./Forms/EPFForm.jsx";
import { Plus, FileText, FileSpreadsheet, Pencil, Trash, TrendingUp, PieChart, IndianRupee, Activity, BarChart3, Wallet, LayoutGrid, Calendar, Building2, User } from "lucide-react";

import { useAuth } from "../../context/AuthContext.jsx";
const getFY = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed, so 3 is April
  if (month < 3) {
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
  return `${year}-${(year + 1).toString().slice(-2)}`;
};

const currentFY = getFY(new Date());

// XIRR calculation functions
const ExcelFormulas = {
  DaysBetween: function (date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
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

  // Initial loop to find valid bracket
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

const Epf = () => {
  const { isTrialMode } = useTrialMode();
  const { session } = useAuth();
  const token = session?.access_token;
  const [records, setRecords] = useState([]);
  const [userMasterData, setUserMasterData] = useState([]);
  const [filters, setFilters] = useState({ fy: [currentFY], company: "", invest: "" });
  const [editingCompany, setEditingCompany] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [newCompanyData, setNewCompanyData] = useState({
    uan: '',
    epf_number: '',
    company_name: '',
    date_of_joining: '',
    date_of_left: ''
  });
  const [showAddCompanyForm, setShowAddCompanyForm] = useState(false);
  const [showFyMenu, setShowFyMenu] = useState(false);
  const [fyQuery, setFyQuery] = useState("");
  const fyMenuRef = useRef(null);
  const [assumptions, setAssumptions] = useState(null);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [epfXirr, setEpfXirr] = useState(null);
  const [editingTx, setEditingTx] = useState(null);
  const [projectionPrefs, setProjectionPrefs] = useState({
    currentCorpus: null,
    excludeCorpusFromInvested: true
  });
  const [showProjectionForm, setShowProjectionForm] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard"); // "Dashboard" | "Account Details" | "Summary"
  const [showEpfForm, setShowEpfForm] = useState(false);

  // Fetch Master Data (Company Details)
  const fetchRecords = useCallback(async () => {
    if (!token) return;
    try {
      const data = await assetAPI.getTransactions('epf', token);
      setRecords(data.transactions || []);
    } catch (error) {
      console.error("❌ Error fetching EPF records:", error);
    }
  }, [token]);

  const fetchUserMaster = useCallback(async () => {
    if (!token) return;
    try {
      const data = await assetAPI.getUserMaster('EPF', token);
      setUserMasterData(data || []);
    } catch (err) {
      console.error("❌ Error fetching company data:", err);
    }
  }, [token]);

  useEffect(() => {
    fetchRecords();
    fetchUserMaster();
  }, [fetchRecords, fetchUserMaster]);

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

  useEffect(() => {
    const handleCacheInvalidation = (e) => {
      if (e.detail?.assetType === 'epf') {
        fetchRecords();
      }
    };
    window.addEventListener('portfolio-cache-invalidated', handleCacheInvalidation);
    return () => window.removeEventListener('portfolio-cache-invalidated', handleCacheInvalidation);
  }, [fetchRecords]);

  // Refs and helpers for PDF generation
  const pdfRef = useRef(null); // wraps Filters summary + table

// Build compact filters summary text for PDF header
const filtersSummaryText = useMemo(() => {
  const parts = [];
  if (filters.fy && Array.isArray(filters.fy) && filters.fy.length) parts.push(`FY: ${filters.fy.join(', ')}`);
  if (filters.company) parts.push(`Company: ${filters.company}`);
  if (filters.invest) parts.push(`Type: ${filters.invest}`);
  return parts.join(" | ") || "None";
}, [filters]);

const handleDownloadPdf = async () => {
  const pdf = new jsPDF('landscape', 'pt', 'a4');
  pdf.setFont('helvetica', 'normal');

  const tableEl = document.getElementById('epfSummaryTable');
  if (!tableEl) return;

  // Build dynamic title and subtitle from filters
  const title = 'EPF Summary Report';
  const subtitle = `Filters: ${filtersSummaryText}`;

  // Extract headers and body from the table DOM, stripping currency symbols on numeric columns
  const stripCurrency = (txt) => {
    const s = (txt || '').toString();
    // Remove leading ₹, Rs, Rs., or INR tokens
    return s.replace(/^\s*(₹|rs\.?|inr)\s*/i, '');
  };
  const head = [Array.from(tableEl.querySelectorAll('thead th')).map(th => th.innerText.trim())];
  const amountColumns = ['Employee', 'Employer', 'Pension'];
  const body = Array.from(tableEl.querySelectorAll('tbody tr')).map(tr => {
    const cells = Array.from(tr.cells);
    let rowData = [];
    let cellIdx = 0;

    for (let h = 0; h < head[0].length; h++) {
      const colName = head[0][h];
      if (cellIdx < cells.length) {
        const td = cells[cellIdx];
        const colspan = parseInt(td.getAttribute('colspan') || 1);
        const text = td.innerText.trim();

        if (colspan > 1) {
          // Fill spanned columns with the text in first, empty for rest
          rowData.push(text);
          for (let i = 1; i < colspan; i++) {
            rowData.push('');
          }
          h += colspan - 1; // skip the spanned headers
        } else {
          rowData.push(amountColumns.includes(colName) ? stripCurrency(text) : text);
        }
        cellIdx++;
      } else {
        rowData.push('');
      }
    }
    return rowData;
  });

  // Column widths tuned to fit A4 landscape; adjust as needed
  const columnWidths = {
    'Period': 90,
    'Company': 120,
    'Invest Type': 120,
    'Employee': 110,
    'Employer': 110,
    'Pension': 110
  };
  const columnStyles = {};
  head[0].forEach((colName, idx) => {
    columnStyles[idx] = { cellWidth: columnWidths[colName] || 100, halign: ['Employee', 'Employer', 'Pension'].includes(colName) ? 'center' : 'center' };
  });

  const left = 40;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(204, 0, 0);
  pdf.text(title, left, 28);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  pdf.text(subtitle, left, 44);

  autoTable(pdf, {
    head,
    body,
    startY: 58,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, halign: 'center', valign: 'middle', lineColor: [128,128,128], lineWidth: 0.3, textColor: [0,0,0] },
    headStyles: { fillColor: [204,0,0], textColor: 255, fontStyle: 'bold', fontSize: 10 },
    columnStyles,
    didDrawPage: (data) => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(204, 0, 0);
      pdf.text(title, left, 28);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.text(subtitle, left, 44);
    },
  });

  pdf.save('epf-summary.pdf');
};

const handleDownloadExcel = () => {
  const tableEl = document.getElementById('epfSummaryTable');
  if (!tableEl) return;

  const head = Array.from(tableEl.querySelectorAll('thead th')).map(th => th.innerText.trim());

  const parseAmount = (txt) => {
    const cleaned = (txt || '').toString().replace(/[^0-9.-]/g, '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  };

  const body = Array.from(tableEl.querySelectorAll('tbody tr')).map(tr => {
    const cells = Array.from(tr.cells);
    let rowData = [];
    let cellIdx = 0;

    for (let h = 0; h < head.length; h++) {
      const headerText = head[h];
      if (cellIdx < cells.length) {
        const td = cells[cellIdx];
        const colspan = parseInt(td.getAttribute('colspan') || 1);
        const text = td.innerText.trim();

        if (colspan > 1) {
          // Fill spanned columns with the text in first, empty for rest
          rowData.push(text);
          for (let i = 1; i < colspan; i++) {
            rowData.push('');
          }
          h += colspan - 1; // skip the spanned headers
        } else {
          // Parse as number if header is Employee, Employer, or Pension
          if (headerText === 'Employee' || headerText === 'Employer' || headerText === 'Pension') {
            rowData.push(parseAmount(text));
          } else {
            rowData.push(text);
          }
        }
        cellIdx++;
      } else {
        rowData.push('');
      }
    }
    return rowData;
  });

  const ws = XLSX.utils.aoa_to_sheet([head, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  XLSX.writeFile(wb, 'epf-summary.xlsx');
};



const handleSave = async () => {
  if (editingCompany && token) {
    const record = userMasterData.find(r => r.id === editingCompany);
    if (record) {
      try {
        await assetAPI.updateUserMaster(editingCompany, {
          uan: record.uan,
          epf_number: record.epf_number,
          company_name: record.company_name,
          date_of_joining: record.date_of_joining,
          date_of_left: record.date_of_left
        }, token);
        alert("✅ Company updated successfully!");
        await assetAPI.invalidateCache('epf', token);
        await new Promise(resolve => setTimeout(resolve, 500));
        fetchUserMaster();
      } catch (error) {
        console.error("Error updating user master:", error);
        alert("Failed to save changes");
      }
    }
  }
  setShowEditForm(false);
  setEditingCompany(null);
};

const handleAddCompany = async () => {
  if (!newCompanyData.company_name || !newCompanyData.date_of_joining) {
    alert("Please fill in Company Name and Date of Joining");
    return;
  }

  if (!token) return;

  try {
    await assetAPI.addUserMaster({
      uan: newCompanyData.uan,
      epf_number: newCompanyData.epf_number,
      company_name: newCompanyData.company_name,
      date_of_joining: newCompanyData.date_of_joining,
      date_of_left: newCompanyData.date_of_left,
      asset_type: 'EPF'
    }, token);
    alert("✅ Company added successfully!");
    await assetAPI.invalidateCache('epf', token);
    await new Promise(resolve => setTimeout(resolve, 500));
    setShowAddCompanyForm(false);
    setNewCompanyData({
      uan: '',
      epf_number: '',
      company_name: '',
      date_of_joining: '',
      date_of_left: ''
    });
    fetchUserMaster();
  } catch (error) {
    console.error("Error adding new company:", error);
    alert("Failed to add new company");
  }
};


const filteredRecords = records.filter((r) => {
  let pass = true;

  // FY filter
  if (filters.fy && Array.isArray(filters.fy) && filters.fy.length > 0) {
    const fy = getFY(r.contribution_date);
    if (!filters.fy.includes(fy)) pass = false;
  }

  // Company filter
  if (filters.company && r.company_name !== filters.company) pass = false;

  // Invest type filter
  if (filters.invest && r.invest_type !== filters.invest) pass = false;

  return pass;
});

const resetFilters = () => {
  setFilters({ fy: [currentFY], company: "SMPL-MP", invest: "" });
  setFyQuery(currentFY);
};


// Fiscal helpers and dynamic summary totals (respect non-date filters)
const parseFYRange = (fyStr) => {
  const useFY = fyStr || getFY(new Date());
  const [startYearStr] = String(useFY).split("-");
  const startYear = parseInt(startYearStr, 10);
  if (isNaN(startYear)) return null;
  const fyStart = new Date(`${startYear}-04-01T00:00:00`);
  const prevFyEnd = new Date(`${startYear}-03-31T23:59:59.999`);
  const fyEnd = new Date(`${startYear + 1}-03-31T23:59:59.999`);
  return { startYear, fyStart, prevFyEnd, fyEnd };
};

const nonDateFiltered = records.filter((r) => {
  if (filters.company && r.company_name !== filters.company) return false;
  if (filters.invest && r.invest_type !== filters.invest) return false;
  return true;
});

const sumShares = (rows) =>
  rows.reduce(
    (acc, r) => {
      const investType = String(r.invest_type || "").toLowerCase();
      const sign = investType.includes("withdrawal") ? -1 : 1;
      acc.employee += sign * (parseFloat(r.employee_share) || 0);
      acc.employer += sign * (parseFloat(r.employer_share) || 0);
      acc.pension += sign * (parseFloat(r.pension_share) || 0);
      return acc;
    },
    { employee: 0, employer: 0, pension: 0 }
  );

const selectedFYs = Array.isArray(filters.fy) && filters.fy.length ? filters.fy : [currentFY];
const earliestSelectedFY = selectedFYs.slice().sort((a, b) => a.localeCompare(b))[0];
const fyRange = parseFYRange(earliestSelectedFY);

let totalsPrevFY = { employee: 0, employer: 0, pension: 0 };
let totalsCurrFY = { employee: 0, employer: 0, pension: 0 };
let totalsOverall3 = { employee: 0, employer: 0, pension: 0 };

if (fyRange) {
  const prevRows = nonDateFiltered.filter((r) => {
    if (!r.contribution_date) return false;
    const d = new Date(r.contribution_date);
    return d <= fyRange.prevFyEnd;
  });

  const currRows = nonDateFiltered.filter((r) => {
    if (!r.contribution_date) return false;
    const fy = getFY(r.contribution_date);
    return selectedFYs.includes(fy);
  });

  totalsPrevFY = sumShares(prevRows);
  totalsCurrFY = sumShares(currRows);
  totalsOverall3 = {
    employee: totalsPrevFY.employee + totalsCurrFY.employee,
    employer: totalsPrevFY.employer + totalsCurrFY.employer,
    pension: totalsPrevFY.pension + totalsCurrFY.pension,
  };
}



  useEffect(() => {
    fetchRecords();
    fetchUserMaster();
  }, [fetchRecords, fetchUserMaster]);

  useEffect(() => {
    const handleCacheInvalidation = (e) => {
      if (e.detail?.assetType === 'epf') {
        fetchRecords();
      }
    };
    window.addEventListener('portfolio-cache-invalidated', handleCacheInvalidation);
    return () => window.removeEventListener('portfolio-cache-invalidated', handleCacheInvalidation);
  }, [fetchRecords]);

// ✅ Place the helper here (before return)
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const month = months[d.getMonth()];
  const year = d.getFullYear();

  return `${month}'${year}`;
};


const formatIndianNumber = (num) => {
  if (num == null || isNaN(num)) return "0";
  return new Intl.NumberFormat("en-IN").format(num);
};

const formatDDMMYYYY = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  return `${dd}-${mm}-${yyyy}`;
};




useEffect(() => {
  // Only derive defaults from records if we don't already have saved/user-set assumptions
  if (records.length > 0 && !assumptions) {
    const latest = records[records.length - 1];
    setAssumptions({
      employeeShare: parseFloat(latest.employee_share) || 0,
      employeeGrowth: 5,
      employerShare: parseFloat(latest.employer_share) || 0,
      pensionShare: parseFloat(latest.pension_share) || 0,
      interestRate: 8,
      targetYear: new Date().getFullYear() + 25,
    });
  }
}, [records, assumptions]);

  // Compute EPF XIRR
  useEffect(() => {
    if (records.length === 0) {
      setEpfXirr(null);
      return;
    }
    const cashFlows = [];
    let currentValue = 0;
    records.forEach(r => {
      const emp = parseFloat(r.employee_share) || 0;
      const empr = parseFloat(r.employer_share) || 0;
      const pen = parseFloat(r.pension_share) || 0;
      const amount = emp + empr + pen;
      const investType = String(r.invest_type || "").toLowerCase();
      let flow = 0;
      if (investType.includes("interest") || investType.includes("withdrawal")) {
        flow = amount;
        if (investType.includes("withdrawal")) {
          currentValue -= amount;
        } else {
          currentValue += amount;
        }
      } else {
        // deposit
        flow = -amount;
        currentValue += amount;
      }
      if (r.contribution_date && flow !== 0) {
        cashFlows.push({ Date: new Date(r.contribution_date), Flow: flow });
      }
    });
    // Add current value at today if positive
    if (currentValue > 0) {
      cashFlows.push({ Date: new Date(), Flow: currentValue });
    }
    // Sort and filter
    cashFlows.sort((a, b) => a.Date - b.Date);
    const filteredFlows = cashFlows.filter(cf => cf.Flow !== 0);
    // Calculate XIRR
    if (filteredFlows.length > 1) {
      const xirrValue = ExcelFormulas.XIRR(filteredFlows);
      setEpfXirr(xirrValue);
    } else {
      setEpfXirr(null);
    }
  }, [records]);

  // Auto-insert logic for new month on 1st date
  const hasCheckedAutoInsert = useRef(false);
  useEffect(() => {
    if (records.length > 0 && !hasCheckedAutoInsert.current) {
      const checkAndAutoInsert = async () => {
        const today = new Date();
        // Trigger on first visit of the month
        const currentMonthFirstDate = new Date(today.getFullYear(), today.getMonth(), 1);
        const yyyy = currentMonthFirstDate.getFullYear();
        const mm = String(currentMonthFirstDate.getMonth() + 1).padStart(2, '0');
        const dd = String(currentMonthFirstDate.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        
        // Check if entry for this month already exists
        const alreadyExists = records.some(r => r.contribution_date === dateStr);
        
        if (!alreadyExists) {
          // Find the latest deposit from previous months
          const sortedRecords = [...records].sort((a, b) => new Date(b.contribution_date) - new Date(a.contribution_date));
          const latestDeposit = sortedRecords.find(r => String(r.invest_type).toLowerCase() === 'deposit');
          
          if (latestDeposit) {
            console.log("🚀 Auto-inserting EPF record for new month:", dateStr);
            try {
              await assetAPI.addTransaction('epf', {
                company_name: latestDeposit.company_name,
                contribution_date: dateStr,
                employee_share: parseFloat(latestDeposit.employee_share),
                employer_share: parseFloat(latestDeposit.employer_share),
                pension_share: parseFloat(latestDeposit.pension_share),
                invest_type: latestDeposit.invest_type,
                created_at: new Date().toISOString()
              });
              await assetAPI.invalidateCache('epf');
              fetchRecords();
            } catch (error) {
              console.error("❌ Auto-insertion failed:", error);
            }
          }
        }
        hasCheckedAutoInsert.current = true;
      };
      
      checkAndAutoInsert();
    }
  }, [records, fetchRecords]);

  // Open edit modal for a transaction
  const handleOpenEditTransaction = (tx) => {
    setEditingTx({
      ...tx,
      employee_share: tx.employee_share ?? 0,
      employer_share: tx.employer_share ?? 0,
      pension_share: tx.pension_share ?? 0,
    });
  };

  // Delete transaction
  const handleDeleteTransaction = async (id) => {
    if (!window.confirm("Delete this transaction? This cannot be undone.")) return;
    try {
      await assetAPI.deleteTransaction('epf', id);
      await assetAPI.invalidateCache('epf');
      fetchRecords();
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete transaction");
    }
  };

  // Update transaction (called from the inline modal)
  const handleUpdateTransaction = async (updated) => {
    const { id, ...payload } = updated;
    try {
      await assetAPI.updateTransaction('epf', id, payload);
      await assetAPI.invalidateCache('epf');
      setEditingTx(null);
      fetchRecords();
    } catch (error) {
      console.error("Update failed:", error);
      alert("Failed to update transaction");
    }
  };
  // -------------------- Helpers --------------------
const formatShort = (num) => {
  if (num == null) return "₹0";
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);

  // 👉 Use short form (K, L, Cr)
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(2)}K`;

  return `${sign}₹${abs.toFixed(0)}`;
};


  const snapshotUpTo = (rows, cutoffDate) => {
    if (!rows || rows.length === 0)
      return { contributions: 0, interest: 0, withdrawals: 0, total_balance: 0 };
    const cutoff = new Date(cutoffDate);
    cutoff.setHours(23, 59, 59, 999);
    let contributions = 0,
      interest = 0,
      withdrawals = 0;
    for (const r of rows) {
      if (!r.contribution_date) continue;
      const d = new Date(r.contribution_date);
      if (d <= cutoff) {
        const emp = parseFloat(r.employee_share) || 0;
        const empr = parseFloat(r.employer_share) || 0;
        const pen = parseFloat(r.pension_share) || 0;
        const rowAmount = emp + empr + pen;
        const investType = String(r.invest_type || "").toLowerCase();
        if (investType.includes("interest"))
          interest += rowAmount;
        else if (investType.includes("withdrawal"))
          withdrawals += rowAmount;
        else contributions += rowAmount;
      }
    }
    return { contributions, interest, withdrawals, total_balance: contributions + interest - withdrawals };
  };

  const getLastTransactionDate = (rows) => {
    if (!rows || rows.length === 0) return null;
    let max = null;
    for (const r of rows) {
      if (!r.contribution_date) continue;
      const d = new Date(r.contribution_date);
      if (max === null || d > max) max = d;
    }
    return max;
  };

  const lastTxDate = getLastTransactionDate(records);
  const lastTxDateStr = lastTxDate
    ? lastTxDate.toISOString().slice(0, 10)
    : null;
  const currentSnapshot = lastTxDate
    ? snapshotUpTo(nonDateFiltered, lastTxDate)
    : { contributions: 0, interest: 0, withdrawals: 0, total_balance: 0 };

  const getRowTotalAmount = (row) =>
    (parseFloat(row.employee_share) || 0) +
    (parseFloat(row.employer_share) || 0) +
    (parseFloat(row.pension_share) || 0);

  const totalDepositsAll = records.reduce((sum, rec) => {
    const investType = String(rec.invest_type || "").toLowerCase();
    if (investType.includes("withdrawal") || investType.includes("interest")) {
      return sum;
    }
    return sum + getRowTotalAmount(rec);
  }, 0);

  const totalWithdrawalsAll = records.reduce((sum, rec) => {
    const investType = String(rec.invest_type || "").toLowerCase();
    if (!investType.includes("withdrawal")) {
      return sum;
    }
    return sum + getRowTotalAmount(rec);
  }, 0);

 

  const sumColUpTo = (rows, cutoff, col) => {
    const c = new Date(cutoff);
    c.setHours(23, 59, 59, 999);
    return rows.reduce((acc, r) => {
      if (!r.contribution_date) return acc;
      const d = new Date(r.contribution_date);
      if (d <= c) {
        const amount = parseFloat(r[col]) || 0;
        const investType = String(r.invest_type || "").toLowerCase();
        if (investType.includes("withdrawal")) {
          return acc - amount;
        } else {
          return acc + amount;
        }
      }
      return acc;
    }, 0);
  };

  const totalEmployee = sumColUpTo(nonDateFiltered, lastTxDateStr, "employee_share");
  const totalEmployer = sumColUpTo(nonDateFiltered, lastTxDateStr, "employer_share");
  const totalPension = sumColUpTo(nonDateFiltered, lastTxDateStr, "pension_share");
  const totalInterest = nonDateFiltered
    .filter(
      (r) =>
        r.invest_type &&
        String(r.invest_type).toLowerCase().includes("interest")
    )
    .reduce(
      (s, r) =>
        s +
        (parseFloat(r.employee_share) || 0) +
        (parseFloat(r.employer_share) || 0) +
        (parseFloat(r.pension_share) || 0),
      0
    );

  const interestRecords = nonDateFiltered.filter(
    (r) =>
      r.invest_type &&
      String(r.invest_type).toLowerCase().includes("interest")
  );

  const totalInterestEmployee = interestRecords.reduce(
    (s, r) => s + (parseFloat(r.employee_share) || 0),
    0
  );
  const totalInterestEmployer = interestRecords.reduce(
    (s, r) => s + (parseFloat(r.employer_share) || 0),
    0
  );
  const totalInterestPension = interestRecords.reduce(
    (s, r) => s + (parseFloat(r.pension_share) || 0),
    0
  );

  const totalDepositsEmployee = totalEmployee - totalInterestEmployee;
  const totalDepositsEmployer = totalEmployer - totalInterestEmployer;
  const totalDepositsPension = totalPension - totalInterestPension;

  const overallTotal = totalEmployee + totalEmployer + totalPension + totalInterest;

  const consolidatedTotal = records.reduce((sum, rec) => {
    const investType = String(rec.invest_type || "").toLowerCase();
    const amount = (parseFloat(rec.employee_share) || 0) + (parseFloat(rec.employer_share) || 0) + (parseFloat(rec.pension_share) || 0);
    if (investType.includes("withdrawal")) {
      return sum - amount;
    } else {
      return sum + amount;
    }
  }, 0);

 const overallNetContributions = totalDepositsAll - totalWithdrawalsAll;
  const balanceDifference = consolidatedTotal - overallNetContributions;

  const Card = ({ title, main, subtitle, extra, icon: Icon, colorClass = "from-blue-600/20 to-indigo-900/40 border-blue-500/20", iconColor = "text-blue-400" }) => (
    <div className={`bg-gradient-to-br ${colorClass} backdrop-blur-xl p-4 sm:p-6 rounded-[2rem] shadow-xl border flex flex-col justify-between hover:scale-[1.02] transition-all duration-300 group overflow-hidden relative`}>
      <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/5 blur-2xl rounded-full" />
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-5 h-5 ${iconColor}`} />}
          <h3 className={`text-[10px] sm:text-xs font-bold text-white/70 uppercase tracking-widest`}>{title}</h3>
        </div>
        {extra && <div className="relative z-20">{extra}</div>}
      </div>
      <div className="relative z-10">
        <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">{main}</div>
        {subtitle && (
          <div className="mt-2 text-[10px] font-medium text-white/50 flex items-center gap-1.5 uppercase tracking-wide">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );

  // Nested Projection Form (MF-like UI)
  const ProjectionForm = ({ onClose }) => {
    const [local, setLocal] = useState({
      currentCorpus: (projectionPrefs.currentCorpus !== null && projectionPrefs.currentCorpus !== undefined)
        ? projectionPrefs.currentCorpus
        : overallTotal,
      monthlyEmployee: assumptions?.employeeShare || 0,
      monthlyEmployer: assumptions?.employerShare || 0,
      monthlyPension: assumptions?.pensionShare || 0,
      years: Math.max(0, (assumptions?.targetYear || new Date().getFullYear()) - new Date().getFullYear()),
      interestRate: assumptions?.interestRate || 8,
      employeeIncrement: assumptions?.employeeGrowth || 0,
      excludeCorpusFromInvested: projectionPrefs.excludeCorpusFromInvested ?? true,
    });

    useEffect(() => {
      const handleEsc = (e) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const preview = calculateProjectedEPF(local);

    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm z-[100] p-4" onClick={onClose}>
        <div className="w-full max-w-md bg-gray-900 border border-gray-700/50 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300" onClick={(e) => e.stopPropagation()}>
          <div className="p-8 space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <BarChart3 className="text-blue-400 w-6 h-6" />
              </div>
              <h4 className="text-xl font-black text-white tracking-tight">EPF Projection</h4>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Current Corpus (₹)</p>
                <input
                  type="number"
                  value={local.currentCorpus}
                  onChange={(e) => setLocal({ ...local, currentCorpus: Number(e.target.value) })}
                  className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>

              <label className="flex items-center gap-3 bg-gray-800/30 p-3 rounded-xl border border-gray-700/30 cursor-pointer group">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-blue-500 focus:ring-blue-500/50"
                  checked={local.excludeCorpusFromInvested}
                  onChange={(e) => setLocal({ ...local, excludeCorpusFromInvested: e.target.checked })}
                />
                <span className="text-xs font-bold text-gray-400 group-hover:text-gray-200 transition-colors uppercase tracking-wide">Exclude corpus from invested</span>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Employee Share</p>
                  <input
                    type="number"
                    value={local.monthlyEmployee}
                    onChange={(e) => setLocal({ ...local, monthlyEmployee: Number(e.target.value) })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Employer Share</p>
                  <input
                    type="number"
                    value={local.monthlyEmployer}
                    onChange={(e) => setLocal({ ...local, monthlyEmployer: Number(e.target.value) })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Pension Share</p>
                  <input
                    type="number"
                    value={local.monthlyPension}
                    onChange={(e) => setLocal({ ...local, monthlyPension: Number(e.target.value) })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Duration (Years)</p>
                  <input
                    type="number"
                    value={local.years}
                    onChange={(e) => setLocal({ ...local, years: Number(e.target.value) })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Int. Rate (%)</p>
                  <input
                    type="number"
                    value={local.interestRate}
                    onChange={(e) => setLocal({ ...local, interestRate: Number(e.target.value) })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Growth (%)</p>
                  <input
                    type="number"
                    value={local.employeeIncrement}
                    onChange={(e) => setLocal({ ...local, employeeIncrement: Number(e.target.value) })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 rounded-2xl p-5 border border-indigo-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Projected Maturity</span>
                <span className="text-xl font-black text-white tracking-tighter">{formatShort(preview.totalValue)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest pt-2 border-t border-indigo-500/10">
                <span>Invested: <span className="text-gray-300">{formatShort(preview.invested)}</span></span>
                <span>Returns: <span className="text-emerald-400">{formatShort(preview.profit)}</span></span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition-all text-sm uppercase tracking-widest"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 text-sm uppercase tracking-widest"
                onClick={() => {
                  const now = new Date();
                  const years = Number(local.years) || 0;
                  setAssumptions({
                    employeeShare: Number(local.monthlyEmployee) || 0,
                    employerShare: Number(local.monthlyEmployer) || 0,
                    pensionShare: Number(local.monthlyPension) || 0,
                    interestRate: Number(local.interestRate) || 0,
                    employeeGrowth: Number(local.employeeIncrement) || 0,
                    targetYear: now.getFullYear() + years,
                  });
                  setProjectionPrefs({
                    currentCorpus: Number(local.currentCorpus) || 0,
                    excludeCorpusFromInvested: !!local.excludeCorpusFromInvested,
                  });
                  onClose();
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AssumptionsForm = () => {
    const [local, setLocal] = useState({ ...assumptions });

    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        setAssumptions({ ...local });
        setShowAssumptions(false);
      }
    };

    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4" onClick={() => setShowAssumptions(false)}>
        <div 
          className="w-full max-w-sm bg-gray-900 border border-gray-700/50 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300" 
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          <div className="p-8 space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <LayoutGrid className="text-violet-400 w-5 h-5" />
              </div>
              <h4 className="text-xl font-black text-white tracking-tight">Projection Settings</h4>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Target Year</p>
                <input
                  type="number"
                  min={new Date().getFullYear()}
                  value={local.targetYear}
                  onChange={(e) => setLocal({ ...local, targetYear: parseInt(e.target.value) })}
                  className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                />
              </div>

              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Employee Share (Monthly)</p>
                <input
                  type="number"
                  value={local.employeeShare}
                  onChange={(e) => setLocal({ ...local, employeeShare: parseFloat(e.target.value) })}
                  className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Growth (%)</p>
                  <input
                    type="number"
                    value={local.employeeGrowth}
                    onChange={(e) => setLocal({ ...local, employeeGrowth: parseFloat(e.target.value) })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Interest (%)</p>
                  <input
                    type="number"
                    value={local.interestRate}
                    onChange={(e) => setLocal({ ...local, interestRate: parseFloat(e.target.value) })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition-all text-sm uppercase tracking-widest"
                onClick={() => setShowAssumptions(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-violet-900/20 text-sm uppercase tracking-widest"
                onClick={() => {
                  setAssumptions({ ...local });
                  setShowAssumptions(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- EPF Projection (MF-style monthly compounding, annuity-due) ---
  const calculateProjectedEPF = ({
    currentCorpus,
    monthlyEmployee,
    monthlyEmployer,
    monthlyPension,
    years,
    interestRate,
    employeeIncrement = 0,
    excludeCorpusFromInvested = true,
  }) => {
    const months = Math.round((years || 0) * 12);
    const monthlyRate = (parseFloat(interestRate) / 100) / 12; // nominal monthly

    // When excluding corpus, it must not be used to start the projection
    // and it must not be counted as invested.
    let corpus = excludeCorpusFromInvested ? 0 : (Number(currentCorpus) || 0);
    let invested = excludeCorpusFromInvested ? 0 : (Number(currentCorpus) || 0);

    let emp = Number(monthlyEmployee) || 0;
    const empr = Number(monthlyEmployer) || 0;
    const pen = Number(monthlyPension) || 0;

    for (let m = 1; m <= months; m++) {
      const monthlyContribution = emp + empr + pen;
      // annuity-due: contribute, then grow
      corpus = (corpus + monthlyContribution) * (1 + monthlyRate);
      invested += monthlyContribution;

      if (m % 12 === 0) {
        emp = emp * (1 + (Number(employeeIncrement) || 0) / 100);
      }
    }

    const profit = corpus - invested;
    return { invested, profit, totalValue: corpus };
  };

const calculateService = (doj, dol) => {
  if (!doj) return "";
  const joinDate = new Date(doj);
  const endDate = dol ? new Date(dol) : new Date();

  let years = endDate.getFullYear() - joinDate.getFullYear();
  let months = endDate.getMonth() - joinDate.getMonth();
  let days = endDate.getDate() - joinDate.getDate();

  if (days < 0) {
    months--;
    days += new Date(endDate.getFullYear(), endDate.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  return `${years} years ${months} months ${days} days`;
};

  // Calculate total service from oldest date of joining to current date
  const oldestDOJ = userMasterData.length > 0
    ? userMasterData
        .map(record => record.date_of_joining)
        .filter(date => date) // Filter out null/empty dates
        .sort((a, b) => new Date(a) - new Date(b))[0] // Get the oldest date
    : null;

  const totalServiceFromOldest = oldestDOJ ? calculateService(oldestDOJ) : "N/A";


  const projectedValue = () => {
    if (!assumptions) return 0; // guard
    const currYear = new Date().getFullYear();
    const targetYear = parseInt(assumptions.targetYear) || currYear;
    const years = Math.max(0, targetYear - currYear);

    // Use saved preferences when provided, fall back to actual current balance
    const currentCorpus = (projectionPrefs.currentCorpus !== null && projectionPrefs.currentCorpus !== undefined)
      ? Number(projectionPrefs.currentCorpus) || 0
      : (overallTotal || 0);

    const result = calculateProjectedEPF({
      currentCorpus,
      monthlyEmployee: assumptions.employeeShare,
      monthlyEmployer: assumptions.employerShare,
      monthlyPension: assumptions.pensionShare,
      years,
      interestRate: assumptions.interestRate,
      employeeIncrement: assumptions.employeeGrowth,
      excludeCorpusFromInvested: !!projectionPrefs.excludeCorpusFromInvested,
    });

    return Math.round(result.totalValue);
  };

// ...existing code...
  // Inline Edit Transaction Modal (simple, local to this component)
  const EditTransactionModal = ({ tx, onClose, onSave }) => {
    const [local, setLocal] = useState({ ...tx });
    useEffect(() => {
      setLocal({ ...tx });
    }, [tx]);
    if (!tx) return null;

    const companies = Array.from(new Set(records.map(r => r.company_name).filter(Boolean)));
    const investTypes = Array.from(new Set(records.map(r => r.invest_type).filter(Boolean)));

    const companyOptions = local.company_name && !companies.includes(local.company_name)
      ? [local.company_name, ...companies]
      : companies;

    const investOptions = local.invest_type && !investTypes.includes(local.invest_type)
      ? [local.invest_type, ...investTypes]
      : investTypes;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="w-full max-w-md bg-gray-900 border border-gray-700/50 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300" onClick={(e)=>e.stopPropagation()}>
          <div className="p-8 space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Pencil className="text-emerald-400 w-5 h-5" />
              </div>
              <h4 className="text-xl font-black text-white tracking-tight">Edit Transaction</h4>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Transaction Date</p>
                <input 
                  type="date" 
                  className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" 
                  value={local.contribution_date?.slice(0,10) || ""} 
                  onChange={e=>setLocal({...local, contribution_date: e.target.value})}
                />
              </div>

              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Company</p>
                <select
                  className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer"
                  value={local.company_name || ""}
                  onChange={(e) => setLocal({ ...local, company_name: e.target.value })}
                >
                  <option value="">-- Select Company --</option>
                  {companyOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Invest Type</p>
                <select
                  className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer"
                  value={local.invest_type || ""}
                  onChange={(e) => setLocal({ ...local, invest_type: e.target.value })}
                >
                  <option value="">-- Select Invest Type --</option>
                  {investOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Employee</p>
                  <input type="number" className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" value={local.employee_share || 0} onChange={e=>setLocal({...local, employee_share: Number(e.target.value)})}/>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Employer</p>
                  <input type="number" className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" value={local.employer_share || 0} onChange={e=>setLocal({...local, employer_share: Number(e.target.value)})}/>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Pension</p>
                  <input type="number" className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" value={local.pension_share || 0} onChange={e=>setLocal({...local, pension_share: Number(e.target.value)})}/>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition-all text-sm uppercase tracking-widest" onClick={onClose}>Cancel</button>
              <button className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/20 text-sm uppercase tracking-widest" onClick={()=>onSave(local)}>Update</button>
            </div>
          </div>
        </div>
      </div>
    );
  };
// ...existing code...

  return (
    <div className="px-4 py-6 sm:p-8 max-w-7xl mx-auto bg-gray-900 min-h-screen text-gray-100">
      {/* iOS Segmented Control - Main Tabs */}
      <div className="flex justify-center mb-10 px-2">
        <div className="bg-gray-800/40 backdrop-blur-2xl p-1.5 rounded-[1.5rem] flex w-full max-w-lg shadow-inner border border-gray-700/50">
          {["Dashboard", "Summary", "Account Details"].map((tab) => (
            <button
              key={tab}
              className={`flex-1 py-2.5 text-sm font-bold rounded-[1.25rem] transition-all duration-500 ease-out ${
                activeTab === tab
                  ? "bg-white text-gray-900 shadow-2xl scale-[1.02] translate-y-[-1px]"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5 active:scale-95"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "Account Details" ? "Account" : tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Dashboard" && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* 🟩 Portfolio Summary Hero Card */}
          <div className="space-y-4">
            <div className="px-1">
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 whitespace-nowrap">
                <Activity className="w-5 h-5 text-indigo-400" />
                Portfolio Overview
              </h2>
            </div>

            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-[2.5rem] shadow-2xl p-8 text-white relative overflow-hidden group text-center">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700" />
              <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-black/20 rounded-full blur-3xl" />
              
              <div className="relative z-10 flex flex-col items-center gap-8">
                <div>
                  <p className="text-indigo-100 text-sm font-bold uppercase tracking-widest mb-1">Total EPF Corpus</p>
                  <h1 className="text-5xl sm:text-6xl font-black tracking-tighter">
                    {formatShort(isTrialMode ? 0 : consolidatedTotal)}
                  </h1>
                  <div className="mt-3">
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/30 px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-500/20">
                      {totalServiceFromOldest}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-8 sm:gap-12">
                  <div className="text-center">
                    <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mb-1 opacity-80">Invested</p>
                    <p className="text-xl font-bold tracking-tight">
                      {formatShort(isTrialMode ? 0 : overallNetContributions)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mb-1 opacity-80">Returns</p>
                    <p className="text-xl font-bold tracking-tight">
                      {formatShort(isTrialMode ? 0 : balanceDifference)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mb-1 opacity-80">Gain</p>
                    <div className="flex items-center justify-center gap-1 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/30 mt-1">
                      <TrendingUp size={14} className="text-white" />
                      <span className="text-sm font-black text-white">
                        {(isTrialMode ? 0 : overallNetContributions) > 0 
                          ? `${(((isTrialMode ? 0 : balanceDifference) / (isTrialMode ? 0 : overallNetContributions)) * 100).toFixed(1)}%` 
                          : "0%"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 🔹 Detailed Stats Grid */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1 whitespace-nowrap">
              <LayoutGrid className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl font-bold text-white tracking-tight">Detailed Breakdown</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <Card
                title="Current Balance"
                icon={Wallet}
                colorClass="from-emerald-600/20 to-teal-900/40 border-emerald-500/20"
                iconColor="text-emerald-400"
                main={formatShort(isTrialMode ? 0 : currentSnapshot.total_balance)}
                subtitle={
                  <>
                    <TrendingUp size={12} className="text-emerald-400" />
                    <span>Deposits: {formatShort(isTrialMode ? 0 : currentSnapshot.contributions)}</span>
                  </>
                }
              />

              <Card
                title="Total Interest"
                icon={IndianRupee}
                colorClass="from-amber-600/20 to-orange-900/40 border-amber-500/20"
                iconColor="text-amber-400"
                main={formatShort(isTrialMode ? 0 : totalInterest)}
                subtitle={
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Activity size={12} className="text-amber-400" />
                      <span className="text-amber-400">IRR: {epfXirr !== null && isFinite(epfXirr) ? `${(isTrialMode ? 0 : (epfXirr * 100)).toFixed(2)}%` : "N/A"}</span>
                    </div>
                  </div>
                }
              />

              <Card
                title="Employee Share"
                icon={User}
                colorClass="from-blue-600/20 to-indigo-900/40 border-blue-500/20"
                iconColor="text-blue-400"
                main={formatShort(isTrialMode ? 0 : totalEmployee)}
                subtitle={`Base: ${formatShort(isTrialMode ? 0 : totalDepositsEmployee)}`}
              />

              <Card
                title="Employer Share"
                icon={Building2}
                colorClass="from-rose-600/20 to-pink-900/40 border-rose-500/20"
                iconColor="text-rose-400"
                main={formatShort(isTrialMode ? 0 : totalEmployer)}
                subtitle={`Base: ${formatShort(isTrialMode ? 0 : totalDepositsEmployer)}`}
              />

              <Card
                title="Pension Fund"
                icon={PieChart}
                colorClass="from-sky-600/20 to-cyan-900/40 border-sky-500/20"
                iconColor="text-sky-400"
                main={formatShort(isTrialMode ? 0 : totalPension)}
                subtitle={`Base: ${formatShort(isTrialMode ? 0 : totalDepositsPension)}`}
              />

              {assumptions && (
                <Card
                  title="Projected Value"
                  icon={TrendingUp}
                  colorClass="from-violet-600/20 to-purple-900/40 border-violet-500/20"
                  iconColor="text-violet-400"
                  main={formatShort(isTrialMode ? 0 : projectedValue())}
                  extra={
                    <button
                      className="p-2 rounded-full bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors border border-violet-500/30"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowProjectionForm(true);
                      }}
                    >
                      <BarChart3 size={18} />
                    </button>
                  }
                  subtitle={
                    <span className="text-violet-400 font-bold">Estimated Maturity</span>
                  }
                />
              )}
            </div>
          </div>

          {/* Optional Popups */}
          {showProjectionForm && (
            <ProjectionForm onClose={() => setShowProjectionForm(false)} />
          )}
          {showAssumptions && <AssumptionsForm />}
        </div>
      )}


{activeTab === "Account Details" && (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex items-center justify-between px-1">
      <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
        <Building2 className="w-5 h-5 text-pink-400" />
        EPF Accounts
      </h2>
      <button
        onClick={() => setShowAddCompanyForm(true)}
        className="flex items-center gap-2 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 px-4 py-2 rounded-full border border-pink-500/20 transition-all font-bold text-xs uppercase tracking-wider"
      >
        <Plus size={16} />
        Add Account
      </button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {[...userMasterData].sort((a, b) => {
        const dateA = new Date(a.date_of_joining || 0);
        const dateB = new Date(b.date_of_joining || 0);
        return dateB - dateA;
      }).map(record => (
        <div key={record.id} className="bg-gray-800/20 backdrop-blur-xl rounded-[2.5rem] border border-gray-700/30 p-6 sm:p-8 hover:bg-gray-700/30 transition-all duration-300 relative group overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-pink-500/5 blur-3xl rounded-full group-hover:bg-pink-500/10 transition-all" />
          
          <div className="flex items-start justify-between mb-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg">
                <Building2 className="text-white w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">{record.company_name}</h3>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-0.5">Corporate Account</p>
              </div>
            </div>
            <button
              className="p-2 rounded-xl bg-gray-700/30 text-gray-400 hover:text-white hover:bg-gray-700/50 transition-all border border-gray-600/30"
              onClick={() => {
                setEditingCompany(record.id);
                setShowEditForm(true);
              }}
            >
              <Pencil size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6 relative z-10">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">UAN Number</p>
              <p className="text-sm font-bold text-gray-200">{record.uan || "N/A"}</p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">EPF Number</p>
              <p className="text-sm font-bold text-gray-200">{record.epf_number || "N/A"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Joining Date</p>
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                <Calendar size={12} />
                {formatDDMMYYYY(record.date_of_joining)}
              </div>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Leaving Date</p>
              <div className={`flex items-center justify-end gap-1.5 font-bold text-sm ${record.date_of_left?.trim() ? 'text-rose-400' : 'text-blue-400'}`}>
                <Calendar size={12} />
                {record.date_of_left && record.date_of_left.trim() ? formatDDMMYYYY(record.date_of_left) : 'Present'}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-700/30 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Total Tenure</span>
            </div>
            <p className="text-xs font-black text-white tracking-tight">
              {calculateService(record.date_of_joining, record.date_of_left)}
            </p>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

{showEditForm && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4" onClick={() => setShowEditForm(false)}>
    <div className="w-full max-w-md bg-gray-900 border border-gray-700/50 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300" onClick={(e) => e.stopPropagation()}>
      <div className="p-8 space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
            <Pencil className="text-pink-400 w-5 h-5" />
          </div>
          <h3 className="text-xl font-black text-white tracking-tight">
            Edit Account
          </h3>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setShowEditForm(false);
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">UAN Number</p>
              <input
                type="text"
                className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
                value={userMasterData.find(r => r.id === editingCompany)?.uan || ''}
                onChange={(e) => setUserMasterData(prev => prev.map(r => r.id === editingCompany ? { ...r, uan: e.target.value } : r))}
              />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">EPF Number</p>
              <input
                type="text"
                className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
                value={userMasterData.find(r => r.id === editingCompany)?.epf_number || ''}
                onChange={(e) => setUserMasterData(prev => prev.map(r => r.id === editingCompany ? { ...r, epf_number: e.target.value } : r))}
              />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Company Name</p>
            <input
              type="text"
              className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
              value={userMasterData.find(r => r.id === editingCompany)?.company_name || ''}
              onChange={(e) => setUserMasterData(prev => prev.map(r => r.id === editingCompany ? { ...r, company_name: e.target.value } : r))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Joining Date</p>
              <input
                type="date"
                className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
                value={userMasterData.find(r => r.id === editingCompany)?.date_of_joining || ''}
                onChange={(e) => setUserMasterData(prev => prev.map(r => r.id === editingCompany ? { ...r, date_of_joining: e.target.value } : r))}
              />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Leaving Date</p>
              <input
                type="date"
                className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
                value={userMasterData.find(r => r.id === editingCompany)?.date_of_left || ''}
                onChange={(e) => setUserMasterData(prev => prev.map(r => r.id === editingCompany ? { ...r, date_of_left: e.target.value } : r))}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition-all text-sm uppercase tracking-widest"
              onClick={() => setShowEditForm(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-pink-900/20 text-sm uppercase tracking-widest"
              onClick={handleSave}
            >
              Update
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
)}

{showAddCompanyForm && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4" onClick={() => setShowAddCompanyForm(false)}>
    <div className="w-full max-w-md bg-gray-900 border border-gray-700/50 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300" onClick={(e) => e.stopPropagation()}>
      <div className="p-8 space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
            <Plus className="text-pink-400 w-6 h-6" />
          </div>
          <h3 className="text-xl font-black text-white tracking-tight">Add New Account</h3>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleAddCompany();
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">UAN Number</p>
              <input
                type="text"
                className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
                value={newCompanyData.uan}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, uan: e.target.value })}
              />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">EPF Number</p>
              <input
                type="text"
                className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
                value={newCompanyData.epf_number}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, epf_number: e.target.value })}
              />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Company Name <span className="text-pink-500">*</span></p>
            <input
              type="text"
              className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
              value={newCompanyData.company_name}
              onChange={(e) => setNewCompanyData({ ...newCompanyData, company_name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Joining Date <span className="text-pink-500">*</span></p>
              <input
                type="date"
                className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
                value={newCompanyData.date_of_joining}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, date_of_joining: e.target.value })}
                required
              />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Leaving Date</p>
              <input
                type="date"
                className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
                value={newCompanyData.date_of_left}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, date_of_left: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition-all text-sm uppercase tracking-widest"
              onClick={() => {
                setShowAddCompanyForm(false);
                setNewCompanyData({ uan: '', epf_number: '', company_name: '', date_of_joining: '', date_of_left: '' });
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-pink-900/20 text-sm uppercase tracking-widest"
            >
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
)}


{editingTx && (
  <EditTransactionModal
    tx={editingTx}
    onClose={() => setEditingTx(null)}
    onSave={handleUpdateTransaction}
  />
)}

{/* Summary Tab */}
{activeTab === "Summary" && (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-yellow-400" />
        <h2 className="text-xl font-bold text-white tracking-tight">EPF Transactions</h2>
      </div>
      
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleDownloadPdf}
          className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-4 py-2 rounded-full border border-rose-500/20 transition-all font-bold text-xs uppercase tracking-wider"
        >
          <FileText size={16} />
          PDF
        </button>
        <button
          onClick={handleDownloadExcel}
          className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full border border-emerald-500/20 transition-all font-bold text-xs uppercase tracking-wider"
        >
          <FileSpreadsheet size={16} />
          Excel
        </button>
      </div>
    </div>

    {/* Modern Filters */}
    <div className="bg-gray-800/20 backdrop-blur-xl rounded-[2rem] border border-gray-700/30 p-4 sm:p-6 flex flex-wrap items-center gap-4 relative overflow-visible">
      <div className="absolute -left-4 -top-4 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full" />
      
      <div className="relative z-10 flex flex-wrap items-center gap-4 w-full">
        <div className="flex-1 min-w-[150px] relative" ref={fyMenuRef}>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Financial Year</p>
          <input
            type="text"
            value={fyQuery}
            onChange={(e) => {
              setFyQuery(e.target.value);
              setShowFyMenu(true);
            }}
            onFocus={() => setShowFyMenu(true)}
            placeholder="Search FY"
            className="w-full bg-gray-900 border border-gray-700/50 text-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
          <div className="mt-2 text-[11px] text-gray-400">{filters.fy && Array.isArray(filters.fy) && filters.fy.length ? filters.fy.join(', ') : 'All FY selected'}</div>

          {showFyMenu && (
            <div className="absolute left-0 z-50 mt-2 w-full bg-gray-900 border border-gray-700/50 rounded-xl p-3 shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  setFilters((prev) => ({ ...prev, fy: [] }));
                  setFyQuery("");
                  setShowFyMenu(false);
                }}
                className="w-full text-left text-sm text-gray-200 mb-3 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 transition"
              >
                All FY
              </button>
              <div className="max-h-48 overflow-auto">
                {Array.from(new Set(records.map((r) => getFY(r.contribution_date)))).filter(Boolean).sort((a, b) => b.localeCompare(a)).filter((fy) => fy.toLowerCase().includes(fyQuery.toLowerCase())).map((fy) => (
                  <button
                    key={fy}
                    type="button"
                    onClick={() => {
                      setFilters((prev) => ({ ...prev, fy: [fy] }));
                      setFyQuery(fy);
                      setShowFyMenu(false);
                    }}
                    className="w-full text-left text-sm text-gray-200 py-2 rounded-xl hover:bg-gray-800 transition"
                  >
                    {fy}
                  </button>
                ))}
                {Array.from(new Set(records.map((r) => getFY(r.contribution_date)))).filter(Boolean).filter((fy) => fy.toLowerCase().includes(fyQuery.toLowerCase())).length === 0 && (
                  <div className="text-sm text-gray-500 py-2">No results found.</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-[150px]">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Company</p>
          <select
            className="w-full bg-gray-900 border border-gray-700/50 text-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer"
            value={filters.company}
            onChange={(e) => setFilters((prev) => ({ ...prev, company: e.target.value }))}
          >
            <option value="">All Companies</option>
            {Array.from(new Set(records.map((r) => r.company_name))).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[150px]">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Invest Type</p>
          <select
            className="w-full bg-gray-900 border border-gray-700/50 text-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer"
            value={filters.invest}
            onChange={(e) => setFilters((prev) => ({ ...prev, invest: e.target.value }))}
          >
            <option value="">All Types</option>
            {Array.from(new Set(records.map((r) => r.invest_type))).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end h-full mt-5">
          <button
            onClick={resetFilters}
            className="bg-gray-700/30 hover:bg-gray-700/50 text-gray-300 px-6 py-2 rounded-xl border border-gray-600/30 transition-all text-sm font-bold"
          >
            Reset
          </button>
        </div>
      </div>
    </div>

    {/* Modern Table */}
    <div className="bg-gray-800/20 backdrop-blur-xl rounded-[2.5rem] border border-gray-700/30 overflow-hidden" ref={pdfRef}>
      <div className="overflow-x-auto">
        <table id="epfSummaryTable" className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-700/50">
              <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <Calendar size={12} />
                  Period
                </div>
              </th>
              {filters.company === "" && (
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Building2 size={12} />
                    Company
                  </div>
                </th>
              )}
              {filters.invest === "" && (
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Activity size={12} />
                    Type
                  </div>
                </th>
              )}
              <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right whitespace-nowrap">
                <div className="flex items-center justify-end gap-2">
                  <User size={12} />
                  Employee
                </div>
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right whitespace-nowrap">
                <div className="flex items-center justify-end gap-2">
                  <Building2 size={12} />
                  Employer
                </div>
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right whitespace-nowrap">
                <div className="flex items-center justify-end gap-2">
                  <PieChart size={12} />
                  Pension
                </div>
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {/* ✅ Summary Totals */}
            {filteredRecords.length > 0 && (
              <>
                <tr className="bg-emerald-500/5 font-bold">
                  <td className="px-6 py-4 text-emerald-400 uppercase text-[10px] tracking-widest" colSpan={1 + (filters.company === "" ? 1 : 0) + (filters.invest === "" ? 1 : 0)}>Overall Balance</td>
                  <td className="px-6 py-4 text-right text-sm text-emerald-400 font-black">₹{formatIndianNumber(isTrialMode ? 0 : totalsOverall3.employee)}</td>
                  <td className="px-6 py-4 text-right text-sm text-emerald-400 font-black">₹{formatIndianNumber(isTrialMode ? 0 : totalsOverall3.employer)}</td>
                  <td className="px-6 py-4 text-right text-sm text-emerald-400 font-black">₹{formatIndianNumber(isTrialMode ? 0 : totalsOverall3.pension)}</td>
                  <td className="px-6 py-4"></td>
                </tr>
                {/* Current FY - inserted between Overall and Previous FY */}
                <tr className="bg-yellow-500/5 font-bold">
                  <td className="px-6 py-4 text-yellow-400 uppercase text-[10px] tracking-widest" colSpan={1 + (filters.company === "" ? 1 : 0) + (filters.invest === "" ? 1 : 0)}>Current FY</td>
                  <td className="px-6 py-4 text-right text-sm text-yellow-400 font-black">₹{formatIndianNumber(isTrialMode ? 0 : totalsCurrFY.employee)}</td>
                  <td className="px-6 py-4 text-right text-sm text-yellow-400 font-black">₹{formatIndianNumber(isTrialMode ? 0 : totalsCurrFY.employer)}</td>
                  <td className="px-6 py-4 text-right text-sm text-yellow-400 font-black">₹{formatIndianNumber(isTrialMode ? 0 : totalsCurrFY.pension)}</td>
                  <td className="px-6 py-4"></td>
                </tr>
                <tr className="bg-rose-500/5 font-bold">
                  <td className="px-6 py-4 text-rose-400 uppercase text-[10px] tracking-widest" colSpan={1 + (filters.company === "" ? 1 : 0) + (filters.invest === "" ? 1 : 0)}>Upto Prev FY</td>
                  <td className="px-6 py-4 text-right text-sm text-rose-400 font-black">₹{formatIndianNumber(isTrialMode ? 0 : totalsPrevFY.employee)}</td>
                  <td className="px-6 py-4 text-right text-sm text-rose-400 font-black">₹{formatIndianNumber(isTrialMode ? 0 : totalsPrevFY.employer)}</td>
                  <td className="px-6 py-4 text-right text-sm text-rose-400 font-black">₹{formatIndianNumber(isTrialMode ? 0 : totalsPrevFY.pension)}</td>
                  <td className="px-6 py-4"></td>
                </tr>
              </>
            )}

            {/* Data Rows */}
            {filteredRecords.map((r) => (
              <tr key={r.id} className="hover:bg-gray-700/20 transition-all group">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-gray-500" />
                    <span className="text-sm font-bold text-gray-200">{formatDate(r.contribution_date)}</span>
                  </div>
                </td>
                {filters.company === "" && <td className="px-6 py-4 text-sm font-medium text-gray-400">{r.company_name}</td>}
                {filters.invest === "" && (
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md ${
                      r.invest_type?.toLowerCase().includes('withdrawal') ? 'bg-rose-500/10 text-rose-400' : 
                      r.invest_type?.toLowerCase().includes('interest') ? 'bg-blue-500/10 text-blue-400' : 
                      'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {r.invest_type}
                    </span>
                  </td>
                )}
                <td className="px-6 py-4 text-right text-sm font-bold text-gray-200">₹{formatIndianNumber(isTrialMode ? 0 : r.employee_share)}</td>
                <td className="px-6 py-4 text-right text-sm font-bold text-gray-200">₹{formatIndianNumber(isTrialMode ? 0 : r.employer_share)}</td>
                <td className="px-6 py-4 text-right text-sm font-bold text-gray-200">₹{formatIndianNumber(isTrialMode ? 0 : r.pension_share)}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      className="p-2 rounded-lg bg-gray-700/30 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all border border-gray-600/30"
                      onClick={() => handleOpenEditTransaction(r)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="p-2 rounded-lg bg-gray-700/30 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all border border-gray-600/30"
                      onClick={() => handleDeleteTransaction(r.id)}
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
)}

      {/* Floating Action Button */}
      {!showAssumptions && (
        <>
          <button
            className={`fixed z-[60] right-6 bottom-8 sm:right-8 sm:bottom-10
             bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center
             shadow-[0_8px_30px_rgb(16,185,129,0.3)] hover:scale-110 active:scale-95 transition-all duration-300 ${(showEpfForm || showProjectionForm || showEditForm || showAddCompanyForm) ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            onClick={() => setShowEpfForm(true)}
          >
            <Plus className="w-8 h-8" />
          </button>

{/* Render the form when showEpfForm is true */}
{showEpfForm && (
  <EpfForm
    onClose={() => setShowEpfForm(false)}
    onSuccess={() => {
      setShowEpfForm(false);
      fetchRecords();
    }}
  />
)}
        </>
      )}
    </div>
  );
};

export default Epf;
