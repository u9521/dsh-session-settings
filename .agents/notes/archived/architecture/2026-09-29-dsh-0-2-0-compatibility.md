# Agent Note: DSH 0.2.0 兼容性对齐

Status: archived

Superseded by: .agents/notes/implemented/architecture/2026-10-17-dsh-0-2-1-alignment.md

## Problem

宿主主线升级到 DSH 0.2.0 后，本插件的依赖与兼容性声明需要重新对齐。核查中发现两件事：

1. **`engines.dsh` 已失效。** 0.2.0 的宿主不再读取 `engines.dsh`；唯一的 DSH 兼容闸门改为 `peerDependencies` 中的 `@deepseek-ai/dsh*` 键。本插件声明了 `engines.dsh` 却没有 `peerDependencies`，而 `evaluatePluginCompatibility()` 在 manifest 缺该键时立即返回 `undefined`（`dsh-app-boot/lib/index.js:289`），因此任何版本的宿主都会照常加载本插件。
2. **安装树里存在陈旧同名包，会误导排查。** `@deepseek-ai/dsh-client-web@0.1.0-rc.6` 是无人依赖的历史遗留包，其 `PLATFORM_MODULES` 与运行时真实平台种子不同，按它推断客户端 externals 会改错方向。

## Proposal

当时的做法：删除 `engines.dsh`，改为 `peerDependencies: { "@deepseek-ai/dsh": ">=0.2.0-rc.1" }` 并加 `peerDependenciesMeta.optional: true`；`pnpm-workspace.yaml` 增补 `autoInstallPeers: false`，抑制 peer 声明把整棵宿主依赖树装进 `node_modules`（`pnpm-lock.yaml` 从 1,093 行膨胀到 9,145 行，开启后回到 1,093 行）。真实平台种子的唯一来源是运行中 shell 的 `@deepseek-ai/dsh-web-frontend/dist/assets/index-*.js`，不是 `@deepseek-ai/dsh-client-web` 包。

本 Note 描述的 0.2.0 下限与 SDK 2.0.0 已由 [DSH 0.2.1 对齐与回落代码清理](../../implemented/architecture/2026-10-17-dsh-0-2-1-alignment.md) 取代；`autoInstallPeers: false` 与平台种子的结论仍然有效，并在那篇 Note 中继续成立。
