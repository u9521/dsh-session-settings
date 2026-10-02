# Agent Note: 用 scope 层声明取代全局拦截器

Status: implemented

## Problem

MCP 与 Skill 的会话级隔离此前由**全局拦截器**实现：官方 MCP 客户端全部 fork 在根 ctx（挂载集是各会话需求的并集），再用 `system-prompt/assemble` 过滤工具名、`tools/pre-execute` 按 `mcp__` 前缀拒绝执行。DSH 0.2.0 下暴露两个缺口：

1. **指令段未过滤（G2）。** 0.2.0 新增 `mcp:<serverName>` 与 `mcp-resource-servers` 两个 prompt 段，而拦截器只处理 `transformed.tools`。fork 挂在根 ctx 使 `scopeOf(ctx)` 为 `undefined` 而进入 global 层，`merge()` 对任何 scope 都含该层——**任一会话启用过的服务器，其名字与指令文本会进入所有会话的 prompt**。
2. **资源工具未纳管（G3）。** `dsh-mcp-resources` 的三个资源工具无 `mcp__` 前缀、不在 `toolMeta` 中，两道拦截器都以二者为入口，故既不隐藏也不拒绝。唯一运行期鉴权是 `McpResourceRuntime.request()` 按 `exec.agent` 解析 provider，而 provider 在 global 层——**会话内被禁用的服务器，其资源仍可读取**。

根因是拦截器按事件名与前缀猜名，宿主每新增一个面就要补一个拦截点。

## Proposal

挂载点不变、隔离点换成 scope 层声明：MCP 客户端仍只挂载一次（每服务器一个连接），隔离由每个 agent 自己 scope 上的声明承担。

**成立前提：`tools.restrict()` 只过滤继承面，从不过滤本层。**

```js
for (const [name, definition] of inherited) {          // inherited 起于 global 层
  if (layers.every((layer) => layer.admits(name))) visible.set(name, definition);
}
if (own !== void 0) for (const [name] of own.tools) visible.set(name, definition);  // 本层直接放行
```

故 MCP 必须挂在**共享层（继承面）**；挂进 agent 自己的层则 restrict 立刻失效。这就是"一处挂载"与"scope 隔离"互为前提的原因。`view(scope)` 同时喂养呈现（`schemas()`）与执行（`resolveExecution()` → `UNKNOWN_TOOL`），一处声明双面生效。

`src/server/mcp/policy-projection.ts` 在 `agent/created` 安装四类声明，都装在 `agent.ctx` 上，只作用于该 agent：

| 面 | 原语 | 作用 |
| :--- | :--- | :--- |
| 工具可见性 | `tools.restrict({deny})` | 未启用服务器的全部已注册工具 ∪ 各服务器禁用工具 |
| 执行兜底 | 根 `tools.guard(fn)` | 单调拒绝；覆盖 restrict 生效前的窗口与参数级资源鉴权；求值失败时 fail closed |
| 指令段 | `systemPrompt.section({name:'mcp:<id>', text:''})` | 同名遮蔽祖先段 |
| 资源名单 | 同上，name 为 `mcp-resource-servers` | 自行渲染过滤后的 enabled 名单 |

`deny` 集与 `tools.schemas()` 求交：挂载失败或零工具的服务器不贡献名字，故不会让 `restrict()` 因未知名字抛错。`system-prompt/assemble` 的监听器**只做挂载触发**，不过滤也不改写 assembly。

Skill 侧用注册表自身的分层：`ctx.skills.register()` 把 runtime skill 写进**调用方**的层，近层对同名条目整体胜出。故只在 `agent.ctx` 上重注册被本会话限制的名字并改写 `invocation`，`dsh-tool-skill` 便原生按 `isModelInvocable` 拒绝——`skill` 的 pre-execute guard 与猴补丁都已删除。

**必须显式处理的两点：**

- **子代理不继承父的 agent 层。** `composeFrom(childCtx, parent.ctx)` 把子代理绑到 `standing.key`（父的 generation），父子是**兄弟**而非父子链。策略继承因此不靠 scope，而靠 `resolveAgentSessionId` 沿 `parentSession` 上溯根会话。
- **GUI 显示与强制解耦。** 链只向上，generation 读不到 agent 层，故 `discovery.ts` 不依赖强制机制：读基础 registry 的 invocation-neutral 目录，再由 `resolveEffectiveSkills` 叠加显示标志。

## Alternatives considered

- **只补 G2/G3 两个补丁**：否决。能消除当前缺口，但保留"每加一个面就漏一次"的结构性成因。
- **每个 agent 各自挂载 MCP 客户端**：否决。隔离最彻底，但连接数从每服务器 1 个变为 agent × 服务器，0.2.0 的 stdio 协商还额外起一个探测进程；且 `restrict()` 因"不过滤本层"对该形态失效。
- **挂载到每个预设的 generation scope**：否决。generation 按预设定义版本共享，同预设下多会话共用一个实例，粒度不符会话语义。
- **插件自铸 per-session scope 层**：否决且不可行。`bindScopeParent` 一次性，agent key 的父链已被 `dsh-agent-presets` 占用，re-link 权威不公开。
- **自建工具定义绕过官方客户端**：否决。等于重写传输、重连预算与资源 provider。

## Acceptance criteria

- `policy-projection.ts` 幂等：目标声明集与已装集相等时不重装，`tools/change` 不自激。
- `restrict` 的 deny 集与注册表视图求交，未注册名不致抛错。
- `agent/created` 监听器全程 try/catch：监听器抛错会**导致 agent 创建失败**（serial 语义）。
- 会话 A 启用服务器 X、B 未启用时：B 的 prompt 不含 `mcp:X` 段与 X 的资源名单；B 中 `read_mcp_resource({server:X})` 被拒，X 的工具不可见且调用被拒。
- 禁用某 MCP 工具后被调用即被拒；`subagent` 内同样生效，且子代理可用父会话启用的服务器。
- Skill：`/name` 对禁用技能被拒不崩；技能页禁用态正确；无 `skills/change` 循环。
- `pnpm run check && pnpm run verify:gates` 全绿；GUI 冒烟通过且无需重启。

## Risks

- **`tools/change` 自激循环（首要）**：restrict 本身会经 `ScopedLayers` 的 onChange 触发 `tools/change`。缓解是重装前比较目标集与已装集，相等即跳过；已采样验证不增长。
- **restrict 的应用窗口**：挂载注册到 restrict 生效之间有可见窗口。缓解是 guard 兜底。
- **策略缓存陈旧**：guard 需同步读取，而 `resolveWorkspaceForSession` 是异步。缓解是缓存与 workspace 同存并有界重试。
- **子代理继承遗漏**：父子是兄弟，上溯失败会让子代理静默失去 MCP 能力。冒烟须覆盖 subagent。
- **GUI 跨 scope 读取失效**：显示若依赖强制机制会错误。缓解是二者解耦。
- **G1/G4 不在本方案内**：`maxInstructionBytes` 的 GUI 可达性与 tester 的 SSE 降级结论属独立改动。
