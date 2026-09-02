import yahooFinance from "yahoo-finance2";

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "Symbol required" });

  try {
    const quote = await yahooFinance.quote(symbol);
    const marketCap = quote.marketCap;

    let category = "Micro Cap";
    if (marketCap >= 200_000_000_000) category = "Large Cap";
    else if (marketCap >= 10_000_000_000) category = "Mid Cap";
    else if (marketCap >= 250_000_000) category = "Small Cap";

    res.status(200).json({ category });
  } catch (err) {
    res.status(500).json({ category: null, error: err.message });
  }
}
