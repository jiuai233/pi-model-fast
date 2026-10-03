# pi-model-fast

Pi 模型 Fast 扩展，提供按模型保存的开关、Fast 状态标识和自动更新的能力清单。

支持 `openai` 与 `openai-codex`。供应商适配位于 `src/providers.ts`，能力数据位于 `src/catalog.ts`。

## 安装

依赖 Node.js 24+、Pi 1.0.0+。

```bash
pi install git:github.com/jiuai233/pi-model-fast
```

在 Pi 中运行：

```text
/reload
/fast on
```

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

- `⚡ Fast`：当前模型已开启。
- `⚡ Fast · 请求中`：当前请求已注入 Fast 参数。
- `Fast · 已关闭`：当前模型未开启。
- `Fast · 清单未收录`：清单没有当前模型的能力记录。
- `Fast · 未适配`：供应商或 API 尚未适配。

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

测试使用临时目录和模拟事件，不访问真实模型。新增供应商需加入适配器、官方能力来源及对应测试。

## 更新与卸载

```bash
pi update git:github.com/jiuai233/pi-model-fast
pi remove git:github.com/jiuai233/pi-model-fast
```

更新或卸载后运行 `/reload`。卸载不会删除开关和能力缓存。

## 协议与参考

- [Pi 扩展 API](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)
- [OpenAI Codex 服务档位映射](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/config_types.rs)
- [OpenAI Codex Fast](https://developers.openai.com/codex/speed)

## 许可证

MIT。
