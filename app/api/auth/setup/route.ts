import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  createSession,
  hasPasswordSet,
  setPassword,
} from "@/lib/auth";

export async function POST(req: Request) {
  if (hasPasswordSet()) {
    return NextResponse.json({ error: "Password already set" }, { status: 403 });
  }
  const body = (await req.json()) as { password?: string; confirm?: string };
  if (!body.password || body.password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 },
    );
  }
  if (body.password !== body.confirm) {
    return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
  }
  setPassword(body.password);
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
