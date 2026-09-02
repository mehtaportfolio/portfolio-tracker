// src/components/BackgroundDividendService.js
import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import { BACKEND_URL } from "../config/apiConfig.js";

const BackgroundDividendService = () => {
  const hasRun = useRef(false);
  const { session } = useAuth();
  const token = session?.access_token;

  useEffect(() => {
    const runAutomation = async () => {
      if (hasRun.current || !token) return;
      
      const now = new Date();
      const targetDate = new Date("2026-04-01");
      
      if (now < targetDate) return;

      hasRun.current = true;

      try {
        const backendUrl = BACKEND_URL;
        
        const response = await fetch(`${backendUrl}/api/dividend/automate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Backend automation failed: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.syncedCount > 0 || result.appliedCount > 0) {
          const message = result.message || `Dividend updated: ${result.syncedCount} new events synced, ${result.appliedCount} cashflows generated.`;
          toast.success(message, { duration: 6000 });
        } else {
          toast("No new dividend found.", { icon: 'ℹ️' });
        }
      } catch (error) {
        console.error("Background Dividend Automation Error:", error);
      }
    };

    runAutomation();
  }, [token]);

  return null; // This is a logic-only component
};

export default BackgroundDividendService;
