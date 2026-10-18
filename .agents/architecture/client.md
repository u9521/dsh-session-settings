# 浏览器侧与呈现

Covers: src/client/**

`src/client/**` 是 client-plugin：闭包交给 `window.__ModuleLoader__`，平台模块经注入的 `require` 解析，其余全部内联。改这个目录之前读本页。

## 客户端纯净

不得值导入非平台的 `@deepseek-ai/*` 模块。`tsdown.config.mjs` 的 purity gate 在构建期检查裸标识符：只放行 `CLIENT_EXTERNALS` 里的平台行，其余抛错终止构建。类型导入被擦除，不触发该门。

`CLIENT_EXTERNALS` 保持与宿主平台种子逐字一致（宁多勿少），以免升级宿主时误伤合法平台行。跨插件协作走 cordis 服务，不走 import。

理由见 [自包含构建流水线](../../.agents/notes/implemented/architecture/2026-09-26-self-contained-build-pipeline.md)。

## 插槽优先，DOM 装饰是补充

能通过 `slots` 注册的一律走插槽；仅 shell 未开放插槽处才做 DOM 操作，并随 `ctx.effect` 清理。DOM 装饰不得替换宿主节点，只在其旁附加。

理由见 [hero chip 改走官方座位](../../.agents/notes/implemented/architecture/2026-10-17-hero-chip-slot.md)。

## 呈现跟随观测

界面上的挂载状态、工具计数都是瞬态观测的投影，不能渲染成"结论"（例如"服务器故障"）。零工具的健康服务器必须有正常态；状态过期要有自清或时间维度。

理由见 [挂载判定与状态呈现的一致化](../../.agents/notes/implemented/bug-fix/2026-10-01-mcp-mount-state-consistency.md)。
