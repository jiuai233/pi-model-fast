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

test("Magpie Codex routes use the upstream capability without changing the route", () => {
  const magpie = { provider: "magpie", id: "codex/gpt-6.1-sol", api: "openai-responses" as const };
  const codexOnly = parseOpenAiCatalog({ models: [{ slug: "gpt-6.1-sol", display_name: "GPT-6.1 Sol", additional_speed_tiers: ["fast"] }] });
  assert.equal(canUseFast(magpie, codexOnly), true);
  assert.equal(fastStatus(magpie, true, codexOnly), "Fast ON");
  const payload = { model: magpie.id, input: [], reasoning: { effort: "high" }, tools: [] };
  assert.deepEqual(adapterFor(magpie)!.apply(payload), { ...payload, service_tier: "priority" });
  assert.equal(payload.model, "codex/gpt-6.1-sol");
  assert.equal("service_tier" in payload, false);
  assert.equal(canUseFast({ ...magpie, id: "codex/unknown" }, codexOnly), false);
  for (const id of ["auto/gpt-6.1-sol", "group/mixed", "other/gpt-6.1-sol", "gpt-6.1-sol"]) {
    assert.equal(adapterFor({ ...magpie, id }), undefined);
    assert.equal(canUseFast({ ...magpie, id }, codexOnly), false);
  }
  assert.equal(adapterFor({ ...magpie, api: "openai-completions" }), undefined);
});
