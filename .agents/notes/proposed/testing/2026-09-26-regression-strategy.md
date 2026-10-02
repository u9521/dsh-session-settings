# Agent Note: 回归验证策略

Status: proposed

## Problem

本仓库目前没有任何自动化测试：`package.json` 里没有 `test` 脚本，也没有测试目录或测试框架。回归只能依赖 `tsc` 类型检查与人工 GUI 冒烟。类型检查覆盖不到的区域恰好是最容易出错的部分：

- 纯函数逻辑：`src/server/mcp/naming.ts`、`src/client/utils/config.ts`、`src/client/utils/args.ts`、`src/client/utils/schema.ts`、`src/server/session/resolution.ts` 的模式回退（`global` / `workspace` / `custom` / `inherit`）判定。
- 存储读写与迁移：`session_settings.json`、`mcp_servers.json` 的解析、缺字段容忍、并发写入。
- 拦截器决策：给定会话设置，某工具/技能是否应被拒绝。

这些逻辑的缺陷不会让构建失败，只会表现为 GUI 行为异常，且 agent 无法自行在浏览器里验证。

## Proposal

分两层引入零依赖回归，不新增运行时依赖：

1. **单元层**：用 `node:test` + `node:assert`（Node 内置，无新依赖）覆盖上述纯函数与存储层，测试文件与被测模块同目录，命名 `*.test.ts`，由 `tsc` 类型检查覆盖但不进入 `lib/` 产物。
2. **闸门层**：把已完成的结构校验脚本作为回归的一部分，`pnpm run verify` 定义为 `pnpm run check && pnpm run verify:gates && node --test`。

明确不在范围内：拦截器的端到端测试（需要宿主 cordis 运行时）、浏览器侧组件测试（需要 DOM 运行时与 shell 注入）。这两类继续以 GUI 冒烟验收，并在 Note 的 `## Acceptance criteria` 中写清人工步骤。

## Alternatives considered

- **引入 vitest / jest**：否决。会新增较大的依赖树与配置面，而当前测试对象都是纯函数，Node 内置 test runner 已足够；将来需要 DOM 测试时再评估。
- **只做端到端测试（启动 `dsh web` 后脚本驱动）**：否决。启动宿主成本高、脆弱且慢，作为日常回归的性价比低。
- **不做测试，依赖闸门**：否决。闸门只能校验文档结构与构建不变量，无法发现"模式回退算错了"这类逻辑缺陷。

## Acceptance criteria

- `package.json` 新增 `test` 脚本（`node --test`），`pnpm run verify` 串联 `check`、`verify:gates` 与 `test`。
- 至少覆盖：`SettingsMode` 回退解析、MCP server 命名/去重、store 文件缺失或字段残缺时的读取结果。
- `pnpm run test` 在无测试文件时不视为失败，但至少存在一个 `*.test.ts`。
- `*.test.ts` 不出现在 `lib/` 与 `dist` 分支产物中。

## Risks

- **测试与宿主 API 漂移**：mock 宿主 `ctx` 的测试可能掩盖真实接口变化；优先测试不依赖 cordis 的纯函数，把宿主交互留在冒烟清单。
- **CI 未串入**：与 [采用 Agent-Native 工程规范](../../implemented/process/2026-09-26-agent-native-workflow.md) 一致，测试暂只在本地执行，漏跑风险仍在。
