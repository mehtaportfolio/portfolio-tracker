import { computeMutualFundRealizedAndOpen, computeNpsRealizedAndOpen } from "../../utils/realizedCalculations.js";

describe("computeMutualFundRealizedAndOpen", () => {
  it("aggregates realized profits and open lots per mutual fund", () => {
    const result = computeMutualFundRealizedAndOpen([
      { fund_short_name: "Axis Bluechip", account_name: "ICICI", date: "2023-01-01", units: 100, nav: 10, transaction_type: "buy" },
      { fund_short_name: "Axis Bluechip", account_name: "ICICI", date: "2023-06-01", units: 40, nav: 12, transaction_type: "sell" },
      { fund_short_name: "Axis Bluechip", account_name: "ICICI", date: "2023-09-01", units: 20, nav: 15, transaction_type: "sell" },
      { fund_short_name: "Axis Bluechip", account_name: "ICICI", date: "2024-02-01", units: 50, nav: 14, transaction_type: "buy" },
    ]);

    expect(result.realized.totalCost).toBeCloseTo(40 * 10 + 20 * 10, 6);
    expect(result.realized.totalProceeds).toBeCloseTo(40 * 12 + 20 * 15, 6);
    expect(result.realized.totalProfit).toBeCloseTo((40 * 12 + 20 * 15) - (60 * 10), 6);

    expect(result.open.costBasis).toBeCloseTo(40 * 10 + 50 * 14, 6);
    expect(result.open.unitsByFund["Axis Bluechip"]).toBeCloseTo(90, 6);

    const breakdown = result.realized.breakdown["ICICI::Axis Bluechip"];
    expect(breakdown.cost).toBeCloseTo(60 * 10, 6);
    expect(breakdown.proceeds).toBeCloseTo(40 * 12 + 20 * 15, 6);
    expect(breakdown.profit).toBeCloseTo((40 * 12 + 20 * 15) - (60 * 10), 6);

    expect(result.cashflows.length).toBeGreaterThan(0);
    const buyFlows = result.cashflows.filter((cf) => cf.Flow < 0);
    const sellFlows = result.cashflows.filter((cf) => cf.Flow > 0);
    expect(buyFlows.length).toBe(2);
    expect(sellFlows.length).toBe(2);
  });

  it("ignores transactions with missing nav or units", () => {
    const result = computeMutualFundRealizedAndOpen([
      { fund_short_name: "Mirae", account_name: "HDFC", date: "2023-01-01", units: 0, nav: 100, transaction_type: "buy" },
      { fund_short_name: "Mirae", account_name: "HDFC", date: "2023-02-01", units: 10, nav: null, transaction_type: "buy" },
      { fund_short_name: "Mirae", account_name: "HDFC", date: "2023-03-01", units: 10, nav: 120, transaction_type: "sell" },
    ]);

    expect(result.realized.totalCost).toBe(0);
    expect(result.realized.totalProceeds).toBe(0);
    expect(result.open.costBasis).toBe(0);
    expect(Object.keys(result.open.unitsByFund)).toHaveLength(0);
  });

  it("records unmatched sells when FIFO lots are insufficient", () => {
    const result = computeMutualFundRealizedAndOpen([
      { fund_short_name: "Parag", account_name: "Groww", date: "2023-01-01", units: 10, nav: 50, transaction_type: "buy" },
      { fund_short_name: "Parag", account_name: "Groww", date: "2023-06-01", units: 15, nav: 60, transaction_type: "sell" },
    ]);

    const breakdown = result.realized.breakdown["Groww::Parag"];
    expect(breakdown.cost).toBeCloseTo(10 * 50, 6);
    expect(breakdown.proceeds).toBeCloseTo(15 * 60, 6);
    expect(breakdown.profit).toBeCloseTo(15 * 60 - 10 * 50, 6);
  });
});

describe("computeNpsRealizedAndOpen", () => {
  it("handles buys, sells, and charges", () => {
    const result = computeNpsRealizedAndOpen([
      { scheme_name: "Tier I - Equity", date: "2023-01-01", units: 100, nav: 10, transaction_type: "Buy" },
      { scheme_name: "Tier I - Equity", date: "2023-04-01", units: 10, nav: 1, transaction_type: "Charges" },
      { scheme_name: "Tier I - Equity", date: "2023-07-01", units: 40, nav: 14, transaction_type: "Sell" },
      { scheme_name: "Tier I - Equity", date: "2023-10-01", units: 30, nav: 16, transaction_type: "Sell" },
      { scheme_name: "Tier I - Equity", date: "2024-01-01", units: 20, nav: 12, transaction_type: "Buy" },
    ]);

    expect(result.realized.totalCost).toBeCloseTo(40 * 10 + 30 * 10, 6);
    expect(result.realized.totalProceeds).toBeCloseTo(40 * 14 + 30 * 16, 6);
    expect(result.realized.totalProfit).toBeCloseTo((40 * 14 + 30 * 16) - (70 * 10), 6);

    const breakdown = result.realized.breakdown["Tier I - Equity"];
    expect(breakdown.cost).toBeCloseTo(70 * 10, 6);
    expect(breakdown.proceeds).toBeCloseTo(40 * 14 + 30 * 16, 6);
    expect(breakdown.profit).toBeCloseTo((40 * 14 + 30 * 16) - (70 * 10), 6);

    expect(result.open.costBasis).toBeCloseTo((100 - 10 - 40 - 30 + 20) * 10, 6);
    expect(result.open.unitsByScheme["Tier I - Equity"]).toBeCloseTo(40, 6);

    const charges = result.chargesByScheme["Tier I - Equity"];
    expect(charges).toBeCloseTo(10 * 1, 6);

    expect(result.cashflows.some((cf) => cf.Flow < 0)).toBe(true);
    expect(result.cashflows.some((cf) => cf.Flow > 0)).toBe(true);
  });

  it("skips records without scheme name or valid dates", () => {
    const result = computeNpsRealizedAndOpen([
      { scheme_name: "", date: "2023-01-01", units: 10, nav: 10, transaction_type: "buy" },
      { scheme_name: "Scheme A", date: null, units: 10, nav: 10, transaction_type: "buy" },
      { scheme_name: "Scheme A", date: "2023-02-01", units: 10, nav: 12, transaction_type: "sell" },
    ]);

    expect(result.realized.totalCost).toBeCloseTo(0, 6);
    expect(result.realized.totalProceeds).toBeCloseTo(0, 6);
    expect(result.realized.totalProfit).toBeCloseTo(0, 6);
    expect(Object.keys(result.realized.breakdown)).toHaveLength(0);
  });

  it("creates unmatched sell rows when lots are exhausted", () => {
    const result = computeNpsRealizedAndOpen([
      { scheme_name: "Scheme B", date: "2023-01-01", units: 10, nav: 10, transaction_type: "buy" },
      { scheme_name: "Scheme B", date: "2023-05-01", units: 20, nav: 12, transaction_type: "sell" },
    ]);

    const breakdown = result.realized.breakdown["Scheme B"];
    expect(breakdown.cost).toBeCloseTo(10 * 10, 6);
    expect(breakdown.proceeds).toBeCloseTo(20 * 12, 6);
    expect(breakdown.profit).toBeCloseTo(20 * 12 - 10 * 10, 6);
  });
});