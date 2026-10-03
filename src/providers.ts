import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Catalog } from "./catalog.ts";
import { modelKey } from "./catalog.ts";

export type ModelIdentity = Pick<NonNullable<ExtensionContext["model"]>, "provider" | "id" | "api">;
export interface FastAdapter {
  providers: readonly string[];
  supportsApi(api: string): boolean;
  apply(payload: Record<string, unknown>): Record<string, unknown>;
}

export const adapters: FastAdapter[] = [{
  providers: ["openai", "openai-codex"],
  supportsApi: (api) => ["openai-responses", "openai-codex-responses", "openai-completions"].includes(api),
  apply: (payload) => ({ ...payload, service_tier: "priority" }),
}];

export function adapterFor(model: ModelIdentity | undefined): FastAdapter | undefined {
  return model && adapters.find((adapter) =>
    adapter.providers.includes(model.provider) && adapter.supportsApi(model.api));
}

export function canUseFast(model: ModelIdentity | undefined, catalog: Catalog): boolean {
  return !!adapterFor(model) && catalog.models.some((entry) => modelKey(entry) === modelKey(model!));
}

export function fastStatus(model: ModelIdentity | undefined, enabled: boolean, catalog: Catalog): string {
  if (!model) return "Fast · 未选择模型";
  if (!adapterFor(model)) return "Fast · 未适配";
  if (!canUseFast(model, catalog)) return "Fast · 清单未收录";
  if (!enabled) return "Fast · 已关闭";
  return "Fast ON";
}
