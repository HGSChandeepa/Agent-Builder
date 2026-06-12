"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight, MoreHorizontal, Save } from "lucide-react";
import type { WorkflowDefinition } from "@/src/core/workflow/types";
import { StatusBadge } from "@/src/features/workflow-builder/status_badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type BuilderViewTab = "editor" | "executions";

interface WorkflowTopBarProps {
  readonly workflow: WorkflowDefinition;
  readonly activeTab: BuilderViewTab;
  readonly validationIssueCount: number;
  readonly isSaving: boolean;
  readonly onTabChange: (tab: BuilderViewTab) => void;
  readonly onSave: () => void;
  readonly onPublish: () => void;
}

export function WorkflowTopBar({
  workflow,
  activeTab,
  validationIssueCount,
  isSaving,
  onTabChange,
  onSave,
  onPublish,
}: WorkflowTopBarProps) {
  return (
    <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/" />}
          className="text-muted-foreground"
        >
          Agents
        </Button>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium text-foreground">{workflow.name}</span>
        <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
          {workflow.environment}
        </Badge>
        {validationIssueCount > 0 && (
          <StatusBadge variant="warning">
            {validationIssueCount} issue{validationIssueCount > 1 ? "s" : ""}
          </StatusBadge>
        )}
      </div>
      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange(value as BuilderViewTab)}
        className="absolute left-1/2 -translate-x-1/2"
      >
        <TabsList className="h-8">
          <TabsTrigger value="editor" className="px-4 text-xs">
            Editor
          </TabsTrigger>
          <TabsTrigger value="executions" className="px-4 text-xs">
            Executions
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex items-center gap-1.5">
        <span className="hidden text-xs text-muted-foreground md:inline">
          v{workflow.version}
        </span>
        <Button variant="outline" size="sm" onClick={onSave} disabled={isSaving}>
          <Save data-icon="inline-start" />
          {isSaving ? "Saving…" : "Save"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="sm">
                Publish
                <ChevronDown data-icon="inline-end" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onSave}>Save draft</DropdownMenuItem>
            <DropdownMenuItem onClick={onPublish}>Publish agent</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon-sm">
          <MoreHorizontal />
        </Button>
      </div>
    </header>
  );
}
