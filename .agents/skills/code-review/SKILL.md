---
name: code-review
description: 用于对本仓库的 diff 做结构化代码评审时，以 .agents/architecture 的模块约束与 .agents/notes 的决策记录为准绳。当用户要求 review、检查改动、评审 PR，或询问某改动是否符合架构约定时使用。
---

# 代码评审

只读评审：产出发现与依据，不顺手改代码。结论必须可追溯到具体文件、行与规范出处。

## 评审顺序

1. 按 diff 路径读对应架构文档（`.agents/architecture/` 的 `Covers:` 行指明覆盖范围），再读相关 `implemented/` Note 追理由。
2. 看 diff：`git diff --stat` 先判断改动面，再逐文件精读，不要只看摘要。
3. 按下面清单核对，逐条给出「通过 / 有疑问 / 违规」。
4. 输出按严重度分组，每条写 `文件:行`、现象、依据、建议动作。

## 检查清单

**契约与边界**

- 是否新增了字面量 API 路径或方法？两者必须来自 `src/types.ts` 的 `API_ENDPOINTS` / `API_METHODS`。
- 客户端是否值导入了非平台的 `@deepseek-ai/*` 模块？跨插件协作必须走 cordis 服务。
- 是否绕过 `src/types.ts` 另建了跨半契约（重复类型、并行枚举）？
- 持久化是否只写 `$DSH_HOME/storages/`？是否有启动期强制建目录或读盘？

**运行时正确性**

- `ctx.on(...)` 拦截器：事件名与载荷是否与宿主一致？是否在禁用路径上提前返回而漏掉副作用？
- `ctx.effect` 的资源是否都返回了清理函数（定时器、MutationObserver、rAF、React root、HTTP 路由、MCP 客户端）？
- 回退链（`global` / `workspace` / `custom` / `inherit`）是否在读写两侧一致？
- 错误处理：`catch` 是否吞掉了本应上抛的失败？是否会把坏数据静默写成默认值而不可追溯？

**客户端 DOM 操作**

- 插槽能覆盖的能力是否走了 `slots.register`？
- 选择器是否依赖宿主类名（`navCell`、`heroWorkspaceRow` 等）？依赖处是否容忍元素缺失？
- 观察者回调是否去抖/合并，避免每次变更全量扫描？

**文档与记录**

- 非平凡改动是否新增/更新 Note，且 `implemented/` 描述与代码一致？
- `README.md` 与 `README.zh.md` 是否同步？
- 是否新增了"一处事实两处写"的重复？规则是否被抄进了 Note 而不是链接过去？

**可剥离性**

- 项目文件（`src/**`、`package.json`、构建配置、README）是否出现了 `AGENTS.md` 或 `.agents/` 的字面量？这两个路径必须能被整体删除。
- 新增文档是否被根 `AGENTS.md` 的导航表引用？孤儿文档由 `verify-scaffold` 拦截。

## 输出要求

- 先给结论（可合入 / 需修改 / 需讨论），再列问题。
- 问题按 `严重 / 中等 / 轻微` 分组；每条必须带可验证依据，不接受"感觉不太对"。
- 未发现问题时，说明检查了哪些面、哪些面无法静态确认（如 GUI 行为），不要泛泛肯定。
