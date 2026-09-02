// src/components/Dashboard/Performance.js
import React, { useEffect, useState } from "react";
import { Activity, TrendingUp, PieChart, Wallet } from "lucide-react";
import Summary from "./Growth.jsx";
import InvestmentChart from "./Chart.jsx";
import { computeMutualFundRealizedAndOpen, computeNpsRealizedAndOpen } from "../../utils/realizedCalculations.js";
import { useTrialMode } from "../../hooks/useTrialMode.js";
import { useMode } from "../../context/ModeContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { API_URL as CONFIG_API_URL } from "../../config/apiConfig.js";

// Backend API URL
const API_URL = CONFIG_API_URL;

// XIRR calculation functions
const ExcelFormulas = {
  PVIF: function(rate, nper) {
    return Math.pow(1 + rate, nper);
  },

  FVIFA: function(rate, nper) {
    return rate === 0 ? nper : (this.PVIF(rate, nper) - 1) / rate;
  },

  DaysBetween: function(date1, date2) {
    var oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
  },

  XNPV: function(rate, values) {
    var xnpv = 0.0;
    var firstDate = new Date(values[0].Date);
    for (var key in values) {
      var tmp = values[key];
      var value = tmp.Flow;
      var date = new Date(tmp.Date);
      xnpv += value / Math.pow(1 + rate, this.DaysBetween(firstDate, date) / 365);
    }
    return xnpv;
  },

  XIRR: function(values, guess) {
    if (!guess) guess = 0.05;

    let x1 = 0.0;
    let x2 = guess;
    let f1 = this.XNPV(x1, values);
    let f2 = this.XNPV(x2, values);

    for (let iteration = 0; iteration < 100; iteration += 1) {
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

    const f = this.XNPV(x1, values);
    let root;
    let delta;
    if (f < 0.0) {
      root = x1;
      delta = x2 - x1;
    } else {
      root = x2;
      delta = x1 - x2;
    }

    for (let iteration = 0; iteration < 100; iteration += 1) {
      delta *= 0.5;
      const xMid = root + delta;
      const fMid = this.XNPV(xMid, values);
      if (fMid <= 0.0) root = xMid;
      if (Math.abs(fMid) < 1.0e-6 || Math.abs(delta) < 1.0e-6) return xMid;
    }

    return null;
  }
};

// Helper: safe number
const N = (v) => (typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.-]/g, "")) || 0);

// Helper: Indian currency compact formatting
const formatINRCompact = (value) => {
  const num = Number(value) || 0;
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);

  if (abs < 1000) {
    return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  }
  if (abs < 1e5) {
    return `${sign}₹${(abs / 1e3).toFixed(2)}K`;
  }
  if (abs < 1e7) {
    return `${sign}₹${(abs / 1e5).toFixed(2)}L`;
  }
  return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
};

const CACHE_KEY = 'performanceData';

export default function Performance() {
  const { isTrialMode } = useTrialMode();
  const { priceSource } = useMode();
  const { session } = useAuth();
  const token = session?.access_token;
  const [loading, setLoading] = useState(true);
  const [toggle, setToggle] = useState("open"); // "open" | "closed"
  const [error, setError] = useState("");
  const [xirr, setXirr] = useState(null);
  const [totalAbsoluteReturnPercent, setTotalAbsoluteReturnPercent] = useState(null);
  const [fixedIncomeSummary, setFixedIncomeSummary] = useState({
    invested: 0,
    balance: 0,
    returnPercent: null,
    deposits: 0,
    withdrawals: 0,
    ppfBalance: 0,
    fdBalance: 0,
    interest: 0
  });
  const [realizedSummary, setRealizedSummary] = useState({
    absolute: 0,
    returnPercent: null
  });

  const [masked, setMasked] = useState(() => {
    try {
      return localStorage.getItem("dashboard_mask") === "1"; // same key as Portfolio toggle
    } catch {
      return false;
    }
  });

  // Listen for storage changes (if user toggles in another tab or component)
  useEffect(() => {
    const handleStorage = () => {
      try {
        setMasked(localStorage.getItem("dashboard_mask") === "1");
      } catch {}
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);


 const formatValue = (v) => (masked ? "*****" : formatINRCompact(v));
 const formatPercent = (v) => {
   if (masked) return "*****";
   if (v === null || !Number.isFinite(v)) return "N/A";
   return `${v.toFixed(2)}%`;
 };

 const logRealizedProfitBreakdown = (equityRows = [], summaryRows = [], metadata = {}) => {
   if (typeof window === "undefined" || typeof console === "undefined") return;
   const hasEquity = Array.isArray(equityRows) && equityRows.length > 0;
   const hasSummary = Array.isArray(summaryRows) && summaryRows.length > 0;

   if (!hasEquity && !hasSummary) {
     return;
   }

 };

  useEffect(() => {
    const load = async () => {
      console.log("[Performance] Load started. Trial Mode:", isTrialMode);
      if (isTrialMode) {
        setXirr(null);
        setTotalAbsoluteReturnPercent(null);
        setFixedIncomeSummary({
          invested: 0,
          balance: 0,
          returnPercent: null,
          deposits: 0,
          withdrawals: 0,
          ppfBalance: 0,
          fdBalance: 0,
          interest: 0
        });
        setRealizedSummary({
          absolute: 0,
          returnPercent: null
        });
        setLoading(false);
        setError("");
        return;
      }

      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      // Check cache (Disabled for debugging)
      /*
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < CACHE_DURATION) {
            setXirr(parsed.xirr);
            setTotalAbsoluteReturnPercent(parsed.totalAbsoluteReturnPercent);
            setFixedIncomeSummary(parsed.fixedIncomeSummary);
            setRealizedSummary(parsed.realizedSummary);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
      */

      try {
        const cashFlows = [];
        let totalCurrentValue = 0;
        let equityOpenCost = 0;
        let mfOpenCost = 0;
        let npsOpenCost = 0;
        let epfDeposits = 0;
        let epfWithdrawals = 0;
        let epfBalance = 0;
        let ppfDeposits = 0;
        let ppfWithdrawals = 0;
        let ppfBalance = 0;
        let fdDeposits = 0;
        let fdWithdrawals = 0;
        let fdBalance = 0;
        let bankBalance = 0;
        let stockMV = 0;
        let etfMV = 0;
        let mfMV = 0;
        let npsMV = 0;

        const totalRealizedDetails = {
          equity: { profit: 0, cost: 0 },
          etf: { profit: 0, cost: 0 },
          mf: { profit: 0, cost: 0 },
          nps: { profit: 0, cost: 0 },
          interest: 0
        };

        // ===== 1) STOCK AND ETF DATA FROM BACKEND API =====
        // Use the same portfolio API that Asset pages use for consistency
        let portfolioData = null;
        try {
          const portfolioRes = await fetch(`${API_URL}/stock/portfolio`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (portfolioRes.ok) {
            portfolioData = await portfolioRes.json();
          }
        } catch (err) {
          console.warn('[Performance] Warning: Could not fetch portfolio data from backend, falling back to direct query');
        }

        // Extract stock/ETF data
        if (portfolioData?.openStats && portfolioData?.closedStats) {
          // Use backend portfolio data
          const openStats = portfolioData.openStats || {};
          const closedStats = portfolioData.closedStats || {};
          
          // Open positions
          equityOpenCost = openStats.invested || 0;
          stockMV = openStats.currentValue || 0;
          if (portfolioData.openTxns) {
            portfolioData.openTxns.forEach(txn => {
              if (txn.buy_date) {
                const qty = N(txn.quantity);
                const buyPrice = N(txn.buy_price);
                cashFlows.push({ Date: new Date(txn.buy_date), Flow: -(qty * buyPrice) });
              }
            });
          }

          // Closed positions (realized profit already accounts for charges)
          totalRealizedDetails.equity.profit = closedStats.realizedProfit || 0;
          totalRealizedDetails.equity.cost = closedStats.invested || 0;
          
          if (portfolioData.closedTxns) {
            portfolioData.closedTxns.forEach(txn => {
              if (txn.buy_date) {
                const qty = N(txn.quantity);
                const buyPrice = N(txn.buy_price);
                cashFlows.push({ Date: new Date(txn.buy_date), Flow: -(qty * buyPrice) });
              }
              if (txn.sell_date) {
                const qty = N(txn.quantity);
                const sellPrice = N(txn.sell_price);
                cashFlows.push({ Date: new Date(txn.sell_date), Flow: qty * sellPrice });
              }
            });
          }

          totalCurrentValue += stockMV;
        }

        // ===== 2) MUTUAL FUND DATA FROM BACKEND API =====
        let mfData = null;
        const mfRes = await fetch(`${API_URL}/assets/mf`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (mfRes.ok) {
          mfData = await mfRes.json();
        }

        if (mfData?.transactions && Array.isArray(mfData.transactions)) {
          const { realized, open, cashflows } = computeMutualFundRealizedAndOpen(mfData.transactions);

          totalRealizedDetails.mf.profit = realized.totalProfit;
          totalRealizedDetails.mf.cost = realized.totalCost;

          cashflows.forEach((flow) => {
            if (flow?.Date && Number.isFinite(flow?.Flow)) {
              cashFlows.push(flow);
            }
          });

          mfOpenCost = open.costBasis;

          if (mfData.holdings && Array.isArray(mfData.holdings)) {
            mfData.holdings.forEach(holding => {
              mfMV += holding.currentValue || 0;
            });
          }

          totalCurrentValue += mfMV;
        }


        // ===== 3) NPS DATA FROM BACKEND API =====
        let npsData = null;
        const npsRes = await fetch(`${API_URL}/assets/nps`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (npsRes.ok) {
          npsData = await npsRes.json();
        }

        if (npsData?.transactions && Array.isArray(npsData.transactions)) {
          const npsTransactionsNormalized = npsData.transactions.map(txn => ({
            ...txn,
            scheme_name: txn.scheme_name || txn.fund_name
          }));
          const { realized, open, cashflows } = computeNpsRealizedAndOpen(npsTransactionsNormalized);

          totalRealizedDetails.nps.profit = realized.totalProfit;
          totalRealizedDetails.nps.cost = realized.totalCost;

          cashflows.forEach((flow) => {
            if (flow?.Date && Number.isFinite(flow?.Flow)) {
              cashFlows.push(flow);
            }
          });

          npsOpenCost = open.costBasis;

          if (npsData.holdings && Array.isArray(npsData.holdings)) {
            npsData.holdings.forEach(holding => {
              npsMV += holding.currentValue || 0;
            });
          }

          totalCurrentValue += npsMV;
        }

        // ===== 4) PPF and FD DATA FROM BACKEND API =====
        let ppfData = null;
        const ppfRes = await fetch(`${API_URL}/assets/ppf`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (ppfRes.ok) {
          ppfData = await ppfRes.json();
        }

        if (ppfData?.transactions && Array.isArray(ppfData.transactions)) {
          ppfData.transactions.forEach(t => {
            const amt = N(t.amount);
            const tt = String(t.transaction_type || "").toLowerCase();
            const at = String(t.account_type || "").toLowerCase();
            if (at === 'ppf' || at === 'fd') {
              let flow = 0;
              if (tt === 'deposit') {
                flow = -Math.abs(amt);
                if (at === 'ppf') {
                  ppfDeposits += Math.abs(amt);
                  ppfBalance += Math.abs(amt);
                } else {
                  fdDeposits += Math.abs(amt);
                  fdBalance += Math.abs(amt);
                }
              } else if (tt === 'withdrawal') {
                flow = Math.abs(amt);
                if (at === 'ppf') {
                  ppfWithdrawals += Math.abs(amt);
                  ppfBalance -= Math.abs(amt);
                } else {
                  fdWithdrawals += Math.abs(amt);
                  fdBalance -= Math.abs(amt);
                }
              } else if (tt === 'interest') {
                flow = Math.abs(amt);
                if (at === 'ppf') {
                  ppfBalance += Math.abs(amt);
                } else {
                  fdBalance += Math.abs(amt);
                }
              }
              if (flow !== 0 && t.txn_date) {
                cashFlows.push({ Date: new Date(t.txn_date), Flow: flow });
              }
            }
          });
          
          if (ppfData.summary) {
            ppfDeposits = N(ppfData.summary.totalInvested) || ppfDeposits;
            ppfBalance = N(ppfData.summary.totalCurrent) || ppfBalance;
          }
          totalCurrentValue += ppfBalance + fdBalance;
        }

        // ===== 5) EPF DATA FROM BACKEND API =====
        let epfData = null;
        const epfRes = await fetch(`${API_URL}/assets/epf`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (epfRes.ok) {
          epfData = await epfRes.json();
        }

        if (epfData?.transactions && Array.isArray(epfData.transactions)) {
          epfData.transactions.forEach(t => {
            const emp = N(t.employee_share);
            const empr = N(t.employer_share);
            const pen = N(t.pension_share);
            const amount = emp + empr + pen;
            const investType = String(t.invest_type || "").toLowerCase();
            let flow = 0;
            if (investType.includes("interest")) {
              flow = amount;
              epfBalance += amount;
            } else if (investType.includes("withdrawal")) {
              flow = amount;
              epfWithdrawals += amount;
              epfBalance -= amount;
            } else {
              // All shares (employee, employer, pension) are considered "investment" for deposit type
              flow = -amount; 
              epfDeposits += amount;
              epfBalance += amount;
            }
            if (t.contribution_date && flow !== 0) {
              cashFlows.push({ Date: new Date(t.contribution_date), Flow: flow });
            }
          });
          
          // Using loop values only as summary totals include all types without differentiation
          totalCurrentValue += epfBalance;
        }

        // ===== 6) BANK DATA FROM BACKEND API =====
        let bankData = null;
        const bankRes = await fetch(`${API_URL}/assets/bank`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (bankRes.ok) {
          bankData = await bankRes.json();
        }
        if (bankData?.summary) {
          bankBalance = (N(bankData.summary.Savings?.current) || 0) + (N(bankData.summary.Demat?.current) || 0);
          totalCurrentValue += bankBalance;
        }

        const totalEquityMV = stockMV + etfMV;
        const totalEquityCost = equityOpenCost;
        const fixedIncomeDepositsTotal = epfDeposits + ppfDeposits + fdDeposits + bankBalance;
        const fixedIncomeWithdrawalsTotal = epfWithdrawals + ppfWithdrawals + fdWithdrawals;
        const fixedIncomeBalanceTotal = epfBalance + ppfBalance + fdBalance + bankBalance;
        // Total Gain = Total Market Value - Net Invested (Deposits - Withdrawals)
        // For EPF, gain includes employer_share + pension_share from deposits, plus all shares from interest entries
        const fixedIncomeInterestTotal = fixedIncomeBalanceTotal - (fixedIncomeDepositsTotal - fixedIncomeWithdrawalsTotal);

        const growthInvestedCost = totalEquityCost + mfOpenCost + npsOpenCost;
        const growthMarketValue = totalEquityMV + mfMV + npsMV;
        const growthAbsoluteReturnPercent = growthInvestedCost > 0
          ? ((growthMarketValue - growthInvestedCost) / growthInvestedCost) * 100
          : null;

        totalRealizedDetails.interest = fixedIncomeInterestTotal;
        
        // Equity charges are now included in the backend realized profit calculation
        let equityChargesTotal = 0;

        // Calculate realized profit including ETF (which is now properly separated)
        const equityRealizedProfit = totalRealizedDetails.equity.profit + totalRealizedDetails.etf.profit;
        const equityRealizedCost = totalRealizedDetails.equity.cost + totalRealizedDetails.etf.cost;
        const realizedProfitFromSales = equityRealizedProfit + totalRealizedDetails.mf.profit + totalRealizedDetails.nps.profit;
        const totalRealizedAbsolute = realizedProfitFromSales;
        const realizedCostBase = equityRealizedCost + totalRealizedDetails.mf.cost + totalRealizedDetails.nps.cost;
        const realizedReturnPercent = realizedCostBase > 0
          ? (realizedProfitFromSales / realizedCostBase) * 100
          : null;

        const formatToTwoDecimals = value => Number((value ?? 0).toFixed(2));

        // Build asset summary
        // Note: Equity charges are already considered in stock profit calculations
        const assetSummaryRows = [
          { asset: "Stocks", netRealized: formatToTwoDecimals(totalRealizedDetails.equity.profit) },
          { asset: "ETF", netRealized: formatToTwoDecimals(totalRealizedDetails.etf.profit) },
          { asset: "Mutual Funds", netRealized: formatToTwoDecimals(totalRealizedDetails.mf.profit) },
          { asset: "NPS", netRealized: formatToTwoDecimals(totalRealizedDetails.nps.profit) },
          { asset: "Realized Total", netRealized: formatToTwoDecimals(totalRealizedAbsolute) }
        ];

        logRealizedProfitBreakdown([], assetSummaryRows, {
          inputs: {
            totalRealizedDetails,
            equityChargesTotal,
            totalRealizedAbsolute,
            realizedProfitFromSales,
            realizedCostBase
          },
          message: "Realized profits now computed from backend APIs for consistency across dashboard and asset pages"
        });

// Deposits, Withdrawals, and Current Balance are already computed
const fixedIncomeDeposits = fixedIncomeDepositsTotal;
const fixedIncomeWithdrawals = fixedIncomeWithdrawalsTotal;
const fixedIncomeBalance = fixedIncomeBalanceTotal;

// Total gain percentage across EPF, PPF, and FD (Matches Analysis page logic)
const fixedIncomeReturnValue =
  (fixedIncomeDeposits - fixedIncomeWithdrawals) > 0
    ? (fixedIncomeInterestTotal / (fixedIncomeDeposits - fixedIncomeWithdrawals)) * 100
    : null;

        // Add current value at today
        if (totalCurrentValue > 0) {
          cashFlows.push({ Date: new Date(), Flow: totalCurrentValue });
        }

        // Sort cash flows by date and filter zeros
        cashFlows.sort((a, b) => a.Date - b.Date);
        const filteredFlows = cashFlows.filter(cf => cf.Flow !== 0);

        console.log("--- Fixed Assets Calculation Breakdown ---");
        console.log("EPF: Deposits=", epfDeposits, " Balance=", epfBalance, " Withdrawals=", epfWithdrawals);
        console.log("PPF: Deposits=", ppfDeposits, " Balance=", ppfBalance, " Withdrawals=", ppfWithdrawals);
        console.log("FD: Deposits=", fdDeposits, " Balance=", fdBalance, " Withdrawals=", fdWithdrawals);
        console.log("Bank: Balance=", bankBalance);
        console.log("-------------------------------------------");
        console.log("Total Deposits (Gross):", fixedIncomeDepositsTotal);
        console.log("Total Withdrawals:", fixedIncomeWithdrawalsTotal);
        console.log("Total Market Value:", fixedIncomeBalanceTotal);
        console.log("Net Invested (Deposits - Withdrawals):", fixedIncomeDepositsTotal - fixedIncomeWithdrawalsTotal);
        console.log("Total Gain (Profit):", fixedIncomeInterestTotal);
        console.log("Return %:", fixedIncomeReturnValue);
        console.log("-------------------------------------------");

        // Calculate XIRR
        let xirrValue = null;
        if (filteredFlows.length > 1) {
          xirrValue = ExcelFormulas.XIRR(filteredFlows);
        }

        // Now set all states
        setTotalAbsoluteReturnPercent(growthAbsoluteReturnPercent);
        setRealizedSummary({
          absolute: totalRealizedAbsolute,
          returnPercent: realizedReturnPercent
        });
        setFixedIncomeSummary({
          invested: fixedIncomeDeposits,  // total amount you actually invested
          balance: fixedIncomeBalance,
          returnPercent: fixedIncomeReturnValue,
          deposits: fixedIncomeDeposits,
          withdrawals: fixedIncomeWithdrawals,
          ppfBalance,
          fdBalance,
          interest: fixedIncomeInterestTotal
        });
        setXirr(xirrValue);

        // Cache the data
        try {
          const cacheData = {
            xirr: xirrValue,
            totalAbsoluteReturnPercent: growthAbsoluteReturnPercent,
            fixedIncomeSummary: {
              invested: fixedIncomeDeposits,
              balance: fixedIncomeBalance,
              returnPercent: fixedIncomeReturnValue,
              deposits: fixedIncomeDeposits,
              withdrawals: fixedIncomeWithdrawals,
              ppfBalance,
              fdBalance,
              interest: fixedIncomeInterestTotal
            },
            realizedSummary: {
              absolute: totalRealizedAbsolute,
              returnPercent: realizedReturnPercent
            },
            timestamp: Date.now()
          };
          localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        } catch (e) {
          // Ignore cache errors
        }
      } catch (err) {
        setError("Failed to load performance data: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isTrialMode, priceSource, token]);

  if (loading) return <div className="text-center py-4 text-white">Loading performance data...</div>;
  if (error) return <div className="text-center py-4 text-red-500">{error}</div>;

const PerformanceCard = ({ title, value, subValue, icon: Icon, colorClass, bgClass }) => (
  <div className={`relative group overflow-hidden rounded-[2rem] p-5 shadow-xl transition-all duration-500 hover:-translate-y-1 ${bgClass}`}>
    
    {/* Header */}
    <div className="flex items-center gap-3 mb-2">
      <div className={`p-2 rounded-xl bg-black/20 ${colorClass}`}>
        <Icon size={18} />
      </div>
      <h3 className="text-xs font-semibold text-white/80 uppercase tracking-wider">
        {title}
      </h3>
    </div>

    {/* Value */}
    <div className="text-2xl font-bold text-white">
      {value}
    </div>

    {subValue && (
      <div className="text-xs text-white/60 mt-1">
        {subValue}
      </div>
    )}
  </div>
);


const renderReturnTab = () => (
  <div className="space-y-8">

    {/* ===== MAIN HEADER ===== */}
    <div className="flex items-center gap-3 px-1">
      <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
        <Activity size={20} />
      </div>
      <h2 className="text-lg font-bold text-white uppercase tracking-wider">
        Returns Overview
      </h2>
    </div>

    {/* ===== TOP ROW ===== */}
    <div className="grid grid-cols-2 gap-4">
      <PerformanceCard 
        title="Overall XIRR"
        value={xirr !== null && isFinite(xirr) ? formatValue(xirr * 100) + "%" : "N/A"}
        subValue="Total Portfolio"
        icon={TrendingUp}
        colorClass="text-emerald-300"
        bgClass="bg-gradient-to-br from-emerald-600 to-emerald-800"
      />

      <PerformanceCard 
        title="Realized Return %"
        value={formatPercent(realizedSummary.returnPercent)}
        subValue="On Sold Assets"
        icon={PieChart}
        colorClass="text-rose-300"
        bgClass="bg-gradient-to-br from-rose-600 to-rose-800"
      />
    </div>

    {/* ===== UNREALIZED ===== */}
    <h2 className="text-lg font-bold text-white uppercase px-1">
      Unrealized Returns
    </h2>

    <div className="grid grid-cols-2 gap-4">
      <PerformanceCard 
        title="Equity"
        value={formatPercent(totalAbsoluteReturnPercent)}
        subValue="Growth IRR"
        icon={PieChart}
        colorClass="text-blue-300"
        bgClass="bg-gradient-to-br from-orange-600 to-orange-800"
      />

      <PerformanceCard 
        title="Fixed Assets"
        value={formatPercent(fixedIncomeSummary.returnPercent)}
        subValue="Stable IRR"
        icon={Wallet}
        colorClass="text-indigo-300"
        bgClass="bg-gradient-to-br from-indigo-600 to-indigo-800"
      />
    </div>

    {/* ===== REALIZED ===== */}
    <h2 className="text-lg font-bold text-white uppercase px-1">
      Realized Returns
    </h2>

    <div className="grid grid-cols-2 gap-4">
      <PerformanceCard 
        title="Stock & MF Profits"
        value={formatValue(realizedSummary.absolute)}
        subValue="Net Gains"
        icon={TrendingUp}
        colorClass="text-green-300"
        bgClass="bg-gradient-to-br from-green-600 to-green-800"
      />

      <PerformanceCard 
        title="Interest Earned"
        value={formatValue(fixedIncomeSummary.interest)}
        subValue="Fixed Income"
        icon={Wallet}
        colorClass="text-yellow-300"
        bgClass="bg-gradient-to-br from-yellow-600 to-yellow-800"
      />
    </div>

  </div>
);

  const renderGrowthTab = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Summary masked={masked} isTrialMode={isTrialMode} />
    </div>
  );

  const renderChartTab = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <InvestmentChart masked={masked} isTrialMode={isTrialMode} />
    </div>
  );

  return (
    <div className="w-full max-w-7xl px-1 pt-1 pb-1">
      {/* Sub-navigation Segmented Control */}
      <div className="flex justify-center mb-5">
        <div className="inline-flex p-1.5 bg-gray-800/40 backdrop-blur-2xl rounded-[1.75rem] border border-gray-700/50 shadow-inner">
{[
  { id: "open", label: "Overview" },
  { id: "closed", label: "Growth" },
  { id: "chart", label: "Analysis" }
].map((tab) => (
  <button
    key={tab.id}
    className={`px-6 py-3 font-bold text-sm rounded-[1.4rem] transition-all duration-500 ease-out
      ${
        toggle === tab.id
          ? "bg-white text-gray-900 shadow-2xl scale-[1.02] translate-y-[-1px]"
          : "text-gray-400 hover:text-gray-200 hover:bg-white/5 active:scale-95"
      }`}
    onClick={() => setToggle(tab.id)}
  >
    {tab.label}
  </button>
))}
        </div>
      </div>

      <div className="mt-4">
        {toggle === "open" && renderReturnTab()}
        {toggle === "closed" && renderGrowthTab()}
        {toggle === "chart" && renderChartTab()}
      </div>
    </div>
  );
}