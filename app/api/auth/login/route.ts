import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  createSession,
  hasPasswordSet,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: Request) {
  if (!hasPasswordSet()) {
    return NextResponse.json({ error: "Setup required" }, { status: 400 });
  }
  const body = (await req.json()) as { password?: string };
  if (!body.password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }
  if (!verifyPassword(body.password)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  const { token, expiresAt } = createSession();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
  return NextResponse.json({ ok: true });
}
