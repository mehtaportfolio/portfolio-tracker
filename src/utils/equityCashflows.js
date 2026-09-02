import { calculateXIRR } from "./xirr.jsx";

const toNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (value == null) {
    return 0;
  }

  const parsed = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getValidDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date?.getTime()) ? null : date;
};

const resolveInvestedAmount = (item) => {
  const explicit = toNumber(item?.invested_amount ?? item?.investedAmount);
  if (explicit > 0) {
    return explicit;
  }

  const quantity = toNumber(item?.quantity ?? item?.units);
  const buyPrice = toNumber(item?.buy_price ?? item?.buyPrice);
  const fallback = quantity * buyPrice;
  return fallback > 0 ? fallback : 0;
};

const resolveMarketValue = (item) => {
  const explicit = toNumber(item?.market_value ?? item?.marketValue);
  if (explicit > 0) {
    return explicit;
  }

  const quantity = toNumber(item?.quantity ?? item?.units);
  const cmp = toNumber(item?.cmp ?? item?.master_cmp);
  const fallback = quantity * cmp;
  return fallback > 0 ? fallback : 0;
};

export const buildOpenEquityCashflows = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const flows = [];
  let totalMarketValue = 0;

  items.forEach((item) => {
    const investedAmount = resolveInvestedAmount(item);
    const investedDate = getValidDate(item?.buy_date ?? item?.buyDate);

    if (investedAmount > 0 && investedDate) {
      flows.push({ amount: -investedAmount, date: investedDate });
    }

    const marketValue = resolveMarketValue(item);
    if (marketValue > 0) {
      totalMarketValue += marketValue;
    }
  });

  if (totalMarketValue > 0) {
    flows.push({ amount: totalMarketValue, date: new Date() });
  }

  return flows;
};

export const calculateOpenEquityXirr = (items) => {
  const flows = buildOpenEquityCashflows(items);

  if (flows.length < 2) {
    return null;
  }

  return calculateXIRR(flows);
};