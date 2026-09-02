import React from "react";
import { X } from "lucide-react";

const WatchlistStocks = ({ stocks, onRemove }) => {
  if (!stocks || stocks.length === 0) {
    return <p className="text-gray-500">No stocks in this watchlist.</p>;
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-gray-100">
          <th className="p-2">Stock</th>
          <th className="p-2">CMP</th>
          <th className="p-2">LCP</th>
          <th className="p-2">% Change</th>
          <th className="p-2">Action</th>
        </tr>
      </thead>
      <tbody>
        {stocks.map((s) => {
          const color =
            s.change > 0 ? "text-green-600" : s.change < 0 ? "text-red-600" : "text-gray-600";

          return (
            <tr key={s.stock_name} className="border-t">
              <td className="p-2">{s.stock_name}</td>
              <td className={`p-2 ${color}`}>{s.cmp ?? "-"}</td>
              <td className="p-2">{s.lcp ?? "-"}</td>
              <td className={`p-2 ${color}`}>
                {s.change !== null ? s.change.toFixed(2) + "%" : "-"}
              </td>
              <td className="p-2">
                <button
                  onClick={() => onRemove(s.stock_name)}
                  className="text-red-600 hover:text-red-800"
                >
                  <X size={18} />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default WatchlistStocks;
