# Agent Note: hero chip 改走官方座位

Status: implemented

## Problem

新会话页的入口是一个 DOM 注入：`MutationObserver` 观察 `document.body`，用 `div[class*="heroWorkspaceRow"]` 找行、用 `button[class*="seat"]` 找锚点，然后 `createRoot(container)` 挂一棵独立的 React 根。

三个问题：私有类名（宿主改结构只会让入口静默消失，没有编译错误）、整页 subtree 观察（长会话里每次变更都跑一遍选择器）、以及一棵与外层应用无共享上下文的第二棵根。

DSH 0.2.1 提供了官方座位 `conversation.hero.options`（`list` / `session`，在 New Session 行内右对齐，无 session 时不渲染）。

## Decision

`hero.options` 用 `slots.register` 注册，chip 成为普通插槽条目：

- `src/client/index.ts` 不再导入 `createRoot`，hero 段只剩一个 `slots.inject` + `slots.register`（`id: 'session-settings'`，`order: 10`）。
- chip 的 `remote` / `locale` / `sessions` / `workspaces` 仍由注册处从 `ctx.get` 取出传入，chip 内部继续用 `useSyncExternalStore` 订阅——接口未变。
- chip 的弹层仍由它自己 portal 到 body：座位只给一行位置。

**保留的 DOM 操作只有设置导航图标。** shell 的导航行按 section id 硬编码图标（未知 id 落到齿轮），没有图标座位，所以那一段保留；锚点从硬编码的中英双串改成 `t('mcpServers.tabLabel')`，第三语言也能命中。

**落地约束：**

- `src/client/index.ts` 不再出现 `createRoot`、`heroWorkspaceRow`、`data-dsh-hero-session-settings`（已 grep 确认为零）。
- `conversation.hero.options` 里有本插件条目，点击打开设置弹层；无 session 时不渲染（座位是 session 作用域）。
- 导航图标仍被替换，锚点为 `t('mcpServers.tabLabel')`。
- `pnpm run verify` 全绿。
- GUI 冒烟：新会话页 chip 可见、可点、覆盖徽标随会话配置变化；设置侧边栏 MCP 行仍是专属图标。

## Alternatives considered

- **继续用 DOM 注入**：否决。官方已有座位，继续注入等于把稳定性押在私有类名上。
- **把 chip 放进 `settings.section`**：否决。那是设置弹窗里的页面，不是新会话页的入口。
- **连导航图标一起删掉**：否决。没有图标座位，删掉后该行只剩齿轮，与其它行不一致；这属于"补充而非替换"允许的范围。
- **保留第二棵 React 根**：否决。座位里渲染的就是组件本身。

## Consequences

- **hero.options 的视觉位置**：它渲染在行内右对齐区域，可能与既有控件拥挤，需要一次目视确认。
- **导航图标仍依赖私有类名**：这是无法避免的残留；文案锚点比硬编码双串稳定，但仍是 DOM 耦合。
- **session 作用域**：座位在无 session 时不渲染。空白 hero 一定带 blank session，因此可用，但"未选 workspace"这一态必须在冒烟里覆盖。
