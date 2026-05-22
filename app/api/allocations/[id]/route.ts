import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireApiAuth } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const unauth = await requireApiAuth();
  if (unauth) return unauth;
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const info = db.prepare(`DELETE FROM allocations WHERE id = ?`).run(n);
  if (info.changes === 0)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
