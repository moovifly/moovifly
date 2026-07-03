import { cn } from "@/lib/utils";

type IconType = React.ComponentType<{ className?: string }>;

/** Estado vazio padrão das listas do backoffice: ícone + título + texto secundário. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: IconType;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-14 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-overlay)] text-[var(--text-muted)]">
        <Icon className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-xs text-[var(--text-secondary)]">{description}</p>}
      </div>
    </div>
  );
}
