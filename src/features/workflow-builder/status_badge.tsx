import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusBadgeVariant = "default" | "success" | "warning" | "danger" | "info";

const STATUS_BADGE_STYLES: Record<StatusBadgeVariant, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  danger: "",
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
};

interface StatusBadgeProps {
  readonly children: ReactNode;
  readonly variant?: StatusBadgeVariant;
}

export function StatusBadge({ children, variant = "default" }: StatusBadgeProps) {
  if (variant === "danger") {
    return <Badge variant="destructive">{children}</Badge>;
  }
  return (
    <Badge variant="outline" className={cn(STATUS_BADGE_STYLES[variant])}>
      {children}
    </Badge>
  );
}
