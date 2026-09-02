// src/api.js
import { BACKEND_URL } from './config/apiConfig.js';

export async function fetchFundReturns(amfiCode) {
  const res = await fetch(`${BACKEND_URL}/funds/${amfiCode}/returns`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchAndSaveNavs(amfiCode) {
  const res = await fetch(`${BACKEND_URL}/funds/${amfiCode}/fetch-and-save-navs`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
