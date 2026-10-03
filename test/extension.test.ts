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
    theme: { fg: (color: string, text: string) => `<${color}>${text}</${color}>` },
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
    const green = "<success>⚡\uFE0E</success> <accent>Fast ON</accent>";
    const red = "<error>⚡\uFE0E</error> <accent>Fast ON</accent>";
    const assistant = { role: "assistant", provider: model.provider, model: model.id };
    assert.equal(status, green);
    assert.equal(readSettings(join(dir, "extensions", "pi-model-fast.json")).enabledModels["openai-codex/gpt-6.1-sol"], true);
    const original = { model: model.id, input: [] };
    assert.deepEqual(await hooks.get("before_provider_request")!({ payload: original }, ctx), { ...original, service_tier: "priority" });
    assert.equal(status, green);
    hooks.get("message_end")!({ message: { ...assistant, model: "other-model", stopReason: "error" } }, ctx);
    assert.equal(status, green);
    hooks.get("message_end")!({ message: { ...assistant, stopReason: "error" } }, ctx);
    assert.equal(status, red);
    hooks.get("agent_end")!({}, ctx);
    assert.equal(status, red);
    await handler!("status", ctx);
    assert.ok(messages.at(-1)?.includes("上次请求失败"));
    const other = { ...ctx, model: { ...ctx.model!, id: "other-model" } };
    hooks.get("model_select")!({}, other);
    assert.equal(status, undefined);
    hooks.get("model_select")!({}, ctx);
    assert.equal(status, red);
    await hooks.get("before_provider_request")!({ payload: original }, ctx);
    assert.equal(status, red);
    hooks.get("message_end")!({ message: { ...assistant, stopReason: "aborted" } }, ctx);
    assert.equal(status, red);
    await hooks.get("before_provider_request")!({ payload: original }, ctx);
    hooks.get("message_end")!({ message: { ...assistant, stopReason: "stop" } }, ctx);
    assert.equal(status, green);
    assert.equal(await hooks.get("before_provider_request")!({ payload: { model: "other-model" } }, ctx), undefined);
    hooks.get("message_end")!({ message: { ...assistant, stopReason: "error" } }, ctx);
    assert.equal(status, green);
    await handler!("status", ctx);
    assert.ok(messages.at(-1)?.includes("Fast ON"));
    assert.ok(!messages.at(-1)?.includes("上次请求失败"));
    assert.ok(!messages.at(-1)?.includes("unknown"));
    await handler!("list", ctx);
    assert.ok(messages.at(-1)?.includes("openai-codex/gpt-6.1-sol"));
    await handler!("off", ctx);
    assert.equal(status, undefined);
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
    theme: { fg: (color: string, text: string) => `<${color}>${text}</${color}>` },
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
    assert.equal(status, "<success>⚡\uFE0E</success> <accent>Fast ON</accent>");
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
