# pi-model-fast

Fast mode for Pi, with per-model OpenAI/Codex priority controls, colored status indicators, and an automatically refreshed model capability catalog.

[简体中文](README.zh-CN.md)

![Fast enabled in Pi](https://raw.githubusercontent.com/jiuai233/pi-model-fast/main/docs/assets/fast-status.png)

## Quick start

Requires Node.js 24+ and Pi 1.0.0+.

```bash
pi install git:github.com/jiuai233/pi-model-fast
```

Inside Pi:

```text
/reload
/fast on
```

Fast is off by default. Settings are saved separately for each provider and model. Switching models does not enable Fast on an unconfigured model. Disable other Fast extensions to avoid competing request changes.

**Fast may increase provider usage or cost.** Account access, endpoint support, and provider rules still apply.

## Features

- Supports OpenAI API and Codex models declared Fast-capable in the official catalog.
- Preserves the selected model, reasoning effort, and tools.
- Sends OpenAI/Codex `service_tier: "priority"` when enabled.
- Shows a colored lightning indicator with `Fast ON`; hides the indicator when off.
- Refreshes model capabilities without using model credits or reading OpenAI credentials.

## Commands

| Command | Action |
| --- | --- |
| `/fast` | Toggle Fast for the current model |
| `/fast on`, `/fast off` | Enable or disable Fast |
| `/fast status` | Show the model's setting, capability, and last request failure |
| `/fast list` | List Fast-capable models |
| `/fast refresh` | Refresh the official capability catalog immediately |

## Status indicator

- **Green lightning + `Fast ON`:** enabled and ready to apply Fast parameters.
- **Red lightning + `Fast ON`:** Fast parameters cannot be applied, or the latest Fast request failed. A successful retry restores green.
- **Off:** the indicator is hidden.

Manual enable/disable clears the current model's failure record. Cancelling a request is not counted as a failure. Turning Fast off stops this extension from injecting parameters; it leaves parameters set by other sources intact.

Catalog support does not guarantee account access or faster responses. Codex can echo `service_tier: "default"` even when the request used `priority`; that response field alone cannot verify acceleration.

## Automatic model catalog

The capability source is the [official OpenAI Codex model catalog](https://github.com/openai/codex/blob/main/codex-rs/models-manager/models.json), using `service_tiers` and `additional_speed_tiers`.

Models declaring `priority` or `fast` enter the Codex catalog. Models also declaring `supported_in_api` enter the OpenAI API catalog. Catalog additions do not enable Fast automatically.

- A capability snapshot is bundled with the extension.
- Startup and task submission check the cache; snapshots older than six hours refresh in the background.
- Failed refreshes retain the last catalog and show a notification. Automatic retries are spaced six hours apart.
- `/fast refresh` refreshes immediately.
- GitHub Actions checks upstream every six hours and commits catalog changes.

Catalog refreshes access public GitHub data, make no model requests, and consume no model credits. Snapshots contain model names, identifiers, and providers; no upstream prompts or account data are retained.

## Local settings

Files are stored under the Pi configuration directory's `extensions/` folder, normally `~/.pi/agent/extensions/`. `PI_CODING_AGENT_DIR` is respected.

- `pi-model-fast.json`: per-model settings.
- `pi-model-fast-catalog.json`: capability cache.

Example:

```json
{
  "version": 1,
  "enabledModels": {
    "openai-codex/gpt-6.1-sol": true
  }
}
```

## Development

```bash
npm ci --ignore-scripts
npm run check
npm run update:catalog
```

Tests use temporary directories and simulated extension events; they make no real model requests.

Provider adapters are in `src/providers.ts`; capability handling is in `src/catalog.ts`. New providers require an adapter, an official capability source, and corresponding tests.

## Update or uninstall

```bash
pi update git:github.com/jiuai233/pi-model-fast
pi remove git:github.com/jiuai233/pi-model-fast
```

Run `/reload` afterward. Uninstalling leaves settings and cached capabilities intact.

## References

- [Pi extension API](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)
- [OpenAI Codex service tier mapping](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/config_types.rs)
- [OpenAI Codex Fast mode](https://developers.openai.com/codex/speed)

## License

MIT.
