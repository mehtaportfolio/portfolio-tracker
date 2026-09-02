import React, { useState, useEffect } from "react";
import { stockAPI } from "../../../api/stockAPI.js";
import { Search, Edit2, Check, X, RotateCcw, AlertTriangle, Plus } from "lucide-react";

const StockMap = () => {
  const [stockMap, setStockMap] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStock, setSelectedStock] = useState(null);
  const [filteredStocks, setFilteredStocks] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchFilterType, setSearchFilterType] = useState("stock");
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [incompleteStocks, setIncompleteStocks] = useState([]);
  const [modalEditingStock, setModalEditingStock] = useState(null);
  const [modalEditValues, setModalEditValues] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [symbolSuggestions, setSymbolSuggestions] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStockValues, setNewStockValues] = useState({
    stock_name: "",
    symbol_ao: "",
    symbol_gs: ""
  });
  const [stockNameSuggestions, setStockNameSuggestions] = useState([]);
  const [showStockNameSuggestions, setShowStockNameSuggestions] = useState(false);
  const [addSymbolSuggestions, setAddSymbolSuggestions] = useState([]);

  const fetchStockMap = async () => {
    try {
      const { data } = await stockAPI.fetchStockMappings();
      setStockMap(data || []);
    } catch (error) {
      console.error("Error fetching stock map:", error);
    }
  };

  useEffect(() => {
    fetchStockMap();
  }, []);

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.length > 0) {
      let filtered = [];
      
      if (searchFilterType === "stock") {
        filtered = stockMap.filter(stock =>
          stock.stock_name && stock.stock_name.toLowerCase().includes(query.toLowerCase())
        );
      } else if (searchFilterType === "symbol_gs") {
        filtered = stockMap.filter(stock =>
          stock.symbol_gs && stock.symbol_gs.toLowerCase().includes(query.toLowerCase())
        );
      } else if (searchFilterType === "symbol_ao") {
        filtered = stockMap.filter(stock =>
          stock.symbol_ao && stock.symbol_ao.toLowerCase().includes(query.toLowerCase())
        );
      }
      
      setFilteredStocks(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredStocks([]);
      setShowSuggestions(false);
    }
  };

  const handleStockSelect = (stock) => {
    setSelectedStock(stock);
    setSearchQuery(stock.stock_name);
    setShowSuggestions(false);
  };

  const handleReset = () => {
    setSelectedStock(null);
    setSearchQuery("");
    setSearchFilterType("stock");
    setFilteredStocks([]);
    setShowSuggestions(false);
  };

  const fetchIncompleteStocks = async () => {
    try {
      const { data } = await stockAPI.fetchIncompleteStockMappings();
      setIncompleteStocks(data || []);
    } catch (error) {
      console.error("Error fetching incomplete stocks:", error);
    }
  };

  const handleOpenIncompleteModal = () => {
    fetchIncompleteStocks();
    setShowIncompleteModal(true);
  };

  const handleCloseIncompleteModal = () => {
    setShowIncompleteModal(false);
    setModalEditingStock(null);
    setModalEditValues({});
  };

  const handleModalEdit = (stock) => {
    setModalEditingStock(stock);
    setModalEditValues({
      symbol_ao: stock.symbol_ao || "",
      symbol_gs: stock.symbol_gs || ""
    });
    setShowEditModal(true);
  };

  const handleModalSave = async () => {
    try {
      await stockAPI.updateStockMapping(modalEditingStock.id, modalEditValues);
      
      setIncompleteStocks(incompleteStocks.map(stock =>
        stock.id === modalEditingStock.id
          ? { ...stock, ...modalEditValues }
          : stock
      ));
      setModalEditingStock(null);
      setModalEditValues({});
      setShowEditModal(false);
      setSymbolSuggestions([]);
      
      await fetchStockMap();
      
      const updatedStock = { ...modalEditingStock, ...modalEditValues };
      setSelectedStock(updatedStock);
    } catch (error) {
      alert("Error updating stock: " + error.message);
    }
  };

  const handleModalCancel = () => {
    setModalEditingStock(null);
    setModalEditValues({});
    setShowEditModal(false);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setModalEditingStock(null);
    setModalEditValues({});
  };

  const handleModalEditChange = (field, value) => {
    setModalEditValues(prev => ({ ...prev, [field]: value }));
  };

  const handleSymbolAoChange = async (e) => {
    const query = e.target.value;
    handleModalEditChange('symbol_ao', query);

    if (query.length > 0) {
      try {
        const { data } = await stockAPI.fetchStockSymbols();
        if (data) {
          const filtered = data.filter(item =>
            item.name && item.name.toLowerCase().includes(query.toLowerCase())
          );
          const unique = Array.from(new Map(filtered.map(item => [item.name, item])).values());
          setSymbolSuggestions(unique);
        }
      } catch (error) {
        console.error("Error fetching symbols:", error);
      }
    } else {
      setSymbolSuggestions([]);
    }
  };

  const handleSymbolSelect = async (symbol) => {
    handleModalEditChange('symbol_ao', symbol.name);
    setSymbolSuggestions([]);

    if (modalEditingStock?.stock_name) {
      try {
        const { data } = await stockAPI.fetchStockMaster();
        if (data) {
          const masterStock = data.find(
            s => s.stock_name === modalEditingStock.stock_name
          );
          if (masterStock && masterStock.symbol) {
            handleModalEditChange('symbol_gs', masterStock.symbol);
          }
        }
      } catch (error) {
        console.error("Error fetching stock master:", error);
      }
    }
  };

  const handleOpenAddModal = () => {
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setNewStockValues({
      stock_name: "",
      symbol_ao: "",
      symbol_gs: ""
    });
    setStockNameSuggestions([]);
    setShowStockNameSuggestions(false);
    setAddSymbolSuggestions([]);
  };

  const handleAddNewStockChange = (field, value) => {
    setNewStockValues(prev => ({ ...prev, [field]: value }));
  };

  const handleStockNameChange = async (e) => {
    const query = e.target.value;
    handleAddNewStockChange('stock_name', query);

    if (query.length > 0) {
      try {
        const { data } = await stockAPI.fetchStockMaster();
        if (data) {
          const filtered = data.filter(item =>
            item.stock_name && item.stock_name.toLowerCase().includes(query.toLowerCase())
          );
          setStockNameSuggestions(filtered.slice(0, 50));
          setShowStockNameSuggestions(true);
        }
      } catch (error) {
        console.error("Error fetching stock names:", error);
      }
    } else {
      setStockNameSuggestions([]);
      setShowStockNameSuggestions(false);
    }
  };

  const handleStockNameSelect = (stock) => {
    handleAddNewStockChange('stock_name', stock.stock_name);
    handleAddNewStockChange('symbol_gs', stock.symbol || "");
    setShowStockNameSuggestions(false);
    setStockNameSuggestions([]);
  };

  const handleAddSymbolAoChange = async (e) => {
    const query = e.target.value;
    handleAddNewStockChange('symbol_ao', query);

    if (query.length > 0) {
      try {
        const { data } = await stockAPI.fetchStockSymbols();
        if (data) {
          const filtered = data.filter(item =>
            item.name && item.name.toLowerCase().includes(query.toLowerCase())
          );
          const unique = Array.from(new Map(filtered.map(item => [item.name, item])).values());
          setAddSymbolSuggestions(unique);
        }
      } catch (error) {
        console.error("Error fetching symbols:", error);
      }
    } else {
      setAddSymbolSuggestions([]);
    }
  };

  const handleAddSymbolSelect = (symbol) => {
    handleAddNewStockChange('symbol_ao', symbol.name);
    setAddSymbolSuggestions([]);
  };

  const handleAddModalSave = async () => {
    if (!newStockValues.stock_name.trim()) {
      alert("Stock name is required");
      return;
    }

    try {
      await stockAPI.addStockMapping({
        stock_name: newStockValues.stock_name,
        symbol_ao: newStockValues.symbol_ao || null,
        symbol_gs: newStockValues.symbol_gs || null,
        cmp: null,
        lcp: null
      });

      await fetchStockMap();
      handleCloseAddModal();
    } catch (error) {
      alert("Error adding stock: " + error.message);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl text-yellow-300 font-bold">Stock Map</h2>
          <button
            onClick={handleOpenAddModal}
            className="p-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center"
            title="Add new stock"
          >
            <Plus size={20} />
          </button>
        </div>
        <button
          onClick={handleOpenIncompleteModal}
          className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 flex items-center gap-2"
        >
          <AlertTriangle size={16} />
          Incomplete Stocks
        </button>
      </div>

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
              <option value="symbol_gs">Search by Symbol GS</option>
              <option value="symbol_ao">Search by Symbol AO</option>
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
                  searchFilterType === "symbol_gs" ? "Search by symbol GS..." :
                  "Search by symbol AO..."
                }
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showSuggestions && filteredStocks.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                  {filteredStocks.slice(0, 100).map((stock) => (
                    <div
                      key={stock.id}
                      onClick={() => handleStockSelect(stock)}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      <div className="font-medium">{stock.stock_name}</div>
                      <div className="text-xs text-gray-500">
                        {searchFilterType === "stock" ? "" :
                         searchFilterType === "symbol_gs" ? `Symbol GS: ${stock.symbol_gs || "-"}` :
                         `Symbol AO: ${stock.symbol_ao || "-"}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                const stock = stockMap.find(s => {
                  if (searchFilterType === "stock") {
                    return s.stock_name && s.stock_name.toLowerCase() === searchQuery.toLowerCase();
                  } else if (searchFilterType === "symbol_gs") {
                    return s.symbol_gs && s.symbol_gs.toLowerCase() === searchQuery.toLowerCase();
                  } else if (searchFilterType === "symbol_ao") {
                    return s.symbol_ao && s.symbol_ao.toLowerCase() === searchQuery.toLowerCase();
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Symbol AO</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {selectedStock.symbol_ao || "-"}
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Symbol GS</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {selectedStock.symbol_gs || "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showIncompleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[95vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Incomplete Stocks</h3>
              <button
                onClick={handleCloseIncompleteModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-auto">
              <div className="p-6">
                {(() => {
                  const hasBlankSymbolAo = incompleteStocks.some(s => !s.symbol_ao);
                  const hasBlankSymbolGs = incompleteStocks.some(s => !s.symbol_gs);
                  
                  return (
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Name</th>
                          {hasBlankSymbolAo && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol AO</th>}
                          {hasBlankSymbolGs && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol GS</th>}
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {incompleteStocks.map((stock) => (
                          <tr key={stock.id}>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {stock.stock_name}
                            </td>
                            {hasBlankSymbolAo && (
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 relative">
                                {modalEditingStock?.id === stock.id ? (
                                  <>
                                    <input
                                      type="text"
                                      value={modalEditValues.symbol_ao}
                                      onChange={handleSymbolAoChange}
                                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="Search symbol..."
                                    />
                                    {modalEditValues.symbol_ao.length > 0 && symbolSuggestions.length > 0 && (
                                      <div className="absolute z-20 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1 left-0">
                                        {symbolSuggestions.map((symbol) => (
                                          <div
                                            key={symbol.id || symbol.name}
                                            onClick={() => handleSymbolSelect(symbol)}
                                            className="px-3 py-2 hover:bg-blue-100 cursor-pointer text-sm"
                                          >
                                            <div className="font-medium">{symbol.name}</div>
                                            <div className="text-xs text-gray-500">
                                              Symbol: {symbol.symbol || "-"}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  stock.symbol_ao || <span className="text-red-500">-</span>
                                )}
                              </td>
                            )}
                            {hasBlankSymbolGs && (
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                {modalEditingStock?.id === stock.id ? (
                                  <input
                                    type="text"
                                    value={modalEditValues.symbol_gs}
                                    onChange={(e) => handleModalEditChange('symbol_gs', e.target.value)}
                                    className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                ) : (
                                  stock.symbol_gs || <span className="text-red-500">-</span>
                                )}
                              </td>
                            )}
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              {modalEditingStock?.id === stock.id ? (
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleModalSave}
                                    className="text-green-600 hover:text-green-800"
                                    title="Save"
                                  >
                                    <Check size={16} />
                                  </button>
                                  <button
                                    onClick={handleModalCancel}
                                    className="text-red-600 hover:text-red-800"
                                    title="Cancel"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleModalEdit(stock)}
                                  className="text-blue-600 hover:text-blue-800"
                                  title="Edit"
                                >
                                  <Edit2 size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t">
              <button
                onClick={handleCloseIncompleteModal}
                className="px-4 py-2 bg-gray-300 text-gray-900 rounded-md hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && modalEditingStock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Edit - {modalEditingStock.stock_name}</h3>
              <button
                onClick={handleCloseEditModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Symbol AO</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 relative">
                        <input
                          type="text"
                          value={modalEditValues.symbol_ao}
                          onChange={handleSymbolAoChange}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Type to search or enter custom symbol..."
                        />
                        {modalEditValues.symbol_ao.length > 0 && symbolSuggestions.length > 0 && (
                          <div className="absolute z-20 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                            {symbolSuggestions.map((symbol) => (
                              <div
                                key={symbol.id || symbol.name}
                                onClick={() => handleSymbolSelect(symbol)}
                                className="px-3 py-2 hover:bg-blue-100 cursor-pointer text-sm"
                              >
                                <div className="font-medium">{symbol.name}</div>
                                <div className="text-xs text-gray-500">
                                  Symbol: {symbol.symbol || "-"}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Symbol GS</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <input
                          type="text"
                          value={modalEditValues.symbol_gs}
                          onChange={(e) => handleModalEditChange('symbol_gs', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t">
              <button
                onClick={handleModalCancel}
                className="px-4 py-2 bg-gray-300 text-gray-900 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleModalSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Add New Stock</h3>
              <button
                onClick={handleCloseAddModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Stock Name</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 relative">
                        <input
                          type="text"
                          value={newStockValues.stock_name}
                          onChange={handleStockNameChange}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Type to search..."
                        />
                        {showStockNameSuggestions && stockNameSuggestions.length > 0 && (
                          <div className="absolute z-20 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                            {stockNameSuggestions.map((stock) => (
                              <div
                                key={stock.id}
                                onClick={() => handleStockNameSelect(stock)}
                                className="px-3 py-2 hover:bg-blue-100 cursor-pointer text-sm"
                              >
                                <div className="font-medium">{stock.stock_name}</div>
                                <div className="text-xs text-gray-500">
                                  Symbol: {stock.symbol || "-"}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Symbol AO</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 relative">
                        <input
                          type="text"
                          value={newStockValues.symbol_ao}
                          onChange={handleAddSymbolAoChange}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Type to search or enter custom symbol..."
                        />
                        {newStockValues.symbol_ao.length > 0 && addSymbolSuggestions.length > 0 && (
                          <div className="absolute z-20 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                            {addSymbolSuggestions.map((symbol) => (
                              <div
                                key={symbol.id || symbol.name}
                                onClick={() => handleAddSymbolSelect(symbol)}
                                className="px-3 py-2 hover:bg-blue-100 cursor-pointer text-sm"
                              >
                                <div className="font-medium">{symbol.name}</div>
                                <div className="text-xs text-gray-500">
                                  Symbol: {symbol.symbol || "-"}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Symbol GS</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <input
                          type="text"
                          value={newStockValues.symbol_gs}
                          onChange={(e) => handleAddNewStockChange('symbol_gs', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t">
              <button
                onClick={handleCloseAddModal}
                className="px-4 py-2 bg-gray-300 text-gray-900 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleAddModalSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockMap;
