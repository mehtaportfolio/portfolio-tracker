import { useMode } from "../../context/ModeContext.jsx";
import { useLivePrices } from "../../context/LivePriceContext.jsx";

export default function PriceSourceToggle() {
  const { priceSource, togglePriceSource } = useMode();
  const { isConnected, marketOpen } = useLivePrices();
  
  const getButtonConfig = () => {
    switch(priceSource) {
      case 'stock_mapping':
        return {
          label: '⚡ AO',
          color: 'bg-green-600 hover:bg-green-700',
          title: 'Price Source: Angel One (Real-time DB)'
        };
      case 'live':
        if (!marketOpen) {
          return {
            label: '📡 LIVE',
            color: 'bg-yellow-500 text-black hover:bg-yellow-600',
            title: 'Market Closed (Last Prices)'
          };
        }
        return {
          label: isConnected ? '📡 LIVE' : '📡 STOPPED',
          color: isConnected ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-600 text-white hover:bg-red-700',
          title: isConnected ? 'Price Source: Angel WebSocket (Live)' : 'Price Source: Angel WebSocket (Disconnected)'
        };
      default:
        return {
          label: '📊 GS',
          color: 'bg-blue-600 hover:bg-blue-700',
          title: 'Price Source: Stock Master (Delayed)'
        };
    }
  };

  const config = getButtonConfig();
  
  const handleToggle = () => {
    console.log(`[Toggle] Current priceSource: "${priceSource}", toggling...`);
    togglePriceSource();
  };
  
  return (
    <button
      onClick={handleToggle}
      className={`px-3 py-1 rounded-md font-semibold text-sm transition-colors ${config.color}`}
      title={config.title}
    >
      {config.label}
    </button>
  );
}
