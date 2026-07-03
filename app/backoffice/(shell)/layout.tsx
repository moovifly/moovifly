import { BackofficeShell } from "@/components/backoffice/backoffice-shell";

/**
 * A navegação do backoffice é full-page por design (BackofficeLink usa <a>).
 * Speculation Rules pré-carrega o documento da rota ao passar o mouse no link
 * (Chrome/Edge; demais navegadores ignoram sem efeito colateral).
 */
const SPECULATION_RULES = JSON.stringify({
  prefetch: [
    { source: "document", where: { href_matches: "/backoffice/*" }, eagerness: "moderate" },
  ],
});

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="speculationrules" dangerouslySetInnerHTML={{ __html: SPECULATION_RULES }} />
      <BackofficeShell>{children}</BackofficeShell>
    </>
  );
}
