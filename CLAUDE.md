# Portfolio Tracker — Project Notes for Claude

Personal investment portfolio tracker. Single-user, local-first, Next.js 16 (App Router) + SQLite.

## Architecture

- **Framework**: Next.js 16 with Turbopack, App Router, React 19, TypeScript strict.
- **Storage**: SQLite via `better-sqlite3` at `data/portfolio.db` (WAL mode, in `.gitignore`).
- **Auth**: bcryptjs hashed password (singleton row), HTTP-only signed-cookie sessions in `sessions` table.
- **Live data**: `yahoo-finance2` for stocks/ETFs/FX/futures, `mfapi.in` for Indian mutual fund NAVs.
- **Styling**: Tailwind v4, dark theme (`bg-neutral-950` / `text-neutral-100`).

## Routes

```
app/
  layout.tsx              # HTML shell (no header)
  globals.css
  setup/                  # public — first-run password creation
  login/                  # public — login form
  (protected)/            # auth-gated route group; layout calls requireAuth()
    layout.tsx            #   header + Tabs + Refresh + Sign out
    page.tsx              #   Dashboard
    stocks/
    etfs/
    mutual-funds/
    debt/                 #   bonds + FDs + RDs (type dropdown)
    commodities/          #   gold / silver × physical / digital / ETF
    AvailableFunds.tsx    #   broker cash + planned allocations (dashboard-only)
  api/
    auth/{setup,login,logout}/
    holdings/[id]?        # CRUD; filter by ?type=
    allocations/[id]?     # CRUD for planned-allocation table
    prices/               # live quotes for all holdings
    search/?type=&q=      # symbol typeahead (stock/etf via Yahoo, mf via mfapi.in)
    fx/                   # USD→INR rate
    commodity-rate/       # gold/silver per gram in INR
  components/
    AllocationPie.tsx     # pure SVG donut chart (rounded to 4dp to avoid SSR hydration drift)
    HoldingsTable.tsx     # shared table; inline Qty/Avg-Buy edit
    SymbolSearch.tsx      # debounced typeahead (Yahoo + mfapi.in)
    SummaryStats.tsx      # Invested / Current / P&L cards per tab
    Tabs.tsx
    LogoutButton.tsx
    RefreshButton.tsx     # router.refresh() inside a transition
    FormField.tsx         # Field / SelectField / SubmitButton / PieCard

lib/
  db.ts                   # SQLite init + schema + migration (runs at module load)
  auth.ts                 # bcrypt + session lifecycle; requireAuth / requireApiAuth
  prices.ts               # SERVER-ONLY (yahoo-finance2 import). Has cache map.
  market-cap.ts           # pure helper (kept separate so client can import safely)
  format.ts               # formatCurrency / formatPercent / toInr
  aggregate.ts            # turn holdings → slices for AllocationPie
  portfolio.ts            # enriched-holdings helpers
  api-client.ts           # client wrappers around /api/holdings
  allocations-client.ts   # client wrappers around /api/allocations
```

## Important conventions

1. **Server-only modules**: anything importing `yahoo-finance2` (and so `child_process` via `@deno/shim-deno`) **must not** be reachable from a `"use client"` file. `lib/prices.ts` declares `import "server-only"` to fail fast. Pure helpers like `marketCapBucket` live in their own module (`lib/market-cap.ts`) so the client can use them.
2. **`asset_type='cash'` = broker funds**, not invested. They are:
   - Stored in the same `holdings` table for CRUD reuse.
   - **Excluded** from Dashboard's Invested / Current / P&L / allocation pie / segment cards.
   - Shown only in the Available Funds panel on the Dashboard.
3. **Planned allocations** (`allocations` table) are *plans only* — they reference a broker (`broker_id` FK to a cash holding) plus optional `target_symbol`. They never feed into invested totals or P&L. Their pie shows the planned breakdown + an "Unallocated" slice.
4. **Cost basis unknown**: `avg_buy_price === 0` is a sentinel. HoldingsTable shows "unknown" / "n/a"; SummaryStats and Dashboard treat invested = current for that row so net P&L contribution is zero.
5. **Currency**: source of truth is the holding's own currency. INR-equivalents are computed via `toInr(amount, currency, usdInr)` for cross-currency totals. USD rows show `≈ ₹X` under the value.
6. **Stock sector/region/market_cap**: enriched server-side when a stock is added (`fetchStockInfo`). Existing stocks with missing fields are backfilled on `/stocks` page load.
7. **MF fund type**: enriched from `mfapi.in/mf/<code>` `meta.scheme_category` on add; backfilled on `/mutual-funds` page load.
8. **Comma/space input handling**: any `Field` with `type="number"` actually renders `<input type="text" inputMode="decimal">` and strips non-numeric chars in onChange. Prevents the browser's "Please enter a number" error and accepts pasted formatted numbers like `₹1,066.48`.

## Schema (data/portfolio.db)

```sql
holdings (
  id, asset_type,           -- stock/etf/mf/bond/fd/rd/commodity/cash
  symbol, name, quantity, avg_buy_price, currency, notes,
  sector, region,           -- US/IN, for stocks/ETFs
  fund_type,                -- for MFs
  interest_rate, maturity_date,  -- for debt
  commodity_metal, commodity_form,  -- gold/silver × physical/digital/etf
  current_price,            -- manual override (rarely used)
  market_cap_usd,           -- for stocks (USD, computed at add)
  created_at, updated_at
)
allocations (
  id, broker_id (FK→holdings, CASCADE),
  label, target_symbol, amount, notes, created_at
)
auth ( id=1 singleton, password_hash, created_at )
sessions ( token, created_at, expires_at )
```

## Common scripts

```bash
npm run dev          # start dev server
npm run lint         # ESLint
npx tsc --noEmit     # typecheck
npm run auth:reset   # clear password + sessions (holdings preserved)
```

## Dev environment

- Listening on `http://localhost:3000` and `http://192.168.0.102:3000` (LAN).
- `next.config.ts` allowlists the LAN origin via `allowedDevOrigins` so HMR works from other devices on the network. Without that, Next 16 blocks `_next/webpack-hmr` requests from non-localhost.
- Live commodity prices come from Yahoo (GC=F / SI=F) × USD/INR / 31.1035 g per troy oz — goodreturns.in is Cloudflare-protected.

## Known caveats

- Yahoo's `quoteSummary` `marketCap` field is fetched once at add-time and cached; it can go stale over weeks/months. Re-deriving on every page load would burn API calls — happy to add a manual "refresh metadata" action if it becomes an issue.
- Refresh button calls `router.refresh()` — Yahoo quote requests are not cached internally, so a refresh actually re-hits the network. Commodity + FX rates are cached in-memory for 10–30 min.
- The `holdings` table currently doubles as a cash store via `asset_type='cash'`. If broker accounting grows more complex (transaction log, deposit/withdraw history), promote it to its own table.
- No CSRF protection on POST endpoints — relies on `SameSite=Lax` cookie. Fine for personal/LAN use, not for public exposure.
