import { NextResponse } from "next/server";
import db, { type AllocationRow, type Frequency } from "@/lib/db";
import { requireApiAuth } from "@/lib/auth";

const FREQS: Frequency[] = ["daily", "weekly"];

function parseId(idParam: string): number | null {
  const n = Number(idParam);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const unauth = await requireApiAuth();
  if (unauth) return unauth;
  const { id } = await ctx.params;
  const n = parseId(id);
  if (!n) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const existing = db
    .prepare(`SELECT * FROM allocations WHERE id = ?`)
    .get(n) as AllocationRow | undefined;
  if (!existing)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json()) as Partial<AllocationRow>;

  if (body.label !== undefined && (!body.label || typeof body.label !== "string")) {
    return NextResponse.json({ error: "label required" }, { status: 400 });
  }
  if (
    body.amount !== undefined &&
    (typeof body.amount !== "number" || body.amount <= 0)
  ) {
    return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });
  }

  const deadlineProvided =
    body.deadline_days !== undefined && body.deadline_days !== null;
  const freqProvided = body.frequency !== undefined && body.frequency !== null;
  const bothExplicit =
    body.deadline_days !== undefined || body.frequency !== undefined;
  if (bothExplicit && deadlineProvided !== freqProvided) {
    return NextResponse.json(
      { error: "deadline_days and frequency must both be set, or both omitted" },
      { status: 400 },
    );
  }
  if (deadlineProvided) {
    if (typeof body.deadline_days !== "number" || body.deadline_days <= 0) {
      return NextResponse.json(
        { error: "deadline_days must be a positive integer" },
        { status: 400 },
      );
    }
    if (!FREQS.includes(body.frequency as Frequency)) {
      return NextResponse.json(
        { error: "frequency must be 'daily' or 'weekly'" },
        { status: 400 },
      );
    }
  }

  const next = {
    label: (body.label ?? existing.label).trim(),
    target_symbol:
      body.target_symbol !== undefined
        ? body.target_symbol?.toString().trim() || null
        : existing.target_symbol,
    amount: body.amount ?? existing.amount,
    notes:
      body.notes !== undefined
        ? body.notes?.toString().trim() || null
        : existing.notes,
    deadline_days: bothExplicit
      ? deadlineProvided
        ? Math.floor(body.deadline_days as number)
        : null
      : existing.deadline_days,
    frequency: bothExplicit
      ? freqProvided
        ? (body.frequency as Frequency)
        : null
      : existing.frequency,
  };

  db.prepare(
    `UPDATE allocations
        SET label = ?, target_symbol = ?, amount = ?, notes = ?,
            deadline_days = ?, frequency = ?
      WHERE id = ?`,
  ).run(
    next.label,
    next.target_symbol,
    next.amount,
    next.notes,
    next.deadline_days,
    next.frequency,
    n,
  );

  const row = db.prepare(`SELECT * FROM allocations WHERE id = ?`).get(n);
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const unauth = await requireApiAuth();
  if (unauth) return unauth;
  const { id } = await ctx.params;
  const n = parseId(id);
  if (!n) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const info = db.prepare(`DELETE FROM allocations WHERE id = ?`).run(n);
  if (info.changes === 0)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
