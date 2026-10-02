# Agent Note: 子代理「自选路由」的判别基准

Status: implemented

## Problem

会话/工作区/全局配置的子代理模型不生效：子代理实际跑的是**父会话的模型**。

子代理拦截器的自选判定是

```js
function hasExplicitChildModel(agent) {
  return Boolean(agent?.options?.provider && agent?.options?.model)
}
```

原注释断言「`agent.options.provider`/`model` 只在委派调用显式点名或工具自带子路由时才填充，纯继承的子代理永远为空」。这与宿主实现相反：`@deepseek-ai/dsh-subagent` 的 `resolveChildAgentOptions()` 把**直接父代理**的 provider/model **无条件**合并进**每个**子代理的 `options`：

```js
const resolved = {
  ...parentProvider !== void 0 ? { provider: parentProvider } : {},
  ...parentModel !== void 0 ? { model: parentModel } : {},
  ..., ...requested, subagentDepth: childDepth,
}
```

基线取自 `parentAgentOptionsForDelegation(parent)`（优先 `parent.session.requestHeader()?.config`，回退 `parent.options`）。于是「有路由」对任何子代理都成立，`hasExplicitChildModel` **恒为真**；而 `forcedRouteFor` 只在 `allowAgentSelectModel === false` 时才无视自选：

```js
if (config.allowAgentSelectModel !== false && hasExplicitChildModel(agent)) return undefined
```

`allowAgentSelectModel` 默认为 `true`，故**覆盖在默认配置下永不生效**——插件的主打能力被静默架空。

线上实测（工作区 playground，父会话 `session-19695cc8`）：配置值为 `cpa-antigravity/gemini-3.8-flash-high`（`resolveEffectiveSubagentModel` 返回正确），而子代理 `6d9ed90e` 的 `request/header` 是 `a2a/deepseek-v4.1-flash`（父会话路由）。父会话日志中该次 `subagent` 工具调用的参数为 `{"description","prompt","run_in_background"}`，**不含** `provider`/`model`/`reasoning_effort`，即纯继承。

## Proposal

**一、自选的判别基准改为「相对继承基线的差异」。** 新增 `parentRoute(ctx, agent)`，镜像宿主自己的基线规则（`parent.session.requestHeader()?.config` 优先，回退 `parent.options`），取**直接**父代理——委派继承自调用它的那个 agent，而非 `resolveAgentSessionId` 所上溯的根会话（后者服务配置解析，是另一件事）。

```js
function hasExplicitChildModel(ctx, agent) {
  const o = agent?.options
  if (!o?.provider || !o?.model) return false
  const inherited = parentRoute(ctx, agent)
  if (!inherited) return true // 基线不可得 → 不夺走子代理路由
  return o.provider !== inherited.provider || o.model !== inherited.model
}
```

`forcedRouteFor` 仍以 `allowAgentSelectModel !== false && hasExplicitChildModel(...)` 决定是否让位，语义不变：开启时「自选过」才让位，关闭时一律强制。该函数同时服务 `system-prompt/assemble`（`{{provider}}`/`{{model}}` 变量）与 `agent/request`（真实调用），两处一并修复。

`Session` 接口补可选 `requestHeader?()`（结构性声明，不引入值导入），作为父路由的唯一读取口。

**二、基线不可得时保守失败。** 父代理不在注册表（冷启动 resume 且父未加载）或两者都无路由时，判定为「自选」→ 不动子代理路由。宁可漏覆盖，也不误改一次真实的自选。

## Alternatives considered

- **忽略 `allowAgentSelectModel`，一律强制**：否决。会让「允许 Agent 自选」永久失效，破坏真实的显式委派路由。
- **用 `agent.options.subagentDepth` 的存在判别**：否决。它对每个子代理都被无条件写入，没有区分力。
- **在 `agent/created` 缓存父路由快照**：否决。需引入按会话的生命周期状态与清理，而父代理由子代理的工具调用创建、请求期间仍在注册表中，活体查询已足够。
- **在委派工具侧记录显式选择**：否决。工具属于宿主 `dsh-tool-subagent`，插件不能改；且其 `request.agentOptions` 对拦截器不可见。
- **把 `reasoningEffort` 单独变化也算自选**：否决。与宿主 `routeChanged` 只比 provider/model 的口径保持一致，避免同一概念两套定义。

## Acceptance criteria

- `pnpm run check && pnpm run verify:gates` 全绿，`pnpm run fmt:check` 通过，`pnpm run build` 成功。
- 走真实 `agent/request` 瀑布（注册插件导出的 `registerSubagentModelInterceptor`）：
  - 子代理 options 等于直接父代理路由（纯继承）→ 返回配置的模型与推理强度；
  - 子代理 options 是不同路由且 `allowAgentSelectModel` 为真 → 保留子代理路由；
  - 同上但 `allowAgentSelectModel` 为假 → 返回配置的模型；
  - 父代理不可解析 → 保留子代理路由；
  - 父代理无 `requestHeader` 但有 `options` 路由 → 返回配置的模型；
  - 父代理两者皆无 → 保留子代理路由。
- 既有的暂存消费、接口契约、鉴权闸门、注册顺序回归全部保持通过。

## Risks

- **父代理必须是活体**：一次性与后台子代理由父工具调用创建，父代理在请求期间仍在注册表中，故正常命中；冷启动 resume 且父未加载时走保守回退（与修复前表现一致，不误改路由）。
- **极窄竞态**：基线用父代理**当前** `requestHeader`，与派生时刻可能相差（父会话在子代理首次请求前切换模型）。仅影响该窗口内的一次判定。
- **宿主语义依赖**：判定依赖 `resolveChildAgentOptions` 无条件合并父路由这一事实。若宿主改为只在显式请求时写入 options，判定退化为 `Boolean(o.provider && o.model)`，结论仍然正确（无 options 即不拦覆盖）。
