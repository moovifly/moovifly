"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getSupabaseClient } from "@/lib/supabase/client";
import { publicUrlForPath } from "@/lib/public-site-url";
import { getUserProfile, syncBrowserSessionFromServer, signOutLocal, signOutSafe, type UserProfile } from "@/lib/auth";
import { MOOVIFLY_PASSWORD_RECOVERY_KEY, MOOVIFLY_POS_CONVITE_KEY } from "@/lib/auth-invite-flow";

type AuthContextValue = {
  loading: boolean;
  profile: UserProfile | null;
  effectiveProfile: UserProfile | null;
  userId: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  viewAsVendedor: boolean;
  setViewAsVendedor: (v: boolean) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ADMIN_ONLY = ["/backoffice/configuracoes"];
const VENDEDOR_RESTRICTED = ["/backoffice/financeiro", "/backoffice/checkout"];
const PUBLIC_BACKOFFICE = ["/backoffice/login"];

const VIEW_AS_KEY = "moovifly_view_as_vendedor";

const PROFILE_FETCH_MS = 25_000;

async function getUserProfileWithTimeout() {
  try {
    return await Promise.race([
      getUserProfile(),
      new Promise<{ data: null; sessionUserId: null; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error("profile_fetch_timeout")), PROFILE_FETCH_MS),
      ),
    ]);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return { data: null, sessionUserId: null, error: err };
  }
}

function goBackoffice(path: string) {
  if (typeof window !== "undefined") window.location.assign(publicUrlForPath(path));
}

function clearLocalAuthState() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("userProfile");
}

async function resetAuthState(setProfile: (p: UserProfile | null) => void, setUserId: (id: string | null) => void) {
  setProfile(null);
  setUserId(null);
  clearLocalAuthState();
  await signOutLocal();
}

function checkPagePermissions(pathname: string, profile: UserProfile): string | null {
  for (const page of ADMIN_ONLY) {
    if (pathname.startsWith(page) && profile.tipo !== "administrador") {
      return "/backoffice/dashboard";
    }
  }
  for (const page of VENDEDOR_RESTRICTED) {
    if (pathname.startsWith(page) && profile.tipo === "vendedor") {
      return "/backoffice/dashboard";
    }
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [viewAsVendedor, setViewAsVendedorState] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return sessionStorage.getItem(VIEW_AS_KEY) === "1";
      } catch {
        return false;
      }
    }
    return false;
  });
  const initialized = useRef(false);

  const isBackofficePage = pathname.startsWith("/backoffice");
  const isLoginPage = PUBLIC_BACKOFFICE.some((p) => pathname.startsWith(p));

  const setViewAsVendedor = useCallback((v: boolean) => {
    setViewAsVendedorState(v);
    try {
      if (v) sessionStorage.setItem(VIEW_AS_KEY, "1");
      else sessionStorage.removeItem(VIEW_AS_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const effectiveProfile = useMemo<UserProfile | null>(() => {
    if (!profile) return null;
    if (viewAsVendedor && profile.tipo === "administrador") {
      return { ...profile, tipo: "vendedor" };
    }
    return profile;
  }, [profile, viewAsVendedor]);

  const handleSession = useCallback(async () => {
      // Sessão e perfil em paralelo: /api/profile/ valida pelos mesmos cookies do
      // servidor e não depende do resultado de /api/auth/session/ — evita uma
      // ida-e-volta extra bloqueando o boot a cada navegação (full page load).
      const [sessionUserId, profileResult] = await Promise.all([
        syncBrowserSessionFromServer(),
        getUserProfileWithTimeout(),
      ]);

      if (!sessionUserId) {
        setProfile(null);
        setUserId(null);
        clearLocalAuthState();
        if (isBackofficePage && !isLoginPage) {
          goBackoffice("/backoffice/login/");
        }
        return;
      }

      setUserId(sessionUserId);

      const { data: nextProfile, error } = profileResult;

      if (error || !nextProfile) {
        console.error("[auth] Falha ao carregar perfil:", error);
        if (typeof window !== "undefined" && isBackofficePage && !error && !nextProfile) {
          alert(
            "Sua conta autenticou, mas não há cadastro vinculado no backoffice. Peça a um administrador para vincular em Configurações → Novo usuário → opção «Já existe no Auth — vincular só ao backoffice».",
          );
        }
        await resetAuthState(setProfile, setUserId);
        void signOutSafe();
        if (isBackofficePage) goBackoffice("/backoffice/login/");
        return;
      }

      if (!nextProfile.ativo) {
        await resetAuthState(setProfile, setUserId);
        void signOutSafe();
        if (typeof window !== "undefined") {
          alert("Sua conta está inativa. Entre em contato com o administrador.");
        }
        if (isBackofficePage) goBackoffice("/backoffice/login/");
        return;
      }

      setProfile(nextProfile);
      if (typeof window !== "undefined") {
        localStorage.setItem("userProfile", JSON.stringify(nextProfile));
      }

      if (isLoginPage) {
        if (typeof window !== "undefined") {
          try {
            if (
              sessionStorage.getItem(MOOVIFLY_POS_CONVITE_KEY) === "1" ||
              sessionStorage.getItem(MOOVIFLY_PASSWORD_RECOVERY_KEY) === "1"
            ) {
              sessionStorage.removeItem(MOOVIFLY_POS_CONVITE_KEY);
              sessionStorage.removeItem(MOOVIFLY_PASSWORD_RECOVERY_KEY);
              goBackoffice("/backoffice/definir-senha/");
              return;
            }
          } catch {
            /* ignore */
          }
        }
        goBackoffice("/backoffice/dashboard/");
        return;
      }

      const effective = viewAsVendedor && nextProfile.tipo === "administrador"
        ? { ...nextProfile, tipo: "vendedor" as const }
        : nextProfile;
      const redirect = checkPagePermissions(pathname, effective);
      if (redirect) {
        if (typeof window !== "undefined") {
          alert("Você não tem permissão para acessar esta página.");
        }
        goBackoffice(`${redirect}/`);
      }
    },
    [pathname, isBackofficePage, isLoginPage, viewAsVendedor],
  );

  const refreshProfile = useCallback(async () => {
    await handleSession();
  }, [handleSession]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let active = true;
    const supabase = getSupabaseClient();

    // Hidratação otimista: o perfil cacheado do último boot renderiza o shell de
    // imediato (sem esperar rede); handleSession revalida em seguida e corrige
    // profile/permissões — logout e falhas limpam este cache em clearLocalAuthState.
    if (isBackofficePage && !isLoginPage) {
      try {
        const cached = localStorage.getItem("userProfile");
        if (cached) {
          const parsed = JSON.parse(cached) as UserProfile;
          if (parsed?.user_id && parsed.ativo) {
            setProfile(parsed);
            setUserId(parsed.user_id);
          }
        }
      } catch {
        /* cache inválido é ignorado */
      }
    }

    (async () => {
      try {
        if (!active) return;
        if (active) setLoading(false);
        await handleSession();
      } catch (e) {
        console.error("[auth] Falha ao iniciar sessão:", e);
        await resetAuthState(setProfile, setUserId);
        if (active) setLoading(false);
        if (isBackofficePage && !isLoginPage) {
          goBackoffice("/backoffice/login/");
        }
      }
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event: string) => {
        // Boot e login usam /api/auth/session + cookies do servidor; evita refresh GoTrue no browser.
        if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          return;
        }
        try {
          await handleSession();
        } finally {
          if (active) setLoading(false);
        }
      });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [handleSession, isBackofficePage, isLoginPage]);

  useEffect(() => {
    if (!effectiveProfile) return;
    const redirect = checkPagePermissions(pathname, effectiveProfile);
    if (redirect) goBackoffice(`${redirect}/`);
  }, [pathname, effectiveProfile]);

  const signOut = useCallback(async () => {
    await resetAuthState(setProfile, setUserId);
    setViewAsVendedor(false);
    void signOutSafe();
    goBackoffice("/backoffice/login/");
  }, [setViewAsVendedor]);

  const value = useMemo<AuthContextValue>(
    () => ({ loading, profile, effectiveProfile, userId, refreshProfile, signOut, viewAsVendedor, setViewAsVendedor }),
    [loading, profile, effectiveProfile, userId, refreshProfile, signOut, viewAsVendedor, setViewAsVendedor],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}

export function useProfile() {
  return useAuth().profile;
}
