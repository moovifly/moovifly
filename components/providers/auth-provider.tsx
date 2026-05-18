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
import { getUserProfile, signOut as authSignOut, type UserProfile } from "@/lib/auth";
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
const VENDEDOR_RESTRICTED = ["/backoffice/clientes", "/backoffice/financeiro", "/backoffice/checkout"];
const PUBLIC_BACKOFFICE = ["/backoffice/login"];

const VIEW_AS_KEY = "moovifly_view_as_vendedor";

const PROFILE_FETCH_MS = 25_000;

async function getUserProfileWithTimeout(userId: string) {
  try {
    return await Promise.race([
      getUserProfile(userId),
      new Promise<{ data: null; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error("profile_fetch_timeout")), PROFILE_FETCH_MS),
      ),
    ]);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return { data: null, error: err };
  }
}

function goBackoffice(path: string) {
  if (typeof window !== "undefined") window.location.assign(publicUrlForPath(path));
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

  const handleSession = useCallback(
    async (sessionUserId: string | null) => {
      if (!sessionUserId) {
        setProfile(null);
        setUserId(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("userProfile");
        }
        if (isBackofficePage && !isLoginPage) {
          goBackoffice("/backoffice/login/");
        }
        return;
      }

      setUserId(sessionUserId);

      const { data: nextProfile, error } = await getUserProfileWithTimeout(sessionUserId);

      if (error || !nextProfile) {
        console.error("[auth] Falha ao carregar perfil:", error);
        if (typeof window !== "undefined" && isBackofficePage && !error && !nextProfile) {
          alert(
            "Sua conta autenticou, mas não há cadastro vinculado no backoffice. Peça a um administrador para vincular em Configurações → Novo usuário → opção «Já existe no Auth — vincular só ao backoffice».",
          );
        }
        await authSignOut();
        setProfile(null);
        setUserId(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("userProfile");
        }
        if (isBackofficePage) goBackoffice("/backoffice/login/");
        return;
      }

      if (!nextProfile.ativo) {
        await authSignOut();
        setProfile(null);
        setUserId(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("userProfile");
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
    const supabase = getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    await handleSession(data.session?.user?.id ?? null);
  }, [handleSession]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let active = true;
    const supabase = getSupabaseClient();

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        const uid = data.session?.user?.id ?? null;
        if (uid) setUserId(uid);
        if (active) setLoading(false);
        await handleSession(uid);
      } catch (e) {
        console.error("[auth] Falha ao iniciar sessão:", e);
        if (active) setLoading(false);
      }
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event: unknown, session: { user?: { id?: string } } | null) => {
        try {
          await handleSession(session?.user?.id ?? null);
        } finally {
          if (active) setLoading(false);
        }
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [handleSession]);

  useEffect(() => {
    if (!effectiveProfile) return;
    const redirect = checkPagePermissions(pathname, effectiveProfile);
    if (redirect) goBackoffice(`${redirect}/`);
  }, [pathname, effectiveProfile]);

  const signOut = useCallback(async () => {
    await authSignOut();
    setProfile(null);
    setUserId(null);
    setViewAsVendedor(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("userProfile");
    }
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
