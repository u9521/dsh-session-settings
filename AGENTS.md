# AGENTS.md

本文件是 agent 的入口投影：只写项目基础状态与"去哪找更多"，不写规则正文。`AGENTS.md` 与 `.agents/` 是可剥离的框架，删掉不影响构建、安装与运行。

## 项目定位

`@local/dsh-session-settings` 是 DeepSeek Harness（DSH）Web GUI 的会话设置插件：按会话配置子代理模型与推理强度、管理 MCP 服务器、按会话启停 MCP 工具与技能。插件为双半结构——Node 侧 cordis 插件、浏览器侧 client-plugin；两半只经 `src/types.ts` 与 `src/shared/` 共享。

## 目录导航

| 路径 | 内容 | 改动前先读 |
| :--- | :--- | :--- |
| `src/types.ts`、`src/shared/` | 跨半线格式契约、共享纯逻辑 | [契约与线格式](.agents/architecture/contract.md) |
| `src/server/` | cordis 插件，按 `mcp/`、`session/`、`skills/`、`subagent-model/` 切分 | [服务端与宿主](.agents/architecture/server.md) |
| `src/client/` | client-plugin：插槽注册、样式、文案 | [浏览器侧](.agents/architecture/client.md) |
| `scripts/build.mjs`、`tsdown.config.mjs`、`package.json` | 构建入口、产物配置、清单 | [构建与发布](.agents/architecture/build.md) |
| `.agents/skills/` | 按时机调用的行为规范 | 各 `SKILL.md` 的 description |
| `.agents/notes/` | 决策记录；`implemented/` 是事实基线 | [治理契约](.agents/notes/README.md) |
| `README.md` | 用户可见能力、安装与升级 | — |

## 命令矩阵

| 目的 | 命令 |
| :--- | :--- |
| 安装依赖 | `pnpm install` |
| 构建（`tsc` + `tsdown`） | `pnpm run build` |
| 类型检查 | `pnpm run check` |
| 语义 lint | `pnpm run lint` / `pnpm run lint:fix` |
| 格式检查 / 修复 | `pnpm run fmt:check` / `pnpm run fmt` |
| 全部规范闸门 | `node .agents/gates/verify-all.mjs` |

本仓库没有自动化测试框架：回归 = lint + 构建 + 闸门 + GUI 冒烟。冒烟清单见 `pre-push` 技能。

## 参考入口

- 模块约束与不变量 → `.agents/architecture/`，按被改动的路径查。
- 决策与理由、被否决的方案 → `.agents/notes/`。
- 提交、校验、评审、写 Note 的行为规范 → `.agents/skills/`。
- 闸门实现与全部阈值 → `.agents/gates/config.mjs`。
- 用户可见能力与安装升级 → `README.md` 与 `README.zh.md`（双语同步）。

## 三条纪律

- 改任何路径前，先按导航表读对应模块文档。
- 非平凡的架构、契约、缺陷修复改动，在同一变更里新增或更新 `.agents/notes/`。
- 变更结束前跑 `node .agents/gates/verify-all.mjs`，全绿再提交。
