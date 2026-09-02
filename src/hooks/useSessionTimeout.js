import { useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";

/**
 * Hook for managing session timeout and inactivity tracking
 * Automatically logs out users after specified inactivity period
 */
export function useSessionTimeout(inactivityTimeoutMs = 15 * 60 * 1000) {
  const timeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // Handle session timeout
  const handleSessionTimeout = useCallback(() => {
    toast.error("Session expired due to inactivity. Please sign in again.");

    // Clear all session data
    sessionStorage.clear();
    localStorage.removeItem("biometric_session");

    // Trigger logout
    window.location.href = "/";
  }, []);

  // Update last activity time
  const updateLastActivity = useCallback(() => {
    lastActivityRef.current = Date.now();

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      handleSessionTimeout();
    }, inactivityTimeoutMs);
  }, [handleSessionTimeout, inactivityTimeoutMs]);

  // Track user activity
  useEffect(() => {
    const events = ["mousedown", "keydown", "touchstart", "scroll", "click"];

    const handleActivity = () => {
      updateLastActivity();
    };

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Set initial timeout
    updateLastActivity();

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [updateLastActivity]);

  // Return utility functions
  return {
    getLastActivityTime: () => lastActivityRef.current,
    resetTimeout: updateLastActivity,
    clearTimeout: () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
  };
}