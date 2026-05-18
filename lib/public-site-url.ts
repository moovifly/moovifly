function isLocalDevOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

/**
 * URL absoluta canônica do site em produção, a partir de NEXT_PUBLIC_APP_URL.
 * Evita perder a sessão do Supabase (localStorage é por origem: www vs apex são sites diferentes).
 * Em dev (localhost) mantém caminhos relativos — inclusive quando .env.local repete a URL de produção.
 */
export function publicUrlForPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;

  if (typeof window !== "undefined" && isLocalDevOrigin(window.location.origin)) {
    return p;
  }

  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  const base = raw.replace(/\/$/, "");
  if (!base || base.includes("localhost") || base.includes("127.0.0.1")) {
    return p;
  }
  return `${base}${p}`;
}
