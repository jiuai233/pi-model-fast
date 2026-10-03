import assert from "node:assert/strict";
import test from "node:test";
import { adapterFor, canUseFast, fastStatus } from "../src/providers.ts";
import { parseOpenAiCatalog } from "../src/catalog.ts";

const catalog = parseOpenAiCatalog({ models: [{ slug: "gpt-6.1-sol", display_name: "GPT-6.1 Sol", supported_in_api: true, service_tiers: [{ id: "priority" }] }] });
const model = { provider: "openai-codex", id: "gpt-6.1-sol", api: "openai-codex-responses" as const };

test("Fast UI and wire priority remain separate", () => {
  assert.equal(canUseFast(model, catalog), true);
  assert.equal(fastStatus(model, true, catalog), "Fast ON");
  assert.equal(fastStatus(model, false, catalog), "Fast · 已关闭");
  const original = { model: model.id, input: [] };
  assert.deepEqual(adapterFor(model)!.apply(original), { ...original, service_tier: "priority" });
  assert.equal("service_tier" in original, false);
});

test("missing entries and other providers are not silently marked supported", () => {
  assert.equal(canUseFast({ ...model, id: "new-model" }, catalog), false);
  assert.equal(fastStatus({ ...model, id: "new-model" }, true, catalog), "Fast · 清单未收录");
  assert.equal(adapterFor({ ...model, provider: "anthropic" }), undefined);
  assert.equal(fastStatus({ ...model, provider: "anthropic" }, true, catalog), "Fast · 未适配");
  assert.equal(canUseFast({ ...model, provider: "openai", api: "openai-responses" }, catalog), true);
});
