# Agent Note: 双半插件架构

Status: implemented

## Problem

DSH Web 的会话级配置能力（子代理模型、MCP 服务器、技能开关）横跨三个边界：宿主 cordis 服务的运行时、Web 服务器的 HTTP 层、以及浏览器 shell 的 React 渲染树。若把三者写在一个模块里，任何一侧的加载时序变化都会连带打断另外两侧；而浏览器侧无法直接 `import` 服务端代码，配置 UI 与配置生效路径必须各自存在。

## Proposal

插件以 DSH 标准的**双半结构**发布，两半共享同一份契约文件 `src/types.ts`（`API_ENDPOINTS`、store schema、模式枚举），这是唯一允许跨半共享的代码。

**Node 半（cordis 插件）**：入口 `src/server/index.ts`，`name = 'session-settings'`，`inject = ['connection', 'loader']`，暴露单个 `apply(ctx)`。内部按领域切成 `mcp/`、`session/`、`skills/`、`subagent-model/` 四个目录；`mcp/`、`session/`、`skills/` 各有 `routes.ts`（HTTP），`mcp/`、`skills/`、`subagent-model/` 各有 `interceptor.ts`（运行时装配），共用 `common/paths.ts` 定位落盘文件。

- HTTP 面统一挂在前缀 `/api/session-settings` 下，路径常量只在 `API_ENDPOINTS` 定义一次，客户端与服务端都从这里取；路由经 `ctx.connection.fetch.register()` 注册并在 `ctx.effect` 的清理函数里注销，因此 Host/Origin fence 与浏览器鉴权先于 handler 生效，理由见 [HTTP 接口契约与官方鉴权闸门](../bug-fix/2026-10-01-http-contract-and-auth-fence.md)。
- 策略不靠事件过滤，而是装配到每个 agent 自己的 scope 层：`agent/created` 装 `tools.restrict()` / `tools.guard()` / `systemPrompt.section()` / `skills.register()`，`agent/disposed` 撤销，`tools/change` 触发重绘；`system-prompt/assemble` 只作挂载触发，`agent/request` 改写子代理路由。理由见 [用 scope 层声明取代全局拦截器](2026-09-30-scope-native-mcp-and-skills.md)。
- 状态落盘在 `$DSH_HOME/storages/`（`mcp_servers.json`、`session_settings.json`），store 惰性加载、目录延迟创建：只有真正读写时才触碰磁盘，避免启动期副作用。
- MCP 客户端生命周期由 `McpManager` 持有，随会话策略动态装载/卸载，不需要重启 `dsh web`。

**浏览器半（client-plugin）**：入口 `src/client/index.ts`，产物是交给 `window.__ModuleLoader__.load({ id, factory })` 的闭包。它从注入的 `require` 解析平台模块（`react`、`@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-ui-primitives` 等），其余代码全部内联。它做四件事：

1. 注册 locale 命名空间与样式表（两者都在 `ctx.effect` 中挂载并返回卸载函数）。
2. 通过 `slots.inject`/`slots.register` 注册 UI 座位：`settings.section`（`mcp-servers` order 25）与 `conversation.view`（`session-settings` order 20）。技能只在会话视图内提供，没有独立设置入口。
3. 在 hero 区域挂载会话设置 chip（React root 动态创建/销毁）。
4. 用 `MutationObserver` + `requestAnimationFrame` 给 shell 侧边栏导航按钮补官方图标。

第 3、4 项是**对宿主 DOM 的补充而非替换**：座位插槽能覆盖到的部分走插槽，覆盖不到的部分才做 DOM 装饰。

## Alternatives considered

- **单模块实现，服务端直接渲染配置页**：否决。浏览器侧必须走 client-plugin 装载协议，服务端无法向 shell 的 React 树注入组件。
- **服务端自起 HTTP 服务承载配置 API**：否决。会绕开宿主 `webServer` 的端口、鉴权与生命周期，且多开监听端口与 DSH 单服务模型冲突；`inject: ['connection']` 已能复用现成能力。
- **配置全部存在浏览器 localStorage**：否决。`tools.guard()` 与 `agent/request` 的求值发生在服务端，配置必须对服务端可见，否则无法强制生效。
- **DOM 装饰完全不做，只依赖插槽**：否决。shell 未暴露导航图标与 hero 座位的插槽，缺少装饰则入口不可达。

## Acceptance criteria

- `pnpm install && pnpm run build` 产出 `lib/index.js` 与 `lib/client.js`。
- `pnpm run check` 通过，且 `src/types.ts` 是客户端与服务端唯一共享的契约文件。
- 在 Web GUI 中修改当前会话的子代理模型后，下一次请求即按新模型发起；修改 MCP 工具/技能开关后，被禁用的工具在该 agent 的 scope 层不可见且调用被拒；两种情况都无需重启 `dsh web`。
- `$DSH_HOME/storages/` 下的两个 JSON 文件是配置的唯一持久化位置；删除插件后宿主可正常启动。
- 无会话时会话作用域不可写：页签禁用并给出可见说明，`scope:'session'` 缺 `sessionId` 返回 400，不静默改道。

## Risks

- **宿主 DOM 耦合**：第 4 项与 hero chip 依赖 shell 的类名（`navCell`、`navLabel`、`navIcon`、`heroWorkspaceRow`、`seat`）。DSH 主版本升级若改类名，装饰会静默失效（图标缺失、chip 不挂载），且不会有编译错误。缓解：`main` 分支锁定 DSH `>= 0.2.0-rc.1` 且不提供向后兼容垫片，升级时以 GUI 冒烟为准。
- **`MutationObserver` 开销**：观察 `document.body` 的 subtree 变更，靠 rAF 合并。页面高频变更时仍需注意回调成本。
- **拦截器的隐式契约**：`ctx.on(...)` 的事件名与载荷由宿主定义，属于弱类型界面；宿主改动只会表现为运行时不生效。
