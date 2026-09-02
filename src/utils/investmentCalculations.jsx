/**
 * Computes net investment for assets like stock, ETF, NPS, EPF, PPF, MF, FD.
 * Formula: total deposits + contributions - total withdrawals.
 *
 * @param {Object} params
 * @param {Array} params.transactions - List of transaction objects
 * @param {Function} params.typeMatcher - Function to match transactions for this asset type
 * @param {string} [params.amountKey='amount'] - Key for amount in transaction
 * @param {string} [params.dateKey='date'] - Key for date in transaction
 * @param {string} [params.typeKey='transaction_type'] - Key for transaction type
 * @param {number} [params.maxYear] - Maximum year to consider (inclusive)
 * @param {Map} [params.yearAccumulator] - Optional Map to accumulate year-wise data { invested, marketValue }
 * @returns {Object} { netInvestment: number, yearlyBreakdown: Map<year, netAmount> }
 */
export const computeNetInvestment = ({
  transactions,
  typeMatcher,
  amountKey = "amount",
  dateKey = "date",
  typeKey = "transaction_type",
  maxYear,
  yearAccumulator,
}) => {
  if (!transactions?.length) {
    return { netInvestment: 0, yearlyBreakdown: new Map() };
  }

  const breakdown = new Map();
  const netInvestment = transactions.reduce((total, tx) => {
    if (!typeMatcher?.(tx)) return total;

    const amount = Math.abs(toNumber(tx?.[amountKey]));
    if (amount <= 0) return total;

    const dateValue = tx?.[dateKey];
    const date = dateValue ? new Date(dateValue) : null;
    if (!date || Number.isNaN(date.getTime())) return total;

    const year = date.getFullYear();
    if (Number.isFinite(maxYear) && year > maxYear) return total;

    const rawType = String(tx?.[typeKey] || "").toLowerCase();
    let delta = 0;

    if (rawType.includes("withdraw")) {
      delta = -amount;
    } else if (rawType.includes("deposit") || rawType.includes("contribution")) {
      delta = amount;
    }

    if (delta !== 0) {
      const currentYearTotal = breakdown.get(year) ?? 0;
      breakdown.set(year, currentYearTotal + delta);

      if (yearAccumulator) {
        const entry = yearAccumulator.get(year) ?? { invested: 0, marketValue: 0 };
        entry.invested += delta;
        entry.marketValue += delta;
        yearAccumulator.set(year, entry);
      }
    }

    return total + delta;
  }, 0);

  return { netInvestment, yearlyBreakdown: breakdown };
};

/**
 * Helper function to convert value to number safely.
 * @param {*} value
 * @returns {number}
 */
const toNumber = (value) => {
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
};