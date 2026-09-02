// src/components/Assets/Links.js

import React, { useState } from "react";
import toast from "react-hot-toast";
import {
  FiRefreshCcw,
  FiDatabase,
  FiTrendingUp,
  FiServer,
  FiExternalLink
} from "react-icons/fi";


const GOOGLESHEET_URL = import.meta.env.VITE_GOOGLESHEET_URL;

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL;

export const scriptLinks = {
  GStockPrices: {
    title: "Stock Prices",
    url: "https://script.google.com/macros/s/AKfycbxGY9EFxEHucIdMc0LlPeOf4ZOipsMXxKH8wAsG5MhaSexnx9FyrQXBThha7QJSbE5V/exec",
  },
  GAMFI: {
    title: "AMFI",
    url: "https://script.google.com/macros/s/AKfycbxNV2oJ99--7v3j54T3odBWPsJCaxX9l5gGvRytIjSDQVxqDCVx-oI6xP3FF6zR1ARG/exec",
  },
  GMFNavs: {
    title: "MF Navs",
    url: "https://script.google.com/macros/s/AKfycbxEVEWPtIMmk6_Odc-z1FVQv1RsICJyyZC1cO9aNBHJ5YDEv6OwU-cQUdMdxXdaiZ9I/exec",
  },
  GNPSNavs: {
    title: "NPS Nav",
    url: "https://script.google.com/macros/s/AKfycbyPPXO5DGPLlSSZ4VjJAdADJL9F95Mr3jJYCJSzp0eSzx8uMJAT98_OetqKXMSolk8n/exec",
  },
  UStockPrices: {
    title: "Stock Prices",
    url: `${GOOGLESHEET_URL}/stocks`,
  },
  UAMFI: {
    title: "AMFI",
    url: `${GOOGLESHEET_URL}/amfi`,
  },
  UMFNavs: {
    title: "MF Navs",
    url: `${GOOGLESHEET_URL}/mf`,
  },
  UNPSNavs: {
    title: "NPS Nav",
    url: `${GOOGLESHEET_URL}/nps`,
  },
  BackendRestart: {
    title: "Server",
    serviceName: "backend",
    url: BACKEND_URL,
    restartUrl: `${BACKEND_URL}/restart`,
    restartMethod: "POST",
    restartedMessage: "Backend service restart triggered via Render",
    runningMessage: "Backend service is running",
  },
  ScriptRestart: {
    title: "Script",
    serviceName: "googlesheet",
    url: GOOGLESHEET_URL,
    restartUrl: `${BACKEND_URL}/googlesheet/restart`,
    restartMethod: "POST",
    restartedMessage: "Script service restart triggered via Render",
    runningMessage: "Script service is running",
  },
  Indices: {
    title: "Indices",
    restartUrl: `${BACKEND_URL}/api/nse/update-indices`,
    restartMethod: "GET",
    restartedMessage: "NSE indices updated successfully",
    runningMessage: "Backend service is running",
  },
  AngelOneFreshList: {
    title: "Fresh token",
    restartUrl: `${BACKEND_URL}/refresh-stocks`,
    restartMethod: "GET",
    restartedMessage: "Angel One symbol tokens refreshed successfully",
    runningMessage: "Angel One symbol token service is running",
  },
  AngelOneCMP: {
    title: "CMP/LCP Sync",
    restartUrl: `${BACKEND_URL}/sync`,
    restartMethod: "POST",
    restartedMessage: "Angel One sync triggered successfully",
    runningMessage: "Angel One sync service is running",
  },
  YahooPrice: {
    title: "Angel Fix",
    restartUrl: `${BACKEND_URL}/api/run-angel-fix`,
    restartMethod: "GET",
    restartedMessage: "Internal Angel Price Fix service triggered",
    runningMessage: "Backend service is running",
  },
  CorpAction: {
    title: "Corp-Action",
    restartUrl: `${BACKEND_URL}/api/run-corp-actions`,
    restartMethod: "GET",
    restartedMessage: "Corp-Action service triggered successfully",
    runningMessage: "Corp-Action service is running",
  },
  MarketIndices: {
    title: "Market Indice",
    restartUrl: `${BACKEND_URL}/sync-indices`,
    restartMethod: "POST",
    restartedMessage: "Market Indices updated",
    runningMessage: "Market Indices service is running",
    triggerIfRunning: false,
  },
};

export const openInNewTab = (url) => {
  window.open(url, "_blank");
};

export const restartBackend = async ({ actionUrl, method = "POST", serviceName, url, triggerIfRunning = false }) => {
  // 1. Check if service is already running
  if (url) {
    try {
      const status = await checkServiceStatus(url);
      if (status.ok) {
        if (triggerIfRunning) {
          await fetch(actionUrl, { method });
          return {
            status: 200,
            message: "Service triggered successfully",
          };
        }
        return {
          status: 200,
          message: "Service is already running",
          alreadyRunning: true,
        };
      }
    } catch (e) {
      console.log("Service check failed, proceeding with restart...", e.message);
    }
  }

  // 2. Clear Application Cache first
  try {
    await fetch(actionUrl, { method });
  } catch (e) {
    console.warn("Failed to clear app cache, proceeding with Render restart", e);
  }

  // 3. Trigger Render Deploy/Restart if serviceName is provided
  if (serviceName) {
    const renderResponse = await fetch(
      `${BACKEND_URL}/api/render/deploy`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ serviceName, clearCache: "clear" }),
      }
    );

    if (!renderResponse.ok) {
      const errorData = await renderResponse.json();
      throw new Error(errorData.message || "Failed to trigger Render restart");
    }

    const deployData = await renderResponse.json();
    return {
      status: renderResponse.status,
      message: "Service restart initiated on Render",
      deployId: deployData.id || deployData.deploy?.id,
      serviceName,
    };
  }

  // Fallback for non-Render restarts (e.g., just clearing cache)
  const response = await fetch(actionUrl, { method });
  const contentType = response.headers.get("content-type") || "";
  let payload;

  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  // If we get HTML back, it's likely a redirect to the frontend or an error page
  const isHtml = contentType.includes("text/html") || (typeof payload === "string" && payload.trim().startsWith("<!DOCTYPE"));

  if (!response.ok || isHtml) {
    const message = (typeof payload === "string" && !isHtml) ? payload : payload?.error || payload?.message;
    const error = new Error(message || "Failed to restart service");
    error.status = response.status;
    throw error;
  }

  return {
    status: response.status,
    message: (typeof payload === "string" ? payload : payload?.message || payload?.status) || null,
  };
};

export const checkServiceStatus = async (url) => {
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") || "";
    let payload;

    if (contentType.includes("application/json")) {
      payload = await response.json();
    } else {
      payload = await response.text();
    }

    // If we get HTML back, it's likely a redirect to the frontend or an error page
    const isHtml = contentType.includes("text/html") || (typeof payload === "string" && payload.trim().startsWith("<!DOCTYPE"));

    const rawMessage =
      (typeof payload === "string" ? payload : payload?.message || payload?.status) || null;

    const cleanedMessage =
      typeof rawMessage === "string" && rawMessage.length > 160
        ? null
        : rawMessage;

    return {
      status: response.status,
      ok: response.ok && !isHtml,
      message: cleanedMessage,
    };
  } catch (error) {
    const serviceError = new Error(error?.message || "Service unreachable");
    serviceError.status = error?.status;
    throw serviceError;
  }
};

export const checkDeployStatus = async (serviceName, deployId) => {
  try {
    const url = new URL(`${BACKEND_URL}/api/render/deploy/${serviceName}/${deployId}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch deploy status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error checking deploy status:", error);
    throw error;
  }
};

const Links = () => {
  const [restartingService, setRestartingService] = useState(null);

  const handleServiceRestart = async (serviceConfig) => {
    if (restartingService) return;

    const serviceName = serviceConfig.serviceName || serviceConfig.title;
    const toastId = `${serviceName}-restart`;

    setRestartingService(serviceName);
    toast.loading(`Contacting ${serviceConfig.title} service...`, {
      id: toastId,
      style: {
        borderRadius: "12px",
        background: "#333",
        color: "#fff",
      },
    });

    try {
      const result = await restartBackend({
        actionUrl: serviceConfig.restartUrl || serviceConfig.url,
        method: serviceConfig.restartMethod || "POST",
        serviceName: serviceConfig.serviceName,
        url: serviceConfig.url,
        triggerIfRunning: serviceConfig.triggerIfRunning,
      });

      // Polling for Render deployment status if we have deployId
      if (result.deployId && result.serviceName) {
        let isComplete = false;
        let lastStatus = "";
        const maxAttempts = 60; // 5 minutes with 5s polling
        let attempts = 0;

        while (!isComplete && attempts < maxAttempts) {
          attempts++;
          try {
            // Wait 5 seconds between polls
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const deployInfo = await checkDeployStatus(
              result.serviceName, 
              result.deployId
            );
            
            const status = deployInfo.status || deployInfo.deploy?.status;
            
            if (status !== lastStatus) {
              lastStatus = status;
              const statusMap = {
                'created': 'Deployment created...',
                'build_in_progress': 'Build in progress...',
                'update_in_progress': 'Updating service...',
                'live': 'Service is LIVE! ✅',
                'deactivated': 'Deployment deactivated',
                'failed': 'Deployment FAILED! ❌',
                'canceled': 'Deployment canceled',
                'pre_deploy_in_progress': 'Pre-deploy in progress...',
              };
              
              const statusMsg = statusMap[status] || `Status: ${status}`;
              toast.loading(`${serviceConfig.title}: ${statusMsg}`, { id: toastId });
              
              if (['live', 'failed', 'canceled', 'deactivated'].includes(status)) {
                isComplete = true;
                if (status === 'live') {
                  toast.success(`${serviceConfig.title}: ${statusMsg}`, { id: toastId });
                } else {
                  toast.error(`${serviceConfig.title}: ${statusMsg}`, { id: toastId });
                }
              }
            }
          } catch (pollError) {
            console.error("Polling error:", pollError);
            // Don't break the loop on a single poll error, retry
          }
        }
      } else {
        const message =
          result?.message ||
          serviceConfig.restartedMessage ||
          `${serviceConfig.title} service restarted`;

        toast.success(message, { id: toastId });
      }
    } catch (error) {
      try {
        const statusResult = await checkServiceStatus(serviceConfig.url);
        const fallbackMessage =
          serviceConfig.runningMessage || `${serviceConfig.title} service is running`;
        const runningMessage = statusResult?.ok && statusResult?.message
          ? statusResult.message
          : `${fallbackMessage}${statusResult?.status ? ` (status ${statusResult.status})` : ""}`;

        toast.success(runningMessage, { id: toastId });
      } catch (healthError) {
        const errorMessage =
          healthError?.message || error?.message || `Failed to restart ${serviceConfig.title}`;
        toast.error(errorMessage, { id: toastId });
      }
    } finally {
      setRestartingService(null);
    }
  };

  const sections = [
    {
      header: "App Script",
      icon: <FiDatabase className="text-blue-400" />,
      links: [
        { ...scriptLinks.GStockPrices, icon: <FiRefreshCcw />, color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
        { ...scriptLinks.GAMFI, icon: <FiDatabase />, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
        { ...scriptLinks.GMFNavs, icon: <FiTrendingUp />, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
        { ...scriptLinks.GNPSNavs, icon: <FiDatabase />, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
      ],
    },
    {
      header: "Server URLs",
      icon: <FiExternalLink className="text-purple-400" />,
      links: [
        { ...scriptLinks.UStockPrices, icon: <FiRefreshCcw />, color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
        { ...scriptLinks.UAMFI, icon: <FiDatabase />, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
        { ...scriptLinks.UMFNavs, icon: <FiTrendingUp />, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
        { ...scriptLinks.UNPSNavs, icon: <FiDatabase />, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
      ],
    },
    {
      header: "Equity updates",
      icon: <FiServer className="text-red-400" />,
      links: [
        {
          ...scriptLinks.BackendRestart,
          icon: <FiServer />,
          color: "bg-red-500/20 text-red-400 border-red-500/30",
          action: () => handleServiceRestart(scriptLinks.BackendRestart),
          isRestartButton: true,
        },
        {
          ...scriptLinks.ScriptRestart,
          icon: <FiServer />,
          color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
          action: () => handleServiceRestart(scriptLinks.ScriptRestart),
          isRestartButton: true,
        },
        {
          ...scriptLinks.Indices,
          icon: <FiServer />,
          color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
          action: () => handleServiceRestart(scriptLinks.Indices),
          isRestartButton: true,
        },
        {
          ...scriptLinks.YahooPrice,
          icon: <FiRefreshCcw />,
          color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
          action: () => handleServiceRestart(scriptLinks.YahooPrice),
          isRestartButton: true,
        },
        {
          ...scriptLinks.CorpAction,
          icon: <FiRefreshCcw />,
          color: "bg-rose-500/20 text-rose-400 border-rose-500/30",
          action: () => {
            const days = window.prompt("Enter number of days for Corporate Action sync:", "30");
            if (days !== null) {
              const numDays = parseInt(days) || 30;
              handleServiceRestart({
                ...scriptLinks.CorpAction,
                restartUrl: `${scriptLinks.CorpAction.restartUrl}?days=${numDays}`,
                restartedMessage: `Corp-Action sync for ${numDays} days triggered successfully`
              });
            }
          },
          isRestartButton: true,
        },
        {
          ...scriptLinks.MarketIndices,
          icon: <FiTrendingUp />,
          color: "bg-sky-500/20 text-sky-400 border-sky-500/30",
          action: () => handleServiceRestart(scriptLinks.MarketIndices),
          isRestartButton: true,
        },
      ],
    },
    {
      header: "Angel one Server",
      icon: <FiTrendingUp className="text-emerald-400" />,
      links: [
        {
          ...scriptLinks.AngelOneCMP,
          title: "CMP/LCP Sync",
          icon: <FiTrendingUp />,
          color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
          action: () => handleServiceRestart(scriptLinks.AngelOneCMP),
          isRestartButton: true,
        },
        {
          ...scriptLinks.AngelOneFreshList,
          title: "Fresh token",
          icon: <FiRefreshCcw />,
          color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
          action: () => handleServiceRestart(scriptLinks.AngelOneFreshList),
          isRestartButton: true,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#1c1c1e] text-gray-100 p-4 sm:p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        {sections.map((section, idx) => (
          <div
            key={idx}
            className="bg-[#2c2c2e] rounded-3xl overflow-hidden shadow-2xl border border-white/5"
          >
            <div className="px-6 py-5 flex items-center space-x-3 border-b border-white/5">
              <span className="text-xl">{section.icon}</span>
              <h2 className="text-lg font-bold tracking-tight text-white/90">
                {section.header}
              </h2>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {section.links.map((link, i) => (
                  <button
                    key={i}
                    onClick={link.isRestartButton ? link.action : () => openInNewTab(link.url)}
                    disabled={link.isRestartButton && Boolean(restartingService)}
                    className={`
                      ${link.color}
                      group relative flex items-center justify-between p-4 rounded-2xl
                      border backdrop-blur-sm transition-all duration-300
                      hover:scale-[1.02] active:scale-95 shadow-lg
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-lg group-hover:rotate-12 transition-transform duration-300">
                        {link.icon}
                      </span>
                      <span className="font-semibold text-sm whitespace-nowrap">
                        {link.title}
                      </span>
                    </div>
                    {link.isRestartButton ? (
                      <FiRefreshCcw className={`text-xs ${restartingService === (link.serviceId || link.title) ? "animate-spin" : "opacity-40"}`} />
                    ) : (
                      <FiExternalLink className="text-xs opacity-40 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Links;
