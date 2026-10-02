# Agent Notes 治理契约

Agent Notes 是本仓库的决策记录体系（RFC / ADR 的统称）：**每个非平凡改动必须在同一个变更中新增或更新一篇 Note**，记录问题、方案、被否决的备选与验收标准。代码回答"是什么"，Note 回答"为什么是这样、以及为什么不那样"。

## 目录即状态与分类

状态与分类都由路径编码，不要另建目录：

```
.agents/notes/<status>/<kind>/yyyy-mm-dd-<slug>.md
```

| `<status>` | 含义 |
| :--- | :--- |
| `proposed` | 已提出，尚未实现或尚未验证 |
| `implemented` | 已落地，且与当前代码一致 |
| `rejected` | 评估后决定不做，保留否决理由以防重复提议 |
| `archived` | 已冻结的历史记录，只读 |

| `<kind>` | 含义 |
| :--- | :--- |
| `architecture` | 结构、契约、依赖方向、跨模块不变量 |
| `feature` | 面向用户的新能力 |
| `bug-fix` | 缺陷根因与修复策略 |
| `simplification` | 删除、合并、去重复 |
| `process` | 工作流、规范、工具链 |
| `testing` | 测试策略与覆盖边界 |

## 必需文件头

每篇 Note 的第一行必须是 H1，标题与文件名 slug 语义一致：

```
# Agent Note: <标题>

Status: <status>
```

`Status:` 必须与所在状态目录一致（`archived` 目录内固定写 `Status: archived`）。

## 必需章节

除 `archived` 外，以下五个二级标题都必须出现，顺序不限，缺失即闸门失败：

`## Problem`、`## Proposal`、`## Alternatives considered`、`## Acceptance criteria`、`## Risks`

`archived` 的 Note 只需 `## Problem`、`## Proposal`，并显式写明被谁取代：

```
Superseded by: .agents/notes/implemented/architecture/2026-09-26-<slug>.md
```

## 状态流转

- `proposed → implemented`：把文件 `git mv` 到 `implemented/`，同时更新 `Status:`，并把 `## Proposal` 改写为已实现的事实与最终形态。
- `proposed → rejected`：同样 `git mv`，并在 `## Proposal` 上方补一段否决理由；不要删除原方案描述。
- 任何状态 → `archived`：仅当该 Note 描述的事实已被取代或不再适用，且入链已改指新 Note。

重构时优先**原地更新** `implemented/` 里的既有 Note，让 Note 与代码保持同构；只有事实被替换时才归档。

## 写作约束

- 一处事实一处归属：同一结论只写在一个文件里，其它位置用相对链接指过去。
- 只写结论与理由，不写推理过程、不写"本次会话我做了什么"。
- 加粗仅用于真正的不变量；不使用 emoji 章节标题。
- 命令、路径、标识符保留英文原文，不要翻译。
- 篇幅：单篇 Note 建议 ≤ 1500 counting units（由 `scripts/gates/verify-doc-budgets.mjs` 的计数规则定义）。

## 校验

新增或修改 Note 后运行：

```sh
pnpm run verify:gates
```

闸门 `scripts/gates/verify-agent-note-format.mjs` 会校验路径编码、文件头、状态一致性与必需章节。
