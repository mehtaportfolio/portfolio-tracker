import React, { useState, useCallback } from "react";
import { X, Search, ShoppingCart, Loader2, List, CheckCircle2, AlertCircle } from "lucide-react";
import { stockAPI } from "../../../api/stockAPI.js";

const SellModal = ({ onClose, accountName, broker, equityType, brokerName }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [openTransactions, setOpenTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [sellPrice, setSellPrice] = useState("");
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [view, setView] = useState("search"); // search, transactions, sell_form
  const [ltp, setLtp] = useState(null);
  const [orderLogs, setOrderLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);

  const formatDate = (dateString) => {
    if (!dateString) return "--";
    const date = new Date(dateString);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
  };

  // Fetch LTP using existing mechanisms or from backend
  const fetchLTP = useCallback(async (symbol) => {
    try {
      // 1. Try fetching from stock_mapping first
      const mappings = await stockAPI.fetchStockMappings();
      const stockList = mappings.data || [];
      const stock = stockList.find(m => m.symbol_ao === symbol || m.symbol_kite === symbol || m.stock_name === symbol);
      
      if (stock && stock.cmp) {
        setLtp(stock.cmp);
        setSellPrice(stock.cmp.toString());
        return;
      }

      // 2. Fallback to stock_master if not found in mapping
      const masterData = await stockAPI.fetchStockMaster();
      const masterStock = masterData.find(m => m.stock_name === symbol || m.symbol === symbol);
      if (masterStock && masterStock.cmp) {
        setLtp(masterStock.cmp);
        setSellPrice(masterStock.cmp.toString());
      }
    } catch (err) {
      console.error("Error fetching LTP:", err);
    }
  }, []);

  const handleSearch = async (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (term.length > 2) {
      setLoading(true);
      try {
        // Fetch from open transactions directly or search in stock_transactions via backend
        const result = await stockAPI.getOpenTransactions(accountName, null, term, 1, 100, equityType, brokerName);
        // Deduplicate by stock_name for search results
        const uniqueStocks = Array.from(new Set(result.data.map(r => r.stock_name)))
          .map(name => result.data.find(r => r.stock_name === name));
        setSearchResults(uniqueStocks);
      } catch (err) {
        console.error("Search error:", err);
      }
      setLoading(false);
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectStock = async (stock) => {
    setSelectedStock(stock);
    setLoading(true);
    try {
      const result = await stockAPI.getOpenTransactions(accountName, stock.stock_name, null, 1, 1000, equityType, brokerName);
      setOpenTransactions(result.data);
      fetchLTP(stock.stock_name);
      setView("transactions");
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
    setLoading(false);
  };

  const handleInitiateSell = (txn) => {
    setSelectedTxn(txn);
    setView("sell_form");
  };

  const handlePlaceOrder = async () => {
    if (!sellPrice || isNaN(sellPrice)) {
      alert("Please enter a valid sell price");
      return;
    }

    setOrderLoading(true);
    try {
      const orderData = {
        broker: broker,
        account_id: accountName, // Using accountName as ID for now, adjust if needed
        symbol: selectedStock.stock_name,
        quantity: selectedTxn.quantity,
        price: parseFloat(sellPrice),
        transaction_id: selectedTxn.id,
        token: selectedStock.symbol_token // Ensure this is available
      };

      const result = await stockAPI.placeSellOrder(orderData);
      if (result.success) {
        const newLog = {
          id: result.order_id,
          symbol: selectedStock.stock_name,
          qty: selectedTxn.quantity,
          price: sellPrice,
          status: "OPEN",
          time: new Date().toLocaleTimeString()
        };
        setOrderLogs([newLog, ...orderLogs]);
        alert("Sell order placed successfully!");
        onClose();
      }
    } catch (err) {
      console.error("Order placement error:", err);
      alert(err.message || "Failed to place order");
    }
    setOrderLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[1000] p-4">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[#333] flex items-center justify-between bg-[#222]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
              <ShoppingCart size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Sell Modal</h2>
              <p className="text-xs text-gray-400">{accountName} • {broker}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowLogs(!showLogs)}
              className="p-2 hover:bg-[#333] rounded-xl text-gray-400 transition-all"
              title="Order Logs"
            >
              <List size={20} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl text-gray-400 transition-all"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {showLogs ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <List size={18} className="text-blue-500" /> Order Logs
              </h3>
              {orderLogs.length === 0 ? (
                <p className="text-center py-8 text-gray-500 italic">No recent orders</p>
              ) : (
                <div className="space-y-2">
                  {orderLogs.map(log => (
                    <div key={log.id} className="p-4 bg-[#262626] rounded-2xl border border-[#333] flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white">{log.symbol}</div>
                        <div className="text-xs text-gray-400">{log.qty} units @ ₹{log.price} • {log.time}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {log.status === "OPEN" ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500 bg-orange-500/10 px-2 py-1 rounded-full">Pending</span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">Executed</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button 
                onClick={() => setShowLogs(false)}
                className="w-full py-3 bg-[#333] text-white rounded-2xl font-bold hover:bg-[#444] transition-all"
              >
                Back to Sell
              </button>
            </div>
          ) : view === "search" ? (
            <div className="space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search stock to sell..."
                  className="w-full bg-[#262626] border border-[#333] rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={searchTerm}
                  onChange={handleSearch}
                />
              </div>

              <div className="space-y-2">
                {loading ? (
                  <div className="flex flex-col items-center py-12 text-gray-500 gap-3">
                    <Loader2 className="animate-spin" size={32} />
                    <p>Searching holdings...</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map(stock => (
                    <button
                      key={stock.id}
                      onClick={() => handleSelectStock(stock)}
                      className="w-full p-4 bg-[#262626] border border-[#333] rounded-2xl flex items-center justify-between hover:bg-[#333] transition-all group"
                    >
                      <div className="text-left">
                        <div className="font-bold text-white group-hover:text-blue-400 transition-colors">{stock.stock_name}</div>
                        <div className="text-xs text-gray-400">{stock.account_type}</div>
                      </div>
                      <CheckCircle2 className="text-gray-600 group-hover:text-emerald-500" size={20} />
                    </button>
                  ))
                ) : searchTerm.length > 2 ? (
                  <p className="text-center py-8 text-gray-500">No open holdings found for "{searchTerm}"</p>
                ) : (
                  <div className="text-center py-12">
                    <AlertCircle className="mx-auto mb-3 text-gray-600" size={40} />
                    <p className="text-gray-500">Type at least 3 characters to search</p>
                  </div>
                )}
              </div>
            </div>
          ) : view === "transactions" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setView("search")}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  ← Back to search
                </button>
                <div className="text-right">
                  <div className="text-xs text-gray-400 uppercase tracking-widest font-bold">LTP</div>
                  <div className="text-lg font-black text-emerald-400">₹{ltp || "--"}</div>
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-white">Open Entries for {selectedStock.stock_name}</h3>
              
              <div className="rounded-2xl border border-[#333] overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-[#222]">
                    <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-[#333]">
                      <th className="px-4 py-3">Buy Date</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Buy Price</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#333]">
                    {openTransactions.map(txn => (
                      <tr key={txn.id} className="hover:bg-[#262626] transition-colors">
                        <td className="px-4 py-4 text-sm text-gray-300">{formatDate(txn.buy_date)}</td>
                        <td className="px-4 py-4 text-sm font-bold text-white">{txn.quantity}</td>
                        <td className="px-4 py-4 text-sm text-gray-300">₹{txn.buy_price}</td>
                        <td className="px-4 py-4 text-center">
                          <button 
                            onClick={() => handleInitiateSell(txn)}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-4 py-1.5 rounded-full transition-all active:scale-95"
                          >
                            SELL
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <button 
                onClick={() => setView("transactions")}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
              >
                ← Back to entries
              </button>

              <div className="bg-[#262626] p-6 rounded-[1.5rem] border border-[#333] space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedStock.stock_name}</h3>
                    <p className="text-sm text-gray-400">Selling {selectedTxn.quantity} units from entry dated {formatDate(selectedTxn.buy_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 font-bold uppercase">Live Price</p>
                    <p className="text-xl font-black text-emerald-400">₹{ltp || "--"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Limit Price</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                    <input
                      type="number"
                      step="0.05"
                      className="w-full bg-[#1a1a1a] border border-[#333] rounded-2xl py-4 pl-10 pr-4 text-white text-lg font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                    />
                  </div>
                </div>

                <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10 flex justify-between items-center">
                  <span className="text-sm text-gray-400">Estimated Value</span>
                  <span className="text-lg font-bold text-white">₹{(selectedTxn.quantity * (parseFloat(sellPrice) || 0)).toLocaleString()}</span>
                </div>

                <button
                  disabled={orderLoading}
                  onClick={handlePlaceOrder}
                  className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-lg shadow-lg shadow-emerald-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {orderLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={24} />
                      Placing Order...
                    </>
                  ) : (
                    "PLACE SELL ORDER"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SellModal;
