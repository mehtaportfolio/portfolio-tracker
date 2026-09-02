import axios from 'axios';
import { getAuthHeaders } from "../utils/authUtils.jsx";
import { API_URL } from "../config/apiConfig.js";

/**
 * Generic Asset API Utility
 */
const assetAPI = {
  /**
   * Fetch distinct names/values for a column
   */
  getDistinctNames: async (assetType, columnName, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/assets/${assetType}/names/${columnName}`, { headers });
    return response.data;
  },

  /**
   * Fetch latest date for an asset
   */
  getLatestDate: async (assetType, dateColumn = 'date', token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/assets/${assetType}/latest-date`, {
      params: { dateColumn },
      headers
    });
    return response.data;
  },

  /**
   * Add asset contribution (e.g. NPS)
   */
  addContribution: async (assetType, contribution, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/assets/${assetType}/contribution`, contribution, { headers });
    return response.data;
  },

  /**
   * Fetch NPS master data
   */
  getNPSMaster: async (token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/assets/nps/master`, { headers });
    return response.data;
  },

  /**
   * Fetch all transactions for an asset
   */
  getTransactions: async (assetType, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/assets/${assetType}`, { headers });
    return response.data;
  },

  /**
   * Fetch transactions by range
   */
  getTransactionsByRange: async (assetType, startDate, endDate, dateColumn = 'date', token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/assets/${assetType}/range`, {
      params: { startDate, endDate, dateColumn },
      headers
    });
    return response.data;
  },

  /**
   * Add a single transaction
   */
  addTransaction: async (assetType, transaction, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/assets/${assetType}/transaction`, transaction, { headers });
    return response.data;
  },

  /**
   * Update a transaction
   */
  updateTransaction: async (assetType, id, updates, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.put(`${API_URL}/assets/${assetType}/transaction/${id}`, updates, { headers });
    return response.data;
  },

  /**
   * Delete a transaction
   */
  deleteTransaction: async (assetType, id, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.delete(`${API_URL}/assets/${assetType}/transaction/${id}`, { headers });
    return response.data;
  },

  /**
   * Add bulk transactions
   */
  addBulkTransactions: async (assetType, transactions, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/assets/${assetType}/bulk`, transactions, { headers });
    return response.data;
  },

  /**
   * Fetch user master data
   */
  getUserMaster: async (assetType, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/assets/user-master`, {
      params: { assetType },
      headers
    });
    return response.data;
  },

  /**
   * Update user master data
   */
  updateUserMaster: async (id, updates, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.put(`${API_URL}/assets/user-master/${id}`, updates, { headers });
    return response.data;
  },

  /**
   * Add user master data
   */
  addUserMaster: async (masterData, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/assets/user-master`, masterData, { headers });
    return response.data;
  },

  /**
   * Delete user master data
   */
  deleteUserMaster: async (id, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.delete(`${API_URL}/assets/user-master/${id}`, { headers });
    return response.data;
  },

  /**
   * Fetch all MF data (transactions, master, SIPs)
   */
  getMFData: async (token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/assets/mf`, { headers });
    return response.data;
  },

  /**
   * Add MF SIP
   */
  addMFSIP: async (sipData, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/assets/mf/sip`, sipData, { headers });
    return response.data;
  },

  /**
   * Update MF SIP
   */
  updateMFSIP: async (id, updates, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.put(`${API_URL}/assets/mf/sip/${id}`, updates, { headers });
    return response.data;
  },

  /**
   * Delete MF SIP
   */
  deleteMFSIP: async (id, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.delete(`${API_URL}/assets/mf/sip/${id}`, { headers });
    return response.data;
  },

  /**
   * Fetch other transactions (BDM)
   */
  getOtherTransactions: async (params = {}, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/assets/other/transactions`, {
      params,
      headers
    });
    return response.data;
  },

  /**
   * Update other transaction
   */
  updateOtherTransaction: async (id, updates, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.put(`${API_URL}/assets/other/transaction/${id}`, updates, { headers });
    return response.data;
  },

  /**
   * Delete other transaction
   */
  deleteOtherTransaction: async (id, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.delete(`${API_URL}/assets/other/transaction/${id}`, { headers });
    return response.data;
  },

  /**
   * Fetch BDM account number from backend
   */
  getBDMAccountNumber: async (token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/assets/bdm/account-number`, { headers });
    return response.data;
  },

  /**
   * Upload NPS PDF for processing
   */
  uploadNpsPdf: async (formData, token) => {
    const headers = await getAuthHeaders(token);
    headers['Content-Type'] = 'multipart/form-data';
    const response = await axios.post(`${API_URL}/nps-pdf/upload`, formData, { headers });
    return response.data;
  },

  /**
   * Initialize NPS fetch session
   */
  initNpsFetch: async (token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/nps-fetch/init`, {}, { headers });
    return response.data;
  },

  /**
   * Submit NPS captcha and fetch
   */
  submitNpsCaptcha: async (data, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/nps-fetch/submit`, data, { headers });
    return response.data;
  },

  /**
   * Fetch raw NPS transactions from temp table
   */
  getRawNPSTransactions: async (token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/nps-fetch/raw-transactions`, { headers });
    return response.data;
  },

  /**
   * Fetch transactions from nps_pdf table
   */
  getNpsPdfTransactions: async (token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/nps-pdf/transactions`, { headers });
    return response.data;
  },

  /**
   * Invalidate asset cache
   */
  invalidateCache: async (assetType, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/assets/${assetType}/invalidate-cache`, {}, { headers });
    return response.data;
  }
};

export default assetAPI;
