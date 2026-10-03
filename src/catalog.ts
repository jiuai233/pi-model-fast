import { existsSync, readFileSync } from "node:fs";
import { writeJson } from "./settings.ts";

export const OPENAI_CATALOG_URL =
  "https://raw.githubusercontent.com/openai/codex/main/codex-rs/models-manager/models.json";
export const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface FastModel {
  provider: string;
  id: string;
  name: string;
}
export interface Catalog {
  version: 1;
  updatedAt: string;
  source: string;
  models: FastModel[];
}
interface CodexModel {
  slug: string;
  display_name: string;
  supported_in_api?: boolean;
  service_tiers?: { id: string }[];
  additional_speed_tiers?: string[];
}

export function parseOpenAiCatalog(data: unknown, now = new Date()): Catalog {
  const models = (data as { models?: CodexModel[] } | null)?.models;
  if (!Array.isArray(models)) throw new Error("OpenAI 模型目录格式无效");
  const entries = models.flatMap((model): FastModel[] => {
    const supportsFast = model.service_tiers?.some((tier) => tier.id === "priority" || tier.id === "fast") ||
      model.additional_speed_tiers?.includes("fast");
    if (!supportsFast) return [];
    if (typeof model.slug !== "string" || typeof model.display_name !== "string") {
      throw new Error("OpenAI 模型目录缺少模型名称");
    }
    const providers = model.supported_in_api === true ? ["openai", "openai-codex"] : ["openai-codex"];
    return providers.map((provider) => ({ provider, id: model.slug, name: model.display_name }));
  }).sort((a, b) => modelKey(a).localeCompare(modelKey(b)));
  if (!entries.length) throw new Error("OpenAI 模型目录未提供 Fast 能力记录");
  return { version: 1, updatedAt: now.toISOString(), source: OPENAI_CATALOG_URL, models: entries };
}

export function modelKey(model: Pick<FastModel, "provider" | "id">): string {
  return `${model.provider}/${model.id}`;
}

export function readCatalog(file: string): Catalog {
  const catalog = JSON.parse(readFileSync(file, "utf8")) as Catalog;
  if (!catalog || catalog.version !== 1 || !Number.isFinite(Date.parse(catalog.updatedAt)) ||
      !Array.isArray(catalog.models) || catalog.models.some((model) =>
        typeof model.provider !== "string" || typeof model.id !== "string" || typeof model.name !== "string")) {
    throw new Error("Fast 清单格式无效");
  }
  return catalog;
}

export function loadCatalog(cacheFile: string, bundledFile: string): Catalog {
  const bundled = readCatalog(bundledFile);
  if (!existsSync(cacheFile)) return bundled;
  const cached = readCatalog(cacheFile);
  return Date.parse(cached.updatedAt) > Date.parse(bundled.updatedAt) ? cached : bundled;
}

export function needsRefresh(catalog: Catalog, now = Date.now()): boolean {
  return now - Date.parse(catalog.updatedAt) >= REFRESH_INTERVAL_MS;
}

export async function refreshCatalog(file: string, fetcher: typeof fetch = fetch): Promise<Catalog> {
  const response = await fetcher(OPENAI_CATALOG_URL, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`OpenAI 模型目录 HTTP ${response.status}`);
  const catalog = parseOpenAiCatalog(await response.json());
  writeJson(file, catalog);
  return catalog;
}
