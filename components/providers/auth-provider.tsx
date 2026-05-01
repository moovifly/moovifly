"use client";

import { useRouter, usePathname } from "next/navigation";
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
import { getUserProfile, signOut as authSignOut, type UserProfile } from "@/lib/auth";

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
  const router = useRouter();
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
          router.replace("/backoffice/login/");
        }
        return;
      }

      setUserId(sessionUserId);

      const { data: nextProfile, error } = await getUserProfile(sessionUserId);

      if (error || !nextProfile) {
        console.error("[auth] Falha ao carregar perfil:", error);
        await authSignOut();
        setProfile(null);
        setUserId(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("userProfile");
        }
        if (isBackofficePage) router.replace("/backoffice/login/");
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
        if (isBackofficePage) router.replace("/backoffice/login/");
        return;
      }

      setProfile(nextProfile);
      if (typeof window !== "undefined") {
        localStorage.setItem("userProfile", JSON.stringify(nextProfile));
      }

      if (isLoginPage) {
        router.replace("/backoffice/dashboard/");
        return;
      }

      const redirect = checkPagePermissions(pathname, nextProfile);
      if (redirect) {
        if (typeof window !== "undefined") {
          alert("Você não tem permissão para acessar esta página.");
        }
        router.replace(`${redirect}/`);
      }
    },
    [pathname, isBackofficePage, isLoginPage, router],
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
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      await handleSession(data.session?.user?.id ?? null);
      if (active) setLoading(false);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event: unknown, session: { user?: { id?: string } } | null) => {
        await handleSession(session?.user?.id ?? null);
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
    if (redirect) router.replace(`${redirect}/`);
  }, [pathname, profile, router]);

  const signOut = useCallback(async () => {
    await authSignOut();
    setProfile(null);
    setUserId(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("userProfile");
    }
    router.replace("/backoffice/login/");
  }, [router]);

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
