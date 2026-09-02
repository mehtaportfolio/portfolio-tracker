const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365;

const normalizeDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date?.getTime()) ? null : date;
};

const parseAmount = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (value == null) return 0;

  const parsed = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const calculateXIRR = (flows) => {
  if (!Array.isArray(flows) || flows.length < 2) return null;

  const cashflows = flows
    .map((flow) => ({
      amount: parseAmount(flow.amount),
      date: normalizeDate(flow.date),
    }))
    .filter((flow) => flow.date && flow.amount !== 0)
    .sort((a, b) => a.date - b.date);

  if (cashflows.length < 2) return null;

  const hasPositive = cashflows.some((flow) => flow.amount > 0);
  const hasNegative = cashflows.some((flow) => flow.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const t0 = cashflows[0].date;
  let rate = 0.1;
  const tol = 1e-7;

  for (let i = 0; i < 100; i++) {
    let f = 0;
    let df = 0;

    for (const flow of cashflows) {
      const t = (flow.date - t0) / MS_PER_YEAR;
      const exp = Math.pow(1 + rate, t);
      f += flow.amount / exp;
      df += (-t * flow.amount) / Math.pow(1 + rate, t + 1);
    }

    if (Math.abs(df) < 1e-12) break;

    const newRate = rate - f / df;
    if (Math.abs(newRate - rate) < tol) {
      return newRate * 100;
    }
    rate = newRate;
  }

  return null;
};