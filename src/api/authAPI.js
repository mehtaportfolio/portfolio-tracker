import axios from 'axios';
import { API_URL } from '../config/apiConfig.js';

const authAPI = {
  login: async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      return response.data;
    } catch (error) {
      console.error("authAPI.login error response:", error.response?.data || error.message);
      throw error;
    }
  },
  signup: async (email, password, options) => {
    const response = await axios.post(`${API_URL}/auth/signup`, { email, password, options });
    return response.data;
  },
  logout: async (token) => {
    const response = await axios.post(`${API_URL}/auth/logout`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  getSession: async (token) => {
    const response = await axios.get(`${API_URL}/auth/session`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  getUserDetails: async (email) => {
    const response = await axios.get(`${API_URL}/auth/user-details`, {
      params: { email }
    });
    return response.data;
  },
  updateUser: async (token, data) => {
    const response = await axios.post(`${API_URL}/auth/update-user`, { data }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  verifyMasterPIN: async (token, pin) => {
    const response = await axios.post(`${API_URL}/auth/verify-master-pin`, { pin }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  updateMasterPIN: async (token, currentPin, newPin) => {
    const response = await axios.post(`${API_URL}/auth/update-master-pin`, { currentPin, newPin }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  updateUserDetails: async (token, updates) => {
    const response = await axios.post(`${API_URL}/auth/update-user-details`, { updates }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  verifyMasterPassword: async (token, password) => {
    const response = await axios.post(`${API_URL}/auth/verify-master-password`, { password }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }
};

export default authAPI;
