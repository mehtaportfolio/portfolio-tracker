import React, { useCallback, useEffect, useMemo, useState } from "react";
import { stockAPI } from "../api/stockAPI.js";
import { FiSearch, FiRefreshCw, FiArrowRight, FiSend, FiShield } from "react-icons/fi";

const BROKERS = [
  { id: "zerodha", label: "Zerodha" },
  { id: "angel", label: "Angel One" },
];

const ORDER_PAGE_SIZE = 50;

const formatINR = (value) => {
  const num = Number(value) || 0;
  return num.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const OrderEntry = () => {
  const [selectedBroker, setSelectedBroker] = useState("zerodha");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [openTransactions, setOpenTransactions] = useState([]);
  const [accountOptions, setAccountOptions] = useState([]);
  const [masterMap, setMasterMap] = useState({});
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [orderPrice, setOrderPrice] = useState("");
  const [orderQty, setOrderQty] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPnlSummary, setTotalPnlSummary] = useState({ pnl: 0, pnlPercent: 0 });

  const brokerName = selectedBroker === "all" ? "all" : selectedBroker === "angel" ? "angel" : "zerodha";

  const formatPercent = (value) => {
    const num = Number(value) || 0;
    const sign = num > 0 ? '+' : num < 0 ? '' : '';
    return `${sign}${num.toFixed(2)}%`;
  };

  const computePositionPnl = (position) => {
    const avgPrice = Number(position.average_price) || 0;
    const lastPrice = Number(position.last_price) || avgPrice;
    const qty = Number(position.quantity) || 0;
    const invested = qty * avgPrice;
    const currentValue = qty * lastPrice;
    const pnl = currentValue - invested;
    const pnlPercent = invested !== 0 ? (pnl / invested) * 100 : 0;
    return {
      pnl: Math.round(pnl * 100) / 100,
      pnlPercent: Math.round(pnlPercent * 100) / 100,
      invested: Math.round(invested * 100) / 100,
      currentValue: Math.round(currentValue * 100) / 100,
    };
  };

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalCount / ORDER_PAGE_SIZE));
  }, [totalCount]);

  const loadStockMaster = useCallback(async () => {
    try {
      const data = await stockAPI.fetchStockMaster();
      if (Array.isArray(data)) {
        const map = data.reduce((acc, item) => {
          if (item.stock_name) acc[item.stock_name] = item;
          return acc;
        }, {});
        setMasterMap(map);
      }
    } catch (err) {
      console.warn("OrderEntry: failed to load stock master", err);
    }
  }, []);

  const loadOpenTransactions = useCallback(async () => {
    setLoading(true);
    setStatusMessage("");
    try {
      const result = await stockAPI.fetchEquityPositions();
      const positions = Array.isArray(result.data) ? result.data : [];
      const normalized = positions.map((pos) => ({
        ...pos,
        stock_name: pos.symbol || pos.stock_name,
        account_name: pos.account_id || pos.account_name || 'N/A',
        buy_price: Number(pos.average_price) || 0,
        buy_date: pos.position_date || pos.buy_date || null,
        quantity: Number(pos.quantity) || 0,
        last_price: Number(pos.last_price) || Number(pos.price) || Number(pos.current_price) || 0,
        product: pos.product || pos.product_type || pos.equity_type || 'N/A',
        broker: pos.broker || 'unknown',
      }));

      let filtered = normalized;
      if (selectedBroker !== 'all') {
        filtered = filtered.filter((item) => String(item.broker).toLowerCase() === selectedBroker);
      }
      if (selectedAccount) {
        filtered = filtered.filter((item) => String(item.account_name).toLowerCase() === selectedAccount.toLowerCase());
      }
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        filtered = filtered.filter((item) => {
          return [item.stock_name, item.symbol, item.account_name, item.product, item.broker]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(search));
        });
      }

      const startIndex = (page - 1) * ORDER_PAGE_SIZE;
      const paged = filtered.slice(startIndex, startIndex + ORDER_PAGE_SIZE);

      const summaryTotals = filtered.reduce(
        (acc, item) => {
          const avgPrice = Number(item.average_price) || 0;
          const lastPrice = Number(item.last_price) || avgPrice;
          const qty = Number(item.quantity) || 0;
          acc.invested += qty * avgPrice;
          acc.current += qty * lastPrice;
          return acc;
        },
        { invested: 0, current: 0 }
      );

      const totalPnl = summaryTotals.current - summaryTotals.invested;
      const totalPnlPercent = summaryTotals.invested !== 0 ? (totalPnl / summaryTotals.invested) * 100 : 0;

      setOpenTransactions(paged);
      setTotalCount(filtered.length);
      setTotalPnlSummary({
        pnl: Math.round(totalPnl * 100) / 100,
        pnlPercent: Math.round(totalPnlPercent * 100) / 100,
      });

      const accounts = Array.from(
        new Set(
          (selectedBroker === 'all' ? normalized : normalized.filter((item) => String(item.broker).toLowerCase() === selectedBroker))
            .map((item) => item.account_name)
            .filter(Boolean)
        )
      );
      setAccountOptions(accounts);

      if (!selectedAccount && accounts.length === 1) {
        setSelectedAccount(accounts[0]);
      }
    } catch (err) {
      console.error("OrderEntry: failed to fetch open equity positions", err);
      setStatusMessage(err.message || "Failed to load holdings");
      setOpenTransactions([]);
      setAccountOptions([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [selectedBroker, page, searchTerm, selectedAccount]);

  useEffect(() => {
    loadStockMaster();
  }, [loadStockMaster]);

  useEffect(() => {
    setPage(1);
    setSelectedTxn(null);
    setOrderPrice("");
    setOrderQty("");
    setStatusMessage("");
    loadOpenTransactions();
  }, [brokerName, selectedAccount, searchTerm, loadOpenTransactions]);

  const handleBrokerChange = (brokerId) => {
    setSelectedBroker(brokerId);
    setSelectedAccount("");
    setSearchTerm("");
    setSelectedTxn(null);
    setOrderPrice("");
    setOrderQty("");
    setStatusMessage("");
  };

  const handleSelectTxn = (txn) => {
    setSelectedTxn(txn);
    setOrderQty(txn.quantity?.toString() || "");
    setOrderPrice(
      masterMap[txn.stock_name]?.cmp?.toString() || txn.buy_price?.toString() || ""
    );
    setStatusMessage("");
  };

  const handlePlaceOrder = async () => {
    if (!selectedTxn) return;
    if (!orderQty || Number(orderQty) <= 0) {
      setStatusMessage("Enter a valid quantity to place order.");
      return;
    }
    if (!orderPrice || Number(orderPrice) <= 0) {
      setStatusMessage("Enter a valid limit price.");
      return;
    }
    if (selectedBroker === "angel" && !selectedTxn.symbol_token) {
      setStatusMessage("Angel One orders require symbol token data. Please verify the holding metadata.");
      return;
    }

    setPlacingOrder(true);
    setStatusMessage("");

    try {
      const orderData = {
        broker: selectedBroker,
        account_id: selectedTxn.account_name,
        symbol: selectedTxn.stock_name,
        quantity: Number(orderQty),
        price: Number(orderPrice),
        transaction_id: selectedTxn.id,
        token: selectedTxn.symbol_token,
      };

      const response = await stockAPI.placeSellOrder(orderData);
      if (response && response.success) {
        setStatusMessage(`Order placed successfully: ${response.order_id}`);
        setSelectedTxn(null);
        setOrderQty("");
        setOrderPrice("");
        await loadOpenTransactions();
      } else {
        setStatusMessage("Order placement failed. Please try again.");
      }
    } catch (err) {
      console.error("OrderEntry: placeSellOrder failed", err);
      setStatusMessage(err.message || "Unable to place order.");
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pb-24 pt-4 sm:px-6">
      <div className="rounded-[2rem] border border-gray-800 bg-[#0f172a]/80 p-6 shadow-2xl shadow-cyan-500/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-400/80">Order Entry</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Broker Sell Order Dashboard</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
              Use your existing broker connectivity to select open holdings and place sell orders without changing current portfolio logic.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-700 bg-slate-950/60 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-white">Open Positions</h2>
              <button
                type="button"
                onClick={loadOpenTransactions}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 text-slate-300 transition hover:border-cyan-500 hover:text-cyan-400"
                title="Refresh open positions"
              >
                <FiRefreshCw size={18} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-slate-300">
              <span className="rounded-full border border-slate-700 px-3 py-2 bg-slate-900/80">Broker: {brokerName}</span>
              <span className="rounded-full border border-slate-700 px-3 py-2 bg-slate-900/80">Page {page} / {totalPages}</span>
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-slate-700 bg-slate-900/80 p-4 text-slate-200">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Total P/L</p>
              <span className={`text-2xl font-semibold ${totalPnlSummary.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatINR(totalPnlSummary.pnl)}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-400">Combined P/L for all visible equity positions ({formatPercent(totalPnlSummary.pnlPercent)})</p>
          </div>

          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1 rounded-3xl border border-slate-700 bg-slate-950/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Broker</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {BROKERS.map((broker) => (
                  <button
                    key={broker.id}
                    onClick={() => handleBrokerChange(broker.id)}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      selectedBroker === broker.id
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {broker.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 rounded-3xl border border-slate-700 bg-slate-950/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Account</p>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
              >
                <option value="">All accounts</option>
                {accountOptions.map((account) => (
                  <option key={account} value={account}>{account}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 rounded-3xl border border-slate-700 bg-slate-950/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Search</p>
              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
                <FiSearch size={18} className="text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Stock symbol or name"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Buy Price</th>
                  <th className="px-4 py-3">P/L</th>
                  <th className="px-4 py-3">Buy Date</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-slate-400">
                      Loading open holdings...
                    </td>
                  </tr>
                ) : openTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-slate-400">
                      No open holdings found for the selected broker/account.
                    </td>
                  </tr>
                ) : (
                  openTransactions.map((txn) => (
                    <tr
                      key={txn.id}
                      className={`border-b border-slate-800 transition ${selectedTxn?.id === txn.id ? "bg-slate-900/80" : "hover:bg-slate-900/60"}`}
                    >
                      <td className="px-4 py-4 font-semibold text-white">{txn.stock_name}</td>
                      <td className="px-4 py-4">{txn.account_name}</td>
                      <td className="px-4 py-4">{txn.quantity}</td>
                      <td className="px-4 py-4">{formatINR(txn.buy_price)}</td>
                      <td className={`px-4 py-4 font-semibold ${computePositionPnl(txn).pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatINR(computePositionPnl(txn).pnl)}
                        <span className="ml-1 text-slate-400">({formatPercent(computePositionPnl(txn).pnlPercent)})</span>
                      </td>
                      <td className="px-4 py-4">{formatDate(txn.buy_date)}</td>
                      <td className="px-4 py-4">{txn.product || txn.account_type || txn.equity_type || "N/A"}</td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleSelectTxn(txn)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400"
                        >
                          <FiArrowRight size={16} /> Place Sell
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-2 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-2 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
            <div>{totalCount} open positions available</div>
          </div>
        </div>

        {selectedTxn && (
          <div className="mt-6 rounded-3xl border border-cyan-500/20 bg-slate-950/70 p-6 shadow-inner shadow-cyan-500/10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Selected Order</p>
                <h2 className="text-2xl font-semibold text-white">{selectedTxn.stock_name}</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {selectedTxn.account_name} • Qty {selectedTxn.quantity} • Bought at {formatINR(selectedTxn.buy_price)}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-300">
                {selectedBroker === "angel" ? "Angel One order" : "Zerodha order"}
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <label className="space-y-2 text-sm text-slate-300">
                Quantity
                <input
                  type="number"
                  min="1"
                  max={selectedTxn.quantity}
                  value={orderQty}
                  onChange={(e) => setOrderQty(e.target.value)}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-500"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                Limit Price
                <input
                  type="number"
                  min="0"
                  step="0.05"
                  value={orderPrice}
                  onChange={(e) => setOrderPrice(e.target.value)}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-500"
                />
              </label>

              <div className="space-y-3">
                <button
                  onClick={handlePlaceOrder}
                  disabled={placingOrder}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiSend size={16} /> {placingOrder ? "Placing order..." : "Place Sell Order"}
                </button>
                <button
                  onClick={() => setSelectedTxn(null)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  Cancel selection
                </button>
              </div>
            </div>

            {statusMessage && (
              <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-slate-200">
                {statusMessage}
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Available quantity</p>
                <p className="mt-2 text-xl font-semibold text-white">{selectedTxn.quantity}</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Buy price</p>
                <p className="mt-2 text-xl font-semibold text-white">{formatINR(selectedTxn.buy_price)}</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Current CMP</p>
                <p className="mt-2 text-xl font-semibold text-white">{formatINR(masterMap[selectedTxn.stock_name]?.cmp || 0)}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-3xl border border-slate-700 bg-slate-950/70 p-5 text-sm text-slate-400">
          <div className="flex items-center gap-2 text-cyan-400">
            <FiShield size={16} />
            <span className="font-semibold text-white">Note</span>
          </div>
          <p className="mt-3 leading-6">
            This Order Entry screen uses your existing broker connection and current open holdings. It does not modify or replace any existing portfolio tracking logic. Orders are placed through the same broker sell API already available in the backend.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrderEntry;
