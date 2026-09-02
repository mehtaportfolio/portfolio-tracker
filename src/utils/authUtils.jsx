/**
 * Utility for authentication-related tasks in the frontend
 */

/**
 * Get authentication headers with the token from localStorage
 * @returns {Promise<Object>} Headers object with Authorization if token exists
 */
export const getAuthHeaders = async (passedToken) => {
  const token = passedToken || localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token && { "Authorization": `Bearer ${token}` }),
  };
};
