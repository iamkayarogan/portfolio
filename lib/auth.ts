import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import db from "./db";

export const SESSION_COOKIE = "pf_session";
const SESSION_TTL_DAYS = 30;

interface AuthRow {
  id: number;
  password_hash: string;
  created_at: string;
}

interface SessionRow {
  token: string;
  created_at: string;
  expires_at: string;
}

export function getAuthRow(): AuthRow | undefined {
  return db.prepare(`SELECT * FROM auth WHERE id = 1`).get() as
    | AuthRow
    | undefined;
}

export function hasPasswordSet(): boolean {
  return !!getAuthRow();
}

export function setPassword(plain: string): void {
  if (hasPasswordSet()) throw new Error("Password already set");
  if (plain.length < 6) throw new Error("Password must be at least 6 characters");
  const hash = bcrypt.hashSync(plain, 10);
  db.prepare(`INSERT INTO auth (id, password_hash) VALUES (1, ?)`).run(hash);
}

export function verifyPassword(plain: string): boolean {
  const row = getAuthRow();
  if (!row) return false;
  return bcrypt.compareSync(plain, row.password_hash);
}

export function createSession(): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
  db.prepare(
    `INSERT INTO sessions (token, expires_at) VALUES (?, ?)`,
  ).run(token, expiresAt.toISOString());
  return { token, expiresAt };
}

export function getSessionByToken(token: string): SessionRow | undefined {
  return db
    .prepare(
      `SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')`,
    )
    .get(token) as SessionRow | undefined;
}

export function deleteSession(token: string): void {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

export function purgeExpiredSessions(): void {
  db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`).run();
}

export async function getCurrentSession(): Promise<SessionRow | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getSessionByToken(token) ?? null;
}

export async function requireAuth(): Promise<void> {
  const session = await getCurrentSession();
  if (!session) {
    redirect(hasPasswordSet() ? "/login" : "/setup");
  }
}

export async function requireApiAuth(): Promise<Response | null> {
  const session = await getCurrentSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return null;
}
