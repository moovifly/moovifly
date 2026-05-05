"use client";

import { Loader2, Lock } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOOVIFLY_POS_CONVITE_KEY } from "@/lib/auth-invite-flow";
import { getSupabaseClient } from "@/lib/supabase/client";
import { publicUrlForPath } from "@/lib/public-site-url";

function translatePasswordError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("password") && m.includes("6")) return "A senha deve ter pelo menos 6 caracteres (requisito do sistema).";
  if (m.includes("same as")) return "Escolha uma senha diferente da anterior.";
  return message || "Não foi possível atualizar a senha.";
}

export function DefinirSenhaForm() {
  const { profile, loading: authLoading, userId } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!userId || !profile) {
      window.location.assign(publicUrlForPath("/backoffice/login/"));
    }
  }, [authLoading, userId, profile]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast.error("Defina uma senha com pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(translatePasswordError(error.message));
      toast.success("Senha criada! Redirecionando…");
      try {
        sessionStorage.removeItem(MOOVIFLY_POS_CONVITE_KEY);
      } catch {
        /* ignore */
      }
      window.location.assign(publicUrlForPath("/backoffice/dashboard/"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !userId || !profile) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" aria-hidden />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
          <Lock className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="font-display text-xl font-semibold tracking-tight">Definir senha</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Olá, {profile.nome}. Crie uma senha para acessar o backoffice da MooviFly.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nova-senha">Nova senha</Label>
        <Input
          id="nova-senha"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          placeholder="Mínimo 6 caracteres"
          required
          minLength={6}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmar-senha">Confirmar senha</Label>
        <Input
          id="confirmar-senha"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(ev) => setConfirm(ev.target.value)}
          placeholder="Repita a senha"
          required
          minLength={6}
        />
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Salvando…
          </>
        ) : (
          "Salvar senha e entrar"
        )}
      </Button>
    </form>
  );
}
