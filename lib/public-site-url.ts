/**
 * URL absoluta canônica do site em produção, a partir de NEXT_PUBLIC_APP_URL.
 * Evita perder a sessão do Supabase (localStorage é por origem: www vs apex são sites diferentes).
 *
 * A decisão dev vs. prod usa process.env.NODE_ENV (que o Next injeta com o MESMO valor
 * no servidor e no cliente), e não window.location — assim o SSR e a hidratação geram
 * exatamente a mesma string, sem hydration mismatch. Em dev (`next dev`) mantém caminhos
 * relativos, funcionando tanto em localhost quanto via IP da LAN.
 */
export function publicUrlForPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;

  if (process.env.NODE_ENV !== "production") {
    return p;
  }

  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  const base = raw.replace(/\/$/, "");
  if (!base || base.includes("localhost") || base.includes("127.0.0.1")) {
    return p;
  }
  return `${base}${p}`;
}
