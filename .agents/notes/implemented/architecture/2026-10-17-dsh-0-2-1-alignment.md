# Agent Note: DSH 0.2.1 对齐与回落代码清理

Status: implemented

## Problem

宿主主线已到 0.2.1-rc.2，本仓库仍停在 0.2.0 的依赖与声明上：`@modelcontextprotocol/client` 锁 2.0.0 而宿主用 2.2.0，cordis 4.0.4 而宿主 4.0.5，`peerDependencies` 下限仍是 0.2.0-rc.1。同一进程里因此存在两份 MCP 协议实现，tester 与已挂载客户端可能协商出不同版本。

客户端还留着两条 **pre-0.2.0 回落**：`resolveMainSessionId` 读 `sessions.current`、`resolveRecentWorkspaceId` 读 `workspaces.recentWorkspaceId`。这两个字段在 0.2.0 就已不存在，回落永远命中不了，只是让读者以为还有第二条路径。

## Decision

**依赖与声明**：

- `dependencies["@modelcontextprotocol/client"] = "2.2.0"`，与宿主同一版本。
- `devDependencies["@deepseek-ai/cordis"] = "~4.0.5"`，与宿主同一版本。
- `peerDependencies["@deepseek-ai/dsh"] = ">=0.2.1-rc.2"`；宿主不读 `engines.dsh`，这是唯一的兼容闸门。
- `devDependencies["@deepseek-ai/dsh-client-ui-primitives"] = "0.2.0-rc.1"` 保持不变：它是 shell 的静态模块种子，宿主树里也是这个版本，跟随"最新"会破坏模块表。

**回落代码**：`sessionScope.ts` 只保留真实形状——"当前会话"是 `retainedBy.mainView` 持有者，"最近工作区"由成员会话 `updatedAt` 排序；`SessionsState.current` 与 `WorkspacesState.recentWorkspaceId` 从类型与空快照里删除。回落本就不可达，删除后行为不变，但读者不再需要判断"哪条是真的"。

**不保留的兼容面**：不写"宿主没有某服务时退化到旧路径"的分支。服务缺失即视为组合错误，由宿主在加载期拒绝，而不是本插件猜一个降级行为。

**落地约束：**

- `package.json` 的 SDK、cordis 与 peer 区间与上节一致。
- `src/client/types/session.ts` 不再声明 `current` 与 `recentWorkspaceId`；`sessionScope.ts` 与 hero 的空快照不再提及它们。
- `pnpm run verify` 全绿；`lib/client.js` 仍以 `window.__ModuleLoader__.load` 开头。
- 在 0.2.1-rc.2 宿主上，会话设置 tab、hero chip、MCP 页与技能页正常；hero chip 仍跟随工作区切换。
- `README.md` / `README.zh.md` 兼容表与 `AGENTS.md` 的宿主兼容性不变量同步到 0.2.1。

## Alternatives considered

- **保留 `>=0.2.0-rc.1` 区间**：否决。0.2.0 与 0.2.1 之间本插件没有分支逻辑，声明一个自己没验证过的下限等于把风险留给用户。
- **MCP SDK 保持 2.0.0**：否决。tester 与 bridge 用两份 SDK 时，SSE 降级与协议版本协商的结论可能不一致；对齐版本是唯一能消除该未知数的做法。
- **保留 pre-0.2.0 回落作为"防御"**：否决。字段已不存在，回落不可达；保留它只会让类型多两个永远为空的成员。

## Consequences

- **peer 下限收紧会拒绝 0.2.0 宿主**：这是本方案的意图。用户若仍停留在 0.2.0，需要升级宿主，而不是本插件猜测兼容。
- **MCP SDK 2.2 的 SSE transport 已标 deprecated**：本插件保留它只作为 tester 对旧服务器的降级路径；未来 SDK 删除该导出时，构建期会失败而不是运行期静默失效。
- **primitives 冻结在 0.2.0-rc.1**：这是 shell 种子的版本，不是本插件可以自由升级的依赖；宿主升级时需复核该包版本是否变化。
