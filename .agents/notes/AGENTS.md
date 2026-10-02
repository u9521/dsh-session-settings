# AGENTS.md — .agents/notes

在本目录内工作时，先读 [README.md](README.md)（治理契约），再动手。

## 硬性要求

- 路径必须形如 `<status>/<kind>/yyyy-mm-dd-<slug>.md`，不要新增状态或分类目录。
- 文件头为 `# Agent Note: <标题>` + 空行 + `Status: <status>`，状态与目录一致。
- 状态流转一律用 `git mv`，不要复制粘贴后再删旧文件；历史放在 git，不放在文件名。
- 每篇 Note 落地后运行 `pnpm run verify:gates`，不要手写"应该能过"。

## 内容要求

- 写"决定了什么、为什么、代价是什么"，不写探索过程与对话记录。
- 被否决的方案必须留在 `## Alternatives considered` 里，并给出否决理由——这是防止重复提议的主要防线。
- `## Acceptance criteria` 写成可判定的条目（能对应到命令、闸门或可观察的 GUI 行为），不要写"体验更好"这类无法验证的表述。
- 与代码不一致的 `implemented/` Note 视为缺陷：改了代码就在同一变更里改 Note。

## 反模式

- 用 Note 复述代码结构（读者读代码即可）。
- 把 AGENTS.md 里的命令、预算、安全规则抄进 Note（改一处要改多地，必然漂移）。
- 为"改一个 typo"这类平凡改动补 Note。
