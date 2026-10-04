import { cn } from "@base-template/ui/lib/utils";
import { AlertTriangle, Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Inline banner: info, warning or destructive tone, with icon and a short title. */
export function Callout({
  tone = "info",
  title,
  children,
  icon,
  className,
}: {
  tone?: "info" | "warning" | "destructive";
  title?: string;
  children?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const Icon = icon ?? (tone === "info" ? Info : AlertTriangle);
  return (
    <div
      role={tone === "info" ? "note" : "alert"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13px]",
        tone === "info" && "border-info/40 bg-info/5",
        tone === "warning" && "border-warning/60 bg-warning/10",
        tone === "destructive" && "border-destructive/40 bg-destructive/5",
        className,
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "info" && "text-info",
          tone === "warning" && "text-foreground",
          tone === "destructive" && "text-destructive",
        )}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        {title ? <span className="font-medium">{title}</span> : null}
        {children ? <div className="text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}
