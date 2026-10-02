# Agent Note: 挂载判定、策略解析与状态呈现的一致化

Status: implemented

## Problem

`mountAttempted` 与 `registeredToolCount` 是**瞬态**观测，却被当作**稳态**事实用于三处判定。

**策略重算丢失 workspaceId。** `notifyPolicyChanged()`（每次保存都调用）清空策略缓存后，`policyFor()` 只能以 `undefined` 的 workspace 重算——`resolveWorkspaceForSession` 异步而执行守卫必须同步读策略。工作区 `mode: custom` 时会话启用集被全局集顶替，方向可过严也可过松，守卫随之由拒绝变为放行：**任意无关保存都会让本会话已禁用的服务器重新可执行**。创建时若 `workspaceRegistry` 尚未索引该会话，错位永久化。

**悬空 serverId 使资源工具继续可见。** 配置指向已删除的服务器时 `enabledServerIds.size > 0`，三个资源工具既不隐藏也不拒绝；守卫按名字查会拒，故仅为呈现泄漏。**每次保存都拆建连接。** `syncAll()` 未传 `opts`，`mountOfficialClient()` 拆掉在册 fork 后因 `settleMs = 0` 立即返回，工具尚未重注册。**徽标读的正是该窗口**：`mountAttempted` 早于工具注册写入，谓词无时间维度，而 `count === 0` 同时意味着*握手中*与*已放弃*。窗口关闭后无路径重读，徽标粘住；手动重挂载"能修好"只因它用 `settleMs = 3000`。同谓词把零工具服务器永久误报。

**enabledByDefault 只管挂载。** `normalizeGlobalSettings()` 无条件把 `enabledServerIds` 物化为 `[]`，`defaultMcpIds` 分支不可达，故该标志对可见性无效：服务器被拉起却对任何会话不可见。**提示判据用 `result.ok`（探测）而非 `result.remounted`**，后者从未被读取。

## Proposal

**策略缓存与 workspace 同存。** `policyWorkspace` 与 `policies` 分开存放，`notifyPolicyChanged()` 只清后者，重算即用回同一 workspace。`workspaceRetries` 做有界重解析（上限 5），仅在 workspace 仍为 `undefined` 时于 `ensureMountedFor()` 重试并重装声明。`forget(agent)` 仅在无其他在册 agent 共享该 sessionId 时清理。

**资源工具按可解析的 enabled 集判定。** `resolvableEnabled(policy)` = `enabledServerIds` ∩ `mcp_servers.json` 键，`restrict()` 与守卫共用。
**注册表遍历移出 per-agent 循环。** `registeredToolNames()` 走根 `ctx.tools`、与 agent 无关，改为循环前取一次并下传 `denySetFor()`。
**配置未变则不重挂载。** `mountConfigOf(server)` 同时喂 `ctx.plugin()` 与指纹，配键序无关的 `canonical()`（表单会重排 `env`/`headers` 键）。`syncServer()` 比对 `mountedConfigKeys`，相同即返回；指纹只含影响连接的字段。`refreshServer()` 仍强制重挂。

**删除 `enabledByDefault`**（12 文件）：类型字段、`isServerNeeded()` 首分支、`defaultMcpIds`、两条服务端解析路径、三处客户端回退、表单开关、卡片徽标与样式、三个双语键。
**状态增加时间维度。** `McpServerRuntimeStatus` 增可选 `mountStartedAt`（随 `mountAttempted` 写入、卸载与 `dispose()` 清除）。判定逻辑落在纯模块 `src/client/utils/mcpRuntime.ts`：`lastError` → 失败；未尝试或计数 > 0 → 正常；`expectedToolCount(server) === 0` → 正常（零工具服务器）；`mountStartedAt` 未知 → 不指控；否则超 10s 宽限期才算失败。`expectedToolCount()` 复用 `server.tools`（`getSanitizedServers()` 已转成数字），`now` 由参数注入以便确定性断言。

**提示按真实行为分支。** `remounted` 为真才提示"已重新挂载"；仅 `ok` 为真提示 `refreshProbeOnly`；否则报探测失败。

## Alternatives considered

- **`policyFor()` 改异步**：否决，守卫在 `tools.guard()` 内同步求值。
- **`notifyPolicyChanged()` 里逐 agent 重解析 workspace**：否决，与有界重试职责重复。
- **补可见性解析以"救活" `enabledByDefault`**：用户已否决，改为删除。
- **调大 `settleMs` 或让客户端常驻轮询**：否决，前者只掩盖症状且拖慢每次保存，后者在谓词修好后已无误报可清。
- **给 `mountInBackground()` 去重**：否决，`ensureServersMounted()` 吞掉失败，无法区分"已挂载"与"挂载失败"。
- **给 `syncAll()` 加 await**：否决，保存响应不应阻塞到最长 3s。
- **清理悬空 serverId**：否决，自动裁剪等于隐式迁移。
- **引入测试框架**：否决（本轮），见 [回归验证策略](../../proposed/testing/2026-09-26-regression-strategy.md)。

## Acceptance criteria
- 工作区 `mode: custom` 时 `applyToAgent()` 与 `notifyPolicyChanged()` 后的 deny 集合与挂载 id 集合相同；守卫在保存前后都拒绝工作区未启用的服务器。
- `workspaceRegistry` 首次返回空、第二次命中时策略被纠正；重试达上限后不再重试。
- 配置不变时连续 5 次 `syncAll()` 后 `ctx.plugin` 调用次数停在 1；改 `command` 后增加；只改 `description` 后不增加。
- 只启用一个悬空 id 时三个资源工具进入 deny 集合，守卫拒绝 `read_mcp_resource`。
- `repaint()` 的 `schemas()` 调用次数从 `事件数 × agent 数` 降到 `事件数`。
- 谓词四情形：零工具且计数 0 → `false`；`mountStartedAt` 刚写入 → `false`；前推 11s → `true`；`lastError` → `true`。
- `isServerNeeded=false` 时 `refreshServer()` 返回 `remounted=false, ok=true`，前端走"状态已刷新"分支。
- `pnpm run verify`、`fmt:check`、`build` 全绿；产物中 `enabledByDefault`、`默认开启`、`Enabled by Default`、`dsh-mcp-default-badge` 均 0 次。
- GUI 冒烟：连续保存后不再出现"客户端连接失败"徽标；断开端点后徽标在宽限期外出现且可经重挂载恢复；表单与卡片不再有「默认开启」。

## Risks

- **无关保存不再复活已耗尽重连预算的服务器**：恢复手段是既有的「重新挂载」按钮。
- **真实故障的徽标最多延迟 10s 且需一次状态重读才渲染**；`lastError` 类不受影响。
- **`server.tools` 是最近一次探测的缓存**，可能滞后；偏差方向安全（为 0 时不报警）。
- **能力收缩**：`enabledByDefault` 移除后用户需在全局页逐个启用。
- **`policyWorkspace` 随 sessionId 数量增长**，属有界泄漏。