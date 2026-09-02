import React, { useState } from "react";
import toast from "react-hot-toast";
import { scriptLinks, openInNewTab, restartBackend, checkServiceStatus, checkDeployStatus } from "../Assets/Links.jsx";
import {
  FiRefreshCcw,
  FiDatabase,
  FiTrendingUp,
  FiServer,
} from "react-icons/fi";

const LinksScreen = () => {
  const [restartingService, setRestartingService] = useState(null);

  const handleServiceRestart = async (serviceConfig) => {
    if (restartingService) return;

    const serviceId = serviceConfig.serviceId || serviceConfig.title;
    const toastId = `${serviceId}-restart`;

    setRestartingService(serviceId);
    toast.loading(`Contacting ${serviceConfig.title} service...`, { id: toastId });

    try {
      const result = await restartBackend({
        actionUrl: serviceConfig.restartUrl || serviceConfig.url,
        method: serviceConfig.restartMethod || "POST",
        serviceId: serviceConfig.serviceId,
        url: serviceConfig.url,
        apiKey: serviceConfig.apiKey,
      });

      // Polling for Render deployment status if we have deployId
      if (result.deployId && result.serviceId) {
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
              result.serviceId, 
              result.deployId, 
              serviceConfig.apiKey
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

  // Organize links by category
  const sections = [
    {
      header: "Script",
      headerColor: "text-blue-600",
      links: [
        {
          ...scriptLinks.GStockPrices,
          icon: <FiRefreshCcw className="inline mr-2" />,
          buttonColor: "bg-orange-200 text-red-500",
        },
        {
          ...scriptLinks.GAMFI,
          icon: <FiDatabase className="inline mr-2" />,
          buttonColor: "bg-red-100 text-blue-800",
        },
        {
          ...scriptLinks.GMFNavs,
          icon: <FiTrendingUp className="inline mr-2" />,
          buttonColor: "bg-yellow-200 text-blue-900",
        },
        {
          ...scriptLinks.GNPSNavs,
          icon: <FiDatabase className="inline mr-2" />,
          buttonColor: "bg-blue-100 text-purple-800",
        },
      ],
    },
    {
      header: "URL",
      headerColor: "text-purple-600",
      links: [
        {
          ...scriptLinks.UStockPrices,
          icon: <FiRefreshCcw className="inline mr-2" />,
          buttonColor: "bg-orange-200 text-red-500",
        },
        {
          ...scriptLinks.UAMFI,
          icon: <FiDatabase className="inline mr-2" />,
          buttonColor: "bg-red-100 text-blue-800",
        },
        {
          ...scriptLinks.UMFNavs,
          icon: <FiTrendingUp className="inline mr-2" />,
          buttonColor: "bg-yellow-200 text-blue-900",
        },
        {
          ...scriptLinks.UNPSNavs,
          icon: <FiDatabase className="inline mr-2" />,
          buttonColor: "bg-blue-100 text-purple-800",
        },
        {
          ...scriptLinks.YahooPrice,
          icon: <FiRefreshCcw className="inline mr-2" />,
          buttonColor: "bg-green-100 text-green-800",
          action: () => handleServiceRestart(scriptLinks.YahooPrice),
          isRestartButton: true,
        },
        {
          ...scriptLinks.CorpAction,
          icon: <FiRefreshCcw className="inline mr-2" />,
          buttonColor: "bg-red-600 text-white",
          action: () => handleServiceRestart(scriptLinks.CorpAction),
          isRestartButton: true,
        },
      ],
    },
    {
      header: "Restart Service",
      headerColor: "text-purple-600",
      links: [
        {
          ...scriptLinks.BackendRestart,
          icon: <FiServer className="inline mr-2" />,
          buttonColor: "bg-orange-200 text-red-600",
          action: () => handleServiceRestart(scriptLinks.BackendRestart),
          isRestartButton: true,
        },
        {
          ...scriptLinks.ScriptRestart,
          icon: <FiServer className="inline mr-2" />,
          buttonColor: "bg-gray-200 text-purple-700",
          action: () => handleServiceRestart(scriptLinks.ScriptRestart),
          isRestartButton: true,
        },

        {
          ...scriptLinks.Indices,
          icon: <FiServer className="inline mr-2" />,
          buttonColor: "bg-gray-200 text-green-800",
          action: () => handleServiceRestart(scriptLinks.Indices),
          isRestartButton: true,
        },
      ],
    },
    {
      header: "Equity Page Refresh",
      headerColor: "text-green-600",
      links: [
        {
          ...scriptLinks.AngelOneFreshList,
          icon: <FiRefreshCcw className="inline mr-2" />,
          buttonColor: "bg-green-200 text-green-800",
          action: () => handleServiceRestart(scriptLinks.AngelOneFreshList),
          isRestartButton: true,
        },
        {
          ...scriptLinks.AngelOneCMP,
          icon: <FiTrendingUp className="inline mr-2" />,
          buttonColor: "bg-blue-200 text-blue-800",
          action: () => handleServiceRestart(scriptLinks.AngelOneCMP),
          isRestartButton: true,
        },
      ],
    },
  ];

  return (
    <div className="p-4 max-w-md mx-auto">
      {sections.map((section, idx) => (
        <div
          key={idx}
          className="mb-6 border border-white rounded-lg p-4 shadow-sm"
        >
          <h2 className={`text-lg font-bold mb-3 ${section.headerColor}`}>
            {section.header}
          </h2>

          <div className="flex flex-wrap gap-3">
            {section.links.map((link, i) => (
              <button
                key={i}
                onClick={link.isRestartButton ? link.action : () => openInNewTab(link.url)}
                className={`${link.buttonColor} font-semibold py-2 px-4 rounded shadow hover:opacity-90 transition flex items-center`}
                disabled={link.isRestartButton && Boolean(restartingService)}
              >
                {link.icon} {link.title}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default LinksScreen;
