import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "portfolio.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const existing = db
  .prepare(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='holdings'`,
  )
  .get() as { sql: string } | undefined;

const hasOldSchema = existing && existing.sql.includes("CHECK");

if (hasOldSchema) {
  db.exec(`
    BEGIN;
    CREATE TABLE holdings_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_type TEXT NOT NULL,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      quantity REAL NOT NULL,
      avg_buy_price REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      notes TEXT,
      sector TEXT,
      region TEXT,
      fund_type TEXT,
      interest_rate REAL,
      maturity_date TEXT,
      commodity_metal TEXT,
      commodity_form TEXT,
      current_price REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO holdings_new
      (id, asset_type, symbol, name, quantity, avg_buy_price, currency, notes, created_at, updated_at)
    SELECT id, asset_type, symbol, name, quantity, avg_buy_price, currency, notes, created_at, updated_at
    FROM holdings;
    DROP TABLE holdings;
    ALTER TABLE holdings_new RENAME TO holdings;
    COMMIT;
  `);
}

try {
  db.exec(`ALTER TABLE holdings ADD COLUMN market_cap_usd REAL`);
} catch {
  // column already exists
}
for (const col of [
  "roe",
  "debt_to_equity",
  "current_ratio",
  "book_value",
  "peg_ratio",
  "roce",
]) {
  try {
    db.exec(`ALTER TABLE holdings ADD COLUMN ${col} REAL`);
  } catch {
    // column already exists
  }
}
for (const alter of [
  `ALTER TABLE allocations ADD COLUMN deadline_days INTEGER`,
  `ALTER TABLE allocations ADD COLUMN frequency TEXT`,
]) {
  try {
    db.exec(alter);
  } catch {
    // column already exists, or table not yet created (handled below)
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_type TEXT NOT NULL,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity REAL NOT NULL,
    avg_buy_price REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    notes TEXT,
    sector TEXT,
    region TEXT,
    fund_type TEXT,
    interest_rate REAL,
    maturity_date TEXT,
    commodity_metal TEXT,
    commodity_form TEXT,
    current_price REAL,
    market_cap_usd REAL,
    roe REAL,
    debt_to_equity REAL,
    current_ratio REAL,
    book_value REAL,
    peg_ratio REAL,
    roce REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON holdings(symbol);
  CREATE INDEX IF NOT EXISTS idx_holdings_type ON holdings(asset_type);

  CREATE TABLE IF NOT EXISTS auth (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

  CREATE TABLE IF NOT EXISTS allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    broker_id INTEGER NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    target_symbol TEXT,
    amount REAL NOT NULL,
    notes TEXT,
    deadline_days INTEGER,
    frequency TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_allocations_broker ON allocations(broker_id);
`);

if (hasOldSchema) {
  db.exec(`
    UPDATE holdings
       SET region = CASE
         WHEN symbol LIKE '%.NS' OR symbol LIKE '%.BO' THEN 'IN'
         WHEN asset_type IN ('stock','etf') THEN 'US'
         ELSE NULL
       END
     WHERE region IS NULL AND asset_type IN ('stock','etf');
  `);
}

export default db;

export type AssetType =
  | "stock"
  | "etf"
  | "mf"
  | "bond"
  | "fd"
  | "rd"
  | "commodity"
  | "cash";

export const ASSET_TYPES: AssetType[] = [
  "stock",
  "etf",
  "mf",
  "bond",
  "fd",
  "rd",
  "commodity",
  "cash",
];

export const ASSET_LABEL: Record<AssetType, string> = {
  stock: "Stocks",
  etf: "ETFs",
  mf: "Mutual Funds",
  bond: "Bonds",
  fd: "Fixed Deposits",
  rd: "Recurring Deposits",
  commodity: "Commodities",
  cash: "Broker Cash",
};

export type Region = "IN" | "US" | null;
export type CommodityMetal = "gold" | "silver";
export type CommodityForm = "physical" | "digital" | "etf";

export interface HoldingRow {
  id: number;
  asset_type: AssetType;
  symbol: string;
  name: string;
  quantity: number;
  avg_buy_price: number;
  currency: string;
  notes: string | null;
  sector: string | null;
  region: Region;
  fund_type: string | null;
  interest_rate: number | null;
  maturity_date: string | null;
  commodity_metal: CommodityMetal | null;
  commodity_form: CommodityForm | null;
  current_price: number | null;
  market_cap_usd: number | null;
  roe: number | null;
  debt_to_equity: number | null;
  current_ratio: number | null;
  book_value: number | null;
  peg_ratio: number | null;
  roce: number | null;
  created_at: string;
  updated_at: string;
}

export type Frequency = "daily" | "weekly";

export interface AllocationRow {
  id: number;
  broker_id: number;
  label: string;
  target_symbol: string | null;
  amount: number;
  notes: string | null;
  deadline_days: number | null;
  frequency: Frequency | null;
  created_at: string;
}
