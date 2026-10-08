# Agent Note: 会话沙箱路径策略

Status: implemented

## Problem

DSH 的沙箱只有三个全局模式（`read-only` / `workspace-write` / `danger-full-access`），"能写哪里"由内核按模式推导：`workspace-write` = 会话 cwd + `/tmp` + `os.tmpdir()`。用户既无法表达"这个会话额外允许写 `~/.cache/uv`"，也无法表达"即使在工作区内也拒绝写 `.git`"。

摩擦是具体的：工具链缓存都在工作区外，用户要么每次升权到 `danger-full-access`（比所需宽得多），要么整体放宽默认模式——两者都牺牲隔离。

## Proposal

### 一、交付范围：只做 allow

配置三级（会话/工作区/全局）的**额外可写目录**，每条带一句用途描述，描述随路径一起进入模型上下文。**不做 deny**。

原因是后端能力而非取舍：`bwrap` 与 `landlock-run` 是纯白名单，launcher 的全部 flag 仅 `--ro` / `--rw` / `--probe`（实测 `--deny` 报 usage error），无法表达"工作区减去一个子目录"；只有 macOS Seatbelt 的 SBPL 是完整策略语言。UI 因而不提供无法真正生效的控制。

### 二、注入点是 `ctx.sandbox.confine()`

额外根最终必须出现在 provider 返回的 argv 里，`confine` 是产生该 argv 的唯一 seam，且同时满足两个条件：**逐调用**（provider 的 `runnerCommand` 是配置期字段，改它要重载插件且跳过功能探测，无法承载逐会话列表）与**自带调用者身份**（`policy.sessionId` 已由 `sandboxPolicy.resolve()` 打上）。

`confine` 是原型方法，包装以自有属性遮蔽它，卸载时 `delete` 还原——赋值回原位会留下比插件生命周期更长的自有属性。原设计曾计划 patch `sandboxPolicy.resolve()`；放弃的理由是 `SandboxExecutionPolicy` 没有承载路径的字段，改它需要构造类型外字段并波及四个消费方。

### 三、规则模型与解析

`SessionSettingsConfig` 增加第四个领域 `sandbox`，与 `subagentModel` / `mcp` / `skills` 同构（形状见[落地约束](2026-10-05-session-sandbox-policy-constraints.md)第一节）。

- 相对路径以会话工作区为基准（`.` 即工作区根），`~` 展开为宿主 home。
- 解析顺序逐字镜像 `resolveEffectiveMcp` 的三级阶梯（服务端 `resolveEffectiveSandbox`，客户端有同构镜像）。
- 只影响 `workspace-write`。`danger-full-access` 无需放宽，`read-only` 下 allow 不生效——否则等于绕过那梯更宽模式的审批。
- 描述截断到 200 字符：它是提示词文本，不能由设置文档无限膨胀。

### 四、副作用与失败方向

- **不存在的目录一律丢弃**，不传给 provider。这在 Landlock 下只是无效，在 `bwrap` 下是致命的（`--bind` 拒绝构建 profile，该会话全部命令失败）。被丢弃的条目经 `sandboxSkipped` 回报 UI，不静默。
- **`confine` 包装内任何异常都返回 provider 的原结果**：增强失败时的安全方向是保持 provider 已建立的边界，而不是让命令失败。
- **提示词是独立 context section**（`session-settings:sandbox-allow`，紧跟宿主 `sandbox:policy`），不改写宿主段落；不动 `WIDER_MODES` / `approveEscalation`（宿主闭表）。

### 五、能力上报与面板

`SandboxCapabilityInfo` 由服务端给出，客户端不做平台判断；它区分"无 provider / 尚未扩展 / 已扩展"，并附带会话的实际生效模式（只有宿主能读 `sandbox/mode` 投影）。后端身份从 argv[0] 判定并据此选追加语法，追加插在 `--` 之前。

沙箱面板与模型 / MCP / 技能用**同一套三来源阶梯**（见[配置来源阶梯](2026-10-05-settings-source-ladder.md)），来源非自定义时只读并列出上级实际生效的规则。

实测数据、两条 cordis 装配约束与来源阶梯细节见[落地约束](2026-10-05-session-sandbox-policy-constraints.md)。

## Alternatives considered

- **改 `danger-full-access` + 提示词约束**：放弃内核边界，与诉求相反。
- **硬编码常用缓存目录进 `workspace-write`**：一行改动即可让工具链跑通，但这是产品决策而非用户可配置策略。
- **patch `sandboxPolicy.resolve()`**：见第二节。
- **把 deny 表达成更小的 allow 白名单**：Landlock 与 bwrap 只能授予目录树，除非枚举全部子目录——文件多时不可行且随文件变化失效。
- **上游 `SandboxPolicy` 增加字段**：唯一能让四方言自动一致的路径，但依赖上游发版。

## Acceptance criteria

- `allow` 配置工作区外的兄弟目录后，bash 能写该目录，工作区外其它位置仍返回 `Permission denied`；未配置会话时同一写入仍被拒（实测）。
- `resolveAllowPath` / `resolveAllowSet` 的路径解析、去重与丢弃语义正确（实测）。
- 额外根对 `write` / `edit` 同样生效，`read-only` 与无会话时仍被拒（实测）。
- 来源阶梯七种组合的解析结果与 `resolveEffectiveMcp` 一致（实测）。
- `renderAllowContext([])` 返回空串；`detectCapability()` 在 provider 激活前 / 后 / 无 provider 下为 false / true / false（实测）。
- `pnpm run verify` 全绿。

## Risks

- **包装 `confine` 依赖它的原型方法身份**。DSH 若把它改成自有字段、改名或移入 provider，包装会静默失效；`detectCapability()` 把它转成 UI 可见的"不支持"。
- **追加语法依赖 provider 的 argv 形状**。`--` 缺失时本模块原样返回——保守方向，但上游改形状会静默停用增强。
- **argv 随规则条数线性膨胀**，超长 argv 在 spawn 阶段失败，失败信息与沙箱语义无关。
- **`fs` 侧依赖"无栅栏实现可在原型链上一层取到"**：取不到时退回宿主委托，即额外根对 `write`/`edit` 不生效、但绝不放松边界。
- **平台差异**：macOS 与 Windows 未实现，由能力上报呈现。
