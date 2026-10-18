/**
 * The three-scope settings ladder, shared by both halves.
 *
 * This is the only cross-half code besides the wire contract in
 * `src/types.ts`, and it must stay PURE: no `node:*`, no host package, no
 * React. The server adapter projects its store into {@link SettingsLayers};
 * the client adapter projects its three draft snapshots. Neither half owns a
 * second copy of the ladder — that duplication is what let a panel show one
 * effective value while enforcement used another.
 */
import type {
  SandboxAllowEntry,
  SessionMcpConfig,
  SessionSandboxConfig,
  SessionSettingsConfig,
  SessionSkillsConfig,
  SubagentModelConfig,
  SubagentModelTarget,
} from '../types.ts'

/** Which layer a panel is currently editing. */
export type SettingsScopeId = 'session' | 'workspace' | 'global'

/** The layer a panel's rules actually come from. */
export type SourceMode = 'workspace' | 'global' | 'custom'

/**
 * Which layer one panel's config currently draws from.
 *
 * `global` always edits the global layer itself, so it reads as `custom`.
 * A `workspace` entry that is not `custom` defers to the global layer, and a
 * `session` entry that is not `custom` defers to whichever layer its `mode`
 * names, defaulting to the workspace when the page has one.
 *
 * This lives beside the ladder because it answers the same question — "which
 * layer wins" — for the editor rather than for enforcement. Four panels used
 * to re-derive it, so a change to the ladder could leave them describing a
 * layer that no longer applied.
 */
export function sourceModeFor(
  scope: SettingsScopeId,
  config: { mode?: string } | undefined,
  hasWorkspace: boolean,
): SourceMode {
  const fallback = hasWorkspace ? 'workspace' : 'global'
  if (scope === 'global') return 'custom'
  if (config?.mode === 'custom') return 'custom'
  if (scope === 'workspace') return 'global'
  return (config?.mode as SourceMode | undefined) ?? fallback
}

/** Whether a panel may only view the current layer's rules. */
export function isSourceReadonly(
  scope: SettingsScopeId,
  mode: SourceMode,
): boolean {
  if (scope === 'global') return false
  return mode !== 'custom'
}

/** The three layers one resolution reads, outermost first. */
export interface SettingsLayers {
  session?: SessionSettingsConfig
  workspace?: SessionSettingsConfig
  global?: SessionSettingsConfig
}

/** Deployment-wide defaults; the reset target of the global scope. */
export const DEFAULT_GLOBAL_SETTINGS: SessionSettingsConfig = {
  subagentModel: {
    inherit: true,
    allowAgentSelectModel: true,
    overrideForkModel: false,
  },
  mcp: { enabledServerIds: [] },
  skills: { disabledModelSkills: [], disabledUserSkills: [] },
  sandbox: { allow: [] },
}

/** A session entry that overrides nothing. */
export const DEFAULT_SESSION_SETTINGS: SessionSettingsConfig = {
  subagentModel: { mode: 'workspace' },
  mcp: { mode: 'workspace' },
  skills: { mode: 'workspace' },
  sandbox: { mode: 'workspace' },
}

/**
 * Whether a session entry states anything of its own.
 *
 * Every config domain must be tested. A domain omitted here reads as "not
 * customized", so a session whose only override is that domain is reported as
 * inheriting everything — the hero chip stays quiet and the reset button hides.
 */
export function isSessionCustomized(
  sessionConfig?: SessionSettingsConfig,
): boolean {
  if (!sessionConfig) return false
  return Boolean(
    sessionConfig.subagentModel?.mode === 'custom' ||
    sessionConfig.subagentModel?.allowAgentSelectModel !== undefined ||
    sessionConfig.subagentModel?.overrideForkModel !== undefined ||
    sessionConfig.mcp?.mode === 'custom' ||
    sessionConfig.skills?.mode === 'custom' ||
    sessionConfig.sandbox?.mode === 'custom',
  )
}

/** The effective subagent route and the two delegation switches. */
export function resolveEffectiveSubagentModel(
  layers: SettingsLayers,
): SubagentModelConfig {
  const globalCfg = layers.global?.subagentModel
  const globalAllow = globalCfg?.allowAgentSelectModel !== false
  const globalOverrideFork = globalCfg?.overrideForkModel === true

  const globalResult: SubagentModelConfig =
    globalCfg?.inherit === false && globalCfg?.model
      ? {
          mode: 'custom',
          inherit: false,
          model: globalCfg.model,
          allowAgentSelectModel: globalAllow,
          overrideForkModel: globalOverrideFork,
        }
      : {
          mode: 'custom',
          inherit: true,
          allowAgentSelectModel: globalAllow,
          overrideForkModel: globalOverrideFork,
        }

  const wsModel = layers.workspace?.subagentModel
  const wsAllow =
    wsModel?.allowAgentSelectModel !== undefined
      ? wsModel.allowAgentSelectModel
      : globalAllow
  const wsOverrideFork =
    wsModel?.overrideForkModel !== undefined
      ? wsModel.overrideForkModel
      : globalOverrideFork

  const workspaceResult: SubagentModelConfig =
    wsModel?.mode === 'custom' && wsModel.inherit === false && wsModel.model
      ? {
          mode: 'custom',
          inherit: false,
          model: wsModel.model,
          allowAgentSelectModel: wsAllow,
          overrideForkModel: wsOverrideFork,
        }
      : wsModel?.mode === 'custom' && wsModel.inherit === true
        ? {
            mode: 'custom',
            inherit: true,
            allowAgentSelectModel: wsAllow,
            overrideForkModel: wsOverrideFork,
          }
        : {
            ...globalResult,
            allowAgentSelectModel: wsAllow,
            overrideForkModel: wsOverrideFork,
          }

  const sModel = layers.session?.subagentModel
  if (sModel) {
    const withSessionFlags = (
      base: SubagentModelConfig,
      allow: boolean,
      overrideFork: boolean,
    ): SubagentModelConfig => ({
      ...base,
      allowAgentSelectModel:
        sModel.allowAgentSelectModel !== undefined
          ? sModel.allowAgentSelectModel
          : allow,
      overrideForkModel:
        sModel.overrideForkModel !== undefined
          ? sModel.overrideForkModel
          : overrideFork,
    })
    if (sModel.mode === 'custom') {
      return withSessionFlags(sModel, wsAllow, wsOverrideFork)
    }
    if (sModel.mode === 'workspace') {
      return withSessionFlags(workspaceResult, wsAllow, wsOverrideFork)
    }
    if (sModel.mode === 'global') {
      return withSessionFlags(globalResult, globalAllow, globalOverrideFork)
    }
  }

  if (wsModel) return workspaceResult
  return globalResult
}

/** The winning MCP scope: its enabled ids and its tool toggles. */
export interface EffectiveMcp extends SessionMcpConfig {
  mode: 'global' | 'custom'
  enabledServerIds: string[]
  toolsMode: Record<string, 'global' | 'custom'>
  disabledTools: Record<string, string[]>
}

export function resolveEffectiveMcp(layers: SettingsLayers): EffectiveMcp {
  // The global scope is exactly its explicit list. A malformed store that omits
  // the field falls back to "nothing enabled" rather than to a per-server flag.
  const globalMcp = layers.global?.mcp
  const globalEnabledIds = Array.isArray(globalMcp?.enabledServerIds)
    ? globalMcp.enabledServerIds
    : []
  const globalToolsMode = globalMcp?.toolsMode || {}
  const globalDisabledTools = globalMcp?.disabledTools || {}

  const custom = (source: SessionMcpConfig): EffectiveMcp => ({
    mode: 'custom',
    enabledServerIds: source.enabledServerIds || [],
    toolsMode: source.toolsMode || {},
    disabledTools: source.disabledTools || {},
  })
  const fromGlobal = (): EffectiveMcp => ({
    mode: 'global',
    enabledServerIds: globalEnabledIds,
    toolsMode: globalToolsMode,
    disabledTools: globalDisabledTools,
  })

  const sMcp = layers.session?.mcp
  if (sMcp) {
    if (sMcp.mode === 'custom') return custom(sMcp)
    if (sMcp.mode === 'workspace') {
      const wsMcp = layers.workspace?.mcp
      if (wsMcp?.mode === 'custom') return custom(wsMcp)
    } else if (sMcp.mode === 'global') {
      return fromGlobal()
    }
  }

  const wsMcp = layers.workspace?.mcp
  if (wsMcp?.mode === 'custom') return custom(wsMcp)
  return fromGlobal()
}

/** The winning skill scope. */
export interface EffectiveSkills extends SessionSkillsConfig {
  mode: 'global' | 'custom'
  disabledModelSkills: string[]
  disabledUserSkills: string[]
}

export function resolveEffectiveSkills(
  layers: SettingsLayers,
): EffectiveSkills {
  const globalSkills = layers.global?.skills
  const globalModelSkills = globalSkills?.disabledModelSkills || []
  const globalUserSkills = globalSkills?.disabledUserSkills || []

  const custom = (source: SessionSkillsConfig): EffectiveSkills => ({
    mode: 'custom',
    disabledModelSkills: source.disabledModelSkills || [],
    disabledUserSkills: source.disabledUserSkills || [],
  })
  const fromGlobal = (): EffectiveSkills => ({
    mode: 'global',
    disabledModelSkills: globalModelSkills,
    disabledUserSkills: globalUserSkills,
  })

  const sSkills = layers.session?.skills
  if (sSkills) {
    if (sSkills.mode === 'custom') return custom(sSkills)
    if (sSkills.mode === 'workspace') {
      const wsSkills = layers.workspace?.skills
      if (wsSkills?.mode === 'custom') return custom(wsSkills)
    } else if (sSkills.mode === 'global') {
      return fromGlobal()
    }
  }

  const wsSkills = layers.workspace?.skills
  if (wsSkills?.mode === 'custom') return custom(wsSkills)
  return fromGlobal()
}

/** The winning extra-writable-directory list. */
export interface EffectiveSandbox extends SessionSandboxConfig {
  mode: 'global' | 'custom'
  allow: SandboxAllowEntry[]
}

export function resolveEffectiveSandbox(
  layers: SettingsLayers,
): EffectiveSandbox {
  const globalAllow = Array.isArray(layers.global?.sandbox?.allow)
    ? layers.global.sandbox.allow
    : []

  const custom = (source: SessionSandboxConfig): EffectiveSandbox => ({
    mode: 'custom',
    allow: source.allow || [],
  })
  const fromGlobal = (): EffectiveSandbox => ({
    mode: 'global',
    allow: globalAllow,
  })

  const sSandbox = layers.session?.sandbox
  if (sSandbox) {
    if (sSandbox.mode === 'custom') return custom(sSandbox)
    if (sSandbox.mode === 'workspace') {
      const wsSandbox = layers.workspace?.sandbox
      if (wsSandbox?.mode === 'custom') return custom(wsSandbox)
    } else if (sSandbox.mode === 'global') {
      return fromGlobal()
    }
  }

  const wsSandbox = layers.workspace?.sandbox
  if (wsSandbox?.mode === 'custom') return custom(wsSandbox)
  return fromGlobal()
}

/** The effective value of every domain at once. */
export function resolveEffectiveSessionConfig(
  layers: SettingsLayers,
): SessionSettingsConfig {
  return {
    subagentModel: resolveEffectiveSubagentModel(layers),
    mcp: resolveEffectiveMcp(layers),
    skills: resolveEffectiveSkills(layers),
    sandbox: resolveEffectiveSandbox(layers),
  }
}

/** Narrow a target so callers can rely on a concrete route. */
export function hasModelRoute(
  target: SubagentModelTarget | undefined,
): target is SubagentModelTarget {
  return Boolean(target?.provider && target?.model)
}
