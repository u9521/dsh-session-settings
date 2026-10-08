# Agent Note: 沙箱目录保存后被丢弃

Status: implemented

## Problem

在会话作用域下配置沙箱额外目录并点「保存」，界面提示保存成功，但重新打开面板时列表是空的——目录看起来从未保存过。

根因是**两处"这份配置是否仍是纯继承"的判定在 `sandbox` 字段加入后没有同步更新**，外加一处保存后未回写前端状态。三者叠加成"保存成功但没保存"。

## Proposal

### 一、服务端：纯继承判定漏判 sandbox，导致整条会话记录被删

`src/server/session/routes.ts` 保存会话时如此判断：

```ts
const isPureWorkspaceInherit =
  incomingConfig.subagentModel.mode === 'workspace' &&
  incomingConfig.subagentModel.allowAgentSelectModel === undefined &&
  incomingConfig.subagentModel.overrideForkModel === undefined &&
  incomingConfig.mcp.mode === 'workspace' &&
  incomingConfig.skills.mode === 'workspace'   // sandbox 未参与

if (isPureWorkspaceInherit) delete sessionSettingsStore.sessions[sessionId]
else sessionSettingsStore.sessions[sessionId] = incomingConfig
```

该判定本意是"用户没做任何会话级覆盖就别留空壳记录"。但新会话的默认态正是这三项都为 `workspace`，于是**只改沙箱**时判定为 `true`，服务端把整条会话记录删除——刚写入的 `sandbox.allow` 随之消失。响应仍是 `{ok:true}`，前端因此显示"已保存"。

修复：追加 `incomingConfig.sandbox.mode === 'workspace'`。用 `=== 'workspace'` 而非"字段缺失"，因为 `normalizeSandboxConfig` 对缺失与非法输入统一回落到 `{mode:'workspace'}`，两者在此是同一陈述；纯继承的会话仍会被正确收敛掉。

### 二、客户端：`isSessionCustomized` 同样漏掉 sandbox

`src/client/utils/config.ts` 的同名判定只统计 `subagentModel`、`mcp.mode`、`skills.mode`。影响三处：保存后的 `setHasSessionOverride`、`useSessionData` 的初始判定、以及右上角 hero chip 的"已自定义"显示。只配了沙箱的会话因此被报告为"完全继承"。

修复：追加 `sessionConfig.sandbox?.mode === 'custom'`，与其余三项同构。

### 三、客户端：会话作用域保存后不回写本地状态

`useSessionActions.ts` 的会话分支只调 `setHasSessionOverride`，缺少 `setSandboxConfig(payloadConfig.sandbox)`；而 global 分支有 `setGlobalConfig`、workspace 分支有 `setWorkspaceSettings`。后果是不刷新页面时面板仍显示保存前的草稿——第三个缺陷，独立于前两个。

### 四、为什么这类缺陷会复发

两个判定都是**人工列举配置域**。新增一个配置域而忘记更新它们时，症状是"写入成功、读取静默回退"，这是最难察觉的一类失败：日志、HTTP 状态与界面提示都指向成功。服务端那处更严重，因为它删除的是**整条**记录而非单个字段。

彻底解法是由配置域列表驱动这两个判定（例如遍历 `SessionSettingsConfig` 的已知键并要求各自处于继承态），超出本次范围。当前把它记为已知脆弱点：新增配置域时必须同时检查这两处判定。

## Alternatives considered

- **把缺失的 `sandbox` 视为"非 workspace"**：会让所有历史会话在下次保存时都变成自定义，属破坏性迁移。
- **合并两处判定的重复**：语义相近但**不等价**——服务端的判定还含 `allowAgentSelectModel`、`overrideForkModel` 两项，合并会改变行为。
- **只修服务端**：能解决"重开后面板为空"，但 hero chip 与重置按钮仍会误报为"未自定义"，且不刷新页面时面板不更新。
- **由配置域列表驱动判定**：正确的长期形态，但会同时改动保存路径与三处调用点，超出本次范围。

## Acceptance criteria

- 新会话（其余三项均为默认）下只改沙箱目录并保存，重开面板仍显示该目录。
- 保存后不刷新页面，面板即显示已保存的值。
- 只配了沙箱的会话，hero chip 显示为已自定义。
- 四个配置域全为默认时保存，服务端**仍**删除会话条目（不引入空壳记录）。
- 工作区与全局作用域的沙箱保存不受影响。

## Risks

- **此前被静默丢弃的保存开始真正生效**：用户可能以为自己配过沙箱目录而其实都没落盘。修复后行为变化是变正确，但值得说明。
- **hero chip 与重置按钮的显示会变化**：只配了沙箱的会话此前不显示"自定义"，修好后会显示。属修复而非回归，但是用户可见变化。
- **判定仍靠人工列举字段**：本次补齐 `sandbox`，下次新增配置域仍会漏。已在上文记为已知脆弱点。
