# Agent Note: MCP 服务器注册表

Status: implemented

## Problem

"写一个 MCP 服务器"这件事散在 `mcp/routes.ts` 的九个 handler 里，每个 handler 自己拼一遍 `load → normalize → save → publish → sync → invalidate`，由此产生三个只有组合起来才显形的缺陷：

- **两条读取路径**：`getMcpStore()`（组合根的惰性缓存）与 `loadMcpStore()`（每次重新读盘）。一次改动的可见性取决于该分支有没有记得发布它刚写的那份 store。
- **两套 normalizer**：表单路径校验 id 语法与 reconnect 的 `>=1` 下限，`import` 两条都不做，还会丢掉 `maxInstructionBytes`、`resourceDetails`、`promptDetails`、`capabilities`——一次导入就清空探测缓存。
- **写盘失败被吞**：`saveMcpStore` 捕获异常后仅打日志，handler 照样回 `{ok:true}`；磁盘满或权限错时界面显示已保存而文件没变。

另外 `probe` 在 `await` 网络之后用探测前的快照写回整个对象，期间任何并发编辑都会丢。

## Decision

`src/server/mcp/registry.ts` 拥有 store 的唯一写入口：

| 方法 | 职责 |
| :--- | :--- |
| `list()` / `find(id)` | 客户端视图：重字段降为计数，附运行时状态 |
| `raw(id)` | 未脱敏的存储记录，供探测与刷新使用 |
| `upsert(server, originalId?)` | 归一化 → rename 级联（卸载旧 fork、重写会话配置）→ 落盘 → 广播 |
| `remove(id)` | 删除 → 落盘 → 卸载 fork → 广播 |
| `importServers(data)` | 逐条走同一个 normalizer，保留已有缓存字段 |
| `recordDiscovery(id, result)` | 只补探测字段，在 `await` 之后重新读取当前记录 |
| `cacheView(id)` | 上次探测的缓存视图，永不连接 |
| `refreshClient(server, opts)` | 转调 manager 的重挂载 |

关键决定：

- **store 由组合根持有**（`getStore` 注入），与 `McpManager` 共享同一对象。manager 的"这个服务器是否需要"与 registry 的写入必须看同一份数据，否则挂载判定会读到一次写尚未发布的旧状态。
- **一个 normalizer**：add / edit / import 全走 `normalizeServer`。导入时 id 不合法的条目被跳过，而不是被静默改写成客户端挂不上的名字。
- **落盘失败抛出**，由 handler 映射成 500。`saveMcpStore` 仍是唯一的写盘函数，但不再吞错。
- **每次写成功后广播一次失效**；路由不再自己调 `syncServer` / `syncAll`。

路由从 802 行降到 377 行，九个 handler 里不再出现 `saveMcpStore`、`loadMcpStore`、`getMcpStore`、`setMcpStore`、`mcpManager` 或 `invalidatePolicies`。

**落地约束：**

- `src/server/mcp/routes.ts` 不再出现 `saveMcpStore`、`loadMcpStore`、`getMcpStore`、`setMcpStore`、`mcpManager`、`invalidatePolicies`。
- 导入与表单走同一 normalizer：非法 id 被跳过，reconnect 下限生效，导入保留 `capabilities` 等缓存字段。已用构建产物直接调用 `normalizeServer` 验证：超长/空 id、stdio 缺 command、http 缺 url 均被拒；`maxAttempts: 0` 被抬到 1；缓存字段在二次归一化后仍在。
- 写盘失败返回 500，而不是 `ok:true`。
- 每次写成功后失效广播恰好一次。
- `pnpm run verify` 全绿；MCP 页的增删改查、导入、探测、刷新在 GUI 冒烟中行为不变。

## Alternatives considered

- **只合并 normalizer、保留路由里的写序**：否决。写序才是丢更新与"保存成功但没落盘"的来源。
- **让 registry 自己持有 `McpManager` 并负责 sync**：否决。manager 的 `syncAll` 已挂在 `PolicyBus` 上，registry 再调一次会重复；registry 只负责数据落库与广播。
- **保留两条读取路径但强制每次发布**：否决。两条路径本身就是缺陷来源，而这个进程是唯一写入者，单缓存读取已经足够。
- **让 `probe` 在 await 之前把整个对象写回**：否决。那正是丢并发编辑的写法；改为 `recordDiscovery` 在 await 之后重新读取并只补探测字段。

## Consequences

- **写盘失败变成可见错误**：此前静默成功的场景现在会报错。这是意图，但用户可能第一次看到保存失败；错误沿用现有 `error` 通道呈现。
- **单缓存读取**：若将来出现第二个写入者（外部直接编辑文件），需要显式 reload；当前不引入。
- **registry 注入面变大**：构造参数包含 store 读取、manager、会话 store 读写与失效广播；集中在一处仍比散在九个 handler 里可读。
