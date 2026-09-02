// src/utils/indicesFetcher.js
// Fetches Nifty Midcap 100 and Nifty Smallcap 250 from backend (Economic Times scraper)

import { BACKEND_URL } from "../config/apiConfig.js";

const BACKEND_BASE = BACKEND_URL;

export async function fetchIndices() {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/indices`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.warn(`Failed to fetch indices (${res.status})`);
      return {
        MIDCAP_100: null,
        SMLCAP_250: null,
      };
    }

    const data = await res.json();
    
    return {
      MIDCAP_100: data.MIDCAP_100,
      SMLCAP_250: data.SMLCAP_250,
    };
  } catch (err) {
    console.error("Error fetching indices:", err.message);
    return {
      MIDCAP_100: null,
      SMLCAP_250: null,
    };
  }
}