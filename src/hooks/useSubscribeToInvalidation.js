import { useEffect } from "react";

export const useSubscribeToInvalidation = (assetType, onRefresh) => {
  useEffect(() => {
    if (!assetType || !onRefresh) return;

    const handleEvent = (e) => {
      if (e.detail?.assetType === assetType) {
        onRefresh();
      }
    };

    window.addEventListener('portfolio-cache-invalidated', handleEvent);
    return () => window.removeEventListener('portfolio-cache-invalidated', handleEvent);
  }, [assetType, onRefresh]);
};