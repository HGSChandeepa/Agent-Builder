import type { LucideIcon } from "lucide-react";
import {
  Brain,
  GitBranch,
  Globe,
  Play,
  Shield,
  Shuffle,
  Zap,
} from "lucide-react";

export interface BuilderCategoryConfig {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
}

export const BUILDER_CATEGORY_ORDER: readonly string[] = [
  "trigger",
  "ai",
  "data",
  "control",
  "action",
  "governance",
  "output",
  "input",
];

export const BUILDER_CATEGORY_CONFIG: Record<string, BuilderCategoryConfig> = {
  trigger: {
    id: "trigger",
    label: "Triggers",
    description: "Triggers start your workflow when an event happens.",
    icon: Play,
  },
  ai: {
    id: "ai",
    label: "AI",
    description: "Build autonomous agents, summarize, or call language models.",
    icon: Brain,
  },
  data: {
    id: "data",
    label: "Data",
    description: "Pull data with HTTP requests, databases, or APIs.",
    icon: Globe,
  },
  control: {
    id: "control",
    label: "Flow",
    description: "Branch, merge, or loop the flow across conditions.",
    icon: GitBranch,
  },
  action: {
    id: "action",
    label: "Actions",
    description: "Do something in an app or update external records.",
    icon: Zap,
  },
  governance: {
    id: "governance",
    label: "Human review",
    description: "Request approval or enforce safety policies.",
    icon: Shield,
  },
  output: {
    id: "output",
    label: "Output",
    description: "Return responses, transform data, or emit metrics.",
    icon: Shuffle,
  },
  input: {
    id: "input",
    label: "Input",
    description: "Accept structured input from external sources.",
    icon: Globe,
  },
};
