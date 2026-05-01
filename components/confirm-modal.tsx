"use client";

import { createRoot } from "react-dom/client";
import { Button } from "./ui/button";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export function showConfirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);

    function cleanup(result: boolean) {
      root.unmount();
      document.body.removeChild(container);
      resolve(result);
    }

    root.render(
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => cleanup(false)} />
        <div className="relative z-10 w-full max-w-sm rounded-xl border border-[var(--border-subtle)] bg-card p-6 shadow-[var(--shadow-lg)]">
          <h2 className="text-lg font-semibold text-foreground">{opts.title}</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{opts.message}</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => cleanup(false)}>
              {opts.cancelText ?? "Cancelar"}
            </Button>
            <Button
              variant={opts.destructive ? "destructive" : "default"}
              size="sm"
              onClick={() => cleanup(true)}
            >
              {opts.confirmText ?? "Confirmar"}
            </Button>
          </div>
        </div>
      </div>,
    );
  });
}
