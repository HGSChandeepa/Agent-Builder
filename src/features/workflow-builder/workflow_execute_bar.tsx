"use client";

import { Play, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WorkflowExecuteBarProps {
  readonly isRunning: boolean;
  readonly isSimulation: boolean;
  readonly runInput: string;
  readonly onRun: () => void;
  readonly onSimulationChange: (value: boolean) => void;
  readonly onRunInputChange: (value: string) => void;
}

export function WorkflowExecuteBar({
  isRunning,
  isSimulation,
  runInput,
  onRun,
  onSimulationChange,
  onRunInputChange,
}: WorkflowExecuteBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex items-center justify-center gap-2 px-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-border bg-background/95 p-1.5 shadow-lg backdrop-blur">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" title="Run settings">
                <Settings2 />
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Run settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="space-y-3 px-2 py-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="execute-simulation" className="text-xs font-normal">
                    Simulation mode
                  </Label>
                  <Switch
                    id="execute-simulation"
                    checked={isSimulation}
                    onCheckedChange={onSimulationChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="execute-input" className="text-xs font-normal">
                    Test input (JSON)
                  </Label>
                  <Input
                    id="execute-input"
                    value={runInput}
                    onChange={(event) => onRunInputChange(event.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="lg"
          onClick={onRun}
          disabled={isRunning}
          className="min-w-44 bg-orange-600 text-white hover:bg-orange-700"
        >
          <Play data-icon="inline-start" />
          {isRunning ? "Executing…" : "Execute workflow"}
        </Button>
      </div>
    </div>
  );
}
