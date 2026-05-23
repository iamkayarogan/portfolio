# Portfolio Tracker

Personal investment portfolio tracker for Indian + global markets. Tracks stocks, ETFs, mutual funds, bonds/FDs/RDs, gold/silver, and broker cash with planning. Single-user, local-first, runs on your machine.

Built with Next.js 16 + TypeScript + SQLite. No cloud, no account, your data stays on disk.

## Features

- **Six asset categories** in tabs: Stocks, ETFs, Mutual Funds, Debt (Bonds / FDs / RDs), Commodities (gold/silver — physical, digital, or ETF), and Broker Cash (Dashboard only).
- **Live prices**
  - Stocks/ETFs via Yahoo Finance — Indian (NSE/BSE) and global tickers.
  - Mutual funds via mfapi.in (Indian schemes by scheme code).
  - Gold/Silver spot via Yahoo futures (`GC=F` / `SI=F`) × USD/INR ÷ 31.1035 g/oz.
  - USD/INR via Yahoo `INR=X` for converting USD holdings to INR-equivalent.
- **Auto-enrichment on save**
  - Stocks: sector, region (US/IN), and market cap (USD) from Yahoo.
  - MFs: scheme category from mfapi.in.
- **Charts** (pure SVG, no charting deps)
  - Dashboard: allocation by asset type, region (US/IN) split, allocation plan pie.
  - Stocks: sector / market-cap / per-stock / region pies.
  - MFs: by fund type. ETFs: per-ETF. Debt: by instrument. Commodities: by metal + form.
- **P&L on every tab** — Invested / Current Value / Total P&L with %. Live INR-equivalent under USD values.
- **Broker cash + allocation planning** — track funds in Zerodha / Groww / Angel One / etc. Plan future buys with target symbol + amount; the UI shows "≈ N shares @ ₹X" at live prices. Plans never affect invested totals.
- **Cost basis unknown** — leave Avg Buy as `0` for inherited assets (e.g. jewellery). The row shows "unknown" / "n/a" and contributes 0 to P&L.
- **Search-based adding** — typeahead for stocks/ETFs (Yahoo, India-first ordering) and MFs (mfapi.in). Picking a result auto-fills symbol, name, and currency.
- **Inline edit** — Qty and Avg Buy editable directly in any holdings table; comma/space/₹ symbols accepted in number fields.
- **Refresh button** in the header re-fetches prices and FX for the current page.
- **Auth** — first-run setup creates a single password (bcrypt-hashed). Sign-out + session in HTTP-only cookies.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 → you'll be redirected to `/setup` on first visit to create a password.

The SQLite database lives at `data/portfolio.db` (gitignored).

## Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (Turbopack, hot reload). |
| `npm run build` | Production build. |
| `npm run start` | Run the production build. |
| `npm run lint` | ESLint. |
| `npm run auth:reset` | Clear the password and all sessions. Holdings data is **untouched**. Next visit will redirect to `/setup`. |

## Tech stack

- **Next.js 16** (App Router, React 19, Turbopack)
- **TypeScript** strict
- **SQLite** via `better-sqlite3` — local file, no server
- **Tailwind CSS v4** — dark theme
- **bcryptjs** — password hashing
- **yahoo-finance2** — live quotes, search, market cap, FX
- **mfapi.in** — Indian mutual fund NAVs and metadata

## Tracking from another device on your LAN

The dev server binds to your network IP (e.g. `http://192.168.0.102:3000`). `next.config.ts` already includes the local subnets in `allowedDevOrigins`, so hot-module reload works from phones/tablets on the same Wi-Fi. Adjust the IPs there if your subnet differs.

## Resetting the login

Forgot the password? Run:

```bash
npm run auth:reset
```

Refresh the browser — you'll land back on `/setup`.

## Folder map

```
app/
  setup/, login/                # Public auth pages
  (protected)/                  # All app pages, auth-gated
    page.tsx                    # Dashboard
    AvailableFunds.tsx          # Broker cash + planning (Dashboard only)
    stocks/, etfs/, mutual-funds/, debt/, commodities/
  api/                          # REST endpoints (all gated, except /auth/*)
  components/                   # AllocationPie, HoldingsTable, SymbolSearch, etc.
lib/
  db.ts                         # SQLite init + schema
  auth.ts                       # bcrypt + sessions
  prices.ts                     # Yahoo + mfapi (server-only)
  market-cap.ts                 # pure helpers (client-safe)
  format.ts, aggregate.ts, portfolio.ts
  api-client.ts, allocations-client.ts
scripts/
  reset-auth.mjs                # Used by `npm run auth:reset`
data/
  portfolio.db                  # SQLite DB (gitignored)
```

## Security notes

- All app data is local; no telemetry, no remote sync.
- Password stored as bcrypt hash (10 rounds) in the DB.
- Session token = 256 random bits, cookie is `HttpOnly` + `SameSite=Lax`, 30-day expiry.
- API routes return 401 without a valid session.
- No CSRF token — relies on SameSite. **Don't expose this publicly without adding one.**

## License

Personal project. Use however you like.
