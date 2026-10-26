# Agent Note: MCP 重新挂载入口

Status: implemented

## Problem

某台 MCP 服务器（streamable HTTP）在运行中丢失 HTTP 会话后，宿主侧继续用旧 session id 发请求，每次工具调用都被服务端拒绝，而界面显示「已连接」、工具计数正常。

恢复动作本来就有：拆掉官方客户端 fork 再重建（`refreshServer`）。宿主也明说这是唯一出路——重连预算耗尽后 "disposal (including HMR) is the only way back"，而 `Mcp-Session-Id` 由 SDK 私有持有、宿主桥从不调用 `terminateSession()`，所以只有销毁 client 才能换掉失效会话。

问题在于它只挂在「客户端连接失败」徽标上，而该徽标由 `isMcpClientUnavailable` 判定：有 `lastError`，或零工具且超过 10s 宽限。会话失效两种都不满足——工具是注册着的，失败的只是调用。于是界面上没有恢复入口，用户只能重启 dsh。

同一处还有一段死支路：`force` 用来绕过「任何 scope 都没启用就不挂」的判定，注释写明是给「尚未保存的草稿开关」用的，但前端从未发送过它（唯一调用方 `routes.ts` 也不发）。缺了它，草稿态的重挂会被静默跳过，却照样报告成功。

## Decision

- **常驻按钮**：每张已启用卡片页脚加「重新挂载」，与失败徽标共用同一个 `refreshClient`，一个后端动作、两个入口。未启用的卡片不给入口，可见性就是权限边界。
- **删掉 `force`**：重挂载是显式恢复动作，恒重建。`refreshServer` 不再读 `isServerNeeded`，`McpProbeRequest` 去掉该字段。`isServerNeeded` 仍供 `syncServer` 与 `syncAll` 使用，那里的「需不需要挂」才是真问题。
- **判定改用重建结果**：`McpRefreshResult.ok` 不再是 `probe.ok`，而是「fork 重建成功且未报 `lastError`，且（注册了工具或已在预算内 settle）」。探测走独立短连接，它连得通恰恰不能证明那条长连接活着。
- **`settled` 位**：`McpRefreshOutcome` 增加 `settled`，标出「重建完成但握手仍在预算外继续」。这种按成功报，文案说明工具仍在注册，按钮可再点一次。
- **握手单独轮询**：`fork.await()` 只代表插件激活完成，`tools/list` 还没回来，所以「重建成功」不能由它判定。`waitForTools()` 以 100ms 间隔读 `getServerStatus().registeredToolCount`，预算与整个重挂共用（激活花掉的时间要扣掉），遇到 `lastError` 立即停止。
- **结果只进全局 notice**：行内保留既有失败徽标，不新增结果行。

## Alternatives considered

- **自动自愈**：插件不监听 `tools/result`，工具调用失败对它不可见，没有可靠信号；自动重试还会让非幂等工具被执行两次。上游该在收到 404/-32001 时 `terminateSession` 并重建，那是宿主的事。
- **保留 `force` 只补前端**：那样「点重挂」的语义仍取决于服务器有没有被启用，而按钮本来就只出现在已启用的卡片上；两处判定迟早再次分叉。
- **只做会话级「全部重新挂载」**：故障是单台的，整批重建会把健康连接一起打断。
- **按传输类型分支**：stdio 重挂是杀子进程再起，但 dispose+重建的路径对两种传输一致，没有需要区别处理的状态。
- **行内显示结果**：与全局 notice 重复，且刷新页面即失。

## Consequences

- **全进程影响**：fork 按 `serverId` 共享、跨会话，重挂期间所有会话同时失去该服务器工具。UI 不额外提示。
- **3000ms 上限**：预算内未 settle 时报成功并提示工具仍在注册；再点一次即可，UI 不自行轮询。
- **只暴露工具的服务器**：只声明资源、不声明工具的服务器永远 settle 不了，因此「可用」不要求 `settled`——只要没记 `lastError`，重建成功即算成功。
- **探测仍会先跑**：重挂请求仍是探测入口的 `remount: true` 分支，探测失败不阻止重建。
- **API 无护栏**：服务端不再校验「有没有被启用」，对未启用的服务器发 `remount: true` 会真的挂上。护栏在 UI 的可见性上，不在执行面。
