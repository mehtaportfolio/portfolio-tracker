export function getActivePriceSourceTable(priceSource) {
  return priceSource === 'stock_mapping' ? 'stock_mapping' : 'stock_master';
}

export function normalizeStockName(name) {
  return String(name || '').trim().toUpperCase();
}

export function createNormalizedStockMap(data) {
  const map = new Map();
  (data || []).forEach(row => {
    const normalizedKey = normalizeStockName(row.stock_name);
    map.set(normalizedKey, { cmp: row.cmp, lcp: row.lcp });
  });
  return map;
}
