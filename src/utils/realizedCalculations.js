/**
 * Shared utilities for computing realized profits and open lots across asset classes.
 * These helpers mirror the logic used on the asset detail pages so the Dashboard
 * can stay perfectly aligned with the per-asset breakdowns.
 */

const toNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    if (!cleaned) return 0;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
};

const toValidDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const createCashflowEvent = (date, flow) => {
  const validDate = toValidDate(date);
  const amount = Number(flow);
  if (!validDate || !Number.isFinite(amount) || amount === 0) {
    return null;
  }
  return { Date: validDate, Flow: amount };
};

const ensureMfBreakdownEntry = (map, accountName, fundName) => {
  const accountLabel = accountName ? accountName : "General";
  const fundLabel = fundName ? fundName : "Unknown";
  const key = `${accountLabel}::${fundLabel}`;
  if (!map.has(key)) {
    map.set(key, { cost: 0, proceeds: 0, profit: 0 });
  }
  return { key, entry: map.get(key) };
};

const normalizeMfType = (raw) => {
  const type = String(raw ?? "").trim().toLowerCase();
  if (!type) return null;
  if (type.includes("buy") || type.includes("purchase") || type.includes("sip")) return "buy";
  if (type.includes("sell") || type.includes("redeem")) return "sell";
  return null;
};

export function computeMutualFundRealizedAndOpen(transactions = []) {
  transactions = Array.isArray(transactions) ? transactions : [];
  const fifoByKey = new Map();

  transactions.forEach((txn) => {
    const fundShortNameRaw = typeof txn?.fund_short_name === "string" ? txn.fund_short_name : "";
    const fundShortName = fundShortNameRaw.trim();
    if (!fundShortName) return;

    const type = normalizeMfType(txn?.transaction_type);
    if (!type) return;

    const date = toValidDate(txn?.date);
    if (!date) return;

    const units = Math.abs(toNumber(txn?.units));
    const nav = toNumber(txn?.nav);
    if (!units || !nav) return;

    const accountName = txn?.account_name || "";
    const key = `${accountName}||${fundShortName}`;

    if (!fifoByKey.has(key)) fifoByKey.set(key, []);
    fifoByKey.get(key).push({ type, date, units, nav, accountName, fundShortName });
  });

  const breakdownMap = new Map();
  const cashflows = [];
  const realizedSplits = [];
  const openLots = [];
  let totalCost = 0;
  let totalProceeds = 0;
  let openCost = 0;
  const openUnitsByFund = {};

  fifoByKey.forEach((txns, key) => {
    txns.sort((a, b) => a.date - b.date);
    const lots = [];
    const [accountName = "", fundName = ""] = key.split("||");

    txns.forEach((tx) => {
      if (tx.type === "buy") {
        lots.push({ units: tx.units, nav: tx.nav, date: tx.date, accountName, fundName });
        const flow = createCashflowEvent(tx.date, -tx.units * tx.nav);
        if (flow) cashflows.push(flow);
      } else if (tx.type === "sell") {
        const saleFlow = createCashflowEvent(tx.date, tx.units * tx.nav);
        if (saleFlow) cashflows.push(saleFlow);

        let remaining = tx.units;
        while (remaining > 0 && lots.length) {
          const lot = lots[0];
          const take = Math.min(remaining, lot.units);
          const cost = take * lot.nav;
          const proceeds = take * tx.nav;

          totalCost += cost;
          totalProceeds += proceeds;

          const { entry } = ensureMfBreakdownEntry(breakdownMap, accountName, fundName);
          entry.cost += cost;
          entry.proceeds += proceeds;
          entry.profit += proceeds - cost;

          realizedSplits.push({
            fund_short_name: fundName,
            account_name: accountName,
            quantity: take,
            buy_price: lot.nav,
            sell_price: tx.nav,
            buy_date: lot.date,
            sell_date: tx.date,
          });

          lot.units -= take;
          remaining -= take;
          if (lot.units <= 1e-8) lots.shift();
        }

        if (remaining > 1e-8) {
          const unmatchedProceeds = remaining * tx.nav;
          totalProceeds += unmatchedProceeds;
          const { entry } = ensureMfBreakdownEntry(breakdownMap, accountName, fundName);
          entry.proceeds += unmatchedProceeds;
          entry.profit += unmatchedProceeds;

          realizedSplits.push({
            fund_short_name: fundName,
            account_name: accountName,
            quantity: remaining,
            buy_price: null,
            sell_price: tx.nav,
            buy_date: null,
            sell_date: tx.date,
          });
        }
      }
    });

    lots.forEach((lot) => {
      if (lot.units > 1e-8) {
        openCost += lot.units * lot.nav;
        openUnitsByFund[lot.fundName] = (openUnitsByFund[lot.fundName] || 0) + lot.units;
        openLots.push({
          fund_short_name: lot.fundName,
          account_name: lot.accountName,
          units: lot.units,
          buy_nav: lot.nav,
          buy_date: lot.date,
          sell_date: null,
        });
      }
    });
  });

  return {
    realized: {
      totalCost,
      totalProceeds,
      totalProfit: totalProceeds - totalCost,
      breakdown: Object.fromEntries(breakdownMap.entries()),
    },
    open: {
      costBasis: openCost,
      unitsByFund: openUnitsByFund,
      lots: openLots,
    },
    cashflows,
    realizedSplits,
  };
}

const classifyNpsType = (raw) => {
  const type = String(raw ?? "").trim().toLowerCase();
  if (!type) return "buy";
  if (type.includes("sell") || type.includes("withdraw") || type.includes("redeem")) return "sell";
  if (type.includes("charg") || type.includes("fee") || type.includes("tax")) return "charges";
  if (type.includes("buy") || type.includes("contribution") || type.includes("purchase") || type.includes("credit")) return "buy";
  return "other";
};

const ensureNpsBreakdownEntry = (map, schemeName) => {
  const key = schemeName || "Unknown Scheme";
  if (!map.has(key)) {
    map.set(key, { cost: 0, proceeds: 0, profit: 0 });
  }
  return map.get(key);
};

export function computeNpsRealizedAndOpen(transactions = []) {
  transactions = Array.isArray(transactions) ? transactions : [];
  const fifoByScheme = new Map();
  const cashflows = [];

  transactions.forEach((txn) => {
    const schemeRaw = typeof txn?.scheme_name === "string" ? txn.scheme_name : "";
    const schemeName = schemeRaw.trim();
    if (!schemeName) return;

    const type = classifyNpsType(txn?.transaction_type);

    if (type === "buy" || type === "sell") {
      const date = toValidDate(txn?.date);
      if (!date) return;

      const units = Math.abs(toNumber(txn?.units));
      const nav = toNumber(txn?.nav);
      if (!units || !nav) return;

      const key = schemeName;
      if (!fifoByScheme.has(key)) fifoByScheme.set(key, []);
      fifoByScheme.get(key).push({ type, date, units, nav, schemeName });
    } else if (type === "charges") {
      const date = toValidDate(txn?.date);
      const amount = toNumber(txn?.amount);
      const flow = createCashflowEvent(date, -amount);
      if (flow) cashflows.push(flow);
    }
  });

  const breakdownMap = new Map();
  const realizedSplits = [];
  const openLots = [];
  let totalCost = 0;
  let totalProceeds = 0;
  let openCost = 0;
  const openUnitsByScheme = {};

  fifoByScheme.forEach((txns, key) => {
    txns.sort((a, b) => a.date - b.date);
    const lots = [];
    const schemeName = key;

    txns.forEach((tx) => {
      if (tx.type === "buy") {
        lots.push({ units: tx.units, nav: tx.nav, date: tx.date, schemeName });
        const flow = createCashflowEvent(tx.date, -tx.units * tx.nav);
        if (flow) cashflows.push(flow);
      } else if (tx.type === "sell") {
        const saleFlow = createCashflowEvent(tx.date, tx.units * tx.nav);
        if (saleFlow) cashflows.push(saleFlow);

        let remaining = tx.units;
        while (remaining > 0 && lots.length) {
          const lot = lots[0];
          const take = Math.min(remaining, lot.units);
          const cost = take * lot.nav;
          const proceeds = take * tx.nav;

          totalCost += cost;
          totalProceeds += proceeds;

          const entry = ensureNpsBreakdownEntry(breakdownMap, schemeName);
          entry.cost += cost;
          entry.proceeds += proceeds;
          entry.profit += proceeds - cost;

          realizedSplits.push({
            scheme_name: schemeName,
            quantity: take,
            buy_price: lot.nav,
            sell_price: tx.nav,
            buy_date: lot.date,
            sell_date: tx.date,
          });

          lot.units -= take;
          remaining -= take;
          if (lot.units <= 1e-8) lots.shift();
        }

        if (remaining > 1e-8) {
          const unmatchedProceeds = remaining * tx.nav;
          totalProceeds += unmatchedProceeds;
          const entry = ensureNpsBreakdownEntry(breakdownMap, schemeName);
          entry.proceeds += unmatchedProceeds;
          entry.profit += unmatchedProceeds;

          realizedSplits.push({
            scheme_name: schemeName,
            quantity: remaining,
            buy_price: null,
            sell_price: tx.nav,
            buy_date: null,
            sell_date: tx.date,
          });
        }
      }
    });

    lots.forEach((lot) => {
      if (lot.units > 1e-8) {
        openCost += lot.units * lot.nav;
        openUnitsByScheme[lot.schemeName] = (openUnitsByScheme[lot.schemeName] || 0) + lot.units;
        openLots.push({
          scheme_name: lot.schemeName,
          units: lot.units,
          buy_nav: lot.nav,
          buy_date: lot.date,
          sell_date: null,
        });
      }
    });
  });

  return {
    realized: {
      totalCost,
      totalProceeds,
      totalProfit: totalProceeds - totalCost,
      breakdown: Object.fromEntries(breakdownMap.entries()),
    },
    open: {
      costBasis: openCost,
      unitsByScheme: openUnitsByScheme,
      lots: openLots,
    },
    cashflows,
    realizedSplits,
  };
}