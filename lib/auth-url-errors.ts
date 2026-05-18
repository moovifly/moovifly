/** Erros devolvidos pelo GoTrue no hash ou query após verify (ex.: link expirado). */
export type AuthUrlError = {
  code: string;
  description: string;
};

export function parseAuthErrorFromUrl(): AuthUrlError | null {
  if (typeof window === "undefined") return null;

  const hashParams = new URLSearchParams(
    window.location.hash?.startsWith("#") ? window.location.hash.slice(1) : "",
  );
  const searchParams = new URLSearchParams(window.location.search);

  const error = hashParams.get("error") ?? searchParams.get("error");
  const errorCode = hashParams.get("error_code") ?? searchParams.get("error_code");
  const errorDescription =
    hashParams.get("error_description") ?? searchParams.get("error_description");

  if (!error && !errorCode) return null;

  return {
    code: errorCode ?? error ?? "unknown",
    description: (errorDescription ?? "").replace(/\+/g, " "),
  };
}

export function messageForAuthUrlError(err: AuthUrlError): string {
  const code = err.code.toLowerCase();
  if (code === "otp_expired") {
    return (
      "Este link expirou ou já foi usado (um novo pedido de senha invalida o anterior). " +
      "Em /backoffice/login/, use «Esqueci minha senha», abra só o e-mail mais recente e clique no link em até 1 hora."
    );
  }
  if (code === "access_denied") {
    return err.description || "Acesso negado. Solicite um novo link de recuperação ou convite.";
  }
  return err.description || "Não foi possível concluir a autenticação pelo link.";
}

export function loginQueryForAuthError(err: AuthUrlError): string {
  if (err.code === "otp_expired") return "otp_expired";
  return "auth";
}
