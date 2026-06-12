import { NextResponse } from "next/server";
import { ensurePlatformReady } from "@/src/lib/bootstrap";
import { nodePluginRegistry } from "@/src/core/nodes/registry";

export async function GET(): Promise<NextResponse> {
  ensurePlatformReady();
  const plugins = nodePluginRegistry.getAll().map((plugin) => ({
    type: plugin.type,
    label: plugin.label,
    description: plugin.description,
    category: plugin.category,
    icon: plugin.icon,
    color: plugin.color,
    inputPorts: plugin.inputPorts,
    outputPorts: plugin.outputPorts,
    configFields: plugin.configFields,
    defaultConfig: plugin.defaultConfig,
    isMutating: plugin.isMutating ?? false,
  }));
  return NextResponse.json({ plugins });
}
