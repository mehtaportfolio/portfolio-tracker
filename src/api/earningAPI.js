import axios from 'axios';
import { getAuthHeaders } from "../utils/authUtils.jsx";
import { API_URL } from "../config/apiConfig.js";

export async function fetchEarningData(token) {
  try {
    const headers = await getAuthHeaders(token);
    const response = await axios.get(`${API_URL}/analysis/earning`, { headers });
    return response.data;
  } catch (error) {
    console.error('[Earning API] Failed to fetch:', error);
    throw error;
  }
}
