# pi-model-fast

**为 Pi 的 OpenAI API / Codex 模型提供独立的 Fast 开关。**

[npm](https://www.npmjs.com/package/pi-model-fast) · [安装](#安装) · [命令](#命令) · [English](README.md)

- **每个模型一个开关**：通过 `/fast on` 开启，设置按供应商和模型分别保存。
- **状态直接可见**：彩色闪电显示 Fast 是否开启，并标记最近一次请求失败。
- **能力清单自动更新**：跟随 OpenAI Codex 官方模型目录刷新，不调用模型、不读取 OpenAI 登录凭据。

支持官方清单声明具备 Fast 能力的模型；开启时使用 `service_tier: "priority"`，保留原有模型、思考强度和工具设置。

![Pi 中已开启的 Fast 状态](https://raw.githubusercontent.com/jiuai233/pi-model-fast/main/docs/assets/fast-status.png)

## 安装

依赖 Node.js 24+、Pi 1.0.0+。

```bash
pi install npm:pi-model-fast
```

在 Pi 中运行：

```text
/reload
/fast on
```

也可通过 GitHub 安装：`pi install git:github.com/jiuai233/pi-model-fast`。npm 与 GitHub 选择一种来源即可。

默认关闭。开关按供应商和模型分别保存；切换模型不会自动开启未配置的模型。其他 Fast 扩展应停用，避免同时改写请求。

## 命令

| 命令 | 功能 |
| --- | --- |
| `/fast` | 切换当前模型的 Fast 开关 |
| `/fast on`、`/fast off` | 开启或关闭当前模型 |
| `/fast status` | 查看当前模型状态 |
| `/fast list` | 查看 Fast 能力清单 |
| `/fast refresh` | 立即同步官方能力清单 |

## 状态显示

- 绿色闪电 + `Fast ON`：当前模型已开启，Fast 参数可用。
- 红色闪电 + `Fast ON`：当前模型无法应用 Fast 参数，或最近一次 Fast 请求失败；请求成功后恢复绿色。
- 关闭时隐藏状态标识。

`/fast status` 显示开关、能力和最近一次请求失败状态。手动开启或关闭会清除当前模型的失败记录。取消请求不计为失败。

OpenAI/Codex 请求使用 `service_tier: "priority"`。Fast 开启不改变模型、思考强度或工具。关闭后停止注入，不覆盖其他来源已设置的请求参数。

Fast 会增加服务商用量或费用。清单声明表示模型具备对应能力，实际可用性仍受账号、端点和服务商规则影响。Codex 返回的 `service_tier: "default"` 无法单独判定 Fast 是否生效。

## 清单更新

数据源为 [OpenAI Codex 官方模型目录](https://github.com/openai/codex/blob/main/codex-rs/models-manager/models.json)中的 `service_tiers` 和 `additional_speed_tiers`。

声明 `priority` 或 `fast` 的模型进入 Codex 清单；同时声明 `supported_in_api` 的模型也进入 OpenAI API 清单。未声明 Fast 的模型不会自动开启。

- 随包提供能力快照。
- 启动和提交任务时检查缓存；超过六小时后后台刷新。
- 刷新失败沿用已有清单，并显示通知；自动刷新重试间隔为六小时。
- `/fast refresh` 立即重新拉取清单。
- GitHub Actions 每六小时检查上游，清单变化时提交更新。

目录同步访问公开 GitHub 数据，不读取 OpenAI 登录凭据，不调用模型，不消耗模型额度。快照仅包含模型名称、标识和供应商信息，不保存上游提示或账号信息。

## 本地文件

文件保存在 Pi 配置目录下的 `extensions/`，默认目录为 `~/.pi/agent/extensions/`，遵循 `PI_CODING_AGENT_DIR`：

- `pi-model-fast.json`：模型开关。
- `pi-model-fast-catalog.json`：能力缓存。

配置示例：

```json
{
  "version": 1,
  "enabledModels": {
    "openai-codex/gpt-6.1-sol": true
  }
}
```

## 开发

```bash
npm ci --ignore-scripts
npm run check
npm run update:catalog
```

测试使用临时目录和模拟事件，不访问真实模型。供应商适配位于 `src/providers.ts`，能力数据位于 `src/catalog.ts`；新增供应商需加入适配器、官方能力来源及对应测试。

## 更新与卸载

```bash
pi update npm:pi-model-fast
pi remove npm:pi-model-fast
```

通过 GitHub 安装时，将命令中的来源替换为 `git:github.com/jiuai233/pi-model-fast`。

更新或卸载后运行 `/reload`。卸载不会删除开关和能力缓存。

## 反馈

问题与功能建议可提交至 [GitHub Issues](https://github.com/jiuai233/pi-model-fast/issues)。有效的反馈信息包括 Pi 版本、供应商与模型 ID、`/fast status` 输出、预期行为和实际行为；不包含凭据或私人提示词。

## 协议与参考

- [Pi 扩展 API](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)
- [OpenAI Codex 服务档位映射](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/config_types.rs)
- [OpenAI Codex Fast](https://developers.openai.com/codex/speed)

## 许可证

MIT。
