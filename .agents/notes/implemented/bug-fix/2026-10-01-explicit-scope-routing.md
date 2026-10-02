# Agent Note: 显式作用域路由

Status: implemented

## Problem

新会话页面（尚未创建会话）配置子代理模型、MCP 或技能不生效，且污染全局配置。根因是目标作用域靠**字段推断**而非显式声明：

```js
const isSaveDefault =
  !isSaveWorkspaceDefault &&
  Boolean(parsed.isDefault || !targetSessionId || parsed.saveAsDefault)
```

`!targetSessionId` 使 `isSaveDefault` 在无会话 id 时**无条件为真**。于是新会话的会话级保存被改道写入 `globalConfig`：子代理模型覆盖全局默认，MCP 因 `normalizeGlobalSettings` 无 `enabledServerIds` 概念而被**静默丢弃**。三个作用域在接口上无区分，是结构性成因。

同轮还暴露：会话页签在无会话 id 时不可用；顶栏把"没有会话"与"已有暂存"压成一个布尔，故首次进入新会话时**无任何提示**。

## Proposal

**作用域在接口上显式声明。** `save-settings` 必填判别字段 `scope`（`SettingsScopeId`），缺失或非法即 400，**不再回退推断**：

| `scope` | 必需 | 写入 |
| :--- | :--- | :--- |
| `global` | — | `globalConfig` |
| `workspace` | `workspaceId` | `workspaces[workspaceId]` |
| `session` | `sessionId` | `sessions[sessionId]` |

`isRestoringDefault` 是各作用域的修饰符，**保存与重置统一走 `save-settings`**。接口形状与鉴权归属见 [HTTP 接口契约与官方鉴权闸门](2026-10-01-http-contract-and-auth-fence.md)。

**没有暂存作用域。** 曾有一档 `session-pending`，把无会话页面的会话级编辑暂存到工作区、由 `agent/created` 一次性消费。它被删除，因为**它只能猜目标**：该页面并未选定工作区，暂存键只能取最近性推导值；而 hero 页选定工作区时空白会话**已经存在**（`openWorkspace` → `connectWorkspace` → `reuseOrCreateBlank` → `create` → `replaceMain`），直接写该会话即可立即生效。删除后仅剩的到达路径是「归档当前会话后停在无会话页面」与首帧快照未齐，两者都不该产生写入。

**禁用态必须自证。** 无会话时会话页签禁用，但 disabled 控件吞掉指针事件、其 `title` 不可达，故原因以可见文本（`.dsh-scope-hint`）渲染在页签旁。页签可用性与默认页签共用同一个 `defaultScope()`：两处各写一份偏好顺序正是上一轮"默认落在禁用页签"的成因。

**作用域可用性与默认页签**：`session` 需 `sessionId`，`workspace` 需 `currentWorkspaceId`，`global` 恒可用；默认取首个可用者。会话身份消失（归档）时，已选页签若失效则重新取默认，用户自选的有效选择不被推翻。

## Alternatives considered

- **拆独立端点**：否决，多份 handler 重复校验；判别字段已表达同一边界。
- **只修 `!targetSessionId`，保留字段推断**：否决，隐式契约下次会再犯。
- **保留 `session-pending` 作为无会话时的兜底**：否决。该页面未选定工作区，暂存只能靠最近性猜一个目标——正是本 Note 要消除的那类隐患；且 hero 页的空白会话已存在，兜底没有真实用户场景。
- **暂存放内存**：否决，重启即丢失用户已确认的意图。
- **粘性暂存**：否决，一次编辑会持续影响后续所有会话。
- **在 `session/created` 消费**：否决，该事件即发即弃、不 await，无法保证先于首次策略解析。
- **用 `hasPendingSession()` 区分新建与复用**：否决，它是 JSONL 后端特有，且对已落盘的新建会话返回 false。
- **无会话时把会话级保存改道写入工作区默认**：否决，用户选的是「会话」，静默改写其他作用域正是本 Note 的原始缺陷。

## Acceptance criteria

- `pnpm run check`、`pnpm run verify:gates`、`pnpm run fmt:check` 通过，`pnpm run build` 成功。
- 三个 `scope` 各发一次保存，回读 `session_settings.json`：**只有目标键变化**，其余两处逐字节不变。
- `scope` 缺失、`scope:'session'` 无 `sessionId`、`scope:'workspace'` 无 `workspaceId` 均返回 **400**；`scope:'session-pending'` 亦返回 400（不再是合法值）。
- `src/` 内不出现 `pendingSessions`、`pendingConfig`、`stagePendingSession`、`takePendingSession`、`session-pending`；`SessionSettingsStore` 无该键。
- 归档当前会话后停在无会话页面：会话页签禁用且渲染可见提示，默认页签为工作区（有工作区时），保存写入 `workspaces[workspaceId]`。
- 有 `sessionId` 时顶栏显示可复制 id chip；无 `sessionId` 时不渲染会话 chip。

## Risks

- **破坏性接口变更**：`scope` 必填，半新半旧 HMR 窗口内旧载荷得 400；刷新后一致。
- **能力收缩不可逆**：无会话页面不再能"先配好、等下一个会话"，必须新建会话后再配置。
- **旧存储残留键**：文件里遗留的 `pendingSessions` 在载入时被丢弃，下一次保存重写文件即消失；不写迁移代码，因为当前实际为空。
- **禁用提示依赖 `currentWorkspaceId` 的解析质量**：工作区解析不出时同时禁用工作区页签并提示；解析逻辑见 [hero 页工作区解析在 0.2.0 下塌缩为常量](2026-10-01-hero-workspace-resolution-0-2-0.md)。
- **无自动化测试框架**：回归靠类型检查 + 构建 + 闸门 + 人工冒烟，归档路径必须人工确认。
