import React, { useState, useEffect, useRef } from "react";
import { stockAPI } from "../../../api/stockAPI.js";
import { createChart } from "lightweight-charts";

const API_KEY = "Q4ILT5GO9H144PAN"; // Alpha Vantage API key
const BASE_URL = "https://www.alphavantage.co/query";

const INTERVALS = {
  daily: { func: "TIME_SERIES_DAILY_ADJUSTED", label: "Daily" },
  weekly: { func: "TIME_SERIES_WEEKLY_ADJUSTED", label: "Weekly" },
  monthly: { func: "TIME_SERIES_MONTHLY_ADJUSTED", label: "Monthly" },
  yearly: { func: "TIME_SERIES_MONTHLY_ADJUSTED", label: "Yearly" }, // aggregate monthly into yearly
};

// --------- Parse Time Series ----------
function parseTimeSeries(data, func) {
  let key = "";
  switch (func) {
    case "TIME_SERIES_DAILY_ADJUSTED":
      key = "Time Series (Daily)";
      break;
    case "TIME_SERIES_WEEKLY_ADJUSTED":
      key = "Weekly Adjusted Time Series";
      break;
    case "TIME_SERIES_MONTHLY_ADJUSTED":
      key = "Monthly Adjusted Time Series";
      break;
    default:
      key = "";
      break;
  }
  const series = data[key];
  if (!series) return [];

  const parsed = Object.entries(series)
    .map(([date, values]) => ({
      date,
      open: parseFloat(values["1. open"]),
      high: parseFloat(values["2. high"]),
      low: parseFloat(values["3. low"]),
      close: parseFloat(values["4. close"]),
      volume: parseInt(values["6. volume"] || values["5. volume"] || 0),
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return parsed;
}

// --------- TradingView Style Chart ----------
function CandlestickChart({ data }) {
  const chartContainerRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const initialWidth = chartContainerRef.current.clientWidth;
    const initialHeight = Math.max(260, Math.min(500, Math.round(initialWidth * 0.6)));

    const chart = createChart(chartContainerRef.current, {
      width: initialWidth,
      height: initialHeight,
      layout: {
        background: { color: "#ffffff" },
        textColor: "#333",
      },
      grid: {
        vertLines: { color: "#eee" },
        horzLines: { color: "#eee" },
      },
      crosshair: {
        mode: 1, // normal crosshair
      },
      timeScale: {
        borderColor: "#d1d5db",
      },
      rightPriceScale: {
        borderColor: "#d1d5db",
      },
    });

console.log("chart object:", chart);


    const candleSeries = chart.addCandlestickSeries({
      upColor: "#16a34a",
      downColor: "#dc2626",
      borderUpColor: "#16a34a",
      borderDownColor: "#dc2626",
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
    });

    // set candlestick data
    candleSeries.setData(
      data.map((d) => ({
        time: d.date, // must be YYYY-MM-DD
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    // volume bars
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: "#aaa",
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    volumeSeries.setData(
      data.map((d) => ({
        time: d.date,
        value: d.volume,
        color: d.close >= d.open ? "#16a34a55" : "#dc262655",
      }))
    );

    // resize handler
    const handleResize = () => {
      if (!chartContainerRef.current) return;
      const w = chartContainerRef.current.clientWidth;
      const h = Math.max(240, Math.min(480, Math.round(w * 0.6)));
      chart.applyOptions({ width: w, height: h });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data]);

  return <div ref={chartContainerRef} className="w-full max-w-full overflow-hidden" />;
}

// --------- Main Component ----------
export default function ChartTab() {
  const [symbol, setSymbol] = useState("RELIANCE");
  const [interval, setInterval] = useState("daily");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Supabase search
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);

  // Date filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function toTicker(name) {
    if (!name) return "";
    return name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  }

  // Search in Backend
  useEffect(() => {
    async function fetchStocks() {
      if (!search) {
        setResults([]);
        return;
      }
      try {
        const response = await stockAPI.searchStocks(search);
        if (response.success) {
          setResults(response.data || []);
        }
      } catch (err) {
        console.error("Error searching stocks:", err);
      }
    }
    fetchStocks();
  }, [search]);

  // Fetch Alpha Vantage
  useEffect(() => {
    async function fetchData() {
      if (!symbol) return;

      setLoading(true);
      setError(null);
      setData([]);

      const func = INTERVALS[interval].func;
      const primaryUrl = `${BASE_URL}?function=${func}&symbol=${encodeURIComponent(
        symbol
      )}.NSE&apikey=${API_KEY}`;
      const fallbackUrl = `${BASE_URL}?function=${func}&symbol=${encodeURIComponent(
        symbol
      )}.BSE&apikey=${API_KEY}`;

      try {
        let res = await fetch(primaryUrl);
        if (!res.ok) throw new Error(`Network error: ${res.status}`);
        let json = await res.json();

        let timeseriesData = parseTimeSeries(json, func);
        if (json["Error Message"] || json.Note || timeseriesData.length === 0) {
          if (json?.Note)
            throw new Error("API call frequency limit reached. Please try later.");
          res = await fetch(fallbackUrl);
          if (!res.ok) throw new Error(`Network error: ${res.status}`);
          json = await res.json();
          if (json?.Note)
            throw new Error("API call frequency limit reached. Please try later.");
          if (json["Error Message"])
            throw new Error("Invalid symbol or error fetching data.");
          timeseriesData = parseTimeSeries(json, func);
        }

        // yearly aggregation
        let series = timeseriesData;
        if (interval === "yearly") {
          const byYear = {};
          for (const d of timeseriesData) {
            const y = new Date(d.date).getFullYear();
            if (!byYear[y]) {
              byYear[y] = {
                date: `${y}-12-31`,
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
                volume: d.volume,
              };
            }
            const agg = byYear[y];
            agg.high = Math.max(agg.high, d.high);
            agg.low = Math.min(agg.low, d.low);
            agg.close = d.close;
            agg.volume += d.volume || 0;
          }
          series = Object.values(byYear).sort(
            (a, b) => new Date(a.date) - new Date(b.date)
          );
        }

        // filter by date
        const filtered = series.filter((d) => {
          const dateObj = new Date(d.date);
          return (
            (!startDate || dateObj >= new Date(startDate)) &&
            (!endDate || dateObj <= new Date(endDate))
          );
        });

        if (filtered.length === 0)
          throw new Error("No data available for this symbol and date range.");

        setData(filtered);
      } catch (err) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [symbol, interval, startDate, endDate]);

  return (
    <div className="p-4 max-w-7xl mx-auto sm:p-6">
      <h2 className="text-xl font-semibold mb-4">Stock Chart (Alpha Vantage)</h2>

      {/* Stock Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search stock..."
        className="border p-2 w-full mb-2 rounded"
      />
      {results.length > 0 && (
        <ul className="border rounded max-h-40 overflow-y-auto mb-4">
          {results.map((r) => (
            <li
              key={r.stock_name}
              className="p-2 cursor-pointer hover:bg-gray-100"
              onClick={() => {
                const t = toTicker(r.stock_name);
                setSymbol(t);
                setSearch(r.stock_name);
                setResults([]);
              }}
            >
              {r.stock_name}
            </li>
          ))}
        </ul>
      )}

      {/* Interval buttons */}
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(INTERVALS).map(([key, val]) => (
          <button
            key={key}
            onClick={() => setInterval(key)}
            className={`px-3 py-1 rounded border ${
              interval === key
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700"
            }`}
          >
            {val.label}
          </button>
        ))}
      </div>

      {/* Date pickers */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div>
          <label className="block text-sm">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded p-1"
          />
        </div>
        <div>
          <label className="block text-sm">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded p-1"
          />
        </div>
      </div>

      {loading && <p>Loading data...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && data.length > 0 && (
        <div className="maskable-chart w-full">
          <CandlestickChart data={data} />
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <p className="text-sm text-gray-500">
          No data. Note: Alpha Vantage free plan is rate limited; try another
          interval or symbol.
        </p>
      )}
    </div>
  );
}
