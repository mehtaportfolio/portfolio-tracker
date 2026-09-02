import PropTypes from "prop-types";
import { memo, useMemo, useState } from "react";
import { useNavigation } from "../../context/NavigationContext.jsx";

const DEFAULT_ASSET_ROWS = [
  {
    assetType: "Stock",
    marketValue: 0,
    marketAllocation: 0,
    investedValue: 0,
    investedAllocation: 0,
    simpleProfit: 0,
    simpleProfitPercent: 0,
  },
  {
    assetType: "ETF",
    marketValue: 0,
    marketAllocation: 0,
    investedValue: 0,
    investedAllocation: 0,
    simpleProfit: 0,
    simpleProfitPercent: 0,
  },
  {
    assetType: "MF",
    marketValue: 0,
    marketAllocation: 0,
    investedValue: 0,
    investedAllocation: 0,
    simpleProfit: 0,
    simpleProfitPercent: 0,
  },
  {
    assetType: "PPF",
    marketValue: 0,
    marketAllocation: 0,
    investedValue: 0,
    investedAllocation: 0,
    simpleProfit: 0,
    simpleProfitPercent: 0,
  },
  {
    assetType: "FD",
    marketValue: 0,
    marketAllocation: 0,
    investedValue: 0,
    investedAllocation: 0,
    simpleProfit: 0,
    simpleProfitPercent: 0,
  },
  {
    assetType: "NPS",
    marketValue: 0,
    marketAllocation: 0,
    investedValue: 0,
    investedAllocation: 0,
    simpleProfit: 0,
    simpleProfitPercent: 0,
  },
  {
    assetType: "Bank",
    marketValue: 0,
    marketAllocation: 0,
    investedValue: 0,
    investedAllocation: 0,
    simpleProfit: 0,
    simpleProfitPercent: 0,
  },
  {
    assetType: "EPF",
    marketValue: 0,
    marketAllocation: 0,
    investedValue: 0,
    investedAllocation: 0,
    simpleProfit: 0,
    simpleProfitPercent: 0,
  },
];

const numberFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-IN", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const formatCurrency = (value) => numberFormatter.format(Number(value) || 0);
const formatPercent = (value) => percentFormatter.format((Number(value) || 0) / 100);

const TABLE_COLUMNS = [
  { key: "assetType", label: "Asset Type" },
  { key: "marketValue", label: "Market Value" },
  { key: "marketAllocation", label: "Market %" },
  { key: "investedValue", label: "Invested Value" },
  { key: "investedAllocation", label: "Invest %" },
  { key: "simpleProfit", label: "P/L" },
  { key: "simpleProfitPercent", label: "P/L %" },
];

const SORT_CONFIG = {
  defaultKey: "marketValue",
  defaultDirection: "desc",
  order: ["desc", "asc"],
};

const isNumericColumn = (key) => key !== "assetType";

const compareValues = (a, b, key) => {
  const valueA = isNumericColumn(key) ? Number(a[key]) || 0 : String(a[key] ?? "");
  const valueB = isNumericColumn(key) ? Number(b[key]) || 0 : String(b[key] ?? "");

  if (isNumericColumn(key)) {
    return valueA - valueB;
  }

  return valueA.localeCompare(valueB, undefined, { sensitivity: "base" });
};

function TableRow({
  assetType,
  marketValue,
  marketAllocation,
  investedValue,
  investedAllocation,
  simpleProfit,
  simpleProfitPercent,
  onClick,
}) {
  return (
    <tr onClick={onClick} className="cursor-pointer hover:bg-orange-200">
      <td className="whitespace-nowrap px-4 py-3 font-bold text-blue-800">
        {assetType}
      </td>
      <td className="px-4 py-3">{formatCurrency(marketValue)}</td>
      <td className="px-4 py-3">{formatPercent(marketAllocation)}</td>
      <td className="px-4 py-3">{formatCurrency(investedValue)}</td>
      <td className="px-4 py-3">{formatPercent(investedAllocation)}</td>
      <td className="px-4 py-3">{formatCurrency(simpleProfit)}</td>
      <td className="px-4 py-3">{formatPercent(simpleProfitPercent)}</td>
    </tr>
  );
}

TableRow.propTypes = {
  assetType: PropTypes.string.isRequired,
  marketValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  marketAllocation: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  investedValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  investedAllocation: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  simpleProfit: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  simpleProfitPercent: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  onClick: PropTypes.func,
};

function AssetsTable({ rows = DEFAULT_ASSET_ROWS }) {
  const { navigateToAsset } = useNavigation();
  const [sortState, setSortState] = useState({
    key: SORT_CONFIG.defaultKey,
    direction: SORT_CONFIG.defaultDirection,
  });

  const handleSort = (columnKey) => {
    setSortState((prev) => {
      const isSameColumn = prev.key === columnKey;
      const nextDirection = isSameColumn && prev.direction === SORT_CONFIG.order[0]
        ? SORT_CONFIG.order[1]
        : SORT_CONFIG.order[0];

      return {
        key: columnKey,
        direction: nextDirection,
      };
    });
  };

  const getAssetKey = (assetType) => {
    switch (assetType) {
      case "Stock":
        return { type: "stock", subTab: null };
      case "ETF":
        return { type: "stock", subTab: "etf" };
      case "MF":
        return { type: "mf", subTab: null };
      case "PPF":
      case "FD":
        return { type: "ppf", subTab: null };
      case "NPS":
        return { type: "nps", subTab: null };
      case "Bank":
        return { type: "bank", subTab: null };
      case "EPF":
        return { type: "epf", subTab: null };
      default:
        return { type: null, subTab: null };
    }
  };

  const preparedRows = useMemo(() => {
    const cleanRows = (rows.length ? rows : DEFAULT_ASSET_ROWS).map((row) => ({
      ...row,
      marketValue: Number(row.marketValue) || 0,
      marketAllocation: Number(row.marketAllocation) || 0,
      investedValue: Number(row.investedValue) || 0,
      investedAllocation: Number(row.investedAllocation) || 0,
      simpleProfit: Number(row.simpleProfit) || 0,
      simpleProfitPercent: Number(row.simpleProfitPercent) || 0,
      onClick: () => {
        const { type, subTab } = getAssetKey(row.assetType);
        if (type) navigateToAsset(type, subTab);
      },
    }));

    const sortedRows = [...cleanRows].sort((a, b) => {
      const comparison = compareValues(a, b, sortState.key);
      return sortState.direction === "asc" ? comparison : -comparison;
    });

    return sortedRows;
  }, [rows, navigateToAsset, sortState]);

  const renderSortIcon = (columnKey) => {
    if (sortState.key !== columnKey) {
      return <span className="ml-1 text-xs opacity-60">⇅</span>;
    }
    return sortState.direction === "asc" ? (
      <span className="ml-1 text-xs">↑</span>
    ) : (
      <span className="ml-1 text-xs">↓</span>
    );
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
      <table className="min-w-full divide-y divide-slate-800 bg-white text-sm">
        <thead className="bg-blue-500 text-left text-xs font-semibold tracking-wider text-white">
          <tr>
            {TABLE_COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="px-4 py-3 select-none"
                onClick={() => handleSort(column.key)}
              >
                <div className="flex items-center">
                  {column.label}
                  {renderSortIcon(column.key)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-slate-700">
          {preparedRows.map((row) => (
            <TableRow key={row.assetType} {...row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

AssetsTable.propTypes = {
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      assetType: PropTypes.string.isRequired,
      marketValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      marketAllocation: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      investedValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      investedAllocation: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      simpleProfit: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      simpleProfitPercent: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    })
  ),
};

export default memo(AssetsTable);