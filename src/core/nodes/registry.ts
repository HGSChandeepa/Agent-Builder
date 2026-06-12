import type { NodePlugin, NodePluginRegistry } from "@/src/core/nodes/types";

class InMemoryNodePluginRegistry implements NodePluginRegistry {
  private readonly plugins = new Map<string, NodePlugin>();

  register(plugin: NodePlugin): void {
    this.plugins.set(plugin.type, plugin);
  }

  get(type: string): NodePlugin | undefined {
    return this.plugins.get(type);
  }

  getAll(): readonly NodePlugin[] {
    return Array.from(this.plugins.values());
  }

  getByCategory(category: NodePlugin["category"]): readonly NodePlugin[] {
    return this.getAll().filter((plugin) => plugin.category === category);
  }
}

export function createNodePluginRegistry(): NodePluginRegistry {
  return new InMemoryNodePluginRegistry();
}

export const nodePluginRegistry = createNodePluginRegistry();
