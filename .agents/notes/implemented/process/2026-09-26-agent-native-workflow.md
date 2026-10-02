# Agent Note: 采用 Agent-Native 工程规范

Status: implemented

## Problem

本仓库所有改动都由 AI agent 与人工交替完成，但仓库里没有任何面向 agent 的落地规范：没有入口指令文件，没有决策记录，没有可执行的验证闸门。结果是每次协作都要靠对话重新传递上下文（构建命令、客户端纯净门、双半结构、双语 README 同步要求），而这些事实一旦没写下来就会随会话消失，导致同类错误反复出现。

## Proposal

在仓库内建立三件套，全部由 agent 可直接维护：

1. **根 `AGENTS.md`**：项目定位、架构地图、命令矩阵、不变量、安全边界与文档预算。控制在一屏可读的量级，不重复 Note 与 README 的内容。
2. **`.agents/notes/` 决策记录**：路径编码状态与分类，契约见 [Agent Notes 治理契约](../../README.md)；`implemented/` 是事实基线，重构时原地更新。
3. **`scripts/gates/` 零依赖校验闸门**：`verify-agent-note-format.mjs`（笔记结构）、`verify-doc-budgets.mjs`（篇幅预算）、`verify-md-links.mjs`（相对链接与锚点）、`verify-agent-skills.mjs`（本地技能 frontmatter）。统一入口 `pnpm run verify:gates`，聚合入口 `pnpm run verify`（类型检查 + 闸门）。

派生约束：

- agent 的可写范围默认为 `AGENTS.md`、`.agents/**`、`docs/**`、`scripts/gates/**`；改动 `src/**`、`package.json`、`tsdown.config.mjs`、`.github/**` 前必须获得显式授权。
- 闸门只做**可判定的结构校验**，不引入 lint 规则引擎、不引入测试框架依赖；使用 Node 内置能力实现。
- 文档语言：中文为主，命令、路径、标识符保留英文原文。

## Alternatives considered

- **只写根 `AGENTS.md`，不建决策记录**：否决。架构理由会被压缩成结论条目，`AGENTS.md` 迅速膨胀并超出预算，而"为什么不那样做"无处安放，同一提案会被反复提出。
- **用外部 ADR 工具或 wiki**：否决。决策记录必须与代码同仓、同 PR、同 diff 评审，否则必然与代码状态脱节。
- **引入 markdownlint / vale 等现成规范工具**：否决。会新增依赖与配置面，而本仓库真正需要校验的只有四条自定义规则；零依赖脚本的维护成本更低。
- **把闸门接入 CI workflow**：本次否决（保持改动面最小，`release.yml` 不动）。代价是规范漂移只能本地发现，先以 pre-push 本地纪律覆盖。

## Acceptance criteria

- `pnpm run verify:gates` 在干净工作区返回 0；对任一违规（状态目录与 `Status:` 不符、缺失 `## Risks`、超预算、断链、技能缺 `description`）返回非零并打印具体文件。
- 根 `AGENTS.md`、`.agents/notes/README.md`、`.agents/notes/AGENTS.md`、`.agents/notes/implemented/AGENTS.md` 的篇幅均在各自预算内。
- `.agents/notes/` 至少各有一篇 `implemented/architecture/` 与一个 `proposed/` 篇章，用于示范生命周期。
- `AGENTS.md` 的命令矩阵与 `package.json` 的 `scripts` 一致：矩阵中出现但未定义的命令视为缺陷。

## Risks

- **闸门与文档双重维护**：新增受管控文件时必须同步更新 `verify-doc-budgets.mjs` 的预算表，否则文件不受约束。
- **预算过紧会诱发形式化**：为压字数而删除不变量比超字数更糟；超预算时应拆分内容到 Note，而不是删掉理由。
- **状态目录与实际不符**：`implemented/` 中若描述了未落地的能力，会误导后续 agent 做出错误假设；评审时需核对代码。
