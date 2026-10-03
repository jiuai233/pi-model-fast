import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface Settings {
  version: 1;
  enabledModels: Record<string, boolean>;
}

export function readSettings(file: string): Settings {
  if (!existsSync(file)) return { version: 1, enabledModels: {} };
  const data = JSON.parse(readFileSync(file, "utf8")) as Settings;
  if (!data || data.version !== 1 || !data.enabledModels || typeof data.enabledModels !== "object" || Array.isArray(data.enabledModels) ||
      Object.values(data.enabledModels).some((value) => typeof value !== "boolean")) {
    throw new Error("pi-model-fast 配置格式无效");
  }
  return data;
}

export function writeJson(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  renameSync(temporary, file);
}

export function setEnabled(file: string, key: string, enabled: boolean): void {
  const settings = readSettings(file);
  settings.enabledModels[key] = enabled;
  writeJson(file, settings);
}
