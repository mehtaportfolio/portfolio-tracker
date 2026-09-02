// src/GlobalPrivacyMask.js
import React, { useEffect, useRef } from "react";
import { Eye, EyeOff, RotateCcw, Upload, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import { usePrivacy } from "./context/PrivacyContext.jsx";
import { useNavigation } from "./context/NavigationContext.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { clearBackendCache } from "./api/cacheAPI.js";

const MASK_CLASS = "maskable-number";
const HIDE_CLASS = "mask-hide-when-on";
const DATA_ATTR = "data-mask-added";
const TEXT_NODE_SELECTOR = "p, td, span, div, strong, h1, h2, h3, h4, h5, h6";
const BOTTOM_BAR_SELECTOR = "[data-bottom-bar]";

const HEADERS_TO_MASK = [
  "cmp (₹)",
  "invested amount",
  "market value",
  "p/l (₹)",
  "net profit",
  "p/l %",
  "closed value",
  "net returns",
  "xirr %",
];

const CARD_TITLES_TO_MASK = new Set([
  "total stock value",
  "day's change",
  "unrealized profit",
   "net profit",
  "total etf value",
  "total equity value",
  "net returns",
]);

const LABEL_KEYWORDS = [
  "market value",
  "invested",
  "day:",
  "net profit",
   "net return",
  "irr",
  "xirr",
];

const normalize = (text = "") => text.replace(/\s+/g, " ").trim().toLowerCase();

const shouldMaskFreeText = (text) => {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  if (/\d{2,4}[-/]\d{1,2}[-/]\d{1,2}/.test(trimmed)) return false; // skip dates
  if (/\d+:\d+/.test(trimmed)) return false; // skip times
  if (trimmed.includes("₹") || trimmed.endsWith("%")) return true;

  const digitCount = (trimmed.match(/[0-9]/g) || []).length;
  const letterCount = (trimmed.match(/[A-Za-z]/g) || []).length;
  return digitCount > 0 && digitCount >= letterCount * 2;
};

const isProtectedNode = (element) => {
  if (!element) return false;
  return Boolean(
    element.closest(BOTTOM_BAR_SELECTOR) ||
    element.closest("[data-privacy-exempt]") ||
    element.closest(".privacy-exempt") ||
    element.closest("button, svg, .mask-toggle-btn") // ⬅ skip interactive elements
  );
};


const addMaskClass = (element) => {
  if (!element || isProtectedNode(element)) return;
  if (element.classList.contains(MASK_CLASS)) return;

  element.classList.add(MASK_CLASS);
  element.setAttribute(DATA_ATTR, "1");
};

const removeGeneratedMasks = (root = document) => {
  if (!root?.querySelectorAll) return;
  root
    .querySelectorAll(`[${DATA_ATTR}]`)
    .forEach((element) => {
      element.classList.remove(MASK_CLASS);
      element.removeAttribute(DATA_ATTR);
    });
};

const scrubNode = (node, { removeHideClass = false } = {}) => {
  if (!node) return;

  node.classList.remove(MASK_CLASS);
  node.removeAttribute(DATA_ATTR);

  node
    .querySelectorAll(`.${MASK_CLASS}`)
    .forEach((child) => child.classList.remove(MASK_CLASS));

  node
    .querySelectorAll(`[${DATA_ATTR}]`)
    .forEach((child) => child.removeAttribute(DATA_ATTR));

  if (removeHideClass) {
    node.classList.remove(HIDE_CLASS);
    node
      .querySelectorAll(`.${HIDE_CLASS}`)
      .forEach((child) => child.classList.remove(HIDE_CLASS));
  }
};

const ensureProtectedAreas = (root = document) => {
  if (typeof document === "undefined") return;

  scrubNode(document.querySelector(BOTTOM_BAR_SELECTOR), { removeHideClass: true });

  if (!root?.querySelectorAll) return;

  root
    .querySelectorAll("[data-privacy-exempt], .privacy-exempt")
    .forEach((node) => scrubNode(node));
};

const maskTablesByHeaders = (root = document) => {
  if (!root?.querySelectorAll) return;

  const tables = root.querySelectorAll("table");
  tables.forEach((table) => {
    const headers = Array.from(table.querySelectorAll("thead th"));
    if (!headers.length) return;

    const headerMap = headers.map((header) => normalize(header.textContent));
    const columnsToMask = HEADERS_TO_MASK.map(normalize)
      .map((name) => headerMap.indexOf(name))
      .filter((idx) => idx !== -1);

    if (!columnsToMask.length) return;

    table.querySelectorAll("tbody tr").forEach((row) => {
      columnsToMask.forEach((columnIndex) => {
        const cell = row.children[columnIndex];
        if (cell && !isProtectedNode(cell)) addMaskClass(cell);
      });
    });
  });
};

const maskFreeTextNumbers = (root = document) => {
  if (!root?.querySelectorAll) return;

  root.querySelectorAll(TEXT_NODE_SELECTOR).forEach((node) => {
    if (isProtectedNode(node)) return;

    // 🚫 Skip top-level or layout containers
    if (
      node.id === "root" ||
      node.tagName === "BODY" ||
      node.tagName === "HTML" ||
      node.classList.contains("min-h-screen") ||
      node.classList.contains("app-container")
    ) {
      return;
    }

    if (shouldMaskFreeText(node.textContent || "")) {
      addMaskClass(node);
    }
  });
};


const maskCardsByHeadings = (root = document) => {
  if (!root?.querySelectorAll) return;

  root.querySelectorAll("div, section, article").forEach((container) => {
    if (isProtectedNode(container)) return;

    const heading = container.querySelector("h1, h2, h3, h4, h5, h6");
    if (!heading) return;

    const normalizedHeading = normalize(heading.textContent);
    if (!CARD_TITLES_TO_MASK.has(normalizedHeading)) return;

    container.querySelectorAll("p, span, strong, div").forEach((element) => {
      if (isProtectedNode(element)) return;
      if (shouldMaskFreeText(element.textContent || "")) addMaskClass(element);
    });
  });
};

const maskLabeledSummaryLines = (root = document) => {
  if (!root?.querySelectorAll) return;

  root.querySelectorAll("p, span, strong").forEach((element) => {
    if (isProtectedNode(element)) return;

    const text = (element.textContent || "").trim();
    if (!text) return;

    const lower = text.toLowerCase();
    if (LABEL_KEYWORDS.some((keyword) => lower.includes(keyword))) {
      if (shouldMaskFreeText(text)) addMaskClass(element);
    }
  });
};

let isApplyingMask = false;
const applyMask = () => {
  if (typeof document === "undefined") return;

  removeGeneratedMasks(document);
  maskTablesByHeaders(document);
  maskFreeTextNumbers(document);
  maskCardsByHeadings(document);
  maskLabeledSummaryLines(document);
  ensureProtectedAreas(document);
};

const applyMaskSafely = () => {
  if (isApplyingMask) return;
  isApplyingMask = true;
  try {
    applyMask();
  } finally {
    isApplyingMask = false;
  }
};

const clearAllMasks = () => {
  if (typeof document === "undefined") return;

  removeGeneratedMasks(document);
  ensureProtectedAreas(document);
};

const injectStyles = () => {
  if (typeof document === "undefined") return () => {};

  const existing = document.getElementById("global-privacy-mask-style");
  if (existing) return () => existing.remove();

  const style = document.createElement("style");
  style.id = "global-privacy-mask-style";
  style.textContent = `
    body.mask-on .${MASK_CLASS},
    body.mask-on .${MASK_CLASS} * {
      color: transparent !important;
      text-shadow: 0 0 10px rgba(0, 0, 0, 0.6) !important;
      user-select: none !important;
    }

    .mask-controls {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .mask-toggle-btn {
      background: #c00;
      color: #fff;
      border-radius: 9999px;
      padding: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
    }

    .mask-toggle-btn:hover {
      background: #222;
    }

    .mask-import-btn {
      background: #4f46e5;
      color: #fff;
      border-radius: 9999px;
      padding: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
    }

    .mask-import-btn:hover {
      background: #4338ca;
    }

    .mask-logout-btn {
      background: #ef4444;
      color: #fff;
      border-radius: 9999px;
      padding: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
    }

    .mask-logout-btn:hover {
      background: #dc2626;
    }

    .mask-refresh-btn {
      background: #0066cc;
      color: #fff;
      border-radius: 9999px;
      padding: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
    }

    .mask-refresh-btn:hover {
      background: #0052a3;
    }

    body.mask-on .${HIDE_CLASS} {
      display: none !important;
    }

    body.mask-on ${BOTTOM_BAR_SELECTOR} {
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      filter: none !important;
    }

    body.mask-on ${BOTTOM_BAR_SELECTOR} * {
      color: inherit !important;
      text-shadow: none !important;
      user-select: auto !important;
      opacity: 1 !important;
      filter: none !important;

    body.mask-on [data-bottom-bar] {
  display: flex !important;
  visibility: visible !important;
  opacity: 1 !important;
  filter: none !important;
  pointer-events: auto !important;
  position: relative !important;
  z-index: 999 !important;
}

    }
  `;

  document.head.append(style);

  return () => {
    if (style.parentNode) style.parentNode.removeChild(style);
  };
};

const GlobalPrivacyMask = () => {
  const { isDataMasked, toggleData } = usePrivacy();
  const { signOut } = useAuth();
  const { refreshDashboard, refreshAssets, navigateToTab } = useNavigation();
  const observerRef = useRef(null);
  const debounceRef = useRef(null);
  const isMobileRef = useRef(false);

  useEffect(() => {
    // Detect mobile device
    isMobileRef.current = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return injectStyles();
  }, []);

  // Debounced mask application for mobile
  const debouncedApplyMask = (delayMs = 300) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      applyMaskSafely();
    }, delayMs);
  };

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (isDataMasked) {
      document.body.classList.add("mask-on");
      applyMaskSafely();

      // ✅ Always ensure bottom bar is visible
      ensureProtectedAreas(document);

      const bottomBar = document.querySelector("[data-bottom-bar]");
      if (bottomBar) {
        bottomBar.style.display = "flex";
        bottomBar.style.visibility = "visible";
        bottomBar.style.opacity = "1";
        bottomBar.style.filter = "none";
      }
    } else {
      document.body.classList.remove("mask-on");
      clearAllMasks();

      const bottomBar = document.querySelector("[data-bottom-bar]");
      if (bottomBar) {
        // Restore normal style if needed (optional)
        bottomBar.style.display = "";
        bottomBar.style.visibility = "";
        bottomBar.style.opacity = "";
        bottomBar.style.filter = "";
      }
    }
  }, [isDataMasked]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (!observerRef.current) {
      observerRef.current = new MutationObserver((mutations) => {
        if (!document.body.classList.contains("mask-on")) return;

        const touchesProtectedArea = mutations.some((mutation) => {
          if (isProtectedNode(mutation.target)) return true;
          return Array.from(mutation.addedNodes || []).some(
            (node) => node.nodeType === 1 && isProtectedNode(node)
          );
        });

        if (touchesProtectedArea) {
          ensureProtectedAreas(document);
        }

        // On mobile, debounce mask reapplication to avoid hangs
        if (isMobileRef.current) {
          debouncedApplyMask(200);
        } else {
          applyMaskSafely();
        }
      });

      // On mobile, observe fewer attributes to reduce observer firing
      observerRef.current.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: !isMobileRef.current, // Skip character data on mobile
        attributes: !isMobileRef.current, // Skip attribute changes on mobile
      });
    }

    return () => {
      observerRef.current?.disconnect();
      clearTimeout(debounceRef.current);
    };
  }, []);

  const handleRefresh = async () => {
    toast.loading("Refreshing data...", { id: "dashboard-refresh" });
    
    try {
      // Clear backend cache to ensure fresh data
      await clearBackendCache();
      
      // Trigger data reload across components
      refreshDashboard();
      refreshAssets();
      
      toast.success("Data refreshed!", { id: "dashboard-refresh" });
    } catch (error) {
      console.error("Refresh failed:", error);
      toast.error("Failed to refresh data", { id: "dashboard-refresh" });
    }
  };

  return (
    <div className="mask-controls">
      <button
        className="mask-import-btn"
        title="Import Data"
        onClick={() => navigateToTab("profile", "settings", "import")}
        aria-label="Import Data"
        type="button"
      >
        <Upload size={18} />
      </button>
      <button
        className="mask-logout-btn"
        title="Logout"
        onClick={signOut}
        aria-label="Logout"
        type="button"
      >
        <LogOut size={18} />
      </button>
      <button
        className="mask-refresh-btn"
        title="Refresh dashboard data"
        onClick={handleRefresh}
        aria-label="Refresh dashboard data"
        type="button"
      >
        <RotateCcw size={18} />
      </button>
      <button
        className="mask-toggle-btn"
        title="Hide values"
        onClick={toggleData}
        aria-label="Toggle hide values"
        type="button"
      >
        {isDataMasked ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
};

export default GlobalPrivacyMask;


