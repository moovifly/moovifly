"use client";

import { ArrowRight, Lock, Mail, Loader2, AlertCircle } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/providers/auth-provider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { signIn, getUserProfile, signOut, syncBrowserSessionFromServer } from "@/lib/auth";
import { passwordRecoveryRedirectUrl } from "@/lib/auth-redirect-urls";
import { publicUrlForPath } from "@/lib/public-site-url";

function translateError(message: string): string {
  if (message.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("Email not confirmed")) {
    return "E-mail não confirmado. Verifique sua caixa de entrada.";
  }
  if (message.includes("Failed to fetch") || message.includes("fetch")) {
    return "Não foi possível conectar ao servidor. Verifique sua internet, recarregue a página e tente de novo.";
  }
  if (message.includes("demorou demais para responder")) {
    return (
      "A conexão com o login estourou o tempo limite. Feche outras abas do site, recarregue a página ou desative VPN/bloqueador. " +
      "Na Vercel, confira se NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY existem na produção."
    );
  }
  if (message.includes("session_profile_mismatch")) {
    return "Sessão desatualizada. Limpe os cookies do site, recarregue a página e tente entrar de novo.";
  }
  return message || "Erro ao fazer login. Tente novamente.";
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  otp_expired:
    "O link de recuperação expirou ou já foi substituído por um mais novo. Use «Esqueci minha senha» e abra apenas o último e-mail recebido (de preferência em aba anônima).",
  auth: "Não foi possível entrar pelo link do e-mail. Solicite um novo convite ou recuperação de senha.",
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const { profile, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingRecovery, setSendingRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const erro = searchParams.get("erro");
    if (erro && AUTH_ERROR_MESSAGES[erro]) {
      setError(AUTH_ERROR_MESSAGES[erro]);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && profile) {
      window.location.assign(publicUrlForPath("/backoffice/dashboard/"));
    }
  }, [authLoading, profile]);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && localStorage.getItem("rememberMe") === "true") {
        setRememberMe(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} demorou demais para responder.`)), ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function handleForgotPassword() {
    const addr = email.trim();
    if (!addr) {
      toast.error("Informe seu e-mail no campo acima para receber o link de recuperação.");
      return;
    }
    setSendingRecovery(true);
    try {
      const res = await fetch("/api/auth/reset-password/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: addr,
          redirectTo: passwordRecoveryRedirectUrl(),
        }),
      });
      const json = (await res.json()) as { error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? "Erro ao enviar e-mail");
      toast.success("E-mail enviado", {
        description: "Abra o link na mensagem para definir uma nova senha (use aba anônima se já estiver logado).",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Não foi possível enviar o e-mail", { description: msg });
    } finally {
      setSendingRecovery(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Por favor, preencha todos os campos.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: signInError } = await withTimeout(
        signIn(email.trim(), password),
        30000,
        "Login",
      );
      if (signInError) throw new Error(signInError.message);

      await syncBrowserSessionFromServer();

      const { data: userProfile, error: profileError } = await withTimeout(
        getUserProfile(),
        30000,
        "Carregamento do perfil",
      );
      if (profileError) {
        throw new Error("Erro ao carregar perfil do usuário: " + profileError.message);
      }
      if (!userProfile) {
        throw new Error("Perfil não encontrado. Entre em contato com o administrador.");
      }
      if (!userProfile.ativo) {
        await signOut();
        throw new Error("Usuário inativo. Entre em contato com o administrador.");
      }

      try {
        if (rememberMe) localStorage.setItem("rememberMe", "true");
        else localStorage.removeItem("rememberMe");
        localStorage.setItem("userProfile", JSON.stringify(userProfile));
      } catch {
        /* ignore */
      }

      const supabase = getSupabaseClient();
      void (async () => {
        try {
          const { error } = await supabase.from("atividades").insert({
            usuario_id: userProfile.id,
            tipo: "login",
            descricao: `Login realizado - ${new Date().toLocaleString("pt-BR")}`,
          });
          if (error) console.warn("[atividades] Falha ao registrar login:", error);
        } catch (err) {
          console.warn("[atividades] Falha ao registrar login:", err);
        }
      })();

      toast.success("Bem-vindo!", { description: `Olá, ${userProfile.nome}.` });
      window.location.assign(publicUrlForPath("/backoffice/dashboard/"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const translated = translateError(message);
      setError(translated);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-card/95 p-8 shadow-lg backdrop-blur-md">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Image
          src="/assets/images/moovifly_logo_branco.png"
          alt="MooviFly"
          width={150}
          height={42}
          className="h-10 w-auto"
          priority
        />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight font-display">Backoffice</h1>
          <p className="text-sm text-[var(--text-secondary)]">Sistema de Gestão</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-sm">
          <label className="flex items-center gap-2 text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border border-[var(--border-default)] accent-[var(--accent-600)]"
            />
            Lembrar-me
          </label>
          <button
            type="button"
            onClick={() => void handleForgotPassword()}
            disabled={sendingRecovery || submitting}
            className="text-[var(--accent-600)] hover:underline disabled:opacity-50"
          >
            {sendingRecovery ? "Enviando…" : "Esqueci minha senha"}
          </button>
        </div>

        <Button type="submit" disabled={submitting || sendingRecovery} className="w-full">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Entrando...
            </>
          ) : (
            <>
              <span>Entrar</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
        Acesso restrito a usuários autorizados
      </p>
    </div>
  );
}
