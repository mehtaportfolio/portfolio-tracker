import { useState, useCallback, useEffect, useRef } from "react";
import toast from "react-hot-toast";

/**
 * Hook for managing biometric authentication using WebAuthn API
 * Supports fingerprint, face recognition, and platform authenticators
 */

// Helper function to convert base64url to Uint8Array
function base64UrlToUint8Array(base64Url) {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useBiometricAuth() {
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const abortControllerRef = useRef(null);

  // Get current authenticated user
  const getCurrentUser = useCallback(async () => {
    try {
      const { data: { user } } = await import("../supabaseClient.js").then(
        (mod) => mod.supabase.auth.getUser()
      );
      return user;
    } catch (error) {
      return null;
    }
  }, []);

  // Clear biometric session
  const clearBiometricSession = useCallback((userEmail) => {
    const normalizedEmail = userEmail.toLowerCase();
    localStorage.removeItem(`biometric_session_${normalizedEmail}`);
    localStorage.removeItem(`biometric_last_auth_${normalizedEmail}`);
    sessionStorage.removeItem(`biometric_session_${normalizedEmail}`);
  }, []);

  // Check if device supports biometric authentication
  const checkBiometricSupport = useCallback(async () => {
    try {
      // Check if WebAuthn is available
      if (!window.PublicKeyCredential) {
        setBiometricAvailable(false);
        return false;
      }

      // Check if the browser supports conditional UI (for autofill)
      const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      setBiometricAvailable(available);

      // Check if user has enabled biometric for this app
      const user = await getCurrentUser();
      if (user) {
        const normalizedEmail = user.email.toLowerCase();
        const enabled = localStorage.getItem(`biometric_enabled_${normalizedEmail}`) === "true";
        setBiometricEnabled(enabled && available);
      }

      return available;
    } catch (error) {
      console.error("Biometric support check failed:", error);
      setBiometricAvailable(false);
      return false;
    }
  }, [getCurrentUser]);

  // Register biometric credential
  const registerBiometric = useCallback(async (userEmail) => {
    try {
      const normalizedEmail = userEmail.toLowerCase();
      if (!window.PublicKeyCredential) {
        // Fallback for testing: create a mock credential
        const mockCredentialId = "mock_" + Date.now() + "_" + Math.random().toString(36).substring(2);
        localStorage.setItem(`biometric_credential_${normalizedEmail}`, mockCredentialId);
        localStorage.setItem(`biometric_enabled_${normalizedEmail}`, "true");
        setBiometricEnabled(true);
        toast.success("Biometric enabled (test mode)");
        return true;
      }

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const publicKey = {
        challenge,
        rp: {
          name: "Portfolio Tracker",
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(normalizedEmail),
          name: normalizedEmail,
          displayName: normalizedEmail,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" }, // ES256
          { alg: -257, type: "public-key" }, // RS256
        ],
        authenticatorSelection: {
          // Allow any authenticator (platform or cross-platform)
          userVerification: "preferred",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      };

      const credential = await navigator.credentials.create({
        publicKey,
      });

      if (!credential) {
        throw new Error("Biometric registration cancelled");
      }

      if (!credential.id) {
        throw new Error("Invalid credential received");
      }

      // Store credential ID for later use
      // credential.id is already a base64url encoded string
      const credentialId = credential.id;

      localStorage.setItem(`biometric_credential_${normalizedEmail}`, credentialId);
      localStorage.setItem(`biometric_enabled_${normalizedEmail}`, "true");

      setBiometricEnabled(true);
      return true;
    } catch (error) {
      console.error("Biometric registration error:", error);
      // Clear any partial data
      const normalizedEmail = userEmail.toLowerCase();
      localStorage.removeItem(`biometric_credential_${normalizedEmail}`);
      localStorage.removeItem(`biometric_enabled_${normalizedEmail}`);
      toast.error(error.message || "Failed to register biometric");
      return false;
    }
  }, []);

  // Authenticate with biometric
  const authenticateWithBiometric = useCallback(async (userEmail) => {
    try {
      const normalizedEmail = userEmail.toLowerCase();
      // Prevent concurrent requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      setIsAuthenticating(true);

      const storedCredentialId = localStorage.getItem(`biometric_credential_${normalizedEmail}`);
      if (!storedCredentialId || storedCredentialId.trim() === "") {
        throw new Error("Biometric not registered for this account");
      }

      // Check if this is a mock credential for testing
      if (storedCredentialId.startsWith("mock_")) {
        // Simulate successful authentication for testing
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay

        // Get stored password for auto-login
        const passwordKey = `biometric_password_${normalizedEmail}`;
        const storedPassword = localStorage.getItem(passwordKey);
        console.log(`[Mock] Authenticating ${normalizedEmail}. Checking key: ${passwordKey}`);
        console.log(`[Mock] Password status: ${storedPassword ? "Present" : "MISSING"}`);

        if (!storedPassword) {
          console.error(`[Mock] ERROR: Password missing in localStorage for key: ${passwordKey}`);
          throw new Error("Biometric setup incomplete");
        }

        // Create a temporary session token
        const sessionToken = generateSessionToken();
        const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

        sessionStorage.setItem(`biometric_session_${normalizedEmail}`, sessionToken);
        localStorage.setItem(
          `biometric_session_${normalizedEmail}`,
          JSON.stringify({
            token: sessionToken,
            expiresAt,
            email: normalizedEmail,
            lastUsed: Date.now(),
          })
        );

        // Track last biometric auth time for inactivity
        localStorage.setItem(`biometric_last_auth_${normalizedEmail}`, Date.now().toString());

        setIsAuthenticating(false);
        return { success: true, sessionToken, email: normalizedEmail, password: storedPassword };
      }

      if (!window.PublicKeyCredential) {
        throw new Error("WebAuthn not supported");
      }

      // Convert base64url encoded credential ID back to Uint8Array
      const credentialId = base64UrlToUint8Array(storedCredentialId);

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const publicKey = {
        challenge,
        timeout: 60000,
        userVerification: "preferred",
        allowCredentials: [
          {
            id: credentialId,
            type: "public-key",
            transports: ["internal"],
          },
        ],
      };

      const assertion = await navigator.credentials.get({
        publicKey,
        signal: abortControllerRef.current.signal,
      });

      if (!assertion) {
        throw new Error("Biometric authentication failed");
      }

      // Get stored password for auto-login
      const passwordKey = `biometric_password_${normalizedEmail}`;
      const storedPassword = localStorage.getItem(passwordKey);
      console.log(`[Biometric] Authenticating ${normalizedEmail}. Checking key: ${passwordKey}`);
      console.log(`[Biometric] Password status: ${storedPassword ? "Present" : "MISSING"}${storedPassword ? ` (Length: ${storedPassword.length})` : ""}`);
      
      if (!storedPassword) {
        console.error(`[Biometric] ERROR: Password missing in localStorage for key: ${passwordKey}`);
        // Also check if enabled flag is still there
        const enabledFlag = localStorage.getItem(`biometric_enabled_${normalizedEmail}`);
        console.log(`[Biometric] Enabled flag status: ${enabledFlag}`);
        throw new Error("Biometric setup incomplete");
      }

      // Create a temporary session token
      const sessionToken = generateSessionToken();
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

      sessionStorage.setItem(`biometric_session_${normalizedEmail}`, sessionToken);
      localStorage.setItem(
        `biometric_session_${normalizedEmail}`,
        JSON.stringify({
          token: sessionToken,
          expiresAt,
          email: normalizedEmail,
          lastUsed: Date.now(),
        })
      );

      // Track last biometric auth time for inactivity
      localStorage.setItem(`biometric_last_auth_${normalizedEmail}`, Date.now().toString());

      setIsAuthenticating(false);
      return { success: true, sessionToken, email: normalizedEmail, password: storedPassword };
    } catch (error) {
      if (error.name === "AbortError") {
        console.warn("Biometric authentication cancelled due to new request");
      } else {
        console.error("Biometric authentication error:", error);
      }
      setIsAuthenticating(false);
      throw error;
    }
  }, []);

  // Check if stored session is still valid
  const isSessionValid = useCallback((userEmail, inactivityTimeoutMs = 15 * 60 * 1000) => {
    try {
      const normalizedEmail = userEmail.toLowerCase();
      const sessionData = localStorage.getItem(`biometric_session_${normalizedEmail}`);
      if (!sessionData) {
        return false;
      }

      const { expiresAt, lastUsed } = JSON.parse(sessionData);
      const now = Date.now();

      // Check if session expired
      if (now > expiresAt) {
        clearBiometricSession(normalizedEmail);
        return false;
      }

      // Check if inactive for too long
      if (now - lastUsed > inactivityTimeoutMs) {
        clearBiometricSession(normalizedEmail);
        return false;
      }

      // Update last used time
      const updated = JSON.parse(sessionData);
      updated.lastUsed = now;
      localStorage.setItem(`biometric_session_${normalizedEmail}`, JSON.stringify(updated));

      return true;
    } catch (error) {
      console.error("Session validation error:", error);
      return false;
    }
  }, [clearBiometricSession]);

  // Disable biometric for user
  const disableBiometric = useCallback((userEmail) => {
    try {
      const normalizedEmail = userEmail.toLowerCase();
      localStorage.removeItem(`biometric_credential_${normalizedEmail}`);
      localStorage.removeItem(`biometric_enabled_${normalizedEmail}`);
      localStorage.removeItem(`biometric_session_${normalizedEmail}`);
      localStorage.removeItem(`biometric_password_${normalizedEmail}`);
      sessionStorage.removeItem(`biometric_session_${normalizedEmail}`);
      clearBiometricSession(normalizedEmail);

      setBiometricEnabled(false);
      toast.success("Biometric authentication disabled");
      return true;
    } catch (error) {
      console.error("Error disabling biometric:", error);
      toast.error("Failed to disable biometric");
      return false;
    }
  }, [clearBiometricSession]);

  // Generate session token
  const generateSessionToken = () => {
    return `biometric_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  };

  // Initialize biometric on mount
  useEffect(() => {
    checkBiometricSupport();
  }, [checkBiometricSupport]);

  return {
    biometricAvailable,
    biometricEnabled,
    isAuthenticating,
    checkBiometricSupport,
    registerBiometric,
    authenticateWithBiometric,
    isSessionValid,
    disableBiometric,
    clearBiometricSession,
    getCurrentUser,
  };
}