import React, { useState, useEffect } from "react";
import { stockAPI } from "../../../api/stockAPI.js";
import { Search, Edit2, Check, X, RotateCcw, AlertTriangle } from "lucide-react";

const StockMaster = () => {
  const [stockMaster, setStockMaster] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStock, setSelectedStock] = useState(null);
  const [filteredStocks, setFilteredStocks] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchFilterType, setSearchFilterType] = useState("stock");
  const [sectorOptions, setSectorOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [industryOptions, setIndustryOptions] = useState([]);
  const [macroSectorOptions, setMacroSectorOptions] = useState([]);
  const [knownSectorOptions, setKnownSectorOptions] = useState([]);
  const [basicIndustryOptions, setBasicIndustryOptions] = useState([]);
  const [editingField, setEditingField] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [incompleteStocks, setIncompleteStocks] = useState([]);
  const [modalEditingStock, setModalEditingStock] = useState(null);
  const [modalEditValues, setModalEditValues] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [modalBasicIndustryConfirmed, setModalBasicIndustryConfirmed] = useState("");
  const [stockSymbolsCache, setStockSymbolsCache] = useState(null);
  const symbolFetchRef = React.useRef(null);

  // Fetch all stock master data
  const fetchStockMaster = async () => {
    try {
      const { data } = await stockAPI.fetchStockMaster();
      setStockMaster(data || []);
    } catch (error) {
      console.error("Error fetching stock master:", error);
    }
  };

  // Fetch distinct values for dropdowns
  const fetchOptions = async () => {
    try {
      const fields = ["sector", "category", "industry", "macro_sector", "known_sector", "basic_industry"];
      const options = {};
      
      for (const field of fields) {
        const { data } = await stockAPI.fetchDistinctValues(field);
        options[field] = data || [];
      }

      setSectorOptions(options.sector);
      setCategoryOptions(options.category);
      setIndustryOptions(options.industry);
      setMacroSectorOptions(options.macro_sector);
      setKnownSectorOptions(options.known_sector);
      setBasicIndustryOptions(options.basic_industry);
    } catch (error) {
      console.error("Error fetching options:", error);
    }
  };

  useEffect(() => {
    fetchStockMaster();
    fetchOptions();
  }, []);

  // Handle search input change
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.length > 0) {
      let filtered = [];
      
      if (searchFilterType === "stock") {
        filtered = stockMaster.filter(stock =>
          stock.stock_name && stock.stock_name.toLowerCase().includes(query.toLowerCase())
        );
      } else if (searchFilterType === "industry") {
        filtered = stockMaster.filter(stock =>
          stock.industry && stock.industry.toLowerCase().includes(query.toLowerCase())
        );
      } else if (searchFilterType === "sector") {
        filtered = stockMaster.filter(stock =>
          stock.sector && stock.sector.toLowerCase().includes(query.toLowerCase())
        );
      } else if (searchFilterType === "macro_sector") {
        filtered = stockMaster.filter(stock =>
          stock.macro_sector && stock.macro_sector.toLowerCase().includes(query.toLowerCase())
        );
      } else if (searchFilterType === "known_sector") {
        filtered = stockMaster.filter(stock =>
          stock.known_sector && stock.known_sector.toLowerCase().includes(query.toLowerCase())
        );
      } else if (searchFilterType === "basic_industry") {
        filtered = stockMaster.filter(stock =>
          stock.basic_industry && stock.basic_industry.toLowerCase().includes(query.toLowerCase())
        );
      } else if (searchFilterType === "category") {
        filtered = stockMaster.filter(stock =>
          stock.category && stock.category.toLowerCase().includes(query.toLowerCase())
        );
      }
      
      setFilteredStocks(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredStocks([]);
      setShowSuggestions(false);
    }
  };

  // Handle stock selection
  const handleStockSelect = (stock) => {
    setSelectedStock(stock);
    setSearchQuery(stock.stock_name);
    setShowSuggestions(false);
    setEditingField(null);
    setEditValues({});
  };

  // Handle edit button click
  const handleEdit = (field) => {
    setEditingField(field);
    setEditValues({
      sector: selectedStock.sector || "",
      industry: selectedStock.industry || "",
      category: selectedStock.category || "",
      macro_sector: selectedStock.macro_sector || "",
      known_sector: selectedStock.known_sector || "",
      basic_industry: selectedStock.basic_industry || "",
      equity_type: selectedStock.equity_type || "",
      symbol_token: selectedStock.symbol_token || "",
      exchange: selectedStock.exchange || "nse"
    });
  };

  // Handle save edit
  const handleSave = async () => {
    try {
      await stockAPI.updateStockMaster(selectedStock.symbol || selectedStock.stock_name, editValues);
      
      // Update local state
      setSelectedStock({ ...selectedStock, ...editValues });
      setStockMaster(stockMaster.map(stock =>
        stock.stock_name === selectedStock.stock_name
          ? { ...stock, ...editValues }
          : stock
      ));
      setEditingField(null);
      setEditValues({});
      // Refresh options in case new values were added
      fetchOptions();
    } catch (error) {
      alert("Error updating stock: " + error.message);
    }
  };

  // Handle cancel edit
  const handleCancel = () => {
    setEditingField(null);
    setEditValues({});
  };

  // Handle reset
  const handleReset = () => {
    setSelectedStock(null);
    setSearchQuery("");
    setSearchFilterType("stock");
    setFilteredStocks([]);
    setShowSuggestions(false);
    setEditingField(null);
    setEditValues({});
  };

  // Fetch stocks with incomplete data (missing sector, industry, macro_sector, known_sector, basic_industry, or category)
  const fetchIncompleteStocks = async () => {
    try {
      const { data } = await stockAPI.fetchIncompleteStockMaster();
      setIncompleteStocks(data || []);
    } catch (error) {
      console.error("Error fetching incomplete stocks:", error);
    }
  };

  // Handle opening incomplete stocks modal
  const handleOpenIncompleteModal = () => {
    fetchIncompleteStocks();
    setShowIncompleteModal(true);
  };

  // Handle closing incomplete stocks modal
  const handleCloseIncompleteModal = () => {
    setShowIncompleteModal(false);
    setModalEditingStock(null);
    setModalEditValues({});
  };

  // Handle edit in modal
  const handleModalEdit = (stock) => {
    setModalEditingStock(stock);
    setModalEditValues({
      sector: stock.sector || "",
      industry: stock.industry || "",
      category: stock.category || "",
      macro_sector: stock.macro_sector || "",
      known_sector: stock.known_sector || "",
      basic_industry: stock.basic_industry || "",
      equity_type: stock.equity_type || "",
      symbol_token: stock.symbol_token || "",
      exchange: stock.exchange || "nse"
    });
    setShowEditModal(true);
    // initialize confirmed basic industry to existing value
    setModalBasicIndustryConfirmed(stock.basic_industry || "");
  };

  // Handle save in modal
  const handleModalSave = async () => {
    try {
      await stockAPI.updateStockMaster(modalEditingStock.symbol || modalEditingStock.stock_name, modalEditValues);
      
      // Update local state
      setIncompleteStocks(incompleteStocks.map(stock =>
        stock.stock_name === modalEditingStock.stock_name
          ? { ...stock, ...modalEditValues }
          : stock
      ));
      setModalEditingStock(null);
      setModalEditValues({});
      setShowEditModal(false);
      // Refresh options in case new values were added
      fetchOptions();
      // Refresh main stock master data
      fetchStockMaster();
    } catch (error) {
      alert("Error updating stock: " + error.message);
    }
  };

  // Handle cancel in modal
  const handleModalCancel = () => {
    setModalEditingStock(null);
    setModalEditValues({});
    setShowEditModal(false);
    setModalBasicIndustryConfirmed("");
  };

  // Handle close edit modal
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setModalEditingStock(null);
    setModalEditValues({});
    setModalBasicIndustryConfirmed("");
  };

  // Handle modal edit change
  const handleModalEditChange = (field, value) => {
    setModalEditValues(prev => ({ ...prev, [field]: value }));
  };

  // confirm basic industry (called on Enter or onBlur)
  const confirmModalBasicIndustry = () => {
    const v = modalEditValues.basic_industry || "";
    setModalBasicIndustryConfirmed(v.toString().trim());
  };

  // Fetch stock symbols cache when needed
  const ensureStockSymbols = React.useCallback(async () => {
    if (stockSymbolsCache) return stockSymbolsCache;
    try {
      const { data } = await stockAPI.fetchStockSymbols();
      if (data) {
        setStockSymbolsCache(data);
        return data;
      }
    } catch (err) {
      console.error('Error fetching stock symbols:', err);
    }
    return null;
  }, [stockSymbolsCache]);

  const findSymbolToken = React.useCallback((data, name, exch) => {
    if (!data || !name) return null;
    const targetName = String(name).trim().toLowerCase();
    const targetExch = exch ? String(exch).trim().toLowerCase() : null;

    let match = data.find((item) => {
      const n = (item.name || item.stock_name || item.symbol || item.symbol_gs || item.symbol_ao || "").toString().trim().toLowerCase();
      const e = (item.exchange || item.exch || item.market || "").toString().trim().toLowerCase();
      if (targetExch && e && e !== targetExch) return false;
      return n === targetName;
    });

    if (!match) {
      match = data.find((item) => {
        const n = (item.name || item.stock_name || item.symbol || "").toString().trim().toLowerCase();
        const e = (item.exchange || item.exch || item.market || "").toString().trim().toLowerCase();
        if (targetExch && e && e !== targetExch) return false;
        return n.includes(targetName) || targetName.includes(n);
      });
    }

    if (!match) return null;
    return (match.symbol_token || match.token || match.symbol || match.symbol_ao || match.symbol_gs || match.id || null);
  }, []);

  // Auto-populate modal symbol_token when modalEditingStock or exchange changes (debounced)
  React.useEffect(() => {
    if (!modalEditingStock) return;
    if (symbolFetchRef.current) clearTimeout(symbolFetchRef.current);
    symbolFetchRef.current = setTimeout(async () => {
      try {
        const data = await ensureStockSymbols();
        const token = findSymbolToken(data, modalEditingStock.stock_name, modalEditValues.exchange || modalEditingStock.exchange);
        if (token && (!modalEditValues.symbol_token || modalEditValues.symbol_token.trim() === "")) {
          setModalEditValues(prev => ({ ...prev, symbol_token: token }));
        }
      } catch (err) {
        // ignore
      }
    }, 350);
    return () => {
      if (symbolFetchRef.current) clearTimeout(symbolFetchRef.current);
    };
  }, [modalEditingStock, modalEditValues.exchange, modalEditValues.symbol_token, ensureStockSymbols, findSymbolToken]);

  // helper to create a stable key for list items
  const makeKey = (item, idx) => {
    if (!item) return `idx-${idx}`;
    if (typeof item === 'string' || typeof item === 'number') return String(item);
    return String(item.stock_name || item.symbol || item.symbol_token || item.id || `idx-${idx}`);
  };

  // Auto-populate sector, industry, macro_sector and known_sector when basic_industry is chosen in modal
  // Auto-populate when the confirmed basic industry changes (Enter or blur)
  React.useEffect(() => {
    const biRaw = modalBasicIndustryConfirmed || "";
    const bi = biRaw.toString().trim();
    if (!bi || !stockMaster || stockMaster.length === 0) return;

    const normalize = (s) => (s || "").toString().trim().toLowerCase().replace(/\s+/g, ' ');
    const biNorm = normalize(bi);

    // Exact matches first
    let matches = stockMaster.filter(m => m && m.basic_industry && normalize(m.basic_industry) === biNorm);

    // If no exact, try contains (master contains entered or entered contains master)
    if ((!matches || matches.length === 0) && biNorm.length > 2) {
      matches = stockMaster.filter(m => {
        if (!m || !m.basic_industry) return false;
        const mn = normalize(m.basic_industry);
        return mn.includes(biNorm) || biNorm.includes(mn);
      });
    }

    if (!matches || matches.length === 0) return;

    // Pick the record with most fields populated
    matches.sort((a, b) => {
      const score = (r) => ['sector','industry','macro_sector','known_sector'].reduce((s,f)=> s + (r && r[f] ? 1:0), 0);
      return score(b) - score(a);
    });
    const best = matches[0] || {};

    const suggestedSector = best.sector || "";
    const suggestedIndustry = best.industry || "";
    const suggestedMacro = best.macro_sector || "";
    const suggestedKnown = best.known_sector || "";

    setModalEditValues(prev => ({
      ...prev,
      // if modal fields are empty, populate; if they are empty strings or null, replace
      sector: (prev.sector && prev.sector.toString().trim() !== "") ? prev.sector : (suggestedSector || prev.sector),
      industry: (prev.industry && prev.industry.toString().trim() !== "") ? prev.industry : (suggestedIndustry || prev.industry),
      macro_sector: (prev.macro_sector && prev.macro_sector.toString().trim() !== "") ? prev.macro_sector : (suggestedMacro || prev.macro_sector),
      known_sector: (prev.known_sector && prev.known_sector.toString().trim() !== "") ? prev.known_sector : (suggestedKnown || prev.known_sector),
    }));
  }, [modalBasicIndustryConfirmed, stockMaster]);




  // Handle input change during edit
  const handleEditChange = (field, value) => {
    setEditValues(prev => ({ ...prev, [field]: value }));
  };



  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl text-yellow-300 font-bold">Stock Master</h2>
        <button
          onClick={handleOpenIncompleteModal}
          className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 flex items-center gap-2"
        >
          <AlertTriangle size={16} />
          Incomplete Stocks
        </button>
      </div>

      {/* Search Section */}
      <div className="mb-6 relative">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <select
              value={searchFilterType}
              onChange={(e) => {
                setSearchFilterType(e.target.value);
                setSearchQuery("");
                setFilteredStocks([]);
                setShowSuggestions(false);
              }}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="stock">Search by Stock</option>
              <option value="industry">Search by Industry</option>
              <option value="sector">Search by Sector</option>
              <option value="macro_sector">Search by Macro Sector</option>
              <option value="known_sector">Search by Known Sector</option>
              <option value="basic_industry">Search by Basic Industry</option>
              <option value="category">Search by Category</option>
            </select>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 flex items-center gap-2"
            >
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder={
                  searchFilterType === "stock" ? "Search stock by name..." :
                  searchFilterType === "industry" ? "Search by industry..." :
                  searchFilterType === "sector" ? "Search by sector..." :
                  searchFilterType === "macro_sector" ? "Search by macro sector..." :
                  searchFilterType === "known_sector" ? "Search by known sector..." :
                  searchFilterType === "basic_industry" ? "Search by basic industry..." :
                  "Search by category..."
                }
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showSuggestions && filteredStocks.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                  {filteredStocks.slice(0, 100).map((stock, _idx) => (
                    <div
                      key={makeKey(stock, _idx)}
                      onClick={() => handleStockSelect(stock)}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      <div className="font-medium">{stock.stock_name}</div>
                      <div className="text-xs text-gray-500">
                        {searchFilterType === "stock" ? (
                          <>
                            {stock.equity_type ? `Type: ${stock.equity_type}` : "Type: -"}
                            {stock.symbol_token ? ` • Token: ${stock.symbol_token}` : ""}
                          </>
                        ) : searchFilterType === "industry" ? `Industry: ${stock.industry || "-"}` :
                         searchFilterType === "sector" ? `Sector: ${stock.sector || "-"}` :
                         searchFilterType === "macro_sector" ? `Macro Sector: ${stock.macro_sector || "-"}` :
                         searchFilterType === "known_sector" ? `Known Sector: ${stock.known_sector || "-"}` :
                         searchFilterType === "basic_industry" ? `Basic Industry: ${stock.basic_industry || "-"}` :
                         `Category: ${stock.category || "-"}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                const stock = stockMaster.find(s => {
                  if (searchFilterType === "stock") {
                    return s.stock_name && s.stock_name.toLowerCase() === searchQuery.toLowerCase();
                  } else if (searchFilterType === "industry") {
                    return s.industry && s.industry.toLowerCase() === searchQuery.toLowerCase();
                  } else if (searchFilterType === "sector") {
                    return s.sector && s.sector.toLowerCase() === searchQuery.toLowerCase();
                  } else if (searchFilterType === "macro_sector") {
                    return s.macro_sector && s.macro_sector.toLowerCase() === searchQuery.toLowerCase();
                  } else if (searchFilterType === "known_sector") {
                    return s.known_sector && s.known_sector.toLowerCase() === searchQuery.toLowerCase();
                  } else if (searchFilterType === "basic_industry") {
                    return s.basic_industry && s.basic_industry.toLowerCase() === searchQuery.toLowerCase();
                  } else if (searchFilterType === "category") {
                    return s.category && s.category.toLowerCase() === searchQuery.toLowerCase();
                  }
                  return false;
                });
                if (stock) handleStockSelect(stock);
              }}
              disabled={!searchQuery}
              className="px-4 py-2 bg-blue-600 text-black rounded-md hover:bg-blue-700 disabled:bg-green-300 disabled:cursor-not-allowed"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Stock Details Table */}
      {selectedStock && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">{selectedStock.stock_name}</h3>
              <button
                onClick={() => handleModalEdit(selectedStock)}
                className="text-blue-600 hover:text-blue-800"
                title="Edit stock details"
              >
                <Edit2 size={20} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Sector Row */}
                <tr>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Sector</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingField === 'sector' ? (
                      <input
                        type="text"
                        value={editValues.sector}
                        onChange={(e) => handleEditChange('sector', e.target.value)}
                        list="sectorOptions"
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      selectedStock.sector || "-"
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingField === 'sector' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          className="text-green-600 hover:text-green-800"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={handleCancel}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit('sector')}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>

                {/* Industry Row */}
                <tr>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Industry</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingField === 'industry' ? (
                      <input
                        type="text"
                        value={editValues.industry}
                        onChange={(e) => handleEditChange('industry', e.target.value)}
                        list="industryOptions"
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      selectedStock.industry || "-"
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingField === 'industry' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          className="text-green-600 hover:text-green-800"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={handleCancel}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit('industry')}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>

                {/* Macro Sector Row */}
                <tr>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Macro Sector</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingField === 'macro_sector' ? (
                      <input
                        type="text"
                        value={editValues.macro_sector}
                        onChange={(e) => handleEditChange('macro_sector', e.target.value)}
                        list="macroSectorOptions"
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      selectedStock.macro_sector || "-"
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingField === 'macro_sector' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          className="text-green-600 hover:text-green-800"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={handleCancel}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit('macro_sector')}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>

                {/* Known Sector Row */}
                <tr>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Known Sector</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingField === 'known_sector' ? (
                      <input
                        type="text"
                        value={editValues.known_sector}
                        onChange={(e) => handleEditChange('known_sector', e.target.value)}
                        list="knownSectorOptions"
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      selectedStock.known_sector || "-"
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingField === 'known_sector' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          className="text-green-600 hover:text-green-800"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={handleCancel}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit('known_sector')}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>

                {/* Basic Industry Row */}
                <tr>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Basic Industry</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingField === 'basic_industry' ? (
                      <input
                        type="text"
                        value={editValues.basic_industry}
                        onChange={(e) => handleEditChange('basic_industry', e.target.value)}
                        list="basicIndustryOptions"
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      selectedStock.basic_industry || "-"
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingField === 'basic_industry' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          className="text-green-600 hover:text-green-800"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={handleCancel}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit('basic_industry')}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>

                {/* Category Row */}
                <tr>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Category</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingField === 'category' ? (
                      <input
                        type="text"
                        value={editValues.category}
                        onChange={(e) => handleEditChange('category', e.target.value)}
                        list="categoryOptions"
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      selectedStock.category || "-"
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingField === 'category' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          className="text-green-600 hover:text-green-800"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={handleCancel}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit('category')}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
                {/* Exchange Row */}
                <tr>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Exchange</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingField === 'exchange' ? (
                      <select
                        value={editValues.exchange}
                        onChange={(e) => handleEditChange('exchange', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="nse">NSE</option>
                        <option value="bse">BSE</option>
                      </select>
                    ) : (
                      selectedStock.exchange || "nse"
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingField === 'exchange' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          className="text-green-600 hover:text-green-800"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={handleCancel}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit('exchange')}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
                {/* Equity Type Row */}
                <tr>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Equity Type</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingField === 'equity_type' ? (
                      <input
                        type="text"
                        value={editValues.equity_type}
                        onChange={(e) => handleEditChange('equity_type', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      selectedStock.equity_type || "-"
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingField === 'equity_type' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          className="text-green-600 hover:text-green-800"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={handleCancel}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit('equity_type')}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
                {/* Symbol Token Row */}
                <tr>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Symbol Token</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingField === 'symbol_token' ? (
                      <input
                        type="text"
                        value={editValues.symbol_token}
                        onChange={(e) => handleEditChange('symbol_token', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      selectedStock.symbol_token || "-"
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingField === 'symbol_token' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          className="text-green-600 hover:text-green-800"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={handleCancel}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit('symbol_token')}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Incomplete Stocks Modal */}
      {showIncompleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Incomplete Stocks</h3>
              <button
                onClick={handleCloseIncompleteModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(60vh-200px)]">


              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {incompleteStocks.map((stock, _idx) => (
                      <tr key={makeKey(stock, _idx)}>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stock.stock_name}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          <button
                            onClick={() => handleModalEdit(stock)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {incompleteStocks.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No incomplete stocks found. All stocks have complete sector, industry, and category information.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden datalists for autocomplete */}
      <datalist id="sectorOptions">
        {sectorOptions.map((option, _idx) => (
          option ? <option key={option} value={option} /> : <option key={`sector-opt-${_idx}`} value="" />
        ))}
      </datalist>
      <datalist id="industryOptions">
        {industryOptions.map((option, _idx) => (
          option ? <option key={option} value={option} /> : <option key={`industry-opt-${_idx}`} value="" />
        ))}
      </datalist>
      <datalist id="macroSectorOptions">
        {macroSectorOptions.map((option, _idx) => (
          option ? <option key={option} value={option} /> : <option key={`macro-opt-${_idx}`} value="" />
        ))}
      </datalist>
      <datalist id="knownSectorOptions">
        {knownSectorOptions.map((option, _idx) => (
          option ? <option key={option} value={option} /> : <option key={`known-opt-${_idx}`} value="" />
        ))}
      </datalist>
      <datalist id="basicIndustryOptions">
        {basicIndustryOptions.map((option, _idx) => (
          option ? <option key={option} value={option} /> : <option key={`basic-opt-${_idx}`} value="" />
        ))}
      </datalist>
      <datalist id="categoryOptions">
        {categoryOptions.map((option, _idx) => (
          option ? <option key={option} value={option} /> : <option key={`cat-opt-${_idx}`} value="" />
        ))}
      </datalist>

      {/* Modal datalists */}
      <datalist id="modalSectorOptions">
        {sectorOptions.map((option, _idx) => (
          option ? <option key={option} value={option} /> : <option key={`modal-sector-opt-${_idx}`} value="" />
        ))}
      </datalist>
      <datalist id="modalIndustryOptions">
        {industryOptions.map((option, _idx) => (
          option ? <option key={option} value={option} /> : <option key={`modal-ind-opt-${_idx}`} value="" />
        ))}
      </datalist>
      <datalist id="modalMacroSectorOptions">
        {macroSectorOptions.map((option, _idx) => (
          option ? <option key={option} value={option} /> : <option key={`modal-macro-opt-${_idx}`} value="" />
        ))}
      </datalist>
      <datalist id="modalKnownSectorOptions">
        {knownSectorOptions.map((option, _idx) => (
          option ? <option key={option} value={option} /> : <option key={`modal-known-opt-${_idx}`} value="" />
        ))}
      </datalist>
      <datalist id="modalBasicIndustryOptions">
        {basicIndustryOptions.map((option, _idx) => (
          option ? <option key={option} value={option} /> : <option key={`modal-basic-opt-${_idx}`} value="" />
        ))}
      </datalist>
      <datalist id="modalCategoryOptions">
        {categoryOptions.map((option, _idx) => (
          option ? <option key={option} value={option} /> : <option key={`modal-cat-opt-${_idx}`} value="" />
        ))}
      </datalist>

      {/* Edit Modal */}
      {showEditModal && modalEditingStock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[85vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit {modalEditingStock.stock_name}
              </h3>
              <button
                onClick={handleCloseEditModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Basic Industry
                </label>
                <input
                  type="text"
                  value={modalEditValues.basic_industry}
                  onChange={(e) => handleModalEditChange('basic_industry', e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmModalBasicIndustry(); e.target.blur(); } }}
                  onBlur={confirmModalBasicIndustry}
                  list="editBasicIndustryOptions"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter basic industry"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sector
                </label>
                <input
                  type="text"
                  value={modalEditValues.sector}
                  onChange={(e) => handleModalEditChange('sector', e.target.value)}
                  list="editSectorOptions"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter sector"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industry
                </label>
                <input
                  type="text"
                  value={modalEditValues.industry}
                  onChange={(e) => handleModalEditChange('industry', e.target.value)}
                  list="editIndustryOptions"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter industry"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Macro Sector
                </label>
                <input
                  type="text"
                  value={modalEditValues.macro_sector}
                  onChange={(e) => handleModalEditChange('macro_sector', e.target.value)}
                  list="editMacroSectorOptions"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter macro sector"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Known Sector
                </label>
                <input
                  type="text"
                  value={modalEditValues.known_sector}
                  onChange={(e) => handleModalEditChange('known_sector', e.target.value)}
                  list="editKnownSectorOptions"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter known sector"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={modalEditValues.category}
                  onChange={(e) => handleModalEditChange('category', e.target.value)}
                  list="editCategoryOptions"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter category"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exchange
                </label>
                <select
                  value={modalEditValues.exchange}
                  onChange={(e) => handleModalEditChange('exchange', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="nse">NSE</option>
                  <option value="bse">BSE</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Equity Type
                </label>
                <input
                  type="text"
                  value={modalEditValues.equity_type}
                  onChange={(e) => handleModalEditChange('equity_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter equity type"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Symbol Token
                </label>
                <input
                  type="text"
                  value={modalEditValues.symbol_token}
                  onChange={(e) => handleModalEditChange('symbol_token', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter symbol token"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={handleModalCancel}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleModalSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal datalists */}
      <datalist id="editSectorOptions">
        {sectorOptions.map((option, _idx) => (
          option ? <option key={option} value={option} /> : <option key={`edit-sector-opt-${_idx}`} value="" />
        ))}
      </datalist>
      <datalist id="editIndustryOptions">
        {industryOptions.map((option, _idx) => (
          option ? <option key={option} value={option} /> : <option key={`edit-ind-opt-${_idx}`} value="" />
        ))}
      </datalist>
      <datalist id="editMacroSectorOptions">
        {macroSectorOptions.map((option, _idx) => (
          option ? <option key={option} value={option} /> : <option key={`edit-macro-opt-${_idx}`} value="" />
        ))}
      </datalist>
      <datalist id="editKnownSectorOptions">
        {knownSectorOptions.map((option, _idx) => (
          option ? <option key={option} value={option} /> : <option key={`edit-known-opt-${_idx}`} value="" />
        ))}
      </datalist>
      <datalist id="editBasicIndustryOptions">
        {basicIndustryOptions.map((option, _idx) => (
          option ? <option key={option} value={option} /> : <option key={`edit-basic-opt-${_idx}`} value="" />
        ))}
      </datalist>
      <datalist id="editCategoryOptions">
        {categoryOptions.map((option, _idx) => (
          option ? <option key={option} value={option} /> : <option key={`edit-cat-opt-${_idx}`} value="" />
        ))}
      </datalist>
    </div>
  );
};

export default StockMaster;