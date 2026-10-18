import type {
  SubagentModelConfig,
  SubagentModelTarget,
  McpServerStore,
  SandboxAllowEntry,
  SessionSettingsConfig,
  SessionSettingsStore,
  SessionSkillsConfig,
  SessionMcpConfig,
  SessionSandboxConfig,
} from '../../types.ts'
import {
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_SESSION_SETTINGS,
  resolveEffectiveMcp as resolveMcpLayers,
  resolveEffectiveSandbox as resolveSandboxLayers,
  resolveEffectiveSkills as resolveSkillsLayers,
  resolveEffectiveSubagentModel as resolveSubagentModelLayers,
  type SettingsLayers,
} from '../../shared/settings.ts'

/** Longest description that survives normalization; keeps prompt text bounded. */
const MAX_ALLOW_DESCRIPTION_CHARS = 200

/**
 * Normalize one allow entry, or drop it.
 *
 * A path is the entire payload, so an entry without a usable one carries no
 * meaning and is discarded rather than persisted as a grant that resolves to
 * nothing. The description is optional and truncated: it is prompt text, and an
 * unbounded value here would let a settings document inflate every request.
 */
function normalizeSandboxAllowEntry(
  raw: unknown,
): SandboxAllowEntry | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const entry = raw as Partial<SandboxAllowEntry>
  const path = typeof entry.path === 'string' ? entry.path.trim() : ''
  if (!path) return undefined
  const description =
    typeof entry.description === 'string' ? entry.description.trim() : ''
  return {
    path,
    ...(description
      ? { description: description.slice(0, MAX_ALLOW_DESCRIPTION_CHARS) }
      : {}),
  }
}

function normalizeSandboxAllow(raw: unknown): SandboxAllowEntry[] {
  if (!Array.isArray(raw)) return []
  const entries: SandboxAllowEntry[] = []
  for (const item of raw) {
    const entry = normalizeSandboxAllowEntry(item)
    if (entry) entries.push(entry)
  }
  return entries
}

function normalizeSandboxConfig(
  raw?: Partial<SessionSandboxConfig>,
): SessionSandboxConfig {
  if (!raw || typeof raw !== 'object') return { mode: 'workspace' }
  const mode =
    raw.mode === 'custom'
      ? 'custom'
      : raw.mode === 'global'
        ? 'global'
        : 'workspace'

  if (mode === 'custom') {
    return { mode: 'custom', allow: normalizeSandboxAllow(raw.allow) }
  }
  return { mode }
}

function normalizeSubagentModelTarget(
  raw?: Partial<SubagentModelTarget>,
): SubagentModelTarget | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const provider = typeof raw.provider === 'string' ? raw.provider.trim() : ''
  const model = typeof raw.model === 'string' ? raw.model.trim() : ''
  if (!provider || !model) return undefined
  return {
    provider,
    model,
    reasoningEffort:
      typeof raw.reasoningEffort === 'string' && raw.reasoningEffort.trim()
        ? raw.reasoningEffort.trim()
        : undefined,
  }
}

export function normalizeGlobalSettings(
  raw?: Partial<SessionSettingsConfig>,
): SessionSettingsConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_GLOBAL_SETTINGS }
  }

  const subagentModel: SubagentModelConfig = {
    allowAgentSelectModel: raw.subagentModel?.allowAgentSelectModel !== false,
    overrideForkModel: raw.subagentModel?.overrideForkModel === true,
  }
  if (raw.subagentModel && typeof raw.subagentModel === 'object') {
    if (raw.subagentModel.inherit === true) {
      subagentModel.inherit = true
    } else {
      const modelPayload = raw.subagentModel.model
      const target = normalizeSubagentModelTarget(modelPayload)
      if (target) {
        subagentModel.inherit = false
        subagentModel.model = target
      } else {
        subagentModel.inherit = true
      }
    }
  } else {
    subagentModel.inherit = true
  }

  const rawMcp = raw.mcp
  const enabledServerIds = Array.isArray(rawMcp?.enabledServerIds)
    ? rawMcp.enabledServerIds.filter(
        (id): id is string => typeof id === 'string' && id.trim().length > 0,
      )
    : []
  const toolsMode: Record<string, 'global' | 'custom'> = {}
  if (rawMcp?.toolsMode && typeof rawMcp.toolsMode === 'object') {
    for (const [k, v] of Object.entries(rawMcp.toolsMode)) {
      if (typeof k === 'string' && (v === 'custom' || v === 'global')) {
        toolsMode[k] = v
      }
    }
  }
  const disabledTools: Record<string, string[]> = {}
  if (rawMcp?.disabledTools && typeof rawMcp.disabledTools === 'object') {
    for (const [k, v] of Object.entries(rawMcp.disabledTools)) {
      if (typeof k === 'string' && Array.isArray(v)) {
        disabledTools[k] = v.filter(
          (name): name is string =>
            typeof name === 'string' && name.trim().length > 0,
        )
      }
    }
  }
  const mcp: SessionMcpConfig = {
    enabledServerIds,
    ...(Object.keys(toolsMode).length > 0 ? { toolsMode } : {}),
    ...(Object.keys(disabledTools).length > 0 ? { disabledTools } : {}),
  }

  const rawSkills = raw.skills
  const disabledModelSkills = Array.isArray(rawSkills?.disabledModelSkills)
    ? rawSkills.disabledModelSkills.filter(
        (s): s is string => typeof s === 'string' && s.trim().length > 0,
      )
    : []
  const disabledUserSkills = Array.isArray(rawSkills?.disabledUserSkills)
    ? rawSkills.disabledUserSkills.filter(
        (s): s is string => typeof s === 'string' && s.trim().length > 0,
      )
    : []
  const skills: SessionSkillsConfig = {
    disabledModelSkills,
    disabledUserSkills,
  }

  const sandbox: SessionSandboxConfig = {
    allow: normalizeSandboxAllow(raw.sandbox?.allow),
  }

  return {
    subagentModel,
    mcp,
    skills,
    sandbox,
  }
}

function normalizeSubagentModelConfig(
  raw?: Partial<SubagentModelConfig>,
): SubagentModelConfig {
  if (!raw || typeof raw !== 'object') return { mode: 'workspace' }
  const mode =
    raw.mode === 'custom'
      ? 'custom'
      : raw.mode === 'global'
        ? 'global'
        : 'workspace'

  const allowAgentSelectModel =
    raw.allowAgentSelectModel !== undefined
      ? Boolean(raw.allowAgentSelectModel)
      : undefined
  const overrideForkModel =
    raw.overrideForkModel !== undefined
      ? Boolean(raw.overrideForkModel)
      : undefined

  const extraFlags = {
    ...(allowAgentSelectModel !== undefined ? { allowAgentSelectModel } : {}),
    ...(overrideForkModel !== undefined ? { overrideForkModel } : {}),
  }

  if (mode === 'custom') {
    if (raw.inherit === true) {
      return {
        mode: 'custom',
        inherit: true,
        ...extraFlags,
      }
    }
    const modelPayload = raw.model
    const target = normalizeSubagentModelTarget(modelPayload)
    if (target) {
      return {
        mode: 'custom',
        inherit: false,
        model: target,
        ...extraFlags,
      }
    }
    return {
      mode: 'custom',
      inherit: true,
      ...extraFlags,
    }
  }

  return { mode, ...extraFlags }
}

function normalizeMcpConfig(raw?: Partial<SessionMcpConfig>): SessionMcpConfig {
  if (!raw || typeof raw !== 'object') {
    return { mode: 'workspace' }
  }
  const mode =
    raw.mode === 'custom'
      ? 'custom'
      : raw.mode === 'global'
        ? 'global'
        : 'workspace'
  if (mode === 'custom') {
    const enabledServerIds = Array.isArray(raw.enabledServerIds)
      ? raw.enabledServerIds.filter(
          (id): id is string => typeof id === 'string' && id.trim().length > 0,
        )
      : []

    const toolsMode: Record<string, 'global' | 'custom'> = {}
    if (raw.toolsMode && typeof raw.toolsMode === 'object') {
      for (const [k, v] of Object.entries(raw.toolsMode)) {
        if (typeof k === 'string' && (v === 'custom' || v === 'global')) {
          toolsMode[k] = v
        }
      }
    }

    const disabledTools: Record<string, string[]> = {}
    if (raw.disabledTools && typeof raw.disabledTools === 'object') {
      for (const [k, v] of Object.entries(raw.disabledTools)) {
        if (typeof k === 'string' && Array.isArray(v)) {
          disabledTools[k] = v.filter(
            (name): name is string =>
              typeof name === 'string' && name.trim().length > 0,
          )
        }
      }
    }

    return {
      mode: 'custom',
      enabledServerIds,
      ...(Object.keys(toolsMode).length > 0 ? { toolsMode } : {}),
      ...(Object.keys(disabledTools).length > 0 ? { disabledTools } : {}),
    }
  }
  return { mode }
}

function normalizeSkillsConfig(
  raw?: Partial<SessionSkillsConfig>,
): SessionSkillsConfig {
  if (!raw || typeof raw !== 'object') {
    return { mode: 'workspace' }
  }
  const mode =
    raw.mode === 'custom'
      ? 'custom'
      : raw.mode === 'global'
        ? 'global'
        : 'workspace'

  if (mode === 'custom') {
    const disabledModelSkills = Array.isArray(raw.disabledModelSkills)
      ? raw.disabledModelSkills.filter(
          (s): s is string => typeof s === 'string' && s.trim().length > 0,
        )
      : []

    const disabledUserSkills = Array.isArray(raw.disabledUserSkills)
      ? raw.disabledUserSkills.filter(
          (s): s is string => typeof s === 'string' && s.trim().length > 0,
        )
      : []

    return {
      mode: 'custom',
      disabledModelSkills,
      disabledUserSkills,
    }
  }
  return { mode }
}

export function normalizeSessionSettings(
  raw?: Partial<SessionSettingsConfig>,
): SessionSettingsConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SESSION_SETTINGS }
  }

  const subagentModel = normalizeSubagentModelConfig(raw.subagentModel)
  const mcp = normalizeMcpConfig(raw.mcp)
  const skills = normalizeSkillsConfig(raw.skills)
  const sandbox = normalizeSandboxConfig(raw.sandbox)

  return {
    subagentModel,
    mcp,
    skills,
    sandbox,
  }
}

function renameMcpInConfig(
  mcp: SessionSettingsConfig['mcp'] | undefined,
  oldId: string,
  newId: string,
): boolean {
  if (!mcp) return false
  let changed = false

  if (
    Array.isArray(mcp.enabledServerIds) &&
    mcp.enabledServerIds.includes(oldId)
  ) {
    mcp.enabledServerIds = mcp.enabledServerIds.map((id) =>
      id === oldId ? newId : id,
    )
    changed = true
  }

  if (mcp.toolsMode && oldId in mcp.toolsMode) {
    mcp.toolsMode[newId] = mcp.toolsMode[oldId]
    delete mcp.toolsMode[oldId]
    changed = true
  }

  if (mcp.disabledTools && oldId in mcp.disabledTools) {
    mcp.disabledTools[newId] = mcp.disabledTools[oldId]
    delete mcp.disabledTools[oldId]
    changed = true
  }

  return changed
}

export function renameServerIdInSessionStore(
  store: SessionSettingsStore,
  oldId: string,
  newId: string,
): boolean {
  if (!oldId || !newId || oldId === newId) return false
  let changed = false

  if (store.globalConfig?.mcp) {
    if (renameMcpInConfig(store.globalConfig.mcp, oldId, newId)) {
      changed = true
    }
  }

  if (store.workspaces) {
    for (const wsConfig of Object.values(store.workspaces)) {
      if (wsConfig?.mcp && renameMcpInConfig(wsConfig.mcp, oldId, newId)) {
        changed = true
      }
    }
  }

  if (store.sessions) {
    for (const sCfg of Object.values(store.sessions)) {
      if (sCfg?.mcp && renameMcpInConfig(sCfg.mcp, oldId, newId)) {
        changed = true
      }
    }
  }

  return changed
}

/** Project the store onto the three layers one resolution reads. */
function layersFor(
  store: SessionSettingsStore,
  sessionId?: string,
  workspaceId?: string,
): SettingsLayers {
  return {
    session: sessionId ? store.sessions?.[sessionId] : undefined,
    workspace: workspaceId ? store.workspaces?.[workspaceId] : undefined,
    global: store.globalConfig,
  }
}

export function resolveEffectiveSubagentModel(
  store: SessionSettingsStore,
  sessionId?: string,
  workspaceId?: string,
): SubagentModelConfig {
  return resolveSubagentModelLayers(layersFor(store, sessionId, workspaceId))
}

export function resolveEffectiveMcp(
  store: SessionSettingsStore,
  mcpStore: McpServerStore,
  sessionId?: string,
  workspaceId?: string,
): {
  mode: 'global' | 'custom'
  enabledServerIds: string[]
  toolsMode: Record<string, 'global' | 'custom'>
  disabledTools: Record<string, string[]>
  effectiveDisabledTools: Record<string, string[]>
} {
  const effective = resolveMcpLayers(layersFor(store, sessionId, workspaceId))

  // The per-server disabled list is a projection over the MCP server store, not
  // a scope decision: a server's own list applies unless this scope opted into
  // a custom one for that server.
  const effectiveDisabledTools: Record<string, string[]> = {}
  for (const server of Object.values(mcpStore.servers)) {
    const isCustomTools = effective.toolsMode[server.id] === 'custom'
    if (isCustomTools && effective.disabledTools[server.id]) {
      effectiveDisabledTools[server.id] = effective.disabledTools[server.id]
    } else {
      effectiveDisabledTools[server.id] = Array.isArray(server.disabledTools)
        ? server.disabledTools
        : []
    }
  }

  return {
    mode: effective.mode,
    enabledServerIds: effective.enabledServerIds,
    toolsMode: effective.toolsMode,
    disabledTools: effective.disabledTools,
    effectiveDisabledTools,
  }
}

export function resolveEffectiveSkills(
  store: SessionSettingsStore,
  sessionId?: string,
  workspaceId?: string,
): {
  mode: 'global' | 'custom'
  disabledModelSkills: string[]
  disabledUserSkills: string[]
  effectiveDisabledModelSkills: string[]
  effectiveDisabledUserSkills: string[]
} {
  const effective = resolveSkillsLayers(
    layersFor(store, sessionId, workspaceId),
  )
  return {
    ...effective,
    effectiveDisabledModelSkills: effective.disabledModelSkills,
    effectiveDisabledUserSkills: effective.disabledUserSkills,
  }
}

/**
 * The effective extra-writable-directory list for one session.
 *
 * The ladder itself lives in `src/shared/settings.ts`; this function only
 * projects the store onto its layers, so the settings panel and the sandbox
 * enforcement cannot disagree about which scope wins.
 */
export function resolveEffectiveSandbox(
  store: SessionSettingsStore,
  sessionId?: string,
  workspaceId?: string,
): { mode: 'global' | 'custom'; allow: SandboxAllowEntry[] } {
  const effective = resolveSandboxLayers(
    layersFor(store, sessionId, workspaceId),
  )
  return { mode: effective.mode, allow: effective.allow }
}
