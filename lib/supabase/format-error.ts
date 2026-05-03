/** Mensagem legível para PostgrestError / erro genérico (evita "[object Object]" no toast). */
export function formatSupabaseError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const o = err as { message?: string; details?: string; hint?: string };
    const parts = [o.message, o.details, o.hint].filter((s): s is string => typeof s === "string" && s.length > 0);
    if (parts.length) return parts.join(" — ");
  }
  return err instanceof Error ? err.message : String(err);
}
