"use client";

import { Loader2 } from "lucide-react";
import { type ReactNode } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Sidebar } from "./sidebar";

export function BackofficeShell({ children }: { children: ReactNode }) {
  const { loading, profile } = useAuth();

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-600)]" />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
