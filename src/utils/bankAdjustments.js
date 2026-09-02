// src/utils/bankAdjustments.js
import { getAuthHeaders } from './authUtils.jsx';
import { invalidateBulkCache } from './supabasePagination.js';

import { BACKEND_URL } from "../config/apiConfig.js";

const API_BASE = BACKEND_URL;

export const insertBankAdjustment = async () => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/assets/bank/adjustment`, {
      method: "POST",
      headers,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to process bank adjustment");
    }

    if (result.success) {
      invalidateBulkCache();
      alert(result.message || "Monthly adjustment processed successfully!");
    } else {
      alert(result.message || "No adjustment needed.");
    }
    
    return result;
  } catch (err) {
    console.error("Error processing bank adjustment:", err);
    alert(err.message || "Failed to process adjustment.");
  }
};
