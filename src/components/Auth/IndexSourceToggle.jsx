import { useMode } from "../../context/ModeContext.jsx";

export default function IndexSourceToggle() {
  const { indexSource, toggleIndexSource } = useMode();
  
  const isMarketIndices = indexSource === 'market_indices';
  
  const handleToggle = () => {
    console.log(`[IndexToggle] Current indexSource: "${indexSource}", toggling...`);
    toggleIndexSource();
  };
  
  return (
    <button
      onClick={handleToggle}
      className={`px-3 py-1 rounded-md font-semibold text-sm transition-colors ${
        isMarketIndices
          ? 'bg-purple-600 text-white hover:bg-purple-700'
          : 'bg-orange-600 text-white hover:bg-orange-700'
      }`}
      title={`Index Source: ${isMarketIndices ? 'Market Indices (Default)' : 'Stock Master (Manual)'}`}
    >
      {isMarketIndices ? '📈 MI' : '📊 SM'}
    </button>
  );
}
