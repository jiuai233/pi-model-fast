import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog, modelKey, needsRefresh, REFRESH_INTERVAL_MS, refreshCatalog } from "./catalog.ts";
import { adapterFor, canUseFast, fastStatus } from "./providers.ts";
import { readSettings, setEnabled } from "./settings.ts";

const STATUS_KEY = "pi-model-fast";
const ARGUMENTS = ["on", "off", "status", "list", "refresh"];

export default function modelFast(pi: ExtensionAPI): void {
  const directory = join(getAgentDir(), "extensions");
  const settingsFile = join(directory, "pi-model-fast.json");
  const cacheFile = join(directory, "pi-model-fast-catalog.json");
  const bundledFile = fileURLToPath(new URL("../catalog/openai.json", import.meta.url));
  let catalog = loadCatalog(cacheFile, bundledFile);
  let refreshing: Promise<void> | undefined;
  let lastRefreshAttempt = 0;

  function enabled(ctx: ExtensionContext): boolean {
    return !!ctx.model && readSettings(settingsFile).enabledModels[modelKey(ctx.model)] === true;
  }
  function showStatus(ctx: ExtensionContext, requesting = false): void {
    ctx.ui.setStatus(STATUS_KEY, fastStatus(ctx.model, enabled(ctx), catalog, requesting));
  }
  function updateCatalog(ctx: ExtensionContext, force = false): Promise<void> | undefined {
    if (refreshing) return refreshing;
    if (!force && (!needsRefresh(catalog) || Date.now() - lastRefreshAttempt < REFRESH_INTERVAL_MS)) return;
    lastRefreshAttempt = Date.now();
    refreshing = refreshCatalog(cacheFile).then((next) => {
      catalog = next;
      showStatus(ctx);
    }).catch((error: Error) => {
      ctx.ui.notify(`Fast 清单更新失败，沿用本地清单：${error.message}`, "warning");
    }).finally(() => { refreshing = undefined; });
    return refreshing;
  }

  pi.registerCommand("fast", {
    description: "管理当前模型的 Fast 模式，查看或刷新支持清单",
    getArgumentCompletions: (prefix) => {
      const choices = ARGUMENTS.filter((value) => value.startsWith(prefix));
      return choices.length ? choices.map((value) => ({ value, label: value })) : null;
    },
    handler: async (args, ctx) => {
      const argument = args.trim().toLowerCase();
      if (argument === "refresh") {
        await updateCatalog(ctx, true);
        const updatedAt = new Date(catalog.updatedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
        ctx.ui.notify(`Fast 清单：${catalog.models.length} 项，更新于 ${updatedAt}（UTC+8）`, "info");
        return;
      }
      if (argument === "list") {
        ctx.ui.notify(catalog.models.map((model) => `${modelKey(model)} · ${model.name}`).join("\n"), "info");
        return;
      }
      if (argument === "status") {
        ctx.ui.notify(`${fastStatus(ctx.model, enabled(ctx), catalog)} · ${ctx.model ? modelKey(ctx.model) : "无模型"}`, "info");
        return;
      }
      if (!["", "on", "off"].includes(argument)) {
        ctx.ui.notify("用法：/fast [on|off|status|list|refresh]", "error");
        return;
      }
      if (!ctx.model) {
        ctx.ui.notify("先选择模型", "warning");
        return;
      }
      const turnOn = argument === "on" || (argument === "" && !enabled(ctx));
      if (turnOn && !canUseFast(ctx.model, catalog)) await updateCatalog(ctx, true);
      if (turnOn && !canUseFast(ctx.model, catalog)) {
        ctx.ui.notify(fastStatus(ctx.model, false, catalog), "warning");
        return;
      }
      setEnabled(settingsFile, modelKey(ctx.model), turnOn);
      showStatus(ctx);
      ctx.ui.notify(turnOn ? "Fast 已开启" : "Fast 已关闭", "info");
    },
  });

  pi.on("session_start", (_event, ctx) => {
    showStatus(ctx);
    void updateCatalog(ctx);
  });
  pi.on("model_select", (_event, ctx) => { showStatus(ctx); });
  pi.on("before_agent_start", (_event, ctx) => { void updateCatalog(ctx); });
  pi.on("before_provider_request", async (event, ctx) => {
    if (!enabled(ctx)) return;
    if (!canUseFast(ctx.model, catalog) && refreshing) await refreshing;
    if (!canUseFast(ctx.model, catalog)) return;
    const payload = event.payload as Record<string, unknown> | null;
    if (!payload || Array.isArray(payload) || typeof payload !== "object" ||
        payload.model !== ctx.model?.id) return;
    showStatus(ctx, true);
    return adapterFor(ctx.model)!.apply(payload);
  });
  pi.on("message_end", (event, ctx) => {
    if (event.message.role === "assistant") showStatus(ctx);
  });
  pi.on("agent_end", (_event, ctx) => { showStatus(ctx); });
  pi.on("session_shutdown", (_event, ctx) => { ctx.ui.setStatus(STATUS_KEY, undefined); });
}
