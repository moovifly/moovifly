import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Redireciona o apex (ex.: moovifly.com) para o host canónico em NEXT_PUBLIC_APP_URL (ex.: www.moovifly.com).
 * Cookies da sessão Supabase (@supabase/ssr) são por host — misturar apex e www quebra login / GET em usuarios.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  if (host.endsWith(".vercel.app") || host.includes("localhost")) {
    return NextResponse.next();
  }

  /*
   * Fix obrigatório: não depender só de NEXT_PUBLIC_APP_URL no Edge (por vezes não vem no bundle).
   * Apex e www são origens diferentes para cookies — sessão Supabase fica quebrada em moovifly.com.
   */
  if (host === "moovifly.com") {
    const dest = new URL(request.url);
    dest.hostname = "www.moovifly.com";
    dest.protocol = "https:";
    return NextResponse.redirect(dest, 308);
  }

  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw || raw.includes("localhost") || raw.includes("127.0.0.1")) {
    return NextResponse.next();
  }

  const base = raw.startsWith("http") ? raw : `https://${raw}`;
  let canonicalUrl: URL;
  try {
    canonicalUrl = new URL(base.replace(/\/$/, ""));
  } catch {
    return NextResponse.next();
  }

  if (host === canonicalUrl.host) {
    return NextResponse.next();
  }

  const parts = canonicalUrl.hostname.split(".");
  if (parts[0] === "www" && parts.length >= 2) {
    const apexHost = parts.slice(1).join(".");
    if (host === apexHost) {
      const dest = new URL(request.url);
      dest.hostname = canonicalUrl.hostname;
      dest.protocol = canonicalUrl.protocol;
      return NextResponse.redirect(dest, 308);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Ignora estáticos do Next e favicons; o resto passa pelo middleware.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
