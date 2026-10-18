---
name: write-agent-note
description: 在起草、更新或流转本仓库的 Agent Note（决策记录）时使用，用于按状态选骨架、写 Problem/Decision/Alternatives/Consequences，以及在 proposed 与 implemented 之间迁移。当用户要"记一篇 Note"、"补决策记录"、"把提案落地"，或问某个改动该不该写 Note 时使用。
---

# 写 Agent Note

Note 记录**决定了什么、为什么、代价是什么**。它不记录探索过程，也不复述代码结构——读者能读代码的，就不要写进 Note。

## 先判断值不值得写

| 改动 | 写不写 |
| :--- | :--- |
| 架构、共享契约、线格式、持久化形状 | 必须 |
| 工具链、规范、闸门、测试策略 | 必须 |
| 修一个可复现的缺陷，且根因不显然 | 必须（记根因，不记修法） |
| 改 typo、调文案、升版号 | 不写 |
| 纯格式化、纯重命名 | 不写 |

判断标准是**未来的人会不会问"为什么是这样"**。会问就写。

## 骨架按状态分派

位置编码状态与分类：`.agents/notes/<status>/<kind>/yyyy-mm-dd-<slug>.md`，契约见 [治理契约](../../notes/README.md)。

**proposed** —— 还有未定项，所以要写验收与风险：

```
## Problem
## Proposal
## Alternatives considered
## Acceptance criteria
## Risks
```

**implemented** —— 已落地，没有未定项，风险转为后果：

```
## Problem
## Decision
## Alternatives considered
## Consequences
```

**rejected** —— 保留否决理由，防止重复提议：`## Problem`、`## Proposal`、`## Alternatives considered`。

**archived** —— 只需 `## Problem`、`## Proposal`，并写 `Superseded by: <path|none>`。

## 写完前自检

1. `## Alternatives considered` 里每条都写了**否决理由**。只列名字等于没写，下一个人会再提一次。
2. `## Decision` 是现在时，描述线上真实形态；路径、类型名、常量名与代码一致。
3. 已落地的事实不要再挂在 `## Acceptance criteria` 里——按状态分派时它会被闸门拒绝。
4. 规则正文不抄进 Note，用相对链接指过去；预算数值不抄，指向闸门。
5. 篇幅由 `node .agents/gates/measure.mjs <file>` 量，上限在 `.agents/gates/config.mjs`。

## 状态流转

一律 `git mv`，不要复制后删旧文件：历史在 git，不在文件名。

- `proposed → implemented`：`git mv` 到 `implemented/`，改 `Status:`，`## Proposal` → `## Decision`，`## Acceptance criteria` 中有持久价值的条目并入 Decision，`## Risks` → `## Consequences`。
- `proposed → rejected`：`git mv`，改 `Status: rejected — <一行理由>`，在 `## Proposal` 上方补否决理由，不要删原方案描述。
- 任何状态 → `archived`：仅当事实被整体取代或功能已删且无替代，且入链已改指新 Note。

## 校验

```sh
node .agents/gates/verify-agent-note-format.mjs
node .agents/gates/measure.mjs <你改的 Note>
```

提交前跑 `node .agents/gates/verify-all.mjs`。
