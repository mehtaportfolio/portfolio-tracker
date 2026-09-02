import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { fetchAllRows } from "../../utils/supabasePagination.js";
import { useMode } from "../../context/ModeContext.jsx";
import { getActivePriceSourceTable, normalizeStockName, createNormalizedStockMap } from "../../utils/priceSourceHelper.js";

const DEFAULT_ASSET_ROWS = [
  "Stock",
  "ETF",
  "MF",
  "PPF",
  "FD",
  "NPS",
  "Bank",
  "EPF",
].map((assetType) => ({
  assetType,
  marketValue: 0,
  marketAllocation: 0,
  investedValue: 0,
  investedAllocation: 0,
  simpleProfit: 0,
  simpleProfitPercent: 0,
}));

const N = (v) => (typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.-]/g, "")) || 0);

const calculateTotals = (rows = []) => {
  const grouped = rows.reduce((acc, txn) => {
    const key = txn.account_name || "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(txn);
    return acc;
  }, {});

  let totalDeposit = 0;
  let totalInterest = 0;
  let totalWithdrawal = 0;

  Object.values(grouped).forEach((accountTxns) => {
    accountTxns.sort((a, b) => new Date(a.txn_date) - new Date(b.txn_date));

    let deposit = 0;
    let interest = 0;
    let withdrawal = 0;

    accountTxns.forEach((txn) => {
      const amount = N(txn.amount);
      const type = String(txn.transaction_type || "").toLowerCase();

      if (type === "deposit") {
        deposit += amount;
      } else if (type === "interest") {
        interest += amount;
      } else if (type === "withdrawal") {
        withdrawal += amount;
      }
    });

    totalDeposit += deposit;
    totalInterest += interest;
    totalWithdrawal += withdrawal;
  });

  const totalCurrentBalance = totalDeposit + totalInterest - totalWithdrawal;
  const totalInvestment = Math.max(totalDeposit - totalWithdrawal, 0);
  const totalInterestEarned = totalInterest;

  return {
    deposit: totalDeposit,
    interest: totalInterest,
    withdrawal: totalWithdrawal,
    total: totalCurrentBalance,
    currentBalance: totalCurrentBalance,
    investment: totalInvestment,
    interestEarned: totalInterestEarned,
  };
};

const FIFO_SALE_KEYWORDS = [
  "sell",
  "redeem",
  "withdraw",
  "switch out",
  "switch-out",
  "switch to",
  "switch-to",
  "stp out",
  "stp-out",
  "charges",
  "exit",
  "migration",
  "transfer",
  "payout",
];

const reduceLotUnits = (lots, unitsToRemove) => {
  let remaining = unitsToRemove;
  lots.sort((a, b) => {
    const orderDiff = (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY);
    if (Math.abs(orderDiff) > 1e-8) {
      return orderDiff;
    }
    return (a.sequence ?? 0) - (b.sequence ?? 0);
  });
  while (remaining > 1e-8 && lots.length) {
    const currentLot = lots[0];
    const deduction = Math.min(remaining, currentLot.units);
    const costPerUnit = currentLot.units ? currentLot.cost / currentLot.units : 0;
    currentLot.units -= deduction;
    currentLot.cost -= deduction * costPerUnit;
    remaining -= deduction;
    if (currentLot.units <= 1e-8) {
      lots.shift();
    }
  }
};

const parseTransactionDate = (value) => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) {
    return date;
  }
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    const epochDate = new Date(numeric);
    if (!Number.isNaN(epochDate.getTime())) {
      return epochDate;
    }
  }
  return null;
};

const aggregateLatestSavingsDemat = (transactions = []) => {
  if (!transactions.length) {
    return { savings: 0, demat: 0, total: 0 };
  }

  const filtered = transactions.filter((txn) => {
    const type = String(txn?.account_type || "").toLowerCase();
    return type === "savings" || type === "demat";
  });

  if (!filtered.length) {
    return { savings: 0, demat: 0, total: 0 };
  }

  let latestMonthNumeric = -Infinity;
  filtered.forEach((txn) => {
    if (!txn?.txn_date) return;
    const date = new Date(txn.txn_date);
    if (Number.isNaN(date.getTime())) return;
    const monthNumeric = date.getFullYear() * 100 + (date.getMonth() + 1);
    if (monthNumeric > latestMonthNumeric) {
      latestMonthNumeric = monthNumeric;
    }
  });

  if (!Number.isFinite(latestMonthNumeric) || latestMonthNumeric < 0) {
    return { savings: 0, demat: 0, total: 0 };
  }

  const groups = new Map();
  filtered.forEach((txn) => {
    const key = `${txn.account_name || ""}||${txn.bank_name || ""}||${txn.account_type || ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(txn);
  });

  let savingsSum = 0;
  let dematSum = 0;

  groups.forEach((list) => {
    const match = [...list]
      .filter((txn) => txn?.txn_date)
      .sort((a, b) => new Date(b.txn_date || 0) - new Date(a.txn_date || 0))
      .find((txn) => {
        const date = new Date(txn.txn_date);
        if (Number.isNaN(date.getTime())) return false;
        const monthNumeric = date.getFullYear() * 100 + (date.getMonth() + 1);
        return monthNumeric === latestMonthNumeric;
      });

    if (!match) return;

    const type = String(match.account_type || "").toLowerCase();
    const amount = N(match.amount);

    if (type === "savings") {
      savingsSum += amount;
    } else if (type === "demat") {
      dematSum += amount;
    }
  });

  return { savings: savingsSum, demat: dematSum, total: savingsSum + dematSum };
};

const buildDefaultRows = () => DEFAULT_ASSET_ROWS.map((row) => ({ ...row }));

export default function useAssetRows() {
  const { priceSource } = useMode();
  const [rows, setRows] = useState(buildDefaultRows);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [masked, setMasked] = useState(() => {
    try {
      return localStorage.getItem("dashboard_portfolio_mask") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("dashboard_portfolio_mask", masked ? "1" : "0");
    } catch {}
  }, [masked]);

  const [bankSavings, setBankSavings] = useState(0);
  const [bankDemat, setBankDemat] = useState(0);
  const [overallTotals, setOverallTotals] = useState({
    marketValue: 0,
    invested: 0,
    profit: 0,
    profitPercent: 0,
  });

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const priceSourceTable = getActivePriceSourceTable(priceSource);
        const useBackendMF = priceSource === 'stock_mapping' || priceSource === 'live';

        const [
          stockTxRes,
          stockPriceRes,
          mfTxRes,
          mfMasterRes,
          mfBackendRes,
          bankRes,
          epfRes,
          ppfFdRes,
          npsTxRes,
          npsMasterRes,
        ] = await Promise.all([
          fetchAllRows(supabase, "stock_transactions", {
            select: "stock_name, quantity, buy_price, sell_date, account_type",
          }),
          fetchAllRows(supabase, priceSourceTable, {
            select: "stock_name, cmp, lcp",
          }),
          fetchAllRows(supabase, "mf_transactions", {
            select: "fund_short_name, account_name, units, transaction_type, nav, date",
          }),
          fetchAllRows(supabase, "fund_master", {
            select: "fund_short_name, cmp, lcp",
          }),
          useBackendMF 
            ? fetchAllRows(supabase, "fund_master_backend", {
                select: "fund_short_name, nav, last_sync_at",
                order: { column: "last_sync_at", ascending: false },
              })
            : Promise.resolve({ data: [], error: null }),
          fetchAllRows(supabase, "bank_transactions", {
            select: "account_name, bank_name, account_type, txn_date, amount",
          }),
          fetchAllRows(supabase, "epf_transactions", {
            select: "employee_share, employer_share, pension_share, invest_type",
          }),
          fetchAllRows(supabase, "ppf_transactions", {
            select: "account_name, txn_date, amount, transaction_type, account_type",
            order: { column: "txn_date", ascending: true },
          }),
          fetchAllRows(supabase, "nps_transactions", {
            select: "scheme_name, account_name, units, transaction_type, nav, date, created_at, fund_name",
          }),
          fetchAllRows(supabase, "nps_pension_fund_master", {
            select: "scheme_name, cmp, lcp",
          }),
        ]);

        let stockMarketValue = 0;
        let stockInvested = 0;
        let stockDayChange = 0;
        let etfMarketValue = 0;
        let etfInvested = 0;
        let etfDayChange = 0;

        if (!stockTxRes.error && !stockPriceRes.error) {
          const masterMap = createNormalizedStockMap(stockPriceRes.data || []);

          const aggregated = new Map();
          (stockTxRes.data || []).forEach((txn) => {
            if (!txn.stock_name) return;
            if (txn.sell_date) return; // only open positions

            const key = `${String(txn.account_type || "").toUpperCase()}||${String(txn.stock_name).trim()}`;
            const entry = aggregated.get(key) || {
              accountType: String(txn.account_type || "").trim().toUpperCase(),
              stockName: String(txn.stock_name).trim(),
              quantity: 0,
              invested: 0,
              dayChange: 0,
            };

            entry.quantity += N(txn.quantity);
            entry.invested += N(txn.quantity) * N(txn.buy_price);
            aggregated.set(key, entry);
          });

          aggregated.forEach((entry) => {
            if (!entry.quantity) return;
            const normalizedName = normalizeStockName(entry.stockName);
            const master = masterMap.get(normalizedName) || { cmp: 0, lcp: 0 };
            const cmp = master.cmp;
            const lcp = master.lcp;
            const marketValue = entry.quantity * cmp;
            const invested = entry.invested;
            const dayChange = lcp > 0 ? entry.quantity * (cmp - lcp) : 0;

            if (entry.accountType === "ETF") {
              etfMarketValue += marketValue;
              etfInvested += invested;
              etfDayChange += dayChange;
            } else {
              stockMarketValue += marketValue;
              stockInvested += invested;
              stockDayChange += dayChange;
            }
          });
        }

        let mfMarketValue = 0;
        let mfInvested = 0;
        let mfDayChange = 0;
        if (!mfTxRes.error && !mfMasterRes.error) {
          const masterMap = new Map();
          
          // 1. Baseline from fund_master
          (mfMasterRes.data || []).forEach((m) => {
            const name = String(m.fund_short_name || '').trim().toUpperCase();
            if (name) {
              masterMap.set(name, { cmp: N(m.cmp), lcp: N(m.lcp) });
            }
          });

          // 2. Override from fund_master_backend if applicable
          if (useBackendMF && !mfBackendRes?.error && mfBackendRes?.data) {
            const groupedMF = new Map();
            mfBackendRes.data.forEach((m) => {
              const name = String(m.fund_short_name || '').trim().toUpperCase();
              if (name) {
                if (!groupedMF.has(name)) groupedMF.set(name, []);
                groupedMF.get(name).push(m);
              }
            });

            groupedMF.forEach((history, name) => {
              if (history.length > 0) {
                const cmp = N(history[0].nav);
                const lcp = history.length > 1 ? N(history[1].nav) : cmp;
                // Override or add new
                masterMap.set(name, { cmp, lcp });
              }
            });
          }

          const lotsByFund = new Map();

          const mfTransactions = (mfTxRes.data || [])
            .map((txn, index) => {
              const fundName = String(txn.fund_short_name || "").trim();
              if (!fundName) return null;
              const accountName = String(txn.account_name || "").trim();
              const type = String(txn.transaction_type || "").toLowerCase();
              const units = N(txn.units);
              const nav = N(txn.nav);
              const effectiveDate =
                parseTransactionDate(txn.date) ||

                null;
              return {
                fundName,
                accountName,
                type,
                units,
                nav,
                effectiveDate,
                index,
              };
            })
            .filter((txn) => txn && Number.isFinite(txn.units) && Math.abs(txn.units) > 1e-8)
            .sort((a, b) => {
              const aTime = a.effectiveDate ? a.effectiveDate.getTime() : Number.POSITIVE_INFINITY;
              const bTime = b.effectiveDate ? b.effectiveDate.getTime() : Number.POSITIVE_INFINITY;
              if (aTime !== bTime) return aTime - bTime;
              return a.index - b.index;
            });

          mfTransactions.forEach((txn) => {
            const { fundName, accountName, type, units, nav, effectiveDate, index } = txn;
            const fundKey = `${fundName}||${accountName}`;
            if (!lotsByFund.has(fundKey)) {
              lotsByFund.set(fundKey, []);
            }
            const lots = lotsByFund.get(fundKey);

            if (type.includes("buy") && units > 0) {
              lots.push({
                units,
                cost: units * nav,
                date: effectiveDate,
                order: effectiveDate ? effectiveDate.getTime() : Number.POSITIVE_INFINITY,
                sequence: index,
              });
              return;
            }

            const isSaleType =
              units < 0 ||
              FIFO_SALE_KEYWORDS.some((keyword) => type.includes(keyword));

            if (isSaleType) {
              const unitsToRemove = units < 0 ? Math.abs(units) : units;
              reduceLotUnits(lots, unitsToRemove);
            }
          });

          lotsByFund.forEach((lots, key) => {
            const [fundNameRaw] = key.split("||");
            const fundName = fundNameRaw?.trim() || "";
            const openLots = lots.filter((lot) => lot.units > 1e-8);
            if (!openLots.length) return;
            const master = masterMap.get(fundName.toUpperCase()) || { cmp: 0, lcp: 0 };
            const cmp = master.cmp;
            const lcp = master.lcp;
            const openUnits = openLots.reduce((sum, lot) => sum + lot.units, 0);
            const invested = openLots.reduce((sum, lot) => sum + Math.max(lot.cost, 0), 0);
            const marketValue = openUnits * cmp;
            const dayChange = openUnits * (cmp - lcp);

            mfMarketValue += marketValue;
            mfInvested += invested;
            mfDayChange += dayChange;
          });
        }

        let bankSavings = 0;
        let bankDemat = 0;
        if (!bankRes.error) {
          const bankTotals = aggregateLatestSavingsDemat(bankRes.data || []);
          bankSavings = bankTotals.savings || 0;
          bankDemat = bankTotals.demat || 0;
        }
        const bankMarketValue = bankSavings + bankDemat;
        const bankInvested = bankMarketValue;

        let epfMarketValue = 0;
        let epfInvested = 0;
        if (!epfRes.error) {
          let deposits = 0;
          let interest = 0;
          let withdrawal = 0;

          (epfRes.data || []).forEach((row) => {
            const amount = N(row.employee_share) + N(row.employer_share) + N(row.pension_share);
            if (amount <= 0) return;
            const type = String(row.invest_type || "").toLowerCase();

            if (type.includes("withdraw")) {
              withdrawal += amount;
            } else if (type.includes("interest")) {
              interest += amount;
            } else {
              deposits += amount;
            }
          });

          epfMarketValue = deposits + interest - withdrawal;
          epfInvested = deposits - withdrawal; // Assuming withdrawal reduces invested
        }

        let ppfMarketValue = 0;
        let ppfInvested = 0;
        let fdMarketValue = 0;
        let fdInvested = 0;
        if (!ppfFdRes.error) {
          const today = new Date();
          const rowsUptoToday = (ppfFdRes.data || []).filter((txn) => {
            const date = txn.txn_date ? new Date(txn.txn_date) : null;
            return date && date <= today;
          });

          const ppfRows = rowsUptoToday.filter(
            (txn) => String(txn.account_type || "").toLowerCase() === "ppf"
          );
          const fdRows = rowsUptoToday.filter(
            (txn) => String(txn.account_type || "").toLowerCase() === "fd"
          );

          const ppfTotals = calculateTotals(ppfRows);
          const fdTotals = calculateTotals(fdRows);

          ppfMarketValue = ppfTotals.currentBalance || 0;
          ppfInvested = ppfTotals.investment || 0;
          fdMarketValue = fdTotals.currentBalance || 0;
          fdInvested = fdTotals.investment || 0;
        }

        let npsMarketValue = 0;
        let npsInvested = 0;
        let npsDayChange = 0;
        if (!npsTxRes.error && !npsMasterRes.error) {
          const masterMap = new Map(
            (npsMasterRes.data || []).map((m) => [String(m.scheme_name).trim(), { cmp: N(m.cmp), lcp: N(m.lcp) }])
          );

          const lotsByScheme = new Map();

          const npsTransactions = (npsTxRes.data || [])
            .map((txn, index) => {
              const schemeName = String(txn.scheme_name || "").trim();
              if (!schemeName) return null;
              const accountName = String(txn.account_name || "").trim();
              const type = String(txn.transaction_type || "").toLowerCase();
              const units = N(txn.units);
              const nav = N(txn.nav);
              const fundName = String(txn.fund_name || "").trim();
              const effectiveDate =
                parseTransactionDate(txn.date) ||
                parseTransactionDate(txn.txn_date) ||
                parseTransactionDate(txn.created_at) ||
                null;
              return {
                schemeName,
                accountName,
                fundName,
                type,
                units,
                nav,
                effectiveDate,
                index,
              };
            })
            .filter((txn) => txn && Number.isFinite(txn.units) && Math.abs(txn.units) > 1e-8)
            .sort((a, b) => {
              const aTime = a.effectiveDate ? a.effectiveDate.getTime() : Number.POSITIVE_INFINITY;
              const bTime = b.effectiveDate ? b.effectiveDate.getTime() : Number.POSITIVE_INFINITY;
              if (aTime !== bTime) return aTime - bTime;
              return a.index - b.index;
            });

          npsTransactions.forEach((txn) => {
            const { schemeName, accountName, type, units, nav, effectiveDate, index } = txn;
            const key = `${schemeName}||${accountName}`;
            if (!lotsByScheme.has(key)) {
              lotsByScheme.set(key, []);
            }
            const lots = lotsByScheme.get(key);

            if (type.includes("buy") && units > 0) {
              lots.push({
                units,
                cost: units * nav,
                date: effectiveDate,
                order: effectiveDate ? effectiveDate.getTime() : Number.POSITIVE_INFINITY,
                sequence: index,
              });
              return;
            }

            const isSaleType =
              units < 0 || FIFO_SALE_KEYWORDS.some((keyword) => type.includes(keyword));

            if (isSaleType) {
              const unitsToRemove = units < 0 ? Math.abs(units) : units;
              reduceLotUnits(lots, unitsToRemove);
            }
          });

          lotsByScheme.forEach((lots, key) => {
            const [schemeNameRaw] = key.split("||");
            const schemeName = schemeNameRaw?.trim() || "";
            const openLots = lots.filter((lot) => lot.units > 1e-8);
            if (!openLots.length) return;
            const master = masterMap.get(schemeName) || { cmp: 0, lcp: 0 };
            const cmp = master.cmp;
            const lcp = master.lcp;
            const openUnits = openLots.reduce((sum, lot) => sum + lot.units, 0);
            const invested = openLots.reduce((sum, lot) => sum + Math.max(lot.cost, 0), 0);
            const marketValue = openUnits * cmp;
            const dayChange = openUnits * (cmp - lcp);

            npsMarketValue += marketValue;
            npsInvested += invested;
            npsDayChange += dayChange;
          });
        }

        const assembledRows = [
          {
            assetType: "Stock",
            marketValue: stockMarketValue,
            investedValue: stockInvested,
            dayChange: stockDayChange,
          },
          {
            assetType: "ETF",
            marketValue: etfMarketValue,
            investedValue: etfInvested,
            dayChange: etfDayChange,
          },
          {
            assetType: "MF",
            marketValue: mfMarketValue,
            investedValue: mfInvested,
            dayChange: mfDayChange,
          },
          {
            assetType: "PPF",
            marketValue: ppfMarketValue,
            investedValue: ppfInvested,
            dayChange: 0,
          },
          {
            assetType: "FD",
            marketValue: fdMarketValue,
            investedValue: fdInvested,
            dayChange: 0,
          },
          {
            assetType: "NPS",
            marketValue: npsMarketValue,
            investedValue: npsInvested,
            dayChange: npsDayChange,
          },
          {
            assetType: "Bank",
            marketValue: bankMarketValue,
            investedValue: bankInvested,
            dayChange: 0,
          },
          {
            assetType: "EPF",
            marketValue: epfMarketValue,
            investedValue: epfInvested,
            dayChange: 0,
          },
        ];

        const totalMarketValue = assembledRows.reduce((sum, row) => sum + (Number(row.marketValue) || 0), 0);
        const totalInvestedValue = assembledRows.reduce((sum, row) => sum + (Number(row.investedValue) || 0), 0);

        const finalRows = assembledRows.map((row) => {
          const marketValue = Math.round(Number(row.marketValue)) || 0;
          const investedValue = Math.round(Number(row.investedValue)) || 0;
          const dayChange = Math.round(Number(row.dayChange)) || 0;
          const simpleProfit = Math.round(marketValue - investedValue);
          const marketAllocation = totalMarketValue ? (marketValue / totalMarketValue) * 100 : 0;
          const investedAllocation = totalInvestedValue ? (investedValue / totalInvestedValue) * 100 : 0;
          const simpleProfitPercent = investedValue ? (simpleProfit / investedValue) * 100 : 0;

          return {
            assetType: row.assetType,
            marketValue,
            investedValue,
            dayChange,
            marketAllocation,
            investedAllocation,
            simpleProfit,
            simpleProfitPercent,
          };
        });

        const overallMarketValue = totalMarketValue;
        const overallInvestedValue = totalInvestedValue;
        const overallProfit = overallMarketValue - overallInvestedValue;
        const overallProfitPercent = overallInvestedValue
          ? (overallProfit / overallInvestedValue) * 100
          : 0;

        if (!isCancelled) {
          setRows(finalRows);
          setBankSavings(bankSavings);
          setBankDemat(bankDemat);
          setOverallTotals({
            marketValue: overallMarketValue,
            invested: overallInvestedValue,
            profit: overallProfit,
            profitPercent: overallProfitPercent,
          });
        }
      } catch (error) {
        console.error("Failed to load asset rows", error);
        if (!isCancelled) {
          setRows(buildDefaultRows());
          setError("Failed to load asset data");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isCancelled = true;
    };
  }, [priceSource]);

  return useMemo(
    () => ({
      rows,
      loading,
      error,
      masked,
      setMasked,
      bankSavings,
      bankDemat,
      overallTotals,
    }),
    [rows, loading, error, masked, bankSavings, bankDemat, overallTotals]
  );
}