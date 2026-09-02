import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useMode } from "./ModeContext.jsx";
import { useAuth } from "./AuthContext.jsx";
import { fetchLivePriceDetails } from "../api/dashboardAPI.js";
import { isMarketOpen } from "../utils/marketHours.js";
import { BACKEND_URL } from "../config/apiConfig.js";

const LivePriceContext = createContext();

const buildWsUrl = () => {
  const protocol = typeof window !== 'undefined' && window.location?.protocol === 'https:' ? 'wss' : 'ws';

  if (typeof BACKEND_URL === 'string' && BACKEND_URL.trim()) {
    const normalized = BACKEND_URL.trim();
    try {
      const parsed = new URL(normalized);
      parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : parsed.protocol === 'http:' ? 'ws:' : parsed.protocol;
      return parsed.origin;
    } catch {
      return `${protocol}://${normalized.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
    }
  }

  if (typeof window !== 'undefined' && window.location) {
    return `${protocol}://${window.location.host}`;
  }

  return 'ws://localhost:3001';
};

const WS_URL = buildWsUrl();

export const LivePriceProvider = ({ children }) => {
  const { priceSource } = useMode();
  const { session } = useAuth();
  const user = session?.user;
  const token = session?.access_token;
  const [livePrices, setLivePrices] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [marketOpen, setMarketOpen] = useState(isMarketOpen());
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);
  const symbolsRef = useRef([]);

  const fetchPortfolioSymbols = useCallback(async () => {
    if (!user || !token) return [];
    
    try {
      const result = await fetchLivePriceDetails(token);
      if (!result.success || !result.data) return [];

      const symbols = [...new Set(result.data
        .filter(m => m.symbol_ao)
        .map(m => m.symbol_ao))];
        
      console.log(`[LivePrice] Final symbol count for subscription: ${symbols.length}`);
      symbolsRef.current = symbols;
      return symbols;
    } catch (err) {
      console.error("[LivePrice] Error fetching symbols:", err.message);
      return [];
    }
  }, [user, token]);

  const connect = useCallback(async () => {
    if (ws.current || priceSource !== 'live') return;

    console.log("[LivePrice] Connecting to WebSocket...");
    
    const socket = new WebSocket(`${WS_URL}/ws/live-prices`);
    ws.current = socket;

    socket.onopen = async () => {
      console.log("🟢 [LivePrice] WebSocket Connected");
      setIsConnected(true);
      
      const symbols = await fetchPortfolioSymbols();
      if (symbols.length > 0) {
        console.log(`[LivePrice] Subscribing to ${symbols.length} symbols`);
        socket.send(JSON.stringify({
          type: "subscribe",
          symbols: symbols
        }));
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.symbol && data.ltp) {
          setLivePrices(prev => ({
            ...prev,
            [data.symbol]: data.ltp
          }));
        }
      } catch (err) {
        console.error("[LivePrice] Error parsing message:", err);
      }
    };

    socket.onclose = () => {
      console.log("🔴 [LivePrice] WebSocket Disconnected");
      ws.current = null;
      setIsConnected(false);
      
      if (priceSource === 'live') {
        reconnectTimeout.current = setTimeout(connect, 5000);
      }
    };

    socket.onerror = (err) => {
      console.error("❌ [LivePrice] WebSocket Error:", err);
    };
  }, [priceSource, fetchPortfolioSymbols]);

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMarketOpen(isMarketOpen());
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (priceSource === 'live' && user && token && marketOpen) {
      connect();
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [priceSource, user, token, marketOpen, connect, disconnect]);

  return (
    <LivePriceContext.Provider value={{ livePrices, isConnected, marketOpen }}>
      {children}
    </LivePriceContext.Provider>
  );
};

export const useLivePrices = () => {
  const context = useContext(LivePriceContext);
  if (!context) {
    throw new Error("useLivePrices must be used within a LivePriceProvider");
  }
  return context;
};
