import fs from 'node:fs'
import type {
  SubagentModelConfig,
  McpServerStore,
  SessionSettingsConfig,
  SessionSettingsStore,
  SessionSkillsConfig,
} from '../../types.ts'
import { getSessionSettingsStoragePath } from '../common/paths.ts'

export const DEFAULT_SESSION_SETTINGS: SessionSettingsConfig = {
  subagentModel: { mode: 'inherit' },
  mcp: {
    mode: 'default',
    enabledServerIds: [],
    toolsMode: {},
    disabledTools: {},
  },
  skills: {
    mode: 'default',
    disabledSkills: [],
    disabledModelSkills: [],
    disabledUserSkills: [],
  },
}

export function normalizeSubagentModelConfig(
  raw?: Partial<SubagentModelConfig>,
): SubagentModelConfig {
  if (!raw || typeof raw !== 'object') return { mode: 'inherit' }
  const mode =
    raw.mode === 'custom'
      ? 'custom'
      : raw.mode === 'workspace'
        ? 'workspace'
        : raw.mode === 'inherit'
          ? 'inherit'
          : 'default'
  if (mode === 'custom') {
    const provider = typeof raw.provider === 'string' ? raw.provider.trim() : ''
    const model = typeof raw.model === 'string' ? raw.model.trim() : ''
    if (!provider || !model) {
      return { mode: 'inherit' }
    }
    return {
      mode: 'custom',
      provider,
      model,
      reasoningEffort:
        typeof raw.reasoningEffort === 'string' && raw.reasoningEffort.trim()
          ? raw.reasoningEffort.trim()
          : undefined,
    }
  }
  return { mode }
}

export function normalizeSkillsConfig(
  raw?: Partial<SessionSkillsConfig>,
): SessionSkillsConfig {
  if (!raw || typeof raw !== 'object') {
    return {
      mode: 'default',
      disabledSkills: [],
      disabledModelSkills: [],
      disabledUserSkills: [],
    }
  }
  const mode =
    raw.mode === 'custom'
      ? 'custom'
      : raw.mode === 'workspace'
        ? 'workspace'
        : 'default'

  let disabledModelSkills: string[] = []
  if (Array.isArray(raw.disabledModelSkills)) {
    disabledModelSkills = raw.disabledModelSkills.filter(
      (s): s is string => typeof s === 'string' && s.trim().length > 0,
    )
  } else if (Array.isArray(raw.disabledSkills)) {
    disabledModelSkills = raw.disabledSkills.filter(
      (s): s is string => typeof s === 'string' && s.trim().length > 0,
    )
  }

  const disabledUserSkills = Array.isArray(raw.disabledUserSkills)
    ? raw.disabledUserSkills.filter(
        (s): s is string => typeof s === 'string' && s.trim().length > 0,
      )
    : []

  return {
    mode,
    disabledSkills: disabledModelSkills,
    disabledModelSkills,
    disabledUserSkills,
  }
}

export function normalizeSessionSettings(
  raw?: Partial<SessionSettingsConfig>,
): SessionSettingsConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SESSION_SETTINGS }
  }

  const subagentModel = normalizeSubagentModelConfig(raw.subagentModel)
  const rawMcp = raw.mcp
  const mcpMode =
    rawMcp?.mode === 'custom'
      ? 'custom'
      : rawMcp?.mode === 'workspace'
        ? 'workspace'
        : 'default'
  const enabledServerIds = Array.isArray(rawMcp?.enabledServerIds)
    ? rawMcp.enabledServerIds.filter(
        (id): id is string => typeof id === 'string',
      )
    : []

  const toolsMode: Record<string, 'default' | 'custom'> = {}
  if (rawMcp?.toolsMode && typeof rawMcp.toolsMode === 'object') {
    for (const [k, v] of Object.entries(rawMcp.toolsMode)) {
      if (typeof k === 'string' && (v === 'custom' || v === 'default')) {
        toolsMode[k] = v
      }
    }
  }

  const disabledTools: Record<string, string[]> = {}
  if (rawMcp?.disabledTools && typeof rawMcp.disabledTools === 'object') {
    for (const [k, v] of Object.entries(rawMcp.disabledTools)) {
      if (typeof k === 'string' && Array.isArray(v)) {
        disabledTools[k] = v.filter(
          (name): name is string => typeof name === 'string',
        )
      }
    }
  }

  const skills = normalizeSkillsConfig(raw.skills)

  return {
    subagentModel,
    mcp: {
      mode: mcpMode,
      enabledServerIds,
      toolsMode,
      disabledTools,
    },
    skills,
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
          const def = normalizeSessionSettings(data.default)
          const workspaces: Record<string, SessionSettingsConfig> = {}
          if (data.workspaces && typeof data.workspaces === 'object') {
            for (const [id, w] of Object.entries(data.workspaces)) {
              if (w && typeof w === 'object') {
                workspaces[id] = normalizeSessionSettings(w as any)
              }
            }
          }
          const sessions: Record<string, SessionSettingsConfig> = {}
          if (data.sessions && typeof data.sessions === 'object') {
            for (const [id, s] of Object.entries(data.sessions)) {
              if (s && typeof s === 'object') {
                sessions[id] = normalizeSessionSettings(s as any)
              }
            }
          }
          return { default: def, workspaces, sessions }
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
    default: { ...DEFAULT_SESSION_SETTINGS },
    workspaces: {},
    sessions: {},
  }
}

export function saveSessionSettingsStore(store: SessionSettingsStore): void {
  try {
    const file = getSessionSettingsStoragePath()
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

  if (mcp.effectiveDisabledTools && oldId in mcp.effectiveDisabledTools) {
    mcp.effectiveDisabledTools[newId] = mcp.effectiveDisabledTools[oldId]
    delete mcp.effectiveDisabledTools[oldId]
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

  if (store.default?.mcp) {
    if (renameMcpInConfig(store.default.mcp, oldId, newId)) {
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
  const globalDefault = store.default?.subagentModel || { mode: 'inherit' }

  // 1. Check session override
  if (sessionId && store.sessions?.[sessionId]) {
    const entry = store.sessions[sessionId]
    if (entry.subagentModel) {
      if (entry.subagentModel.mode === 'custom') {
        return entry.subagentModel
      }
      if (entry.subagentModel.mode === 'inherit') {
        return { mode: 'inherit' }
      }
      if (entry.subagentModel.mode === 'workspace') {
        if (workspaceId && store.workspaces?.[workspaceId]?.subagentModel) {
          const wsModel = store.workspaces[workspaceId].subagentModel
          if (wsModel.mode === 'custom') return wsModel
          if (wsModel.mode === 'inherit') return { mode: 'inherit' }
        }
        return globalDefault
      }
      if (entry.subagentModel.mode === 'default') {
        return globalDefault
      }
    }
  }

  // 2. Check workspace default if no session override or unconfigured
  if (workspaceId && store.workspaces?.[workspaceId]?.subagentModel) {
    const wsModel = store.workspaces[workspaceId].subagentModel
    if (wsModel.mode === 'custom') return wsModel
    if (wsModel.mode === 'inherit') return { mode: 'inherit' }
  }

  // 3. Fall back to global default
  return globalDefault
}

export function resolveEffectiveMcp(
  store: SessionSettingsStore,
  mcpStore: McpServerStore,
  sessionId?: string,
  workspaceId?: string,
): {
  mode: 'default' | 'custom'
  enabledServerIds: string[]
  toolsMode: Record<string, 'default' | 'custom'>
  disabledTools: Record<string, string[]>
  effectiveDisabledTools: Record<string, string[]>
} {
  let mode: 'default' | 'custom' = 'default'
  let enabledServerIds: string[] = []
  let toolsMode: Record<string, 'default' | 'custom'> = {}
  let disabledTools: Record<string, string[]> = {}

  const defaultMcpIds = Object.values(mcpStore.servers)
    .filter((s) => s.enabledByDefault)
    .map((s) => s.id)
  const globalMcpMode =
    store.default?.mcp?.mode === 'custom' ? 'custom' : 'default'
  const globalEnabledIds =
    globalMcpMode === 'custom'
      ? store.default.mcp.enabledServerIds || []
      : defaultMcpIds
  const globalToolsMode = store.default?.mcp?.toolsMode || {}
  const globalDisabledTools = store.default?.mcp?.disabledTools || {}

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
    } else if (sMcp.mode === 'default') {
      mode = globalMcpMode
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
    mode = globalMcpMode
    enabledServerIds = globalEnabledIds
    toolsMode = globalToolsMode
    disabledTools = globalDisabledTools
  }

  // Calculate effective disabled tools per server
  const effectiveDisabledTools: Record<string, string[]> = {}
  for (const server of Object.values(mcpStore.servers)) {
    const isCustomTools = toolsMode[server.id] === 'custom'
    if (isCustomTools && disabledTools[server.id]) {
      effectiveDisabledTools[server.id] = disabledTools[server.id]
    } else {
      effectiveDisabledTools[server.id] = server.disabledTools || []
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
  mode: 'default' | 'custom'
  disabledSkills: string[]
  disabledModelSkills: string[]
  disabledUserSkills: string[]
  effectiveDisabledSkills: string[]
  effectiveDisabledModelSkills: string[]
  effectiveDisabledUserSkills: string[]
} {
  let mode: 'default' | 'custom' = 'default'
  let disabledModelSkills: string[] = []
  let disabledUserSkills: string[] = []

  const globalMode =
    store.default?.skills?.mode === 'custom' ? 'custom' : 'default'
  const globalModelSkills =
    store.default?.skills?.disabledModelSkills ||
    store.default?.skills?.disabledSkills ||
    []
  const globalUserSkills = store.default?.skills?.disabledUserSkills || []

  let resolved = false

  // 1. Session level
  if (sessionId && store.sessions?.[sessionId]?.skills) {
    const sSkills = store.sessions[sessionId].skills
    if (sSkills.mode === 'custom') {
      mode = 'custom'
      disabledModelSkills =
        sSkills.disabledModelSkills || sSkills.disabledSkills || []
      disabledUserSkills = sSkills.disabledUserSkills || []
      resolved = true
    } else if (sSkills.mode === 'workspace') {
      if (
        workspaceId &&
        store.workspaces?.[workspaceId]?.skills?.mode === 'custom'
      ) {
        const wsSkills = store.workspaces[workspaceId].skills
        mode = 'custom'
        disabledModelSkills =
          wsSkills.disabledModelSkills || wsSkills.disabledSkills || []
        disabledUserSkills = wsSkills.disabledUserSkills || []
        resolved = true
      }
    } else if (sSkills.mode === 'default') {
      mode = globalMode
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
    disabledModelSkills =
      wsSkills.disabledModelSkills || wsSkills.disabledSkills || []
    disabledUserSkills = wsSkills.disabledUserSkills || []
    resolved = true
  }

  // 3. Global level
  if (!resolved) {
    mode = globalMode
    disabledModelSkills = globalModelSkills
    disabledUserSkills = globalUserSkills
  }

  return {
    mode,
    disabledSkills: [...disabledModelSkills],
    disabledModelSkills: [...disabledModelSkills],
    disabledUserSkills: [...disabledUserSkills],
    effectiveDisabledSkills: [...disabledModelSkills],
    effectiveDisabledModelSkills: [...disabledModelSkills],
    effectiveDisabledUserSkills: [...disabledUserSkills],
  }
}

export function resolveEffectiveSessionSettings(
  store: SessionSettingsStore,
  mcpStore: McpServerStore,
  sessionId?: string,
  workspaceId?: string,
): SessionSettingsConfig {
  return {
    subagentModel: resolveEffectiveSubagentModel(store, sessionId, workspaceId),
    mcp: resolveEffectiveMcp(store, mcpStore, sessionId, workspaceId),
    skills: resolveEffectiveSkills(store, sessionId, workspaceId),
  }
}
