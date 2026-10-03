import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadCatalog, needsRefresh, OPENAI_CATALOG_URL, parseOpenAiCatalog, REFRESH_INTERVAL_MS, refreshCatalog } from "../src/catalog.ts";
import { writeJson } from "../src/settings.ts";

const source = { models: [
  { slug: "gpt-6.1-sol", display_name: "GPT-6.1 Sol", supported_in_api: true, service_tiers: [{ id: "priority" }] },
  { slug: "codex-only", display_name: "Codex only", additional_speed_tiers: ["fast"] },
  { slug: "standard-only", display_name: "Standard" },
] };

test("official capability fields define the Fast list without assuming all models support it", () => {
  const catalog = parseOpenAiCatalog(source);
  assert.deepEqual(catalog.models.map((model) => `${model.provider}/${model.id}`), [
    "openai-codex/codex-only", "openai-codex/gpt-6.1-sol", "openai/gpt-6.1-sol",
  ]);
  assert.equal(catalog.source, OPENAI_CATALOG_URL);
  assert.throws(() => parseOpenAiCatalog({ data: [] }), /格式无效/);
  assert.throws(() => parseOpenAiCatalog({ models: [{ slug: "other", display_name: "Other" }] }), /Fast 能力/);
});

test("cache selection uses the newest snapshot and refresh becomes due after six hours", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-fast-catalog-"));
  try {
    const bundled = join(dir, "bundled.json"), cached = join(dir, "cache.json");
    const older = parseOpenAiCatalog(source, new Date("2026-01-01T00:00:00Z"));
    const newer = parseOpenAiCatalog(source, new Date("2026-01-02T00:00:00Z"));
    writeJson(bundled, newer);
    assert.equal(loadCatalog(cached, bundled).updatedAt, newer.updatedAt);
    writeJson(cached, older);
    assert.equal(loadCatalog(cached, bundled).updatedAt, newer.updatedAt);
    writeJson(cached, parseOpenAiCatalog(source, new Date("2026-01-03T00:00:00Z")));
    assert.equal(loadCatalog(cached, bundled).updatedAt, "2026-01-03T00:00:00.000Z");
    const now = Date.parse(newer.updatedAt);
    assert.equal(needsRefresh(newer, now + REFRESH_INTERVAL_MS - 1), false);
    assert.equal(needsRefresh(newer, now + REFRESH_INTERVAL_MS), true);
  } finally { rmSync(dir, { recursive: true }); }
});

test("live refresh writes only capability metadata and failures retain the last cache", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-fast-refresh-"));
  try {
    const file = join(dir, "cache.json");
    const fetcher = (async (url, options) => {
      assert.equal(url, OPENAI_CATALOG_URL);
      assert.ok(options?.signal);
      return Response.json(source);
    }) as typeof fetch;
    const catalog = await refreshCatalog(file, fetcher);
    assert.equal(JSON.parse(readFileSync(file, "utf8")).models.length, 3);
    const saved = readFileSync(file, "utf8");
    await assert.rejects(refreshCatalog(file, (async () => new Response("", { status: 503 })) as typeof fetch), /503/);
    await assert.rejects(refreshCatalog(file, (async () => Response.json({ data: [] })) as typeof fetch), /格式无效/);
    assert.equal(readFileSync(file, "utf8"), saved);
    assert.equal(catalog.models[0].id, "codex-only");
  } finally { rmSync(dir, { recursive: true }); }
});
