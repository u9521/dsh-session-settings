# Agent Note: HTTP 接口契约与官方鉴权闸门

Status: implemented

## Problem

作用域语义的缺陷见 [显式作用域路由](2026-10-01-explicit-scope-routing.md)。本 Note 记录同轮排查暴露的两个接口层问题。

**一、所有路由绕过官方鉴权闸门。** `webServer.match()` 先查 exact 表再查 prefix 表：

```js
match(pathname) { const exact = this.exact.get(pathname); if (exact !== void 0) return exact; let best; … }
```

官方 `/api` 闸门是 **prefix** 路由（先 `connection.admit(req)` 做 Host/Origin fence 与浏览器鉴权，再转发），而本插件把路由注册为 **exact** `/api/session-settings/*`，命中 exact 表即绕过。实测无 cookie 时 `/api/rpc` 得 401，而 `/api/session-settings/get-settings` 得 200——任何能访问该端口的进程都可读写 MCP 配置（含明文 env/headers）与全部会话设置。

**二、接口没有唯一形状。** 服务端有 11 处"接受多种形状"的兼容分支：`config ?? parsed`、`globalConfig ?? config ?? parsed`、`server || parsed` ×4、`data || parsed`、`id || serverId`、`parsed.id || url.searchParams.get('id')`。路径只在 `API_ENDPOINTS` 定义，HTTP 方法完全没有契约，前后端各写一份字面量。

## Proposal

**一、方法进契约。** `src/types.ts` 新增

```ts
export const API_METHODS: Record<keyof typeof API_ENDPOINTS, ApiHttpMethod> = { … }
```

`Record<keyof typeof API_ENDPOINTS, …>` 让键集由类型强制对齐：漏写或多写即**编译错误**。前端 `method: API_METHODS.x` 发送，服务端 `methods: [API_METHODS.x]` 声明，同一常量，漂移不可能。

**二、请求/响应类型进契约。** `SaveSettingsRequest` 为以 `scope` 为判别键的联合，含 `global`、`workspace`（带 `workspaceId`）、`session`（带 `sessionId`）三个变体，作用域集合的归属见 [显式作用域路由](2026-10-01-explicit-scope-routing.md)；另有 `McpServerRequest`、`McpImportRequest`、`McpIdRequest` 与统一响应 `SettingsSnapshotResponse`。前端按此构造、服务端按此校验，11 处兼容分支全部删除——写端点参数一律进 body，读端点（`getSettings`、`mcpServersList`、`mcpServersCache`、`skills`、`skillsContent`）保持 `GET + query`，且这些读端点都不读 body。

`deleteSettings` 端点移除：reset 统一走 `save-settings` + `scope` + `isRestoringDefault`，避免同一语义两套表达。

**三、路由迁移到官方闸门。** 13 个路由从 `webServer.register` 改为 `ctx.connection.fetch.register`。该入口的 handler 仅在 carrier 施加信任与鉴权策略之后被调用，未鉴权请求由 carrier 统一返回 401。副带收益：

- carrier 的方法白名单只有 `GET | HEAD | POST`，与"移除 DELETE"天然一致；
- `requestBody: 'buffered'` 由 carrier 读体并施加 JSON 大小上限，手工 `readRequestBody` 随之删除；
- `path` 是完整 pathname，对外 URL 不变。

`inject` 从 `['webServer', 'loader']` 改为 `['connection', 'loader']`。`connection` 是**必需**依赖而非可选：缺少它只能以无鉴权方式注册这些路由，故宁可拒绝加载。

## Alternatives considered

- **保留 `deleteSettings` 端点（改为只接受 `DELETE`）**：否决。reset 会留下两套表达（DELETE 删会话、POST 重置暂存），正是本轮要消除的不对称；且 carrier 方法白名单不含 DELETE。
- **用自定义请求头做鉴权**：否决，且不可行。官方 `BrowserAuth` 只校验签名 cookie，读的头部仅 `host`/`cookie`/`content-length`；token 只在首页 URL 出现一次用于换 cookie。自建头需要自造密钥与存储，属另起一套鉴权而非"官方机制"。
- **继续在 `webServer` 上注册、由插件自行校验 cookie**：否决。签名密钥是 `BrowserAuth` 的私有成员，拿不到；等于重写鉴权。
- **把读端点也改成 POST + body**：否决。读失去 GET 语义与可缓存性，只为统一形态不值得；query 是 GET 传参的标准做法。
- **保留兼容分支并新增严格模式开关**：否决。多一条配置轴，且默认值一改即回归；破坏性收紧一次到位更可验证。

## Acceptance criteria

- `pnpm run check && pnpm run verify:gates` 全绿，`pnpm run fmt:check` 通过，`pnpm run build` 成功。
- **方法一致性**：13 个端点声明的 `methods` 恰为 `[API_METHODS[key]]`；对每个端点发 `DELETE` 均被拒。
- **形状严格性**：旧"扁平体"（`subagentModel` 直接置顶层、缺 `config`、缺 `server`/`data`/`id`）一律 **400**。
- `API_ENDPOINTS.deleteSettings` 不存在；13 个路由全部经 `connection.fetch.register` 注册，`webServer.register` 零调用。
- **鉴权**：运行中的 `dsh web` 上无 cookie 访问任一 `/api/session-settings/*` 返回 **401**（此前为 200）。
- `grep` 无残留：`server || parsed`、`config ?? parsed`、`globalConfig ??`、`id || serverId`、`readRequestBody`、`webServer.register`、`method: 'DELETE'`。

## Risks

- **接口是破坏性变更**：`deleteSettings` 移除、扁平体不再接受、鉴权收紧；客户端与服务端同包发布，半新半旧窗口内旧载荷得 400，刷新页面后一致。
- **对 `connection` 的硬依赖**：缺少该服务的组合将拒绝加载本插件。这是刻意选择（宁可拒绝加载，也不静默绕过鉴权），但会使插件在非 Web carrier 环境下不可用。
- **鉴权行为依赖宿主 carrier**：若宿主调整 fence 或 cookie 策略，本插件的行为随之变化；插件不再自持任何鉴权逻辑，这是把该职责交还宿主的代价。
- **`fetch` 路由签名与 `node:http` 不同**：handler 从 `(req, res)` 变为 `(request) => Promise<Response>`，body 需 `await request.json()`/`.text()`；迁移后所有 handler 都遵循该形态。
