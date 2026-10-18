# Agent Note: 策略失效总线

Status: implemented

## Problem

设置保存后要让新策略对活着的 agent 生效，靠的是三根各自为政的线：`saveSettings` 调 `mcpManager.syncAll()` 与 `invalidatePolicies()`（后者只扇出到 MCP 与 sandbox 两个投影），MCP 路由各自再调一次 `invalidatePolicies`，技能侧则发一个 `ctx.emit('skills/change')`——而这个事件**没有任何监听者**，`SkillPolicyProjection.notifyPolicyChanged()` 从未被调用。

后果是用户可见的：禁用某个技能后保存，界面显示已禁用，但活着的 agent 仍保留旧的 scope 声明，下一次技能调用照旧可用，直到该 agent 被重建。新增一个策略面时，还要记得改路由里的扇出列表，漏改不会报错。

第二个缺陷藏在投影内部：`notifyPolicyChanged()` 遍历的是"有 shadow 注册的 agent"，而创建时没有任何技能被禁用的 agent 不在那张表里。于是"先建会话、后禁用技能"这条最常见的路径永远不会到达该 agent。

## Decision

**`PolicyBus`（`src/server/common/policy-bus.ts`）拥有失效扇出。** 订阅者按注册顺序被调用，调用方只说"失效了"，不必知道有谁在听：

| 顺序 | 订阅者 | 作用 |
| :--- | :--- | :--- |
| 1 | `mcpManager.syncAll` | 挂载/卸载，产生新的工具集 |
| 2 | `mcpPolicyProjection.notifyPolicyChanged` | 按新工具集重装 restrict / guard / 段遮蔽 |
| 3 | `sandboxInterceptor.notifyPolicyChanged` | 丢弃 roots 缓存 |
| 4 | `skillPolicyProjection.notifyPolicyChanged` | 重装技能 shadow |

顺序是契约：先 sync 后投影，与旧 `saveSettings` 里的次序一致，注册点集中在 `src/server/index.ts` 一处。一个订阅者抛错只记日志，不阻断后续订阅者。

**写入方只调 `invalidate()`。** `saveSettings` 与 MCP 的 add/edit/rm/probe/import 都只调这一个方法；路由不再自己调 `syncServer`/`syncAll`，也不再有 `invalidatePolicies` 与 `syncAll` 的成对调用。`registerSessionSettingsRoutes` 因此不再接收 `McpManager`。

**删除死事件。** `skills/change` 与它在 `types.ts` 的声明一并删除：没有监听者的事件是误导。

**投影改为跟踪全部 agent。** `SkillPolicyProjection` 新增 `agents` 集合，在 `applyToAgent` 里无条件登记、在 `forget` 里移除；`notifyPolicyChanged()` 遍历它而不是 `installed`。`installed` 继续只记录"有 shadow 的 agent"，幂等键仍按 agent 保存。

**落地约束：**

- `src/server/**` 不再出现 `skills/change`；`types.ts` 的 `Events` 不再声明它。
- `src/server/session/routes.ts` 不再接收或引用 `McpManager`。
- `saveSettings` 保存后，一个已存在且此前无技能限制的 agent 立即受新策略约束。
- MCP 的 add/edit/rm/probe/import 只调 `invalidate()`，且不重复挂载（manager 的 fingerprint 短路仍生效）。
- 一个订阅者抛错时，其余订阅者仍被执行。
- `pnpm run verify` 全绿。

## Alternatives considered

- **只补一根线（在 `saveSettings` 里调 `SkillPolicyProjection.notifyPolicyChanged()`）**：否决。能修当前缺陷，但保留"新增策略面要记得改扇出列表"的结构性成因，也修不了投影只遍历已 shadow agent 的第二个缺陷。
- **用 `ctx.emit` 事件代替 bus**：否决。Cordis 事件是全局广播，任何插件都能监听，失效语义会扩散成本插件的公开契约；bus 是插件私有的。
- **带 domain 参数的 `invalidate('mcp' | 'skills' | …)`**：否决。四个订阅者里有三个必须每次都跑；为省一次幂等调用引入一套订阅契约不划算。
- **让 bus 支持 async 订阅者并 await 全部**：否决。`syncAll` 本身就是"发起、不等待"的语义，await 一个不等结果的调用没有意义；技能侧的异步重装由它自己吞错。

## Consequences

- **执行顺序变成隐式契约**：订阅顺序决定 sync 与投影的先后。缓解：模块注释与 `index.ts` 的注册点都写明"先 sync 后投影"。
- **syncAll 被更频繁调用**：MCP 路由的每次写现在都顺带 syncAll。manager 的 config fingerprint 与 `activeSyncs` 去重让它成为幂等操作；若将来去掉短路，这里会变成重复重连。
- **技能重装是异步且不等待**：bus 是同步的，技能 shadow 可能晚一帧落地。对"下一次技能调用"没有影响（调用发生在用户下一次交互），但不适合作为同步一致性保证。
