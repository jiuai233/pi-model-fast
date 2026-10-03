import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import modelFast from "../src/index.ts";
import { readSettings } from "../src/settings.ts";

test("the command, request injection and status lifecycle work together", async () => {
  const old = process.env.PI_CODING_AGENT_DIR;
  const dir = mkdtempSync(join(tmpdir(), "pi-fast-extension-"));
  process.env.PI_CODING_AGENT_DIR = dir;
  const hooks = new Map<string, (event: any, ctx: ExtensionContext) => unknown>();
  let handler: (args: string, ctx: ExtensionContext) => Promise<void>;
  let status: string | undefined;
  const messages: string[] = [];
  const model = { provider: "openai-codex", id: "gpt-6.1-sol", api: "openai-codex-responses" };
  const ctx = { model, ui: {
    setStatus(_key: string, value: string | undefined) { status = value; },
    notify(message: string) { messages.push(message); },
  } } as unknown as ExtensionContext;
  const pi = {
    on(name: string, callback: (event: any, context: ExtensionContext) => unknown) { hooks.set(name, callback); },
    registerCommand(name: string, command: { handler: typeof handler }) {
      assert.equal(name, "fast"); handler = command.handler;
    },
  } as unknown as ExtensionAPI;
  try {
    modelFast(pi);
    await handler!("on", ctx);
    assert.equal(status, "⚡ Fast");
    assert.equal(readSettings(join(dir, "extensions", "pi-model-fast.json")).enabledModels["openai-codex/gpt-6.1-sol"], true);
    const original = { model: model.id, input: [] };
    assert.deepEqual(await hooks.get("before_provider_request")!({ payload: original }, ctx), { ...original, service_tier: "priority" });
    assert.equal(status, "⚡ Fast · 请求中");
    hooks.get("message_end")!({ message: { role: "assistant" } }, ctx);
    assert.equal(status, "⚡ Fast");
    assert.equal(await hooks.get("before_provider_request")!({ payload: { model: "other-model" } }, ctx), undefined);
    await handler!("status", ctx);
    assert.ok(messages.at(-1)?.includes("⚡ Fast"));
    assert.ok(!messages.at(-1)?.includes("unknown"));
    await handler!("list", ctx);
    assert.ok(messages.at(-1)?.includes("openai-codex/gpt-6.1-sol"));
    await handler!("off", ctx);
    assert.equal(status, "Fast · 已关闭");
    assert.equal(await hooks.get("before_provider_request")!({ payload: original }, ctx), undefined);
    await handler!("unsupported-command", ctx);
    assert.ok(messages.at(-1)?.startsWith("用法："));
    hooks.get("session_shutdown")!({}, ctx);
    assert.equal(status, undefined);
  } finally {
    if (old === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = old;
    rmSync(dir, { recursive: true });
  }
});

test("a new official model can be enabled after refresh and failed refresh retains its capability", async () => {
  const oldDirectory = process.env.PI_CODING_AGENT_DIR;
  const oldFetch = globalThis.fetch;
  const dir = mkdtempSync(join(tmpdir(), "pi-fast-new-model-"));
  process.env.PI_CODING_AGENT_DIR = dir;
  const hooks = new Map<string, (event: any, ctx: ExtensionContext) => unknown>();
  let handler: (args: string, ctx: ExtensionContext) => Promise<void>;
  let status: string | undefined;
  const messages: string[] = [];
  const model = { provider: "openai-codex", id: "future-official-model", api: "openai-codex-responses" };
  const ctx = { model, ui: {
    setStatus(_key: string, value: string | undefined) { status = value; },
    notify(message: string) { messages.push(message); },
  } } as unknown as ExtensionContext;
  const pi = {
    on(name: string, callback: (event: any, context: ExtensionContext) => unknown) { hooks.set(name, callback); },
    registerCommand(_name: string, command: { handler: typeof handler }) { handler = command.handler; },
  } as unknown as ExtensionAPI;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return Response.json({ models: [{ slug: model.id, display_name: "Future official model", additional_speed_tiers: ["fast"] }] });
  }) as typeof fetch;
  try {
    modelFast(pi);
    await handler!("on", ctx);
    assert.equal(calls, 1);
    assert.equal(status, "⚡ Fast");
    const payload = { model: model.id };
    assert.deepEqual(await hooks.get("before_provider_request")!({ payload }, ctx), { ...payload, service_tier: "priority" });
    globalThis.fetch = (async () => new Response("", { status: 503 })) as typeof fetch;
    await handler!("refresh", ctx);
    assert.ok(messages.some((message) => message.includes("更新失败")));
    assert.deepEqual(await hooks.get("before_provider_request")!({ payload }, ctx), { ...payload, service_tier: "priority" });
    assert.ok(messages.at(-1)?.includes("UTC+8"));
  } finally {
    globalThis.fetch = oldFetch;
    if (oldDirectory === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = oldDirectory;
    rmSync(dir, { recursive: true });
  }
});
