import { BackofficeShell } from "@/components/backoffice/backoffice-shell";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return <BackofficeShell>{children}</BackofficeShell>;
}
