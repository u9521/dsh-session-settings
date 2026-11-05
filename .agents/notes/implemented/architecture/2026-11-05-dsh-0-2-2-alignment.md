# Agent Note: DSH 0.2.2 对齐

Status: implemented

## Problem

宿主主线到 0.2.2-rc.1，本仓库仍按 0.2.1 的 API 面编写。三处按旧语义写的地方在 0.2.2 上不是"看起来不一样"，而是直接失效：

**子代理强制路由变成硬错误。** `dsh-agent-loop` 现在在步进准备时先固定 `selection`，之后 `agent/request` 只要提出不同的 provider/model/effort 就抛错。本插件原先正是靠改写这个 waterfall 实现"按会话强制子代理模型"，于是每个强制路由的委派都会在第一次请求时中止。

**沙箱加宽落错层。** 宿主给 `SandboxPolicy` 加了 `additionalWritableRoots`，四个后端（bwrap/landlock/seatbelt/windows-acl）与文件系统 fence 都已消费它。插件原先改的是 `confine()` 的返回 argv，而 provider 的 argv 形状是 `[...runnerArgv, '--', …]`，插入的 `--rw`/`--bind` 落在 runner 自己的参数表内部、grant 块之后，profile 被污染；windows-acl 则直接抛 `SandboxUnsupportedPolicyError`。

**两段死代码。** 宿主先装配 sections/variables，再由 registry 在 waterfall 之后挂 tools，装配里根本不含工具表，"剥掉子代理工具参数"永不命中；`{{provider}}/{{model}}` 也已改为从该步固定的 selection 推导。

`peerDependencies` 区间 `>=0.2.1-rc.2` 实际已排除当前宿主：预发布区间只匹配同一 `major.minor.patch` 元组。

## Decision

**兼容门槛**：peer 抬到 `>=0.2.2-rc.1`，cordis 升到 `~4.1.0`。cordis 4.1 的差异（`Fiber.update` 返回类型、`Reflect.Impl` 形状、WARN/INFO 值互换）本插件一处未用，对齐只是让类型面跟上运行时。`dsh-client-ui-primitives` 保持 `0.2.0-rc.1`：它是 shell 的静态模块种子。

**子代理路由走 `agent.model.select()`**，两个落点：`agent/created`（串行、在 loop 启动前，保证首步即按强制路由准备）与 prepend 的 `agent/pre-step`（覆盖会话中途改设置，从下一步生效——loop 在派发该事件前已捕获 selection）。`allowAgentSelectModel === false` 的强制改由每个 agent 自己的 `tools.restrict({ deny: ['list_subagent_models'] })` 表达。

**沙箱改写 `ctx.sandboxPolicy.resolve()`**：这是 bash、持久终端、文件系统 fence 共同取策略的唯一入口，一处包装即覆盖全部执行面，仓库里不再有后端固定的 argv 语法。`fs-proxy` 随之删除——它存在的前提是 fence 只看 `writableRoots()` 而不含额外根；根上了策略之后 fence 自己就允许，顺带恢复了宿主的重规范化（封堵并发换 symlink 的 TOCTOU）并覆盖了代理看不见的 `patchText`/`deleteFile`/`moveFile`。`resolve()` 在热路径上，因此保持同步，缓存由 `agent/created` 与每次装配预热。

**客户端**：`settings.section.icon` 取代 MutationObserver（后者扫 `navCell` 这类哈希类名并改写宿主 SVG）；会话身份改用框架注入的 `sessionId`/`useSessions`/`useWorkspaces`，不再自己按 `retainedBy.mainView` 重算；两个宿主字典里不存在的令牌改用 `--dsw-alias-state-error-primary`，全部 21 个 `--dsw-*` 引用均可解析。

**其余静默漂移**：技能按 `SkillSource` 字面量分桶而非子串猜测；`register()` 被拒时经快照回传到面板并显示"策略未生效 + 原因"；MCP tester 用与官方 client 相同的 `scrubbedParentEnv` 规则构造子进程环境；存储域经 `defineDomain` 校验，把名字/版本/global 校验提前到模块加载期，`ctx.storageDomain` 声明为非可选。

## Alternatives considered

- **保留 `agent/request` 改写并只处理同一个路由**：否决。宿主在 `prepareRequest` 里的判等是无条件的；即使提出的路由与原路由相同，保留一段永不生效的 waterfall 只会让下一个人再问一次"为什么这里不动"。
- **在 `agent/pre-step` 里改路由而不加 `agent/created`**：否决。loop 在派发 pre-step 之前已经捕获 selection，只靠它会让首步仍走旧路由，而首步正是强制路由最该生效的地方。
- **把允许清单写进宿主的 `subagent/model-selection-policy`**：否决。宿主那份是部署级"子代理可以挑哪些模型"，与"本会话强制跑在哪个模型"是两个轴；`select()` 不经过 `assertAllowedModelSelection`（该断言在委派创建时检查的是工具调用参数），写进去等于把插件策略混进部署策略。
- **继续用 `confine` 但把插入点移到 grant 块之前**：否决。块边界是每个后端自己的语法，插件无从得知；这正是宿主新增 `additionalWritableRoots` 要消除的耦合。
- **保留 `fs-proxy` 作为双保险**：否决。代理绕过的正是 host 记录在案的重规范化，且看不到另外三个受 fence 的变更方法；"两条路都对"是错觉，"只有一条路"才可验证。
- **按严重度拆分提交**：否决。严重度横切每个域，按它拆会让同一文件出现两次；按域拆的每个提交都回答一个独立问题。

## Consequences

- **0.2.1 及更早宿主被拒绝**：peer 区间是唯一门槛，且旧宿主上 `agent.model.select()` 与 `additionalWritableRoots` 都不存在，本插件不会退化成"部分可用"。
- **子代理设置改动从下一步生效**：修改设置后已在进行的那一步不受影响。这是宿主事件顺序决定的，不是实现取舍。
- **沙箱额外根的生效依赖会话已装配过一次**：缓存未预热时 `resolve()` 拿到的是未加宽策略，表现为"该次调用按原边界执行"，不会放宽。`agent/created` 使首轮即足够。
- **tester 的环境清洗是复制而非导入**：server 半边独立打包、运行时不解析宿主包；宿主改规则时这里不会自动跟随。
- **`settings.section.icon` 的注册 id 必须等于 section id**：shell 用 `only: row.id` 派发，改 id 会让图标静默退回默认齿轮。
