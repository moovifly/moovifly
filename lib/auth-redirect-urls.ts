import { publicUrlForPath } from "@/lib/public-site-url";

export const DEFINIR_SENHA_PATH = "/backoffice/definir-senha/";

/** URL de retorno após convite ou recuperação (usar em resetPasswordForEmail e no Site URL do Supabase). */
export function authCallbackRedirectUrl(next = DEFINIR_SENHA_PATH): string {
  const q = new URLSearchParams({ next });
  return publicUrlForPath(`/auth/callback?${q.toString()}`);
}

export function passwordRecoveryRedirectUrl(): string {
  return authCallbackRedirectUrl(DEFINIR_SENHA_PATH);
}
