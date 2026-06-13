"use client";

import Link from "next/link";
import { LayoutGrid, Plug, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AppNavSection = "agents" | "integrations" | "editor";

interface AppNavSidebarProps {
  readonly activeSection: AppNavSection;
  readonly workflowName?: string;
}

export function AppNavSidebar({ activeSection, workflowName }: AppNavSidebarProps) {
  return (
    <aside className="flex w-14 shrink-0 flex-col items-center border-r border-border bg-background py-3">
      <Button
        variant={activeSection === "agents" ? "secondary" : "ghost"}
        size="icon-sm"
        nativeButton={false}
        render={<Link href="/" />}
        title="All agents"
        className={cn(
          activeSection === "agents" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutGrid />
      </Button>
      <div className="mt-4 flex flex-col items-center gap-1">
        <Button
          variant={activeSection === "integrations" ? "secondary" : "ghost"}
          size="icon-sm"
          nativeButton={false}
          render={<Link href="/integrations" />}
          title="Integrations"
          className={cn(
            activeSection === "integrations"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Plug />
        </Button>
        <span className="max-w-12 truncate text-[9px] text-muted-foreground">Integrate</span>
      </div>
      {activeSection === "editor" && (
        <div className="mt-4 flex flex-col items-center gap-1">
          <Button
            variant="secondary"
            size="icon-sm"
            title={workflowName ?? "Editor"}
            className="bg-primary/10 text-primary"
          >
            <Workflow />
          </Button>
          <span className="max-w-12 truncate text-[9px] text-muted-foreground">Editor</span>
        </div>
      )}
    </aside>
  );
}
