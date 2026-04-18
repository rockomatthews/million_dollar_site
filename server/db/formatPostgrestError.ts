/** Compact, log-friendly string for Supabase PostgREST / Postgres errors. */
export function formatPostgrestError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const e = err as { message?: string; details?: string; hint?: string; code?: string };
    return [e.message, e.details, e.hint, e.code ? `code=${e.code}` : ""].filter(Boolean).join(" | ");
  }
  return String(err);
}

/** Postgres undefined_column is 42703; PostgREST often echoes the missing column name in message. */
export function isMissingColumnError(err: unknown, columnName: string): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { message?: string; code?: string };
  const msg = (e.message ?? "").toLowerCase();
  const col = columnName.toLowerCase();
  return msg.includes(col) || e.code === "42703";
}
