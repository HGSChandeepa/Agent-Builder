import { AgentBuilderApp } from "@/src/features/workflow-builder/agent_builder_app";

interface BuilderPageProps {
  params: Promise<{ id: string }>;
}

export default async function BuilderPage({ params }: BuilderPageProps) {
  const { id } = await params;
  return <AgentBuilderApp workflowId={id} />;
}
