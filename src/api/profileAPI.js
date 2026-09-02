import axios from 'axios';
import { API_URL } from "../config/apiConfig.js";
import { getAuthHeaders } from "../utils/authUtils.jsx";

const profileAPI = {
  // --- Demat Accounts ---
  async getAccounts(token) {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/profile/accounts`, { headers });
    return response.data;
  },

  async saveAccount(accountData, token) {
    const headers = await getAuthHeaders(token);
    const response = await axios.post(`${API_URL}/profile/accounts`, accountData, { headers });
    return response.data;
  },

  async updateAccount(accountId, accountData, token) {
    const headers = await getAuthHeaders(token);
    const response = await axios.put(`${API_URL}/profile/accounts/${accountId}`, accountData, { headers });
    return response.data;
  },

  async deleteAccount(accountId, token) {
    const headers = await getAuthHeaders(token);
    const response = await axios.delete(`${API_URL}/profile/accounts/${accountId}`, { headers });
    return response.data;
  },

  // --- Profile Settings ---
  async getSettings(token) {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/profile/settings`, { headers });
    return response.data;
  },

  async updateSettings(settings, token) {
    const headers = await getAuthHeaders(token);
    const response = await axios.put(`${API_URL}/profile/settings`, settings, { headers });
    return response.data;
  },
};

export default profileAPI;