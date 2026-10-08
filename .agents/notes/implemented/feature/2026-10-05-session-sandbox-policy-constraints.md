# Agent Note: 会话沙箱路径策略的落地约束

Status: implemented

## Problem

[会话沙箱路径策略](2026-10-05-session-sandbox-policy.md)决定了额外可写目录的注入点与规则模型。但能否落地、落地后有哪些不可忽略的副作用，取决于三件必须先查清的事实：各后端实际能表达什么、插件如何把规则喂给后端、以及宿主写死的部分会怎样限制能力边界。本篇是那些事实的唯一归属地。

## Proposal

### 一、契约与实测数据（本机 Linux / kernel 6.18 / WSL2）

`SessionSettingsConfig` 增加第四个领域，与既有三个同构：

```ts
interface SandboxAllowEntry { path: string; description?: string }
interface SessionSandboxConfig { mode?: SettingsMode; allow?: SandboxAllowEntry[] }
```

无 `bwrap`，`dsh-sandbox-local` 的 linux 链落到 `landlock`，其 `--probe` 报 `full`。`confine` 实际返回：

```
landlock-run --ro / --rw /dev/null --rw /tmp --rw <ws> -- bash -c <cmd>
```

按此形状在 `--` 之前追加 `--rw <extra>` 即扩充白名单。端到端验证（工作区 `.sbx-probe/ws`，额外根 `.sbx-probe/extra` 为其兄弟目录，故不在默认授予内）：

| 场景 | 结果 |
| :--- | :--- |
| 未配置会话，写 extra | `Permission denied` |
| 会话配置 extra 后写 extra | 成功 |
| 写工作区 | 成功 |
| 写未授予的 `/run/user/...` | `Permission denied` |

后端追加语法：`landlock` 用 `--rw <path>`，`bwrap` 用 `--bind <path> <path>`，Seatbelt 无法追加（profile 是单个 SBPL 字符串）。provider 的 `internals.landlockLauncher` / `internals.seatbeltExec` 是测试钩子，无稳定性承诺，本实现不取用——后端身份只从返回的 argv[0] 判断。

### 二、必须处理的副作用

- **路径规范化**：`confine` 只对 `workspaceRoot` 做 `canonicalPath()`，额外根由插件自行规范化后写入。
- **不存在的根在 bwrap 下是致命的**：`landlock` 静默匹配不到，`bwrap --bind` 会让 profile 构建失败、该会话全部命令报错。故 `resolveAllowSet` 进 provider 前 `statSync` 过滤，并在 UI 显示被跳过的条目。
- **两侧强度不同**：`fs` 侧是 trusted code 里的路径判定（宿主自认 "containment, not a security boundary"），bash 侧才是内核边界。`checkedTarget` 遍历的 `writableRoots` 不读额外根，所以另有一层 `ctx.fs` 代理：命中额外根时改调**栅栏之上**的同名实现（原型链上一层），写入机制仍是宿主的原子写。
- **`argv` 膨胀**：条数线性增长 launcher 参数，超长 argv 在 spawn 阶段失败。

### 三、两条 cordis 装配约束（都曾静默导致"UI 显示不支持"）

- **服务必须在 `ctx.inject([...], cb)` 回调里取**。`apply` 在加载时只跑一次，而基础组合写明 "Row order carries no load semantics"——行在自身服务可用时才激活。在 `apply` 里同步 `ctx.get('sandbox')` 会拿到 `undefined`，于是配置全部不生效。`ctx.fs` 同理。
- **能力判定不能比较函数身份**。`ctx.get(name)` 返回 traced Proxy，读**函数属性**每次都换一个新的 shadow wrapper；写仍转发到同一个 target（实测消费者后续 `ctx.get` 能看到补丁），但 `provider.confine === 上次读到的` 永远为假。故用记录式 `installed` 标记，`restore()` 一并清除且其 `delete` 不做身份判断（否则会静默跳过清理）。

### 四、宿主写死、插件改不了的部分

- **升级阶梯**：`approveEscalation` 与 `WIDER_MODES` 是宿主闭表，额外规则只作用于标准模式，被拒绝后的升权重试仍走宿主三档。
- **模型可见文本**：`sandbox:policy` 段由 `@deepseek-ai/dsh-sandbox-policy` 写死（只描述模式与 `workspaceRoot`）。额外规则由插件**追加**自己的 context section（`session-settings:sandbox-allow`，order = `SANDBOX_POLICY + 1`）。
- **宿主不变式伴侣**只校验 `sandbox/mode` 的值域，不涉及额外目录。
- **`confine` 不是扩展点**：它是原型方法，包装以自有属性遮蔽它，卸载时 `delete` 还原（赋值回原位会留下比插件生命周期更长的自有属性）。
- **`ctx.fs` 的委托不能吞掉宿主的判决**：只有"是否放行"的判断被 try 包住；委托写入若抛错（`FS_STALE_VERSION`）必须原样上抛。

## Alternatives considered

- **用 `runnerCommand` 配置注入额外根**：配置期字段，改它需重载插件、跳过功能探测，且要求同时提供 `runnerFailureSignatures`；无法承载逐会话列表。
- **取用 provider 的 `internals` 测试钩子拿 launcher 路径**：无稳定性承诺；从 argv[0] 判断后端已足够。
- **把额外根塞进 `workspaceRoot`**：会让插件自己的相对路径解析与 `tool-bash` 的 `workdir` 默认值一起漂移，且放弃与其它工作区的隔离。

## Acceptance criteria

- 上表四个场景的退出码与错误文本一致（实测）。
- 配置不存在的绝对路径时不使命令失败，且该条目出现在 `sandboxSkipped` 中。
- 未配置任何规则时 `confine` 的行为与包装前逐字节相同（`roots.length === 0` 时早返回原结果）。
- provider 在插件之后激活时能力仍报 true；激活前报 false 且理由是"尚未挂载"（实测）。
- `write` / `edit` 命中额外根时成功，`read-only` 与无会话时仍返回 `FS_SANDBOX_DENIED`（实测）。
- 委托写入抛出的 `FS_STALE_VERSION` 原样上抛，不被改写成策略拒绝（实测）。
- 模型上下文出现 `session-settings:sandbox-allow` 段，逐条列出路径与描述；无规则时该段不产生文本。
- `pnpm run verify` 全绿。

## Risks

- **押注 provider 的 argv 形状**：上游重构 profile 生成会让追加静默失效；`--` 缺失时本模块原样返回，属保守方向。
- **`landlock` 的 root 顺序**：`grantArgs` 先 `--ro` 后 `--rw`，顺序不影响授权集合，但依赖该顺序的假设不应扩散到其它后端。
- **`fs` 未接入**导致 bash 与 write 工具对额外根的行为不一致：bash 可写，`write` 工具仍报 `FS_SANDBOX_DENIED`。这是当前已交付形态的已知边界，需在文档与 UI 中如实说明。
