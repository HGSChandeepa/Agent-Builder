import { nodePluginRegistry } from "@/src/core/nodes/registry";
import { allNodePlugins } from "@/src/core/nodes/plugins/index";
import { seedDefaultCredentials } from "@/src/security/secrets/vault";
import { createExecutionEngine } from "@/src/core/execution/engine";

let initialized = false;

export function bootstrapPlatform(): void {
  if (initialized) {
    return;
  }
  for (const plugin of allNodePlugins) {
    nodePluginRegistry.register(plugin);
  }
  seedDefaultCredentials();
  initialized = true;
}

export const executionEngine = createExecutionEngine(nodePluginRegistry);

export function ensurePlatformReady(): void {
  bootstrapPlatform();
}
