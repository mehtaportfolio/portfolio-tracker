import axios from 'axios';
import { getAuthHeaders } from "../utils/authUtils.jsx";
import { API_URL } from "../config/apiConfig.js";

/**
 * MF API Utility
 * Centralizes all Mutual Fund related backend requests
 * (Updated to resolve persistent build cache issues)
 */
const mfAPI = {
  /**
   * Fetch all MF data (transactions, master, holdings)
   */
  getMFData: async (token, priceSource = 'stock_master') => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/assets/mf`, { 
      headers,
      params: { priceSource }
    });
    return response.data;
  },

  /**
   * Fetch distinct MF account names
   */
  getMFAccountNames: async (token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/assets/mf/accounts`, { headers });
    return response.data;
  },

  /**
   * Add a single MF transaction
   */
  addTransaction: async (transaction, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/assets/mf/transaction`, transaction, { headers });
    return response.data;
  },

  /**
   * Add bulk MF transactions
   */
  addBulkTransactions: async (transactions, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/assets/mf/bulk`, transactions, { headers });
    return response.data;
  },

  /**
   * Add MF Master data
   */
  addMaster: async (fundData, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/assets/mf/master`, fundData, { headers });
    return response.data;
  },

  /**
   * Add MF SIP
   */
  addSIP: async (sipData, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/assets/mf/sip`, sipData, { headers });
    return response.data;
  },

  /**
   * Update MF SIP
   */
  updateSIP: async (id, updates, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.put(`${API_URL}/assets/mf/sip/${id}`, updates, { headers });
    return response.data;
  },

  /**
   * Delete MF SIP
   */
  deleteSIP: async (id, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.delete(`${API_URL}/assets/mf/sip/${id}`, { headers });
    return response.data;
  },

  /**
   * Update an MF transaction
   */
  updateTransaction: async (id, updates, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.put(`${API_URL}/assets/mf/transaction/${id}`, updates, { headers });
    return response.data;
  },

  /**
   * Delete an MF transaction
   */
  deleteTransaction: async (id, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.delete(`${API_URL}/assets/mf/transaction/${id}`, { headers });
    return response.data;
  },

  /**
   * Fetch all MF CAS entries
   */
  getCasEntries: async (token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/assets/mf/cas`, { headers });
    return response.data;
  },

  /**
   * Fetch all MF Raw CAS entries
   */
  getRawCasEntries: async (token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/assets/mf/raw-cas`, { headers });
    return response.data;
  },

  /**
   * Delete all MF CAS entries
   */
  deleteAllCasEntries: async (token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.delete(`${API_URL}/assets/mf/cas`, { headers });
    return response.data;
  },

  /**
   * Invalidate MF cache
   */
  invalidateCache: async (token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/assets/mf/invalidate-cache`, {}, { headers });
    return response.data;
  },

  /**
   * Proxy request to external MF API
   */
  proxyMFAPI: async (id) => {
    const response = await axios.get(`${API_URL}/assets/mf/proxy/${id}`);
    return response.data;
  },

  /**
   * Upload CAS PDF file
   */
  uploadCAS: async (formData, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/cas/upload`, formData, { 
      headers: {
        ...headers,
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  /**
   * Fetch CAS from Gmail
   */
  gmailFetchCAS: async (accountName, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/cas/gmail-fetch`, { accountName }, { headers });
    return response.data;
  },

  /**
   * Fetch script logs
   */
  getScriptLogs: async (params, token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/cas/script-logs`, { headers, params });
    return response.data;
  },

/**
 * Generate CAMS statement automatically
 */
autoGenerateCAS: async (accountName, token) => {
    const headers = await getAuthHeaders(token);

    const response = await axios.post(
        `${API_URL}/cams/generate`,
        { account: accountName },
        { headers }
    );

    return response.data;
},

  /**
   * Fetch MF explorer funds metadata
   */
  getExplorerFunds: async (token) => {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/assets/mf/explorer/funds`, { headers });
    return response.data;
  }
};

export default mfAPI;
