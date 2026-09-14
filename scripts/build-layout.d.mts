export interface PluginRootResult {
  name: string;
  version: string;
  layoutRoot: string;
  pluginRoot: string;
  runtimeEntry: string;
}

export function validatePluginRoot(
  pluginRoot?: string,
): Promise<PluginRootResult>;

export function isStrictChild(parent: string, child: string): boolean;
