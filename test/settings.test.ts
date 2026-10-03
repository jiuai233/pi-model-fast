import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readSettings, setEnabled, writeJson } from "../src/settings.ts";

test("settings start disabled and switches persist independently for each model", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-fast-settings-"));
  try {
    const file = join(dir, "extensions", "settings.json");
    assert.deepEqual(readSettings(file), { version: 1, enabledModels: {} });
    setEnabled(file, "openai-codex/gpt-6.1-sol", true);
    setEnabled(file, "openai/gpt-6-sol", false);
    assert.equal(readSettings(file).enabledModels["openai-codex/gpt-6.1-sol"], true);
    setEnabled(file, "openai-codex/gpt-6.1-sol", false);
    assert.equal(readSettings(file).enabledModels["openai-codex/gpt-6.1-sol"], false);
    assert.equal(JSON.parse(readFileSync(file, "utf8")).enabledModels["openai/gpt-6-sol"], false);
    writeJson(file, { version: 1, enabledModels: { invalid: "yes" } });
    assert.throws(() => readSettings(file), /格式无效/);
    writeJson(file, { version: 1, enabledModels: true });
    assert.throws(() => readSettings(file), /格式无效/);
  } finally { rmSync(dir, { recursive: true }); }
});
