import type {
  SessionSettingsConfig,
  SessionSettingsStore,
  GlobalMcpServerConfig,
} from '../types/index.ts'

const STORAGE_KEY = 'dsh.session_settings_store'
const MCP_STORAGE_KEY = 'dsh.mcp_servers_store'

const DEFAULT_SESSION_SETTINGS: SessionSettingsConfig = {
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
  },
}

export function getLocalSessionSettingsStore(): SessionSettingsStore {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          return {
            default: parsed.default || { ...DEFAULT_SESSION_SETTINGS },
            workspaces: parsed.workspaces || {},
            sessions: parsed.sessions || {},
          }
        }
      }
    }
  } catch {}
  return {
    default: { ...DEFAULT_SESSION_SETTINGS },
    workspaces: {},
    sessions: {},
  }
}

export function saveLocalSessionSettingsStore(
  store: SessionSettingsStore,
): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    }
  } catch {}
}

export function getLocalMcpServers(): GlobalMcpServerConfig[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(MCP_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed
      }
    }
  } catch {}
  return []
}

export function saveLocalMcpServers(servers: GlobalMcpServerConfig[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MCP_STORAGE_KEY, JSON.stringify(servers))
    }
  } catch {}
}

export function getSessionRawSettings(
  store: SessionSettingsStore,
  sessionId?: string,
  workspaceId?: string,
): { config: SessionSettingsConfig; hasOverride: boolean } {
  if (sessionId && store.sessions && store.sessions[sessionId]) {
    const s = store.sessions[sessionId]
    const hasOverride =
      (s.subagentModel?.mode !== 'workspace' &&
        s.subagentModel?.mode !== 'default') ||
      (s.mcp?.mode !== 'workspace' && s.mcp?.mode !== 'default') ||
      (s.skills?.mode !== 'workspace' && s.skills?.mode !== 'default')
    return {
      config: {
        subagentModel: s.subagentModel || {
          mode: workspaceId ? 'workspace' : 'default',
        },
        mcp: {
          mode:
            s.mcp?.mode === 'custom'
              ? 'custom'
              : s.mcp?.mode === 'workspace'
                ? 'workspace'
                : 'default',
          enabledServerIds: s.mcp?.enabledServerIds || [],
          toolsMode: s.mcp?.toolsMode || {},
          disabledTools: s.mcp?.disabledTools || {},
        },
        skills: {
          mode:
            s.skills?.mode === 'custom'
              ? 'custom'
              : s.skills?.mode === 'workspace'
                ? 'workspace'
                : 'default',
          disabledSkills: s.skills?.disabledSkills || [],
          disabledModelSkills: s.skills?.disabledModelSkills || [],
          disabledUserSkills: s.skills?.disabledUserSkills || [],
        },
      },
      hasOverride,
    }
  }

  return {
    config: {
      subagentModel: { mode: workspaceId ? 'workspace' : 'default' },
      mcp: {
        mode: workspaceId ? 'workspace' : 'default',
        enabledServerIds: [],
        toolsMode: {},
        disabledTools: {},
      },
      skills: {
        mode: workspaceId ? 'workspace' : 'default',
        disabledSkills: [],
        disabledModelSkills: [],
        disabledUserSkills: [],
      },
    },
    hasOverride: false,
  }
}

export function getSessionEffectiveSettings(
  store: SessionSettingsStore,
  availableMcpServers: GlobalMcpServerConfig[],
  sessionId?: string,
  workspaceId?: string,
): SessionSettingsConfig {
  const globalSubagent = store.default?.subagentModel || { mode: 'inherit' }
  const defaultMcpIds = availableMcpServers
    .filter((s) => s.enabledByDefault)
    .map((s) => s.id)
  const globalMcpMode =
    store.default?.mcp?.mode === 'custom' ? 'custom' : 'default'
  const globalEnabledMcpIds =
    globalMcpMode === 'custom'
      ? store.default.mcp.enabledServerIds || []
      : defaultMcpIds
  const globalToolsMode = store.default?.mcp?.toolsMode || {}
  const globalDisabledTools = store.default?.mcp?.disabledTools || {}

  const globalSkillsMode =
    store.default?.skills?.mode === 'custom' ? 'custom' : 'default'
  const globalDisabledSkills = store.default?.skills?.disabledSkills || []
  const globalDisabledModelSkills =
    store.default?.skills?.disabledModelSkills || globalDisabledSkills
  const globalDisabledUserSkills =
    store.default?.skills?.disabledUserSkills || []

  // 1. Resolve Subagent Model
  let resolvedSubagent = globalSubagent
  if (sessionId && store.sessions?.[sessionId]?.subagentModel) {
    const sModel = store.sessions[sessionId].subagentModel
    if (sModel.mode === 'custom') {
      resolvedSubagent = sModel
    } else if (sModel.mode === 'inherit') {
      resolvedSubagent = { mode: 'inherit' }
    } else if (sModel.mode === 'workspace') {
      if (workspaceId && store.workspaces?.[workspaceId]?.subagentModel) {
        const wsModel = store.workspaces[workspaceId].subagentModel
        if (wsModel.mode === 'custom') resolvedSubagent = wsModel
        else if (wsModel.mode === 'inherit')
          resolvedSubagent = { mode: 'inherit' }
        else resolvedSubagent = globalSubagent
      } else {
        resolvedSubagent = globalSubagent
      }
    } else if (sModel.mode === 'default') {
      resolvedSubagent = globalSubagent
    }
  } else if (workspaceId && store.workspaces?.[workspaceId]?.subagentModel) {
    const wsModel = store.workspaces[workspaceId].subagentModel
    if (wsModel.mode === 'custom') resolvedSubagent = wsModel
    else if (wsModel.mode === 'inherit') resolvedSubagent = { mode: 'inherit' }
  }

  // 2. Resolve MCP
  let resolvedMcpMode: 'default' | 'custom' = 'default'
  let resolvedMcpEnabledIds: string[] = []
  let resolvedMcpToolsMode: Record<string, 'default' | 'custom'> = {}
  let resolvedMcpDisabledTools: Record<string, string[]> = {}
  let mcpResolved = false

  if (sessionId && store.sessions?.[sessionId]?.mcp) {
    const sMcp = store.sessions[sessionId].mcp
    if (sMcp.mode === 'custom') {
      resolvedMcpMode = 'custom'
      resolvedMcpEnabledIds = sMcp.enabledServerIds || []
      resolvedMcpToolsMode = sMcp.toolsMode || {}
      resolvedMcpDisabledTools = sMcp.disabledTools || {}
      mcpResolved = true
    } else if (sMcp.mode === 'workspace') {
      if (
        workspaceId &&
        store.workspaces?.[workspaceId]?.mcp?.mode === 'custom'
      ) {
        const wsMcp = store.workspaces[workspaceId].mcp
        resolvedMcpMode = 'custom'
        resolvedMcpEnabledIds = wsMcp.enabledServerIds || []
        resolvedMcpToolsMode = wsMcp.toolsMode || {}
        resolvedMcpDisabledTools = wsMcp.disabledTools || {}
        mcpResolved = true
      }
    } else if (sMcp.mode === 'default') {
      resolvedMcpMode = globalMcpMode
      resolvedMcpEnabledIds = globalEnabledMcpIds
      resolvedMcpToolsMode = globalToolsMode
      resolvedMcpDisabledTools = globalDisabledTools
      mcpResolved = true
    }
  }

  if (
    !mcpResolved &&
    workspaceId &&
    store.workspaces?.[workspaceId]?.mcp?.mode === 'custom'
  ) {
    const wsMcp = store.workspaces[workspaceId].mcp
    resolvedMcpMode = 'custom'
    resolvedMcpEnabledIds = wsMcp.enabledServerIds || []
    resolvedMcpToolsMode = wsMcp.toolsMode || {}
    resolvedMcpDisabledTools = wsMcp.disabledTools || {}
    mcpResolved = true
  }

  if (!mcpResolved) {
    resolvedMcpMode = globalMcpMode
    resolvedMcpEnabledIds = globalEnabledMcpIds
    resolvedMcpToolsMode = globalToolsMode
    resolvedMcpDisabledTools = globalDisabledTools
  }

  const effectiveDisabledTools: Record<string, string[]> = {}
  for (const srv of availableMcpServers) {
    if (
      resolvedMcpToolsMode[srv.id] === 'custom' &&
      resolvedMcpDisabledTools[srv.id]
    ) {
      effectiveDisabledTools[srv.id] = resolvedMcpDisabledTools[srv.id]
    } else {
      effectiveDisabledTools[srv.id] = srv.disabledTools || []
    }
  }

  // 3. Resolve Skills
  let resolvedSkillsMode: 'default' | 'custom' = 'default'
  let resolvedDisabledModelSkills: string[] = []
  let resolvedDisabledUserSkills: string[] = []
  let skillsResolved = false

  if (sessionId && store.sessions?.[sessionId]?.skills) {
    const sSkills = store.sessions[sessionId].skills
    if (sSkills.mode === 'custom') {
      resolvedSkillsMode = 'custom'
      resolvedDisabledModelSkills =
        sSkills.disabledModelSkills || sSkills.disabledSkills || []
      resolvedDisabledUserSkills = sSkills.disabledUserSkills || []
      skillsResolved = true
    } else if (sSkills.mode === 'workspace') {
      if (
        workspaceId &&
        store.workspaces?.[workspaceId]?.skills?.mode === 'custom'
      ) {
        const wsSkills = store.workspaces[workspaceId].skills
        resolvedSkillsMode = 'custom'
        resolvedDisabledModelSkills =
          wsSkills.disabledModelSkills || wsSkills.disabledSkills || []
        resolvedDisabledUserSkills = wsSkills.disabledUserSkills || []
        skillsResolved = true
      }
    } else if (sSkills.mode === 'default') {
      resolvedSkillsMode = globalSkillsMode
      resolvedDisabledModelSkills = globalDisabledModelSkills
      resolvedDisabledUserSkills = globalDisabledUserSkills
      skillsResolved = true
    }
  }

  if (
    !skillsResolved &&
    workspaceId &&
    store.workspaces?.[workspaceId]?.skills?.mode === 'custom'
  ) {
    const wsSkills = store.workspaces[workspaceId].skills
    resolvedSkillsMode = 'custom'
    resolvedDisabledModelSkills =
      wsSkills.disabledModelSkills || wsSkills.disabledSkills || []
    resolvedDisabledUserSkills = wsSkills.disabledUserSkills || []
    skillsResolved = true
  }

  if (!skillsResolved) {
    resolvedSkillsMode = globalSkillsMode
    resolvedDisabledModelSkills = globalDisabledModelSkills
    resolvedDisabledUserSkills = globalDisabledUserSkills
  }

  return {
    subagentModel: resolvedSubagent,
    mcp: {
      mode: resolvedMcpMode,
      enabledServerIds: resolvedMcpEnabledIds,
      toolsMode: resolvedMcpToolsMode,
      disabledTools: resolvedMcpDisabledTools,
      effectiveDisabledTools,
    },
    skills: {
      mode: resolvedSkillsMode,
      disabledSkills: [...resolvedDisabledModelSkills],
      disabledModelSkills: [...resolvedDisabledModelSkills],
      disabledUserSkills: [...resolvedDisabledUserSkills],
      effectiveDisabledSkills: [...resolvedDisabledModelSkills],
      effectiveDisabledModelSkills: [...resolvedDisabledModelSkills],
      effectiveDisabledUserSkills: [...resolvedDisabledUserSkills],
    },
  }
}
