import { getAuthHeaders } from "../utils/authUtils.jsx";
import { BACKEND_URL } from "../config/apiConfig.js";

const API_BASE_URL = BACKEND_URL;

const buildQueryString = (params) => {
  const urlParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach(v => urlParams.append(key, v));
    } else {
      urlParams.set(key, value);
    }
  });
  return urlParams.toString();
};

export const stockAPI = {
  // --- Transactions ---
  async addTransaction(transaction, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/transaction`, {
      method: "POST",
      headers,
      body: JSON.stringify(transaction),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add transaction");
    }
    return response.json();
  },

  async bulkAddTransactions(transactions, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/transaction/bulk`, {
      method: "POST",
      headers,
      body: JSON.stringify({ transactions }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to bulk add transactions");
    }
    return response.json();
  },

  async deleteTransaction(id, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/transaction/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete transaction");
    }
    return response.json();
  },

  async updateTransaction(id, updates, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/transaction/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update transaction");
    }
    return response.json();
  },

  async sellTransaction(id, sellDetails, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/transaction/sell/${id}`, {
      method: "POST",
      headers,
      body: JSON.stringify(sellDetails),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to sell transaction");
    }
    return response.json();
  },

  async getAccountNames(token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/accounts`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch accounts");
    }
    return response.json();
  },

  async fetchStockAccountNames(type = "", token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/accounts?type=${type}`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch account names");
    }
    return response.json();
  },

  // --- Stock Master ---
  async fetchStockMaster(token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/master`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch stock master");
    }
    return response.json();
  },

  async fetchIncompleteStockMaster(token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/master/incomplete`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch incomplete stock master");
    }
    return response.json();
  },

  async fetchDistinctValues(field, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/master/distinct/${field}`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to fetch distinct values for ${field}`);
    }
    return response.json();
  },

  async addStockMaster(stockData, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/master`, {
      method: "POST",
      headers,
      body: JSON.stringify(stockData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add stock master");
    }
    return response.json();
  },

  async fetchStockSurveillanceIsin(stockName, token) {
    const headers = await getAuthHeaders(token);
    const query = new URLSearchParams({ stockName }).toString();
    const response = await fetch(`${API_BASE_URL}/api/stock/surveillance/isin?${query}`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch stock surveillance ISIN");
    }
    return response.json();
  },

  async fetchStockSurveillanceByIsin(isin, token) {
    const headers = await getAuthHeaders(token);
    const query = new URLSearchParams({ isin }).toString();
    const response = await fetch(`${API_BASE_URL}/api/stock/surveillance/isin-record?${query}`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch stock surveillance record by ISIN");
    }
    return response.json();
  },

  async fetchStockSurveillanceIsinMismatch(token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/surveillance/isin-mismatch`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch stock surveillance ISIN mismatches");
    }
    return response.json();
  },

  async updateStockMaster(symbol, stockData, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/master/${symbol}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(stockData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update stock master");
    }
    return response.json();
  },

  async renameStock(oldSymbol, newDetails, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/master/rename`, {
      method: "POST",
      headers,
      body: JSON.stringify({ oldSymbol, ...newDetails }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to rename stock");
    }
    return response.json();
  },

  // --- Charges ---
  async fetchCharges(token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/charges`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch charges");
    }
    return response.json();
  },

  async addCharge(chargeData, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/charges`, {
      method: "POST",
      headers,
      body: JSON.stringify(chargeData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add charge");
    }
    return response.json();
  },

  async updateCharge(id, chargeData, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/charges/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(chargeData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update charge");
    }
    return response.json();
  },

  async deleteCharge(id, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/charges/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete charge");
    }
    return response.json();
  },

  // --- Bonus/Split ---
  async fetchBonusSplits(token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/bonus-split`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch bonus splits");
    }
    return response.json();
  },

  async syncCorporateActions(token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/bonus-split/sync`, {
      method: "POST",
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to sync corporate actions");
    }
    return response.json();
  },

  async addBonusSplit(bonusSplitData, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/bonus-split`, {
      method: "POST",
      headers,
      body: JSON.stringify(bonusSplitData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add bonus split");
    }
    return response.json();
  },

  async updateBonusSplit(id, bonusSplitData, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/bonus-split/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(bonusSplitData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update bonus split");
    }
    return response.json();
  },

  async deleteBonusSplit(id, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/bonus-split/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete bonus split");
    }
    return response.json();
  },

  async applyBonusSplit(record, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/bonus-split/apply`, {
      method: "POST",
      headers,
      body: JSON.stringify(record),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to apply bonus split");
    }
    return response.json();
  },

  async revertBonusSplit(record, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/bonus-split/revert`, {
      method: "POST",
      headers,
      body: JSON.stringify(record),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to revert bonus split");
    }
    return response.json();
  },

  async applyBulkBonusSplits(records, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/bonus-split/apply-bulk`, {
      method: "POST",
      headers,
      body: JSON.stringify({ records }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to apply bulk bonus splits");
    }
    return response.json();
  },

  async revertBulkBonusSplits(records, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/bonus-split/revert-bulk`, {
      method: "POST",
      headers,
      body: JSON.stringify({ records }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to revert bulk bonus splits");
    }
    return response.json();
  },

  async updateBonusSplitStatusBulk(ids, status, token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/bonus-split/status-bulk`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ids, status }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update bulk status");
    }
    return response.json();
  },

  async invalidateCache(token) {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_BASE_URL}/api/stock/invalidate-cache`, {
      method: "POST",
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to invalidate cache");
    }
    return response.json();
  },

  // --- Orders ---
  async getOpenTransactions(accountName, symbol, search, page = 1, limit = 20, equityType = null, brokerName = null, token) {
    const headers = await getAuthHeaders(token);
    let url = `${API_BASE_URL}/api/orders/open-transactions?page=${page}&limit=${limit}`;
    if (accountName) url += `&account_name=${accountName}`;
    if (brokerName) url += `&broker_name=${brokerName}`;
    if (symbol) url += `&symbol=${symbol}`;
    if (search) url += `&search=${search}`;
    
    if (equityType) {
      if (Array.isArray(equityType)) {
        equityType.forEach(type => {
          url += `&equity_type=${type}`;
        });
      } else {
        url += `&equity_type=${equityType}`;
      }
    }
    
    const response = await fetch(url, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch open transactions");
    }
    return response.json();
  },

  async placeSellOrder(orderData) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/orders/place-sell-order`, {
      method: "POST",
      headers,
      body: JSON.stringify(orderData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to place sell order");
    }
    return response.json();
  },

  async getOrderStatus(orderId, broker, accountId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/orders/order-status?order_id=${orderId}&broker=${broker}&account_id=${accountId}`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch order status");
    }
    return response.json();
  },

  // --- Mapping ---
  async fetchStockMappings() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/mapping`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch stock mappings");
    }
    return response.json();
  },

  async fetchIncompleteStockMappings() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/mapping/incomplete`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch incomplete stock mappings");
    }
    return response.json();
  },

  async addStockMapping(mappingData) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/mapping`, {
      method: "POST",
      headers,
      body: JSON.stringify(mappingData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add stock mapping");
    }
    return response.json();
  },

  async updateStockMapping(id, mappingData) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/mapping/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(mappingData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update stock mapping");
    }
    return response.json();
  },

  async deleteStockMapping(id) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/mapping/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete stock mapping");
    }
    return response.json();
  },

  async fetchOpenStockData(params = {}) {
    const headers = await getAuthHeaders();
    const query = buildQueryString(params);
    const response = await fetch(`${API_BASE_URL}/api/stock/open?${query}`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch open stock data");
    }
    return response.json();
  },

  async fetchStockSymbols() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/symbols`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch stock symbols");
    }
    return response.json();
  },

  // --- Recent Searches ---
  async fetchRecentSearches() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/recent-searches`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch recent searches");
    }
    return response.json();
  },

  async addRecentSearch(stockName) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/recent-searches`, {
      method: "POST",
      headers,
      body: JSON.stringify({ stockName }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add recent search");
    }
    return response.json();
  },

  async clearRecentSearches() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/recent-searches`, {
      method: "DELETE",
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to clear recent searches");
    }
    return response.json();
  },

  // --- Cashflow & Dividends ---
  async fetchCashflow(params = {}) {
    const headers = await getAuthHeaders();
    const query = buildQueryString(params);
    const response = await fetch(`${API_BASE_URL}/api/stock/cashflow?${query}`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch cashflow data");
    }
    return response.json();
  },

  async addCashflow(cashflowData) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/cashflow`, {
      method: "POST",
      headers,
      body: JSON.stringify(cashflowData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add cashflow record");
    }
    return response.json();
  },

  async updateCashflow(id, cashflowData) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/cashflow/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(cashflowData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update cashflow record");
    }
    return response.json();
  },

  async deleteCashflow(id) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/cashflow/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete cashflow record");
    }
    return response.json();
  },

  async fetchDividendEvents() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/dividend-events`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch dividend events");
    }
    return response.json();
  },

  async addDividendEvent(eventData) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/dividend-events`, {
      method: "POST",
      headers,
      body: JSON.stringify(eventData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add dividend event");
    }
    return response.json();
  },

  async updateDividendEvent(id, eventData) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/dividend-events/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(eventData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update dividend event");
    }
    return response.json();
  },

  async deleteDividendEvent(id) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/dividend-events/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete dividend event");
    }
    return response.json();
  },

  async syncDividendEvents() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/dividend-events/sync`, {
      method: "POST",
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to sync dividend events");
    }
    return response.json();
  },

  async applyDividendEvents() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/dividend-events/apply`, {
      method: "POST",
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to apply dividend events");
    }
    return response.json();
  },

  async fetchMarketIndices(source = 'market_indices') {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/indices?source=${source}`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch market indices");
    }
    return response.json();
  },

  async searchStocks(query, limit = 10) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to search stocks");
    }
    return response.json();
  },

  // --- Watchlist ---
  async fetchWatchlist() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/watchlist`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch watchlist");
    }
    return response.json();
  },

  async getAllWatchlists() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/watchlists`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch all watchlists");
    }
    return response.json();
  },

  async addWatchlist(watchlistData) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/watchlists`, {
      method: "POST",
      headers,
      body: JSON.stringify(watchlistData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add watchlist");
    }
    return response.json();
  },

  async updateWatchlist(list_number, watchlistData) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/watchlists/${list_number}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(watchlistData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update watchlist");
    }
    return response.json();
  },

  async addToWatchlist(stockData) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/watchlist`, {
      method: "POST",
      headers,
      body: JSON.stringify(stockData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add to watchlist");
    }
    return response.json();
  },

  async removeFromWatchlist(id) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/watchlist/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to remove from watchlist");
    }
    return response.json();
  },

  // --- Equity Positions ---
  async fetchEquityPositions() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/equity-positions`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch equity positions");
    }
    return response.json();
  },

  async deleteEquityPositions(ids) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/equity-positions`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete equity positions");
    }
    return response.json();
  },

  async fetchTransactionsByDates(dates) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/transactions/by-dates`, {
      method: "POST",
      headers,
      body: JSON.stringify({ dates }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch transactions by dates");
    }
    return response.json();
  },

  // --- Zerodha ---
  async getZerodhaTokenStatus() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/zerodha-status`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch Zerodha status");
    }
    return response.json();
  },

  async syncZerodhaTrades(account) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/zerodha-sync?account=${account}`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to sync trades for ${account}`);
    }
    return response.json();
  },

  async automateZerodhaLogin(account) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/zerodha-automate?account=${account}`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to automate login for ${account}`);
    }
    return response.json();
  },

  async checkAngelOneHealth() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/angel-one-health`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to check Angel One health");
    }
    return response.json();
  },

  async syncAngelOneTrades() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/stock/angel-one-sync`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to sync Angel One trades");
    }
    return response.json();
  },
};
