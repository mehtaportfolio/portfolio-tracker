// src/utils/EquityMasker.js
// Single-file controller for masking equity columns across Portfolio/Stock/ETF/Closed

const LS_KEY = "equity_masked_v1";
let masked = false;
let observer = null;
let debounceTimer = null;
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// 🔧 Configure which table headers & card headings to mask
const CONFIG = {
  headersToMask: [
    // Stock/Holdings
    "CMP (₹)",
    "Invested Amount",
    "Market Value",
    "P/L (₹)",
    "P/L %",
    "Unrealized Profit",

    // ETF
    "ETF CMP (₹)",
    "Invested Amount",
    "Market Value",
    "ETF P/L (₹)",
    "ETF P/L %",
    "Day’s Change",
    "Day's Change",

    // Closed
    "Sell Value",
    "Realized Profit",
    "Return %",
    "XIRR",
    "XIRR %",
    "closed value",
    "invested",
  ],

  cardHeadingsToMask: [
    "Equity Market Value",
    "Market Value",
    "Total Stock Value",
    "Invested",
    "Day’s Change",
    "Day's Change",
    "Holdings",
    "Net Returns",
    "Unrealized Profit",
    "Realized Profit",
    "Performance",
  ],
};

const norm = (txt) =>
  (txt || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const HEADERS_SET = new Set(CONFIG.headersToMask.map((h) => norm(h)));
const CARDS_SET = new Set(CONFIG.cardHeadingsToMask.map((h) => norm(h)));

function isNumberishText(text) {
  return /[\d]/.test(text || "");
}

// SAFE: only toggles classes/attributes; no DOM children destroyed
function maskTextNode(el) {
  if (!el) return;
  if (el.dataset && el.dataset.equityMasked === "1") return;
  if (!isNumberishText(el.textContent)) return;
  el.dataset.equityMasked = "1";
  el.classList.add("maskable-number");
}

function unmaskTextNode(el) {
  if (!el || !el.dataset || el.dataset.equityMasked !== "1") return;
  el.classList.remove("maskable-number");
  delete el.dataset.equityMasked;
}


function getHeaderMap(table) {
  const map = {};
  const thead = table.querySelector("thead");
  let ths = [];
  if (thead) {
    const row = thead.querySelector("tr");
    if (row) ths = Array.from(row.children);
  } else {
    const firstRow = table.querySelector("tr");
    if (firstRow) ths = Array.from(firstRow.children);
  }
  ths.forEach((th, idx) => {
    map[idx] = norm(th.textContent);
  });
  return map;
}

function maskTable(table) {
  const headerMap = getHeaderMap(table);

  const columnsToMask = Object.entries(headerMap)
    .filter(([idx, h]) => HEADERS_SET.has(h))
    .map(([idx]) => parseInt(idx, 10));

  if (!columnsToMask.length) return;

  const rows = table.querySelectorAll("tbody tr");
  rows.forEach((tr) => {
    const tds = Array.from(tr.children);
    columnsToMask.forEach((colIdx) => {
      const td = tds[colIdx];
      if (!td) return;
      maskTextNode(td);
    });
  });
}

function unmaskTable(table) {
  const maskedCells = table.querySelectorAll("[data-equity-masked='1']");
  maskedCells.forEach(unmaskTextNode);
}

function maskCards(root = document) {
  if (CARDS_SET.size === 0) return;

  const cards = root.querySelectorAll("div,section,article");
  cards.forEach((card) => {
    const h = card.querySelector("h1,h2,h3,h4,h5,h6");
    if (!h) return;
    const title = norm(h.textContent);
    if (!CARDS_SET.has(title)) return;

    // ✅ Only mask the "big number" (text-2xl font-bold)
const numbers = card.querySelectorAll("p, span");
    numbers.forEach((el) => {
      if (isNumberishText(el.textContent)) {
        maskTextNode(el);
      }
    });
  });
}

function unmaskCards(root = document) {
  const masked = root.querySelectorAll("[data-equity-masked='1']");
  masked.forEach(unmaskTextNode);
}

function applyMaskToDocument() {
  const tables = document.querySelectorAll("table");
  tables.forEach(maskTable);
  maskCards(document);
}

function removeMaskFromDocument() {
  const tables = document.querySelectorAll("table");
  tables.forEach(unmaskTable);
  unmaskCards(document);
}

function startObserver() {
  if (observer) return;
  observer = new MutationObserver(() => {
    if (!masked) return;
    
    // On mobile, debounce to avoid performance hangs
    if (isMobile) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        applyMaskToDocument();
      }, 150);
    } else {
      applyMaskToDocument();
    }
  });
  
  // On mobile, only observe childList changes (not attributes/characterData)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: !isMobile,
    characterData: !isMobile,
  });
}

function readMaskedFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "false");
  } catch {
    return false;
  }
}

function writeMaskedToStorage(val) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(!!val));
  } catch {}
}

export function isEquityMasked() {
  return masked;
}

export function toggleEquityMask() {
  setEquityMasked(!masked);
}

export function setEquityMasked(val) {
  masked = !!val;
  writeMaskedToStorage(masked);
  document.body.classList.toggle("equity-mask-on", masked);
  
  if (masked) {
    // On mobile, debounce the mask application
    if (isMobile) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        applyMaskToDocument();
      }, 100);
    } else {
      applyMaskToDocument();
    }
  } else {
    removeMaskFromDocument();
  }
}

// Allow consumers to force re-apply after route/tab changes
export function reapplyEquityMask() {
  if (masked) {
    if (isMobile) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        applyMaskToDocument();
      }, 100);
    } else {
      applyMaskToDocument();
    }
  }
}

// Auto-init
(function init() {
  masked = readMaskedFromStorage();
  startObserver();
  document.body.classList.toggle("equity-mask-on", masked);
  if (masked) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", applyMaskToDocument, { once: true });
    } else {
      applyMaskToDocument();
    }
  }
})();