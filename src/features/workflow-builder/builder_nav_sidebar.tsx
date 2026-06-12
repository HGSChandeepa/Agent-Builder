"use client";

import Link from "next/link";
import { LayoutGrid, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
interface BuilderNavSidebarProps {
  readonly workflowName: string;
}

export function BuilderNavSidebar({ workflowName }: BuilderNavSidebarProps) {
  return (
    <aside className="flex w-14 shrink-0 flex-col items-center border-r border-border bg-background py-3">
      <Button
        variant="ghost"
        size="icon-sm"
        nativeButton={false}
        render={<Link href="/" />}
        title="All agents"
        className="text-muted-foreground hover:text-foreground"
      >
        <LayoutGrid />
      </Button>
      <div className="mt-4 flex flex-col items-center gap-1">
        <Button
          variant="secondary"
          size="icon-sm"
          title={workflowName}
          className="bg-primary/10 text-primary"
        >
          <Workflow />
        </Button>
        <span className="max-w-12 truncate text-[9px] text-muted-foreground">Editor</span>
      </div>
    </aside>
  );
}
