# Agent Note: hero 页工作区解析在 0.2.0 下塌缩为常量

Status: implemented

## Problem

新会话（hero）页的「会话设置」不跟随工作区切换：在 A 工作区暂存会话级设置后，把 hero 工作区芯片切到 B，弹窗里仍是 A 的工作区。

根因是**读了 0.2.0 已不存在的快照字段**。0.2.0-rc.1 中 `ctx.sessions` 与 `ctx.workspaces` 分别由 `@deepseek-ai/dsh-api-session-controller` 与 `@deepseek-ai/dsh-api-workspace-controller` 提供：

- `SessionListState` = `ids` / `byId` / `phase` / `projectionsBySession` —— **无 `current`**；"当前主视图会话"改由行内 `retainedBy.mainView` 表达。
- `WorkspaceSnapshot` = `items` / `archivedSessionIds` / `pinnedSessionIds` / `state` / `phase` / `error` —— **无 `recentWorkspaceId`**；最近性改由成员会话 `updatedAt` 派生。

这两个字段只存在于 `@deepseek-ai/dsh-client-runtime@0.1.1-rc.2`，而**没有任何 bundle 行加载它**（全仓 `cordis.patch.yml` 对其匹配为 0；web 名单在 `dsh-web-app/cordis.patch.yml:122` 插入的是 `dsh-api-session-controller`）。读不存在的字段不报错、只返回 `undefined`，于是工作区解析塌缩成 `workspaceItems[0]`——宿主序第一个工作区，一个不随切换变化的常量。同一缺陷还使 hero chip 的 `checkOverride` 拿不到会话 id，"已为此会话单独配置" 徽标成为死代码。

## Proposal

**身份判定收进纯模块 `src/client/utils/sessionScope.ts`**，hero chip 与 `useSessionData` 共用，避免再次各写一份而漂移：

| 事实 | 0.2.0 的等价判定 |
| :--- | :--- |
| 当前主视图会话 | `byId` 中首个 `retainedBy.mainView > 0` 的行 |
| 最近工作区 | 逐字复刻宿主 `recentWorkspace()`：成员会话最大 `updatedAt`，空工作区用 `Date.parse(createdAt)`，并列取宿主序靠前者 |
| 页面所属工作区 | 显式 `workspaceId` → 显式 `sessionId` 归属 → 主视图会话归属（先 `sessionIds`，再 `cwd`/`path`）→ 最近性 |

`resolveMainSessionId` 与官方 `dsh-client-ui-session` 的 `publishMain()` 同一判定，不发明新语义。**刻意不记忆上一次结果**：切换时 `replaceMain` 先 `retain` 新会话再 `release` 旧会话，两步同步完成，没有任何一帧能观察到两个持有者；加「偏好 id」只会引入把旧工作区钉住的新路径——正是本次要修的缺陷类。两个旧字段仍被读取，但**排在最后**，只作旧宿主的降级容错。

**删掉 `list[0]` 兜底是本次修复的实质。** 解析不出工作区时返回 `undefined`，页面如实表现为「工作区页签禁用、不渲染工作区芯片」。命名一个任意工作区，正是让切换看起来被忽略的原因。

**hero 页的会话作用域改写入活会话。** hero 页面**始终**已有会话：选工作区即 `openWorkspace` → `connectWorkspace` → `reuseOrCreateBlank` → `sessions.create` → `replaceMain` → `retain(id, {source:'mainView'})`。因此 hero chip 解析出的 `currentSessionId` 非空，保存按 `scope:'session'` 直接写 `store.sessions[id]`，下一次请求即生效。当时的暂存兜底随后被整体移除，见 [显式作用域路由](2026-10-01-explicit-scope-routing.md)。

两个 `useSyncExternalStore` 兜底 `getSnapshot` 改为模块级常量：字面量每次读返回新对象，会永远判定快照变化。

## Alternatives considered

- **保留 `list[0]` 兜底，仅补主视图会话判定**：否决。切换时若工作区快照尚未到达，页面会退回第一个工作区并**显示错误的工作区**；诚实置空优于错误命名。
- **hero chip 改走插槽注册而非 DOM 注入**：否决，且不可行。hero 行只有三个 `single` 槽，`conversation.hero.agentPreset` 已被 `ui-agent-preset` 以默认优先级占用，同优先级再注册抛异常，换优先级则遮蔽官方控件。重构应单独立项。
- **hero 页继续走暂存，只修工作区解析**：否决（用户裁决）。暂存在 `agent/created` 消费，而 hero 页的空白会话已经创建，用户为「即将开始的这次对话」所做的配置不会作用于它。
- **改用 `ctx.sessions.currentProvideInfo` 判定当前会话**：否决。该字段不在本插件已声明注入的服务面上，且它是 provide 投影而非列表事实。
- **保留 `dsh-client-runtime` 的旧字段语义**：否决。该包不在任何 bundle 行内，按它编程等于按死代码编程。

## Acceptance criteria

- `pnpm run check`、`pnpm run verify:gates`、`pnpm run fmt:check` 全绿，`pnpm run build` 成功且客户端纯净度闸门通过。
- 代码中不再以 `workspaceItems[0]` / `list[0]` 作为工作区兜底。
- `resolvePageWorkspace` 在「显式 `sessionId` 命中」与「最近性命中」两条路径上返回不同工作区（纯函数可直接断言）。
- `recentWorkspaceId` 与 `current` 仅作为带注释的降级容错出现，不再是主路径。
- GUI 冒烟（人工，刷新页面、不重启 `dsh web`）：hero 页在两个工作区间切换工作区芯片，弹窗标题栏的工作区芯片同步跟随；在 hero 页保存会话作用域配置后下一次请求即生效；无工作区可解析时工作区页签禁用且无工作区芯片；会话内 tab、MCP 页、技能页、侧边栏图标、hero chip 渲染正常。

## Risks

- **hero chip 仍依赖私有 DOM 锚点**（`heroWorkspaceRow` 等带哈希类名）：宿主改结构则 hero chip 仍静默失效。
- **首屏时序**：会话与工作区快照分批到达，首帧可能解析为空并短暂禁用工作区页签，下一帧自行恢复。这是从「显示错误工作区」换来的代价。
- **当前为 subagent 寻址会话**：其 `cwd` 与父会话相同、可能不在 `sessionIds` 中，由 `cwd`/`path` 相等分支覆盖。
- **无法自动回归**：客户端装饰与渲染正确性只能人工冒烟，故上述 GUI 条目必须实跑。
