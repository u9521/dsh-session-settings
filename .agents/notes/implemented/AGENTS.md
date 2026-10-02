# AGENTS.md — implemented

这里存放**已落地且与当前代码一致**的 Note。它是本仓库的事实基线。

## 维护规则

- 重构、重命名、契约变更后，**原地更新**对应 Note，而不是新开一篇解释新版本。
- `## Proposal` 写最终形态（现在是什么），不写演进史；历史差异由 git 承担。
- 只有当一篇 Note 描述的事实被另一篇整体取代、或功能已被删除且无替代时，才把它 `git mv` 到 `../archived/<kind>/`，改成 `Status: archived`，补 `Superseded by:` 指向新 Note（或 `Superseded by: none`），并修正所有入链。
- 新增 Note 时检查是否已有同主题的 `implemented/` 篇章：有则合并，不要并存两处事实。

## 落笔前自检

1. 这篇描述的行为，在 `main` 上真的存在吗？
2. 文中出现的路径、命令、常量名是否与代码一致？
3. `## Acceptance criteria` 是否每条都能被某条命令或闸门判定？
