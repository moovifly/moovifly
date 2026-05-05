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
import { MOOVIFLY_POS_CONVITE_KEY } from "@/lib/auth-invite-flow";

type AuthContextValue = {
  loading: boolean;
  profile: UserProfile | null;
  userId: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ADMIN_ONLY = ["/backoffice/configuracoes"];
const MANAGER_PAGES = ["/backoffice/relatorios"];
const PUBLIC_BACKOFFICE = ["/backoffice/login"];


const PROFILE_FETCH_MS = 25_000;

/** Evita getUserProfile pendurado indefinidamente (rede/RLS), que deixava loading eterno no dashboard. */
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

/** Navegação completa; usa NEXT_PUBLIC_APP_URL em produção para não trocar de origem (www vs apex), senão o Supabase perde a sessão. */
function goBackoffice(path: string) {
  if (typeof window !== "undefined") window.location.assign(publicUrlForPath(path));
}

function checkPagePermissions(pathname: string, profile: UserProfile): string | null {
  for (const page of ADMIN_ONLY) {
    if (pathname.startsWith(page) && profile.tipo !== "administrador") {
      return "/backoffice/dashboard";
    }
  }
  for (const page of MANAGER_PAGES) {
    if (pathname.startsWith(page) && !["administrador", "gerente"].includes(profile.tipo)) {
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
  const initialized = useRef(false);

  const isBackofficePage = pathname.startsWith("/backoffice");
  const isLoginPage = PUBLIC_BACKOFFICE.some((p) => pathname.startsWith(p));

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
            if (sessionStorage.getItem(MOOVIFLY_POS_CONVITE_KEY) === "1") {
              sessionStorage.removeItem(MOOVIFLY_POS_CONVITE_KEY);
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

      const redirect = checkPagePermissions(pathname, nextProfile);
      if (redirect) {
        if (typeof window !== "undefined") {
          alert("Você não tem permissão para acessar esta página.");
        }
        goBackoffice(`${redirect}/`);
      }
    },
    [pathname, isBackofficePage, isLoginPage],
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
    if (!profile) return;
    const redirect = checkPagePermissions(pathname, profile);
    if (redirect) goBackoffice(`${redirect}/`);
  }, [pathname, profile]);

  const signOut = useCallback(async () => {
    await authSignOut();
    setProfile(null);
    setUserId(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("userProfile");
    }
    goBackoffice("/backoffice/login/");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ loading, profile, userId, refreshProfile, signOut }),
    [loading, profile, userId, refreshProfile, signOut],
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
