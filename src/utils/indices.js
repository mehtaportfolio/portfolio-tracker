// src/utils/indices.js
// Helper to fetch live indices from our Express backend (/indices)

import { BACKEND_URL } from "../config/apiConfig.js";

function guessBackendBase() {
  return BACKEND_URL;
}

export async function fetchIndices() {
  const base = guessBackendBase();
  const url = `${base}/indices`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to fetch indices (${res.status})`);
  return res.json();
}