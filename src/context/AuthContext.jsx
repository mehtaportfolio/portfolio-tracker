import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import authAPI from "../api/authAPI.js";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(true);

  const unlockApp = useCallback(() => {
    setIsLocked(false);
  }, []);

  const persistAuthToken = (nextSession) => {
    if (typeof window === "undefined") {
      return;
    }

    if (nextSession?.access_token) {
      localStorage.setItem("auth_token", nextSession.access_token);
    } else {
      localStorage.removeItem("auth_token");
    }
  };

  const getInitialSession = useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      try {
        const data = await authAPI.getSession(token);
        const nextSession = { access_token: token, user: data.user };
        setSession(nextSession);
      } catch (error) {
        console.error("Error fetching initial session", error);
        localStorage.removeItem("auth_token");
        setSession(null);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    getInitialSession();
  }, [getInitialSession]);

  const handleSignIn = async ({ email, password }) => {
    try {
      const data = await authAPI.login(email, password);
      persistAuthToken(data.session);
      setSession(data.session);
      setIsLocked(false);
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const handleSignUp = async ({ email, password, options }) => {
    try {
      const data = await authAPI.signup(email, password, options);
      // Depending on if email confirmation is required, session might be null
      if (data.session) {
        persistAuthToken(data.session);
        setSession(data.session);
        setIsLocked(false);
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const handleSignOut = async () => {
    const userEmail = session?.user?.email;
    const token = session?.access_token;

    if (userEmail) {
      const normalizedEmail = userEmail.toLowerCase();
      localStorage.removeItem(`2fa_enabled_${normalizedEmail}`);
      localStorage.removeItem(`2fa_secret_${normalizedEmail}`);
      localStorage.removeItem(`2fa_backup_codes_${normalizedEmail}`);
      localStorage.removeItem(`biometric_session_${normalizedEmail}`);
      localStorage.removeItem(`biometric_last_auth_${normalizedEmail}`);
      // Do NOT remove biometric_password here, it's needed for biometric login
      // unless the user explicitly disables biometric auth in profile settings
      sessionStorage.removeItem(`biometric_session_${normalizedEmail}`);
    }

    localStorage.removeItem("auth_token");

    if (token) {
      try {
        await authAPI.logout(token);
      } catch (error) {
        console.error("Logout error:", error);
      }
    }

    setSession(null);
    setIsLocked(true);
  };

  const updateUserMetadata = async (data) => {
    const token = session?.access_token;
    if (!token) return { data: null, error: new Error("No session") };
    try {
      const updatedUser = await authAPI.updateUser(token, data);
      setSession(prev => ({ ...prev, user: updatedUser }));
      return { data: updatedUser, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const fetchUserDetails = async (email) => {
    try {
      const data = await authAPI.getUserDetails(email);
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    isLocked,
    unlockApp,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    updateUserMetadata,
    fetchUserDetails,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
