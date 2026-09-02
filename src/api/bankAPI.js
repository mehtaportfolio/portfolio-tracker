import axios from 'axios';
import { getAuthHeaders } from "../utils/authUtils.jsx";
import { API_URL } from "../config/apiConfig.js";


/**
 * Bank API Utility
 */
const bankAPI = {
  /**
   * Fetch bank metadata (accounts, banks)
   */
  getMetadata: async (token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/assets/bank/metadata`, { headers });
    return response.data;
  },

  /**
   * Fetch bank transactions by range
   */
  getTransactionsByRange: async (startDate, endDate, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/assets/bank/range`, {
      params: { startDate, endDate },
      headers
    });
    return response.data;
  },

  /**
   * Fetch bank balance snapshots
   */
  getBankSnapshots: async (token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/assets/bank/snapshots`, { headers });
    return response.data;
  },

  /**
   * Add a single bank transaction
   */
  addTransaction: async (transaction, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/assets/bank/transaction`, transaction, { headers });
    return response.data;
  },

  /**
   * Add bulk bank transactions
   */
  addBulkTransactions: async (transactions, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/assets/bank/bulk`, transactions, { headers });
    return response.data;
  },

  /**
   * Fetch all bank data
   */
  getAssets: async (token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/assets/bank`, { headers });
    return response.data;
  },

  /**
   * Process bank adjustment
   */
  processAdjustment: async (token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/assets/bank/adjustment`, {}, { headers });
    return response.data;
  },

  /**
   * Invalidate bank cache
   */
  invalidateCache: async (token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/assets/bank/invalidate-cache`, {}, { headers });
    return response.data;
  },

  /**
   * Update bank balance snapshot
   */
  updateBankBalanceSnapshot: async (id, payload, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.put(`${API_URL}/assets/bank/snapshot/${id}`, payload, { headers });
    return response.data;
  },

  /**
   * Delete bank balance snapshot
   */
  deleteBankBalanceSnapshot: async (id, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.delete(`${API_URL}/assets/bank/snapshot/${id}`, { headers });
    return response.data;
  },
};



export default bankAPI;
