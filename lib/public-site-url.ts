/**
 * URL absoluta canônica do site em produção, a partir de NEXT_PUBLIC_APP_URL.
 * Evita perder a sessão do Supabase (localStorage é por origem: www vs apex são sites diferentes).
 * Em dev (localhost) mantém caminhos relativos.
 */
export function publicUrlForPath(path: string): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  const base = raw.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base || base.includes("localhost") || base.includes("127.0.0.1")) {
    return p;
  }
  return `${base}${p}`;
}
