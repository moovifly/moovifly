import type { Metadata } from "next";
import { DM_Sans, Outfit } from "next/font/google";

import "./globals.css";
import { AuthHashRedirect } from "@/components/auth-hash-redirect";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/sonner";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MooviFly — Viva em Movimento",
  description:
    "MooviFly é a sua agência de viagens para experiências inesquecíveis: passagens aéreas, pacotes, hospedagem, lua de mel e roteiros sob medida.",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${dmSans.variable} ${outfit.variable}`}>
      <body>
        <AuthHashRedirect />
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
          <Toaster richColors closeButton position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
