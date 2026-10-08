import fs from 'node:fs'
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
import { getSessionSettingsStoragePath } from '../common/paths.ts'

const DEFAULT_GLOBAL_SETTINGS: SessionSettingsConfig = {
  subagentModel: {
    inherit: true,
    allowAgentSelectModel: true,
    overrideForkModel: false,
  },
  mcp: {
    enabledServerIds: [],
  },
  skills: {
    disabledModelSkills: [],
    disabledUserSkills: [],
  },
  sandbox: {
    allow: [],
  },
}

const DEFAULT_SESSION_SETTINGS: SessionSettingsConfig = {
  subagentModel: { mode: 'workspace' },
  mcp: {
    mode: 'workspace',
  },
  skills: {
    mode: 'workspace',
  },
  sandbox: {
    mode: 'workspace',
  },
}

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

export function loadSessionSettingsStore(): SessionSettingsStore {
  try {
    const file = getSessionSettingsStoragePath()
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8')
      if (content.trim()) {
        const data = JSON.parse(content)
        if (data && typeof data === 'object') {
          const globalConfig = normalizeGlobalSettings(data.globalConfig)
          const workspaces: Record<string, SessionSettingsConfig> = {}
          if (data.workspaces && typeof data.workspaces === 'object') {
            for (const [id, w] of Object.entries(data.workspaces)) {
              if (w && typeof w === 'object') {
                workspaces[id] = normalizeSessionSettings(
                  w as Partial<SessionSettingsConfig>,
                )
              }
            }
          }
          const sessions: Record<string, SessionSettingsConfig> = {}
          if (data.sessions && typeof data.sessions === 'object') {
            for (const [id, s] of Object.entries(data.sessions)) {
              if (s && typeof s === 'object') {
                sessions[id] = normalizeSessionSettings(
                  s as Partial<SessionSettingsConfig>,
                )
              }
            }
          }
          // A legacy `pendingSessions` key from an older file is dropped here:
          // the store no longer carries it, and the next save rewrites the file
          // without it.
          return { globalConfig, workspaces, sessions }
        }
      }
    }
  } catch (err) {
    console.error(
      '[session-settings:storage] Failed to load session settings store:',
      err,
    )
  }

  return {
    globalConfig: { ...DEFAULT_GLOBAL_SETTINGS },
    workspaces: {},
    sessions: {},
  }
}

export function saveSessionSettingsStore(store: SessionSettingsStore): void {
  try {
    const file = getSessionSettingsStoragePath(true)
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8')
    fs.renameSync(tmp, file)
  } catch (err) {
    console.error(
      '[session-settings:storage] Failed to save session settings store:',
      err,
    )
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

export function resolveEffectiveSubagentModel(
  store: SessionSettingsStore,
  sessionId?: string,
  workspaceId?: string,
): SubagentModelConfig {
  const globalCfg = store.globalConfig?.subagentModel
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

  const wsModel = workspaceId
    ? store.workspaces?.[workspaceId]?.subagentModel
    : undefined

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

  // 1. Check session override
  if (sessionId && store.sessions?.[sessionId]?.subagentModel) {
    const sModel = store.sessions[sessionId].subagentModel

    if (sModel.mode === 'custom') {
      return {
        ...sModel,
        allowAgentSelectModel:
          sModel.allowAgentSelectModel !== undefined
            ? sModel.allowAgentSelectModel
            : wsAllow,
        overrideForkModel:
          sModel.overrideForkModel !== undefined
            ? sModel.overrideForkModel
            : wsOverrideFork,
      }
    }
    if (sModel.mode === 'workspace') {
      return {
        ...workspaceResult,
        allowAgentSelectModel:
          sModel.allowAgentSelectModel !== undefined
            ? sModel.allowAgentSelectModel
            : wsAllow,
        overrideForkModel:
          sModel.overrideForkModel !== undefined
            ? sModel.overrideForkModel
            : wsOverrideFork,
      }
    }
    if (sModel.mode === 'global') {
      return {
        ...globalResult,
        allowAgentSelectModel:
          sModel.allowAgentSelectModel !== undefined
            ? sModel.allowAgentSelectModel
            : globalAllow,
        overrideForkModel:
          sModel.overrideForkModel !== undefined
            ? sModel.overrideForkModel
            : globalOverrideFork,
      }
    }
  }

  // 2. Check workspace default
  if (workspaceId && wsModel) {
    return workspaceResult
  }

  return globalResult
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
  // The global scope is exactly its explicit list. A malformed store that omits
  // the field falls back to "nothing enabled" rather than to a per-server flag.
  const globalMcp = store.globalConfig?.mcp
  const globalEnabledIds = Array.isArray(globalMcp?.enabledServerIds)
    ? globalMcp.enabledServerIds
    : []
  const globalToolsMode = globalMcp?.toolsMode || {}
  const globalDisabledTools = globalMcp?.disabledTools || {}

  let mode: 'global' | 'custom' = 'global'
  let enabledServerIds: string[] = []
  let toolsMode: Record<string, 'global' | 'custom'> = {}
  let disabledTools: Record<string, string[]> = {}
  let resolved = false

  // 1. Session level
  if (sessionId && store.sessions?.[sessionId]?.mcp) {
    const sMcp = store.sessions[sessionId].mcp
    if (sMcp.mode === 'custom') {
      mode = 'custom'
      enabledServerIds = sMcp.enabledServerIds || []
      toolsMode = sMcp.toolsMode || {}
      disabledTools = sMcp.disabledTools || {}
      resolved = true
    } else if (sMcp.mode === 'workspace') {
      if (
        workspaceId &&
        store.workspaces?.[workspaceId]?.mcp?.mode === 'custom'
      ) {
        const wsMcp = store.workspaces[workspaceId].mcp
        mode = 'custom'
        enabledServerIds = wsMcp.enabledServerIds || []
        toolsMode = wsMcp.toolsMode || {}
        disabledTools = wsMcp.disabledTools || {}
        resolved = true
      }
    } else if (sMcp.mode === 'global') {
      mode = 'global'
      enabledServerIds = globalEnabledIds
      toolsMode = globalToolsMode
      disabledTools = globalDisabledTools
      resolved = true
    }
  }

  // 2. Workspace level
  if (
    !resolved &&
    workspaceId &&
    store.workspaces?.[workspaceId]?.mcp?.mode === 'custom'
  ) {
    const wsMcp = store.workspaces[workspaceId].mcp
    mode = 'custom'
    enabledServerIds = wsMcp.enabledServerIds || []
    toolsMode = wsMcp.toolsMode || {}
    disabledTools = wsMcp.disabledTools || {}
    resolved = true
  }

  // 3. Global level
  if (!resolved) {
    mode = 'global'
    enabledServerIds = globalEnabledIds
    toolsMode = globalToolsMode
    disabledTools = globalDisabledTools
  }

  const effectiveDisabledTools: Record<string, string[]> = {}
  for (const server of Object.values(mcpStore.servers)) {
    const isCustomTools = toolsMode[server.id] === 'custom'
    if (isCustomTools && disabledTools[server.id]) {
      effectiveDisabledTools[server.id] = disabledTools[server.id]
    } else {
      effectiveDisabledTools[server.id] = Array.isArray(server.disabledTools)
        ? server.disabledTools
        : []
    }
  }

  return {
    mode,
    enabledServerIds,
    toolsMode,
    disabledTools,
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
  const globalSkills = store.globalConfig?.skills
  const globalModelSkills = globalSkills?.disabledModelSkills || []
  const globalUserSkills = globalSkills?.disabledUserSkills || []

  let mode: 'global' | 'custom' = 'global'
  let disabledModelSkills: string[] = []
  let disabledUserSkills: string[] = []
  let resolved = false

  // 1. Session level
  if (sessionId && store.sessions?.[sessionId]?.skills) {
    const sSkills = store.sessions[sessionId].skills
    if (sSkills.mode === 'custom') {
      mode = 'custom'
      disabledModelSkills = sSkills.disabledModelSkills || []
      disabledUserSkills = sSkills.disabledUserSkills || []
      resolved = true
    } else if (sSkills.mode === 'workspace') {
      if (
        workspaceId &&
        store.workspaces?.[workspaceId]?.skills?.mode === 'custom'
      ) {
        const wsSkills = store.workspaces[workspaceId].skills
        mode = 'custom'
        disabledModelSkills = wsSkills.disabledModelSkills || []
        disabledUserSkills = wsSkills.disabledUserSkills || []
        resolved = true
      }
    } else if (sSkills.mode === 'global') {
      mode = 'global'
      disabledModelSkills = globalModelSkills
      disabledUserSkills = globalUserSkills
      resolved = true
    }
  }

  // 2. Workspace level
  if (
    !resolved &&
    workspaceId &&
    store.workspaces?.[workspaceId]?.skills?.mode === 'custom'
  ) {
    const wsSkills = store.workspaces[workspaceId].skills
    mode = 'custom'
    disabledModelSkills = wsSkills.disabledModelSkills || []
    disabledUserSkills = wsSkills.disabledUserSkills || []
    resolved = true
  }

  // 3. Global level
  if (!resolved) {
    mode = 'global'
    disabledModelSkills = globalModelSkills
    disabledUserSkills = globalUserSkills
  }

  return {
    mode,
    disabledModelSkills,
    disabledUserSkills,
    effectiveDisabledModelSkills: disabledModelSkills,
    effectiveDisabledUserSkills: disabledUserSkills,
  }
}

/**
 * The effective extra-writable-directory list for one session.
 *
 * Scope resolution is deliberately identical to {@link resolveEffectiveMcp}:
 * a session naming `custom` owns the answer outright, `workspace` defers to the
 * workspace's own `custom` entry and otherwise falls through, and `global`
 * takes the deployment list. Two panels offering the same three scopes must not
 * disagree about which one wins, so the ladder lives here once rather than
 * being re-derived per domain.
 *
 * The global list is the explicit `allow` array, never a per-entry flag, for the
 * same reason MCP's global scope is its explicit id list: an absent field must
 * read as "nothing granted", not as "granted by some other entry's default".
 *
 * @param store - the loaded settings store.
 * @param sessionId - the root session whose overrides apply, when known.
 * @param workspaceId - the session's workspace, when resolvable.
 * @returns the winning `allow` list and the scope that produced it.
 */
export function resolveEffectiveSandbox(
  store: SessionSettingsStore,
  sessionId?: string,
  workspaceId?: string,
): { mode: 'global' | 'custom'; allow: SandboxAllowEntry[] } {
  const globalAllow = Array.isArray(store.globalConfig?.sandbox?.allow)
    ? store.globalConfig.sandbox.allow
    : []

  let mode: 'global' | 'custom' = 'global'
  let allow: SandboxAllowEntry[] = []
  let resolved = false

  // 1. Session level
  if (sessionId && store.sessions?.[sessionId]?.sandbox) {
    const sSandbox = store.sessions[sessionId].sandbox
    if (sSandbox.mode === 'custom') {
      mode = 'custom'
      allow = sSandbox.allow || []
      resolved = true
    } else if (sSandbox.mode === 'workspace') {
      if (
        workspaceId &&
        store.workspaces?.[workspaceId]?.sandbox?.mode === 'custom'
      ) {
        const wsSandbox = store.workspaces[workspaceId].sandbox
        mode = 'custom'
        allow = wsSandbox.allow || []
        resolved = true
      }
    } else if (sSandbox.mode === 'global') {
      mode = 'global'
      allow = globalAllow
      resolved = true
    }
  }

  // 2. Workspace level
  if (
    !resolved &&
    workspaceId &&
    store.workspaces?.[workspaceId]?.sandbox?.mode === 'custom'
  ) {
    const wsSandbox = store.workspaces[workspaceId].sandbox
    mode = 'custom'
    allow = wsSandbox.allow || []
    resolved = true
  }

  // 3. Global level
  if (!resolved) {
    mode = 'global'
    allow = globalAllow
  }

  return { mode, allow }
}
