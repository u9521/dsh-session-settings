# Agent Note: ESLint 闸门

Status: implemented

## Problem

本仓库只有类型检查与格式检查，没有语义级 lint。两个半的代码风格差异（空 catch、未使用变量、浏览器/Node 全局混用）只能靠人眼与 Prettier 兜底；`noUnusedLocals` 只覆盖类型可见的未使用声明，覆盖不了 `no-empty`、`no-cond-assign` 这类运行期陷阱。同目录的 `dsh-advanced-model-editor` 与 `dsh-cust-search` 已用 flat config 的 ESLint 9 + typescript-eslint 8，本仓库缺少同一道闸门。

## Decision

新增 `eslint.config.js`（flat config），按两个半分别声明全局：`src/client/**` 用浏览器全局，`src/server/**` 与 `src/index.ts` 用 Node 全局，`scripts/**` 与根 `*.mjs` 用 Node 全局。规则集取 `js.configs.recommended` + `ts.configs.recommended`，并放宽三处：`no-empty` 允许空 catch（本仓库大量 best-effort 清理）、`@typescript-eslint/no-explicit-any` 只警告、`no-console` 关闭（插件日志是产品行为）。

`pnpm run lint` = `eslint src/ scripts/ *.mjs` + `pnpm run check` + `pnpm run fmt:check`；`pnpm run verify` 等价于 `pnpm run lint`；框架的闸门由 `node .agents/gates/verify-all.mjs` 单独校，两者互不代替。

**TypeScript 降到 `^6.0.3`。** typescript-eslint 8.71 在加载期硬性拒绝 TS 7.0（`typescript-eslint does not support TS 7.0`，上游 issue 10940 只承诺 TS ≥ 7.1）。TS 6 与 TS 7 在本仓库的类型面上等价：`pnpm run check` 在两者下都通过，tsdown 的 peer 区间同时接受 ^6 与 ^7。两个同目录插件也都锁在 6.0.3。

**落地约束：**

- `pnpm run lint` 在干净树上通过。
- `pnpm run verify` 依次跑 lint 与四个既有闸门并全部通过。
- `eslint.config.js` 对 `src/client/**` 使用浏览器全局、对 `src/server/**` 使用 Node 全局；在 `src/client/**` 里写 `process.env` 会被判为未定义。
- `package.json` 的 `devDependencies.typescript` 为 `^6.0.3`，`pnpm-lock.yaml` 已更新。
- `AGENTS.md` 的命令矩阵与 `README`/`README.zh.md` 的校验说明同步。

## Alternatives considered

- **保留 TS 7，改用 oxlint**：否决。oxlint 可用且更快，但两个同目录插件用的是 ESLint + typescript-eslint，规则集与豁免写法无法照搬；本次目标是与邻居一致。
- **保留 TS 7，用 `typescript-6` 别名给 lint 单独解析**：否决。typescript-eslint 在模块加载期读 `typescript` 的版本，别名需要改模块解析路径，属于非常规回落，违反 KISS。
- **只跑 `tsc --noEmit` 不引入 lint**：否决。类型检查看不见空 catch 与可疑赋值，而这正是本仓库 best-effort 代码最容易出错的地方。

## Consequences

- **TS 6 与宿主 0.2.1 的 `.d.ts` 兼容**：宿主的类型声明是按 TS 6/7 都能读的形式发布的；若某次宿主升级用了只有 TS 7 才支持的语法，本仓库会在 `pnpm run check` 处失败而不是静默跑错。
- **规则集噪音**：`no-explicit-any` 只警告，避免一次引入上百条待办；后续可单独收紧。
- **lint 与 Prettier 重叠**：两者都检查格式之外的风格，但 Prettier 管排版、ESLint 管语义，边界清晰，不需要 `eslint-config-prettier`。
