# Agent Note: 会话设置控制器

Status: implemented

## Problem

会话设置页的"读、改、存、复位"落在两个 hook 和一个 1,087 行的页面里：

- `useSessionData` 551 行，返回 **76 个成员**，其中 24 个是"域 × 作用域"的成对 getter/setter。四个 loader 融在一个 effect 里，`catch` 全空——加载失败与"没有覆盖"在界面上完全一样。
- `useSessionActions` 376 行，接收 **37 个 props**，主体是三段近乎相同的保存分支与三段复位分支。
- 页面自己再做一遍作用域分发：四个 `currentXxxConfig` getter、四个 setter、四个 handler 各写一遍 `activeScope === 'global' ? … : …`。
- 13 处 `setTimeout(() => setSuccessMsg(''), 3000)`，没有模块拥有"会过期的提示"。

## Decision

`src/client/session/settings-controller.ts` 拥有设置状态与动作，对外 **8 个成员**：`scope`、`select`、`draft(domain)`、`update(domain, value)`、`effective(domain)`、`save()`、`reset()`、`notice`，另有只读的 `layers`、`saving`、`copiedId`/`copySessionId`、`hasSessionOverride` 与作用域可用性。

- `draft(domain)` 在内部按 `scope` 选层，页面不再写作用域分发。
- `effective(domain)` 直接调 `src/shared/settings.ts` 的阶梯，与运行时强制同源。
- 保存与复位各只有一个请求构造器；作用域缺失时以 `notice` 报错而不是静默返回。
- 提示只有一个 owner：一个 effect 在 3 秒后清空，所有保存/复位/刷新都写它。加载失败同样走 `notice`，不再与"无覆盖"混同。

目录数据（模型目录、MCP 服务器列表、技能目录、沙箱能力）拆到同文件的 `useSessionCatalogs`：它们有自己的刷新时机（进入 MCP 页、保存后、点刷新），不参与草稿。

页面 `session/index.ts` 从 1,087 行降到 830 行，只做渲染与四个面板的局部 handler；设置状态与动作在 706 行的 `settings-controller.ts` 里，两个被删除的 hook 合计 926 行。

**落地约束：**

- `useSessionData.ts` 与 `useSessionActions.ts` 删除；页面只调控制器与目录 hook。
- 保存路径不再接收草稿副本；页面不出现按 `scope` 分支的 getter/setter 对。
- 逐 handler 的 `setTimeout(…3000)` 不再存在；提示由一个 effect 清空。
- 加载失败以 `notice` 呈现。
- `pnpm run verify` 全绿；GUI 冒烟：三个作用域的保存、复位、来源页签、hero chip 覆盖徽标行为不变。

## Alternatives considered

- **只把两个 hook 合并、保留页面里的作用域分发**：否决。分发正是"四份 getter/setter"的来源；`draft(domain)` 一个方法就替代它。
- **保留 37 props 的 `useSessionActions` 作为内部实现**：否决。它的接口就是缺陷本身——保存应读控制器自己的草稿，而不是接收 12 份草稿副本。
- **把目录数据也塞进控制器**：否决。目录数据有各自的刷新时机，混在一起会让控制器重新变成状态袋。

## Consequences

- **一次性改动面大**：页面整篇重接。缓解是控制器只暴露"草稿 + 有效值"两组纯数据，渲染结构未动。
- **作用域默认值**：沿用原规则（有 workspace 默认 workspace，否则 global），用户显式选择后不再自动改。
- **并发保存**：`save()` 期间按钮禁用（沿用 `saving` 标志），不引入队列。
- **目录刷新时机**：保存后额外调一次 `reloadServers`，与原实现一致；若将来 MCP 页签不再需要即时刷新，可移除。
