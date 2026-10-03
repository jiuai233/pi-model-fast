import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { OPENAI_CATALOG_URL, parseOpenAiCatalog } from "../src/catalog.ts";
import { writeJson } from "../src/settings.ts";

const file = fileURLToPath(new URL("../catalog/openai.json", import.meta.url));
const response = await fetch(OPENAI_CATALOG_URL, { signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error(`OpenAI 模型目录 HTTP ${response.status}`);
const next = parseOpenAiCatalog(await response.json());
const previous = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined;
if (JSON.stringify(previous?.models) === JSON.stringify(next.models)) {
  console.log("Fast 清单无变化");
} else {
  writeJson(file, next);
  console.log(`Fast 清单更新：${next.models.length} 项`);
}
