# pi-model-fast

Pi 模型 Fast 扩展，Node 24+、Pi 1.0+，TypeScript 源码直接加载。

- `src/index.ts`：命令、状态显示、请求钩子。
- `src/catalog.ts`：官方能力清单解析和缓存刷新。
- `src/providers.ts`：供应商适配；新增供应商同时补能力来源与测试。
- `catalog/openai.json`：官方 OpenAI Codex 目录的 Fast 能力快照；运行 `npm run update:catalog` 更新。
- `npm run check`：类型检查与隔离测试，不访问真实模型。

用户设置与缓存位于 Pi 配置目录，禁止提交凭据、账号信息、真实提示或会话数据。
界面使用 Fast 名称；OpenAI/Codex 请求使用 `service_tier: "priority"`。
Codex 响应回显 `default` 无法单独判定 Fast 是否生效。
