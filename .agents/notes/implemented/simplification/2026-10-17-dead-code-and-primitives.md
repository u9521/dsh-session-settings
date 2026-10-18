# Agent Note: 删除死代码与合并工具弹窗

Status: implemented

## Problem

客户端有两类可删的东西。

**死代码。** `components/ModeSelector.ts`（85 行）没有任何调用方，只在 barrel 里导出；`utils/schema.ts` 的 `parseToolParameters` 只有一个消费者，却占据一层独立 module。

**重复实现。** 两个工具弹窗 `McpToolsModal`（474 行）与 `SessionMcpToolsModal`（550 行）结构相同：搜索框、schema 展开集合、协议标签、工具卡片、三页签容器——差别只在标题前缀、头部徽标与底部动作区。改动卡片渲染永远是两处编辑。另有 5 处 `setTimeout(() => setSuccessMsg(''), 3000)` 散在两个文件里。

## Decision

1. `ModeSelector` 删除；barrel 不再导出。
2. `parseToolParameters` 内联进 `SchemaViewer`；`utils/schema.ts` 删除。
3. **两个弹窗合并**：`McpToolsModal` 成为唯一的实现，通过三个注入位表达差异——`title`、`headerExtra`、`toolsHeader`（工具页签顶部的模式切换位）、`footer`（动作区）。会话侧退化为 246 行的包装：拼标题、徽标、模式切换与 Apply/Cancel 后交给共享体。
4. **成功提示单一 owner**：`useMcpServers` 用一个 effect 在 3 秒后清空 `successMsg`，五个 handler 里的 `setTimeout` 删除。

**没有做的事**：`ModalDialog` 没有换成平台 `Modal`。平台的 `Modal` 只接受字符串标题，而本仓库四个弹窗都有图标、副标题与自定义头部徽标；换用意味着把头部整体改成 `headless` 自绘，收益（portal 与焦点回填）小于改动面。这条从原计划中剔除，理由记在此处以免重复提议。

**落地约束：**

- `grep ModeSelector src` 与 `grep parseToolParameters src/client/utils` 零命中。
- 工具卡片、搜索、schema 展开、三页签容器只有一份实现（`McpToolsModal`）。
- 会话侧的模式切换仍位于工具页签顶部，只读或非工具页签不渲染它。
- `src/client/mcp/index.ts` 与 `useMcpServers` 不再有 `setTimeout(...3000)`。
- `pnpm run verify` 全绿。
- GUI 冒烟：MCP 页、会话工具弹窗（含只读态）、技能弹窗、导入与确认弹窗行为不变。

## Alternatives considered

- **只删死代码**：部分采纳，1 与 2 独立成立；弹窗重复是"改一处忘一处"的来源，值得一并处理。
- **把 `ModalDialog` 包成平台 `Modal` 的薄包装**：否决。见 Proposal 末段——字符串标题限制会迫使所有调用方改用 `headless`，等于把平台 Modal 的优点全部让掉。
- **把会话侧弹窗改成受控 `open`**：否决。它本来就由 `server !== null` 表达开关。
- **让共享弹窗自己拥有底部动作、用布尔开关区分两种模式**：否决。底部差异是"保存到全局"vs"应用到会话"，用布尔会把两套文案与回调塞进一个组件；注入 `footer` 更浅。

## Consequences

- **视觉变化**：`ModalDialog` 未改，因此遮罩与头部外观不变；但合并后头部徽标的组装从共享组件移到了调用方，需要一次目视确认两处外观仍一致。
- **footer 注入的边界**：两个底部差异较大，若将来第三个页面要另一种底部，注入仍是加法而非分支。
- **成功提示的时序**：统一为 3 秒；若某个动作需要更长读时，需要给 `successMsg` 加 hold 参数，而不是回到逐 handler 的 timer。
