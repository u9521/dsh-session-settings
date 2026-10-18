# Agent Note: MCP 发现模块

Status: implemented

## Problem

"发现结果"没有模块拥有，它由三处各自拼装：

- `mcpServersProbe` 被调用 5 次（`useMcpServers`、`mcp/index.ts` 两处、`settings-controller.ts`、`useMcpPrimitives`），每次自行解析响应。`useMcpServers` 还接受 `tools` 为 `string[] | number`，其余按 `toolDetails` 读——同一个接口两种读法。
- "把发现结果写回服务器列表"逐字段重复两份（`mcp/index.ts` 与 `session/index.ts`），字段表 14 项；加一个原始类型要改两处，漏一处卡片与弹窗就不一致。
- `useMcpPrimitives` 的接口是 12 个平铺成员，宿主还必须通过 `onDiscovery` 回调把结果回灌给它，再靠"修改传入的 server 对象"重新播种——持久化知识泄漏进一个只读 hook。

## Decision

**纯函数层 `src/client/utils/mcpDiscovery.ts`**（无 React、无平台导入，可被 node 探针直接检查）：

| 导出 | 职责 |
| :--- | :--- |
| `McpDiscovery` | 一次发现的结果形状 |
| `discoveryFromResponse(payload)` | 唯一的响应解析；`tools` 只从 `toolDetails` 读 |
| `serverPatch(discovery)` | 唯一的"发现 → 服务器列表补丁"字段表 |
| `resourceTargetKey(args)` | 行标识格式，不再外泄给面板 |
| `EMPTY_DISCOVERY` | 空结果常量 |

**状态层 `src/client/mcp/discovery.ts`**：

- `probeServer(server)`：唯一的探测请求，返回 `{ ok, message, discovery? }`。面板、卡片测试、表单预保存检查三处共用；失败如何呈现留给调用方。
- `useMcpDiscovery({ server, t })`：返回判别联合 `state`（idle / loading / ready / error）与五个成员——`discovery`、`refresh()`、`readResource()`、`getPrompt()`、`readState(key)`。`refresh()` **返回**结果而不是回调宿主。
- 宿主写回改为 `serverPatch(result)`：全局页与会话页共用一份字段表。
- 面板通过 `readState(rowKey)` 取行状态，`read` 整对象传递删除。

`useMcpPrimitives` 删除；`onDiscovery` 回调删除。

**保留的一处独立请求**：`settings-controller` 的"刷新客户端"带 `remount: true`，返回的是重挂载结果而非发现结果，属于另一个操作，继续走自己的请求。

**落地约束：**

- 响应解析只有 `discoveryFromResponse` 一处；`tools` 为 `number` 的旧读法删除。
- "发现 → 服务器补丁"字段表只有 `serverPatch` 一处。
- `useMcpPrimitives` 删除；`onDiscovery` 不存在；面板不再收到 `read` 整对象。
- `pnpm run verify` 全绿。
- 纯函数已用 node 探针验证：`toolDetails` 优先且忽略 `tools` 数字；缺省字段归一为空数组；`serverPatch` 带出计数；`capabilities` 随列表保留；行键为 `uri:` / `tpl:` 前缀。
- GUI 冒烟：三个页签共享一次探测、缓存优先、读取与提示词渲染、卡片测试、表单预保存检查行为不变。

## Alternatives considered

- **只抽 `serverPatch` 纯函数、保留现有 hook**：部分采纳——纯函数是方案的一半，但 12 个平铺成员只能靠状态机解决。
- **保留 `onDiscovery` 回调**：否决。它是"hook 知道宿主怎么存"的泄漏；返回结果、由调用方决定写回，是更深的接口。
- **把 remount 也塞进 `probeServer`**：否决。它的响应形状（`remount`、`server`）与发现无关，塞进去会让"探测"这个名字骗人。
- **把纯函数留在 `discovery.ts` 里**：否决。那个文件导入 React，node 探针无法加载；拆到 `utils/` 后可以直接断言解析行为。

## Consequences

- **状态机改变面板渲染条件**：面板原本读 `loading/error/loaded` 三个布尔，现在由调用点从 `state` 派生；三处调用点已同步。
- **错误文案仍在调用方**：全局页与面板各有 locale 键，模块只返回消息，这是有意的分层。
- **探测次数未变**：仍是每个动作一次请求；本次只统一解析与写回，不做请求合并。
