"use client";

import { ArrowRight, Lock, Mail, Loader2, AlertCircle } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/providers/auth-provider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { signIn, getUserProfile } from "@/lib/auth";

function translateError(message: string): string {
  if (message.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("Email not confirmed")) {
    return "E-mail não confirmado. Verifique sua caixa de entrada.";
  }
  return message || "Erro ao fazer login. Tente novamente.";
}

export function LoginForm() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && profile) {
      router.replace("/backoffice/dashboard/");
    }
  }, [authLoading, profile, router]);

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
        15000,
        "Login",
      );
      if (signInError) throw new Error(signInError.message);

      const userId = data.user?.id;
      if (!userId) throw new Error("Não foi possível autenticar usuário.");

      const { data: userProfile, error: profileError } = await withTimeout(
        getUserProfile(userId),
        15000,
        "Carregamento do perfil",
      );
      if (profileError) {
        throw new Error("Erro ao carregar perfil do usuário: " + profileError.message);
      }
      if (!userProfile) {
        throw new Error("Perfil não encontrado. Entre em contato com o administrador.");
      }
      if (!userProfile.ativo) {
        await getSupabaseClient().auth.signOut();
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
      router.replace("/backoffice/dashboard/");
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

        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border border-[var(--border-default)] accent-[var(--accent-600)]"
          />
          Lembrar-me
        </label>

        <Button type="submit" disabled={submitting} className="w-full">
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
