# Agent Note: 回归验证策略

Status: rejected — 测试策略属于项目本体，不属于工程框架

## Problem

本仓库目前没有任何自动化测试：`package.json` 里没有 `test` 脚本，也没有测试目录或测试框架。回归只能依赖 `tsc` 类型检查与人工 GUI 冒烟。类型检查覆盖不到的区域恰好是最容易出错的部分：

- 纯函数逻辑：`src/server/mcp/naming.ts`、`src/client/utils/config.ts`、`src/client/utils/args.ts`、`src/client/utils/schema.ts`、`src/server/session/resolution.ts` 的模式回退（`global` / `workspace` / `custom` / `inherit`）判定。
- 存储读写与迁移：`session_settings.json`、`mcp_servers.json` 的解析、缺字段容忍、并发写入。
- 拦截器决策：给定会话设置，某工具/技能是否应被拒绝。

这些逻辑的缺陷不会让构建失败，只会表现为 GUI 行为异常，且 agent 无法自行在浏览器里验证。

## Proposal

> 否决于 2026-10-18：测试策略属于项目本体，不属于工程框架。框架的职责边界是创建与审计脚手架；一旦把测试方案写进决策记录，"日常开发换别的预设"这条边界就模糊了。方案本身仍然成立，留给真正写代码的人按当时情况决定。

分两层引入零依赖回归，不新增运行时依赖：

1. **单元层**：用 `node:test` + `node:assert`（Node 内置，无新依赖）覆盖上述纯函数与存储层，测试文件与被测模块同目录，命名 `*.test.ts`，由 `tsc` 类型检查覆盖但不进入 `lib/` 产物。
2. **闸门层**：把已完成的结构校验脚本作为回归的一部分，聚合入口串联 check、闸门与 `node --test`。

明确不在范围内：拦截器的端到端测试（需要宿主 cordis 运行时）、浏览器侧组件测试（需要 DOM 运行时与 shell 注入）。这两类继续以 GUI 冒烟验收。

## Alternatives considered

- **引入 vitest / jest**：否决。会新增较大的依赖树与配置面，而当前测试对象都是纯函数，Node 内置 test runner 已足够；将来需要 DOM 测试时再评估。
- **只做端到端测试（启动 `dsh web` 后脚本驱动）**：否决。启动宿主成本高、脆弱且慢，作为日常回归的性价比低。
- **不做测试，依赖闸门**：否决。闸门只能校验文档结构与构建不变量，无法发现"模式回退算错了"这类逻辑缺陷。
