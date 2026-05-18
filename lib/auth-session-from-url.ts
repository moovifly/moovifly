import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthUrlFlow = "recovery" | "invite" | "none";

function flowFromType(type: string | null): AuthUrlFlow {
  return type === "recovery" ? "recovery" : "invite";
}

/**
 * Troca tokens do link (convite / recuperação) por sessão fresca.
 * Limpa sessão local antes para evitar "Password update requires reauthentication".
 */
export async function establishSessionFromUrl(supabase: SupabaseClient): Promise<AuthUrlFlow> {
  if (typeof window === "undefined") return "none";

  const searchParams = new URLSearchParams(window.location.search);
  const code = searchParams.get("code");
  const hash = window.location.hash?.startsWith("#") ? window.location.hash.slice(1) : "";
  const hashParams = new URLSearchParams(hash);
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  const type = hashParams.get("type");

  if (!code && !accessToken) return "none";

  await supabase.auth.signOut({ scope: "local" });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    stripAuthParamsFromUrl();
    return flowFromType(type);
  }

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    stripAuthParamsFromUrl();
    return flowFromType(type);
  }

  throw new Error("Link incompleto. Solicite um novo e-mail de convite ou recuperação de senha.");
}

function stripAuthParamsFromUrl() {
  const path = window.location.pathname;
  const search = new URLSearchParams(window.location.search);
  search.delete("code");
  search.delete("type");
  const q = search.toString();
  window.history.replaceState({}, "", q ? `${path}?${q}` : path);
}
