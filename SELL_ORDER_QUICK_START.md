# Sell Order Tab - Quick Start Guide

## 🚀 Quick Setup & Testing

### Step 1: Verify Backend Changes
```bash
# Check that the new endpoint exists
curl http://localhost:3001/api/order/distinct-brokers-accounts

# Expected response:
# {
#   "brokers": ["zerodha", "angel"],
#   "accounts": ["PM", "PDM", "PSM"]
# }
```

### Step 2: Start Frontend-2
```bash
cd frontend-2
npm install  # If not done yet
npm run dev
# Open http://localhost:5173
```

### Step 3: Test the Tab
1. Click the **"Sell Order"** tab (between Buy Order and Open Positions)
2. You should see:
   - Broker dropdown (loading indicator briefly)
   - Account dropdown
   - Stock search field (disabled until broker/account selected)

### Step 4: Test Sell Order Flow

#### Step 4a: Select Broker & Account
```
1. Select broker: "Zerodha" (or "Angel One")
2. Select account: "PM" (or "PDM"/"PSM")
3. Stock search field should now be enabled
```

#### Step 4b: Search Stock
```
1. Start typing stock name (minimum 2 characters)
   - Example: "REL" for "RELIANCE"
   - Example: "TCS" for "TCS"
2. Suggestions dropdown appears
3. Click on a stock from suggestions
```

#### Step 4c: View Open Entries
```
1. After selecting a stock, a table appears showing:
   - Buy Date (format: DD-MM-YY)
   - Quantity (number of units)
   - Entry Price (formatted with ₹)
   - Sell button
2. Table shows all open holdings for that stock
```

#### Step 4d: Place Sell Order
```
1. Click "Sell" button on any entry
2. Modal opens with:
   - Stock name
   - Max available quantity
   - Quantity dropdown (full or partial)
   - Order type selector (MARKET/LIMIT)
3. Select quantity:
   - Full: "Full (10 units)" - pre-selected
   - Partial: Select specific quantity (1-9)
4. Select order type:
   - MARKET: No price input needed
   - LIMIT: Price input appears
5. If LIMIT selected:
   - Enter limit price
   - See estimated value (quantity × price)
6. Click "Place Sell Order"
7. Wait for API response:
   - Success: "Order placed successfully. Order ID: ..."
   - Error: Shows error message
```

---

## 📊 Testing Scenarios

### Scenario 1: Happy Path (Successful Sell)
```
✅ Select Zerodha
✅ Select PM account
✅ Type "REL" → Click "RELIANCE"
✅ Click Sell button
✅ Select "Full (10 units)"
✅ Select "MARKET" order type
✅ Click "Place Sell Order"
→ Should see: "Order placed successfully. Order ID: ..."
```

### Scenario 2: Limit Order
```
✅ Select Zerodha
✅ Select PM account
✅ Type "TCS" → Click "TCS"
✅ Click Sell button
✅ Select "5 units" from dropdown
✅ Select "LIMIT" order type
✅ Enter price: "3500.50"
✅ Should show: "Estimated Value: ₹17,502.50"
✅ Click "Place Sell Order"
→ Should see: "Order placed successfully. Order ID: ..."
```

### Scenario 3: Partial Sell
```
✅ Select Angel One
✅ Select PDM account
✅ Type "INFO" → Click "INFOTECH"
✅ Click Sell button
✅ Select "3 units" (if max is 10)
✅ Select "MARKET"
✅ Click "Place Sell Order"
→ Should see success message
```

### Scenario 4: Validation Errors
```
❌ Try to place order without selecting quantity
   → Error: "Please enter a valid quantity"

❌ Select LIMIT but don't enter price
   → Submit button disabled (greyed out)

❌ Enter quantity > max available
   → Error: "Quantity cannot exceed 10"

❌ Enter negative or zero price for LIMIT
   → Error: "Please enter a valid limit price"
```

### Scenario 5: Mobile Experience
```
✅ Open frontend-2 on mobile phone
✅ Bottom navigation shows: Buy Order | Sell Order | Open Positions
✅ Click "Sell Order" tab
✅ Form elements stack vertically
✅ Table scrolls horizontally if needed
✅ Modal takes 90% of screen width
✅ All buttons are touch-friendly (large click targets)
```

---

## 🔍 Network Debugging

### Using Browser DevTools

#### Check API Calls:
1. Open **DevTools** (F12 or Right-click → Inspect)
2. Go to **Network** tab
3. Filter by **Fetch/XHR**
4. Look for these requests:

```
GET /api/order/distinct-brokers-accounts
Status: 200
Response: { brokers: [...], accounts: [...] }

GET /api/order/open-transactions?broker_name=zerodha&account_name=PM&search=REL
Status: 200
Response: { data: [...], count: N, page: 1, ... }

POST /api/order/place-sell-order
Status: 200
Response: { success: true, order_id: "..." }
```

#### Check Console:
- No errors should appear in the Console tab
- Look for any fetch failures or validation warnings

---

## 🐛 Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Brokers/Accounts dropdown is empty | No data in stock_transactions | Insert test data or ensure sell_date IS NULL |
| Stock search returns no results | Broker/account combo has no holdings | Add test transactions for that broker/account |
| Sell Order tab doesn't show | Code not deployed | Run `npm run build` and redeploy |
| Modal doesn't open | JavaScript error | Check console for errors, reload page |
| Submit button always disabled | Form validation issue | Ensure quantity and price values are valid |
| API returns 404 | Backend endpoint not registered | Check orderRoutes.js has the route |
| API returns 500 | Database error | Check Supabase connection, ensure table exists |

---

## 📝 Expected Database State

### stock_transactions Table
```sql
-- Should have rows like:
-- id | broker_name | account_name | stock_name | buy_date | quantity | buy_price | sell_date
-- uuid | zerodha | PM | RELIANCE | 2024-01-15 | 10 | 2400.50 | NULL
-- uuid | zerodha | PM | TCS | 2024-02-20 | 5 | 3400.00 | NULL
-- uuid | angel | PDM | INFOTECH | 2024-01-10 | 3 | 1200.00 | NULL
```

**Key Points**:
- `sell_date IS NULL` for open positions (required for filtering)
- `broker_name` and `account_name` must be populated
- Quantities should vary to test partial sells
- Need at least 2-3 brokers and accounts for good testing

---

## 🧪 Manual Test Data

If you need to add test data to stock_transactions:

```sql
INSERT INTO stock_transactions (
  broker_name, account_name, stock_name, buy_date, quantity, buy_price, sell_date
) VALUES
  ('zerodha', 'PM', 'RELIANCE', '2024-01-15', 10, 2400.50, NULL),
  ('zerodha', 'PM', 'TCS', '2024-02-20', 5, 3400.00, NULL),
  ('zerodha', 'PDM', 'HDFC', '2024-03-10', 8, 2800.00, NULL),
  ('angel', 'PM', 'INFOTECH', '2024-01-10', 3, 1200.00, NULL),
  ('angel', 'PSM', 'BAJAJ-AUTO', '2024-02-15', 2, 6500.00, NULL);
```

---

## ✅ Checklist Before Going Live

### Frontend
- [ ] `npm run build` completes without errors
- [ ] No console errors when loading the page
- [ ] Sell Order tab is visible and clickable
- [ ] All dropdowns populate correctly
- [ ] Stock search works with autocomplete
- [ ] Modal opens and closes properly
- [ ] Form validation works
- [ ] Success/error messages display

### Backend
- [ ] `GET /api/order/distinct-brokers-accounts` returns data
- [ ] `GET /api/order/open-transactions` works with all filters
- [ ] `POST /api/order/place-sell-order` places orders correctly
- [ ] Database logs show no errors
- [ ] Broker services (Zerodha/Angel) are configured

### Database
- [ ] stock_transactions table has test data
- [ ] stock_master table has symbol_token data
- [ ] broker_orders table exists (for order tracking)
- [ ] No foreign key constraint errors

### Browser Testing
- [ ] Tested on Chrome
- [ ] Tested on Firefox
- [ ] Tested on Safari
- [ ] Tested on mobile (iOS/Android)
- [ ] Responsive design works at all breakpoints

---

## 🎯 Performance Metrics

### Expected Response Times
- Load brokers/accounts: **<500ms**
- Search stocks: **<1000ms**
- Load open entries: **<1000ms**
- Place sell order: **<2000ms**
- Modal open: **Instant (<100ms)**

### Optimization Tips
- If slow, check database indexes on stock_transactions
- Verify browser DevTools Network tab shows requests completing
- Monitor backend CPU/memory during load testing

---

## 📱 Mobile Testing Checklist

- [ ] Tab navigation hidden on mobile (<640px)
- [ ] Bottom navigation shows 3 buttons
- [ ] Sell Order button in bottom nav works
- [ ] Dropdowns are full-width
- [ ] Search box is full-width and usable
- [ ] Table scrolls horizontally (doesn't break layout)
- [ ] Modal has proper padding and fits screen
- [ ] All buttons are large enough to tap
- [ ] No horizontal scroll on main page
- [ ] Scroll works smoothly (no jank)

---

## 🔐 Security Considerations

- ✅ API endpoints don't require authentication (verify if this is intended)
- ⚠️ Consider adding auth middleware if sensitive data exposed
- ✅ Input validation prevents SQL injection (Supabase parameterized queries)
- ⚠️ Consider rate limiting on place-sell-order endpoint
- ✅ No passwords/tokens exposed in frontend code

---

## 📞 Support Resources

**Documentation Files**:
- Main implementation guide: `SELL_ORDER_TAB_IMPLEMENTATION.md`
- This quick start: `SELL_ORDER_QUICK_START.md`
- Backend code: `backend/src/controllers/orderController.js`
- Frontend code: `frontend-2/src/App.jsx`
- Styles: `frontend-2/src/App.css`

**Backend Endpoints**:
- Distinct brokers/accounts: `GET /api/order/distinct-brokers-accounts`
- Open transactions: `GET /api/order/open-transactions`
- Place sell order: `POST /api/order/place-sell-order`

---

## 🚀 Next Steps

1. ✅ Test all scenarios above
2. ✅ Add more test data if needed
3. ✅ Monitor real broker API responses
4. ✅ Implement real-time LTP display
5. ✅ Add order history/tracking
6. ✅ Deploy to production

---

**Happy testing! 🎉**

For issues or questions, check the troubleshooting section or review the implementation guide.
