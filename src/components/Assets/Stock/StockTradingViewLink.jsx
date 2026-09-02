import React, { useState, useEffect } from "react";
import { stockAPI } from "../../../api/stockAPI.js";
import { ExternalLink, XCircle, History, Trash2 } from "lucide-react";

const StockTradingViewLink = () => {
  const [stocks, setStocks] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedStock, setSelectedStock] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);

  // 🔹 Fetch stocks based on search query
  useEffect(() => {
    const searchStocks = async () => {
      if (!search) {
        setStocks([]);
        return;
      }
      try {
        const result = await stockAPI.searchStocks(search, 10);
        if (result.success) {
          setStocks(result.data || []);
        }
      } catch (error) {
        console.error("Error searching stocks:", error);
      }
    };
    
    const delayDebounceFn = setTimeout(() => {
      searchStocks();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  // 🔹 Fetch last 6 recent searches
  const fetchRecent = async () => {
    try {
      const result = await stockAPI.fetchRecentSearches();
      if (result.success) {
        setRecentSearches(result.data || []);
      }
    } catch (error) {
      console.error("Error fetching recent searches:", error);
    }
  };

  useEffect(() => {
    fetchRecent();
  }, []);

  // 🔹 Clear all recent searches
  const clearRecentSearches = async () => {
    try {
      await stockAPI.clearRecentSearches();
      setRecentSearches([]);
      setSelectedStock(null); // reset selected stock
    } catch (error) {
      console.error("Error clearing recent searches:", error);
    }
  };

  // 🔹 Handle stock selection
  const handleSelectStock = async (stock) => {
    setSelectedStock(stock);
    setSearch("");

    try {
      await stockAPI.addRecentSearch(stock.stock_name);
      fetchRecent();
    } catch (error) {
      console.error("Error adding recent search:", error);
    }
  };

  return (
    <div className="mt-8 px-4 space-y-4">
      <h2 className="text-lg font-bold text-blue-300">
        Trading View Chart Links
      </h2>

      {/* Search Input */}
      <input
        type="text"
        placeholder="Search by stock name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full sm:w-1/2 px-4 py-2 border rounded shadow focus:outline-none focus:ring text-gray-800"
      />

      {/* Search Results */}
      {search && stocks.length > 0 && (
        <ul className="border rounded shadow max-h-60 overflow-y-auto bg-white text-gray-800">
          {stocks.map((stock) => (
            <li
              key={stock.stock_name}
              onClick={() => handleSelectStock(stock)}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
            >
              {stock.stock_name}
            </li>
          ))}
        </ul>
      )}

      {/* Recent Searches */}
{recentSearches.length > 0 && (
  <div>
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-md font-medium text-yellow-300 flex items-center gap-2">
        <History size={16} /> Recent Searches
      </h3>
      <button
        onClick={clearRecentSearches}
        className="flex items-center gap-1 text-sm text-white hover:text-white"
        title="Clear Recent Searches"
      >
        <Trash2 size={16} /> Clear
      </button>
    </div>

    {/* Grid layout for 3 per row */}
    <div className="grid grid-cols-3 gap-2">
      {recentSearches.slice(0, 6).map((stock) => (
        <button
          key={stock.id}
          onClick={() =>
            handleSelectStock({ stock_name: stock.stock_name })
          }
          className="px-3 py-2 text-sm bg-orange-200 hover:bg-gray-300 font-medium rounded shadow text-center"
        >
          {stock.stock_name}
        </button>
      ))}
    </div>
  </div>
)}


      {/* TradingView Buttons + Reset (always inline) */}
      {selectedStock && (
        <div className="flex flex-row flex-wrap gap-2 mt-4">
          {!selectedStock.symbol?.startsWith("BOM") && (
            <a
              href={`https://www.tradingview.com/chart/?symbol=NSE:${selectedStock.stock_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow"
            >
              <ExternalLink size={16} />
              NSE: {selectedStock.stock_name}
            </a>
          )}

          <a
            href={`https://www.tradingview.com/chart/?symbol=BSE:${selectedStock.stock_name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow"
          >
            <ExternalLink size={16} />
            BSE: {selectedStock.stock_name}
          </a>

          <button
            onClick={() => setSelectedStock(null)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow"
          >
            <XCircle size={16} />
            Reset
          </button>
        </div>
      )}
    </div>
  );
};

export default StockTradingViewLink;
