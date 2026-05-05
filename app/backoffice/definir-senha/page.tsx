import type { Metadata } from "next";

import { DefinirSenhaForm } from "./definir-senha-form";

export const metadata: Metadata = {
  title: "Definir senha — MooviFly Backoffice",
};

export default function DefinirSenhaPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-card p-6 shadow-sm">
        <DefinirSenhaForm />
      </div>
    </div>
  );
}
