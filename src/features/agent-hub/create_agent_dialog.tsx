"use client";

import { useState, type FormEvent } from "react";
import type { WorkflowEnvironment } from "@/src/core/workflow/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface CreateAgentDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreate: (input: { name: string; description: string; environment: WorkflowEnvironment }) => Promise<void>;
  readonly isCreating: boolean;
}

export function CreateAgentDialog({ open, onOpenChange, onCreate, isCreating }: CreateAgentDialogProps) {
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [environment, setEnvironment] = useState<WorkflowEnvironment>("development");
  const [error, setError] = useState<string | null>(null);
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Give your agent a name before going online.");
      return;
    }
    setError(null);
    try {
      await onCreate({ name: trimmedName, description: description.trim(), environment });
      setName("");
      setDescription("");
      setEnvironment("development");
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create agent");
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a new agent</DialogTitle>
          <DialogDescription>
            Define the agent you want to bring online. You will customize its workflow in the builder next.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">
              Agent name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Customer Support Agent"
              disabled={isCreating}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-description">Description</Label>
            <Textarea
              id="agent-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What does this agent do?"
              rows={3}
              disabled={isCreating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-environment">Environment</Label>
            <Select
              value={environment}
              onValueChange={(value) => setEnvironment(value as WorkflowEnvironment)}
              disabled={isCreating}
            >
              <SelectTrigger id="agent-environment" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="development">Development</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creating…" : "Create & open builder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
