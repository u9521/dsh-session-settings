---
name: pre-push-checks
description: 在提交或推送本仓库改动前使用，用于按改动面确定最小校验集合（类型检查、构建、规范闸门、GUI 冒烟）并按序执行。当用户提到提交、推送、pre-push、验证改动是否安全，或询问"还要跑什么"时使用。
---

# Pre-Push 校验

目标：用**最小**的命令集合覆盖 diff 的实际风险面，并如实汇报结果。不要为了看起来稳妥而全量重跑，也不要在没跑的情况下声称通过。

## 步骤

1. 确定改动面：

   ```sh
   git status --short && git diff --stat && git diff --cached --stat
   ```

2. 按下表取需要的命令（并集），从左到右执行。
3. 有失败立即停下，定位到文件与行，修完再从头跑该组命令，不要跳过后续闸门。
4. 汇报时逐条给出命令与其结果；被跳过的项要说明原因。

## 最小集合矩阵

| 改动面 | 必须执行 |
| :--- | :--- |
| `AGENTS.md`、`.agents/**`、`docs/**` | `pnpm run verify:gates` |
| `src/**` | `pnpm run check && pnpm run build && pnpm run verify:gates` |
| `src/client/**`、`src/client/styles/**`、`tsdown.config.mjs` | 加上 GUI 冒烟：`dsh web` 后检查会话设置 tab、MCP 服务器页、技能页、hero chip、侧边栏图标 |
| `src/server/**`（拦截器、路由、存储） | 加上 GUI 冒烟：改会话设置后下一次请求即生效；禁用工具后被调用即被拒；`$DSH_HOME/storages/*.json` 内容符合预期 |
| `package.json`、`pnpm-lock.yaml` | `pnpm install --frozen-lockfile && pnpm run build` |
| `scripts/build.mjs`、`tsdown.config.mjs` | `pnpm run build`，并确认 `lib/client.js` 首行是 `window.__ModuleLoader__.load({ id: "@local/dsh-session-settings", ... })` |
| `scripts/gates/**` | `pnpm run verify:gates`，并**故意**制造一次违规（如临时删掉某篇 Note 的 `## Risks`）确认闸门真的会失败 |

## 硬性禁忌

- 不要为了让闸门变绿而放宽预算、删除必需章节或跳过脚本；闸门失败说明内容有问题。
- 不要提交 `lib/`（`.gitignore` 已忽略）；不要手工改 `dist` 分支。
- 不要在同一提交里混合格式化与逻辑改动；`pnpm run fmt` 产生的无关 diff 要拆开或还原。
- 改动了 `README.md` 就必须同步 `README.zh.md`。

## 汇报格式

- 全绿：列出执行的命令与关键输出（如闸门的 `N 篇笔记格式合规`）。
- 失败：贴出失败行原文，说明根因与修复动作，不要复述整段日志。
- 无法执行的检查（例如需要浏览器）：明确写出"未验证"及其影响面。
