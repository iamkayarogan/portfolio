#!/usr/bin/env node
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = path.join(process.cwd(), "data", "portfolio.db");

if (!fs.existsSync(DB_PATH)) {
  console.log(`No database found at ${DB_PATH}. Nothing to reset.`);
  process.exit(0);
}

const db = new Database(DB_PATH);
const authCount = (db.prepare("SELECT COUNT(*) AS n FROM auth").get()).n;
const sessionCount = (db.prepare("SELECT COUNT(*) AS n FROM sessions").get()).n;

db.prepare("DELETE FROM auth").run();
db.prepare("DELETE FROM sessions").run();
db.close();

console.log(
  `Reset done. Removed ${authCount} auth row and ${sessionCount} active session(s).`,
);
console.log("Next visit to the app will redirect to /setup.");
