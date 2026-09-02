# Equity Positions Last_Price Update Logic - Detailed Explanation

## Your Question
# Equity Positions Last_Price Update Logic - Detailed Explanation

## Your Question
> "Is `last_price` updated by matching the symbol column with stock name from stock_master, or is there some other logic?"

## Answer: YES, but with an important clarification

The logic involves **THREE different tables and TWO layers of matching**. Here's the complete flow:

---

## Step-by-Step Update Flow

### Step 1: Get Equity Position Symbols & Get Tokens from Stock Symbols
**Location**: `backend/src/services/angelLiveService.js` → `getEquityPositionTokens()` (lines 37-83)

```javascript
// 1. Fetch all symbols from equity_positions table
const { data: positions } = await supabase
  .from('equity_positions')
  .select('symbol, exchange');
// Result: [{ symbol: "RELIANCE", exchange: "NSE" }, ...]

// 2. Match those symbols directly with stock_symbols (direct column match)
const { data: stockSymbolRows } = await supabase
  .from('stock_symbols')
  .select('symbol, symbol_token, exchange')
  .in('symbol', symbols);  // ← KEY: Direct match - equity_positions.symbol 
                           //    matches stock_symbols.symbol (1:1)

// 3. Create a mapping: symbol → token
const tokenMap = new Map(
  stockSymbolRows
    .map(row => [row.symbol.trim(), { token: row.symbol_token.toString().trim(), exchange: row.exchange || 'NSE' }])
);
// Result: { "RELIANCE" → { token: "2885", exchange: "NSE" }, "INFY" → { token: "9535", ... }}
```

**What's happening here**:
- ✅ `equity_positions.symbol` contains stock symbols like "RELIANCE", "INFY"
- ✅ These are matched **directly** with `stock_symbols.symbol` (no intermediate column matching)
- ✅ `stock_symbols.symbol_token` contains Angel One's token for that stock
- ✅ `stock_symbols.exchange` contains the exchange for better accuracy

---

### Step 2: Subscribe to Live Prices Using Tokens
**Location**: `angelLiveService.js` → `subscribeToPortfolioStocks()` (lines 220-260)

```javascript
// Subscribe to Angel One WebSocket using tokens
symbolTokens.forEach(s => {
  tokenToSymbolMap[token] = s.symbol;  // Reverse map: token → symbol
  
  // Subscribe to this token for live price updates
  smartWS.subscribe({
    tokenList: [{ exchangeType: 1, tokens: [token] }]
  });
});
```

**What's happening here**:
- Creates reverse map: `tokenToSymbolMap` = { "2885" → "RELIANCE", "9535" → "INFY", ... }
- Subscribes to Angel One's WebSocket for live updates using these tokens

---

### Step 3: Receive Tick Data & Update equity_positions
**Location**: `angelLiveService.js` → `handleTick()` + `updateEquityPositionLastPrice()` (lines 287-303)

```javascript
// When broker sends a price tick with a token
function handleTick(msg) {
  const rawToken = msg.token.toString();  // e.g., "2885"
  
  // 1. Convert token back to symbol using our map
  const symbol = tokenToSymbolMap[rawToken] || rawToken;
  // Result: "2885" → "RELIANCE"
  
  const ltp = parseFloat(msg.last_traded_price) / 100;
  
  // 2. Update equity_positions by matching symbol
  updateEquityPositionLastPrice(symbol, ltp);
}

async function updateEquityPositionLastPrice(symbol, lastPrice) {
  // Update equity_positions table WHERE symbol = "RELIANCE"
  const { error } = await supabase
    .from('equity_positions')
    .update({ last_price: lastPrice })
    .eq('symbol', symbol)  // ← Match on symbol column
    .gte('position_date', today);
}
```

**What's happening here**:
- ✅ Receive token from broker (e.g., "2885")
- ✅ Look up symbol using `tokenToSymbolMap` (e.g., "RELIANCE")
- ✅ Update `equity_positions` table WHERE `symbol = "RELIANCE"` SET `last_price = LTP`

---

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   Angel One Broker                          │
│              (Sends live price ticks)                       │
└────────────┬────────────────────────────────────────────────┘
             │ Token: "2885", LTP: 2500.50
             ↓
┌─────────────────────────────────────────────────────────────┐
│              Angel WebSocket (handleTick)                   │
│                                                              │
│  1. Receive: { token: "2885", ltp: 2500.50 }              │
│  2. Lookup: tokenToSymbolMap["2885"] = "RELIANCE"         │
│  3. Result: { symbol: "RELIANCE", ltp: 25.0050 }         │
└────────────┬────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────┐
│        updateEquityPositionLastPrice(symbol, ltp)           │
│                                                              │
│  UPDATE equity_positions                                   │
│  SET last_price = 25.0050                                 │
│  WHERE symbol = "RELIANCE"                                │
│  AND position_date >= TODAY                               │
│                                                              │
│  (Token lookup was already done via stock_symbols table)   │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Mapping Points

### Table 1: stock_symbols (Lookup Table - Direct Match)
```
symbol   | name      | symbol_token | exchange | last_updated
──────────────────────────────────────────────────────────────────
RELIANCE | Reliance  | 2885         | NSE      | 2026-06-19
INFY     | Infosys   | 9535         | NSE      | 2026-06-19
TCS      | TCS       | 11536        | NSE      | 2026-06-19
```

### Table 2: equity_positions (To Update)
```
id  | symbol    | exchange | quantity | last_price | position_date
────────────────────────────────────────────────────────────────
1   | RELIANCE  | NSE      | 10       | 2495.00    | 2026-06-19
2   | INFY      | NSE      | 5        | 1790.00    | 2026-06-19
3   | TCS       | NSE      | 2        | 3490.00    | 2026-06-19
```

### Mapping Logic
```javascript
// On startup:
1. Get symbols from equity_positions: ["RELIANCE", "INFY", "TCS"]

2. Query stock_symbols WHERE symbol IN (symbols)
   Result: DIRECT symbol → symbol_token mapping (no intermediate matching)
   {
     "RELIANCE": { token: "2885", exchange: "NSE" },
     "INFY": { token: "9535", exchange: "NSE" },
     "TCS": { token: "11536", exchange: "NSE" }
   }

3. Subscribe to Angel WebSocket with tokens: ["2885", "9535", "11536"]

4. Create reverse map for incoming ticks:
   tokenToSymbolMap = {
     "2885": "RELIANCE",
     "9535": "INFY",
     "11536": "TCS"
   }

5. On each tick, update equity_positions by symbol name, not token
   (Token lookup was already resolved in step 2 using stock_symbols)
```

---

## Important Details

### ✅ Correct Understanding
1. `equity_positions.symbol` contains **stock symbols** (RELIANCE, INFY, etc.)
2. These symbols are matched **directly** with `stock_symbols.symbol` (1:1 column match)
3. `stock_symbols.symbol_token` is retrieved in the same query (no intermediate matching needed)
4. Tokens are used to subscribe to live prices from broker
5. When prices come in, the **symbol** (not token) is used to update `equity_positions`

### ✅ Advantages of stock_symbols Approach
- **Direct matching**: `equity_positions.symbol` = `stock_symbols.symbol` (no name mismatches)
- **Single query**: Get symbol and token in one query (more efficient)
- **Less maintenance**: No need to maintain stock_name column separately
- **Better accuracy**: Symbol column is primary key in stock_symbols

### ❌ Common Confusion
- The token is **NOT** stored in `equity_positions` (not used for matching in the update)
- The token is only used to:
  - Subscribe to broker for live prices
  - Create the reverse `tokenToSymbolMap` for incoming ticks
- The actual update uses the symbol name (which was already resolved via stock_symbols)

### ⚠️ Potential Issues

1. **Symbol Mismatch**: If `equity_positions.symbol` doesn't match any `stock_symbols.symbol`, the stock won't get a token and won't be subscribed to live prices
   - **Solution**: Ensure symbols in both tables are synchronized

2. **Case Sensitivity**: Symbols are trimmed but not lowercased, so "RELIANCE" ≠ "reliance"
   - **Solution**: Maintain consistent casing in both tables (typically UPPERCASE)

3. **NULL Tokens**: If `stock_symbols.symbol_token` is NULL or missing, the stock won't be subscribed
   - **Solution**: Ensure all symbols in stock_symbols table have valid symbol_token values

4. **Exchange Mismatch**: `equity_positions.exchange` and `stock_symbols.exchange` should match for accuracy
   - **Solution**: Use `stock_symbols.exchange` as source of truth (preference in code)

---

## Code References

| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `getEquityPositionTokens()` | angelLiveService.js | 37-83 | Get symbols from equity_positions + match with stock_symbols to get tokens |
| `subscribeToPortfolioStocks()` | angelLiveService.js | 220-260 | Subscribe to broker using tokens, create tokenToSymbolMap |
| `handleTick()` | angelLiveService.js | 287-303 | Handle incoming price ticks, lookup symbol from token |
| `updateEquityPositionLastPrice()` | angelLiveService.js | 262-280 | Update equity_positions WHERE symbol matches |

---

## Summary

With the new `stock_symbols` table, the flow is **simpler and more efficient**:

```
equity_positions.symbol → [Direct Match] → stock_symbols.symbol
                                              ↓
                                      stock_symbols.symbol_token
                                              ↓
                                    [Subscribe to broker]
                                              ↓
                                    [Broker sends token + price]
                                              ↓
                                    [Lookup symbol from token]
                                              ↓
                             [Update equity_positions by symbol]
```

### Key Improvements:
1. **Direct 1:1 mapping**: `equity_positions.symbol` directly matches `stock_symbols.symbol` (no cross-matching)
2. **Single query**: Both symbol and token are retrieved in one query from stock_symbols
3. **More reliable**: Symbol is the primary key in stock_symbols (ensures uniqueness)
4. **Better maintenance**: Cleaner separation of concerns (stock_symbols holds symbol mappings, stock_master holds price data)

**Answer**: YES, the symbol from `equity_positions` is matched directly with `stock_symbols.symbol` to get the `symbol_token`, which is then used to subscribe to live prices. When prices arrive, the symbol is extracted and used to update `equity_positions`.
