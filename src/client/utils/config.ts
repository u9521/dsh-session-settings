import type {
  SessionSettingsConfig,
  SubagentModelConfig,
  SessionMcpConfig,
  SessionSkillsConfig,
  GlobalMcpServerConfig,
} from '../types/index.ts'

export function isSessionCustomized(
  sessionConfig?: SessionSettingsConfig,
): boolean {
  if (!sessionConfig) return false
  return Boolean(
    sessionConfig.subagentModel?.mode === 'custom' ||
    sessionConfig.subagentModel?.allowAgentSelectModel !== undefined ||
    sessionConfig.subagentModel?.overrideForkModel !== undefined ||
    sessionConfig.mcp?.mode === 'custom' ||
    sessionConfig.skills?.mode === 'custom',
  )
}

export function resolveEffectiveSubagentModel(
  sessionConfig?: SessionSettingsConfig,
  workspaceConfig?: SessionSettingsConfig,
  globalConfig?: SessionSettingsConfig,
): SubagentModelConfig {
  const globalCfg = globalConfig?.subagentModel
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

  const wsCfg = workspaceConfig?.subagentModel
  const wsAllow =
    wsCfg?.allowAgentSelectModel !== undefined
      ? wsCfg.allowAgentSelectModel
      : globalAllow
  const wsOverrideFork =
    wsCfg?.overrideForkModel !== undefined
      ? wsCfg.overrideForkModel
      : globalOverrideFork

  const workspaceResult: SubagentModelConfig =
    wsCfg?.mode === 'custom' && wsCfg.inherit === false && wsCfg.model
      ? {
          mode: 'custom',
          inherit: false,
          model: wsCfg.model,
          allowAgentSelectModel: wsAllow,
          overrideForkModel: wsOverrideFork,
        }
      : wsCfg?.mode === 'custom' && wsCfg.inherit === true
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

  if (sessionConfig?.subagentModel) {
    const sModel = sessionConfig.subagentModel
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

  if (wsCfg) {
    return workspaceResult
  }

  return globalResult
}

export function resolveEffectiveMcp(
  sessionConfig?: SessionSettingsConfig,
  workspaceConfig?: SessionSettingsConfig,
  globalConfig?: SessionSettingsConfig,
  availableMcpServers?: GlobalMcpServerConfig[],
): SessionMcpConfig {
  const defaultMcpIds = (availableMcpServers || [])
    .filter((s) => s.enabledByDefault)
    .map((s) => s.id)

  const globalMcp = globalConfig?.mcp
  const globalEnabledIds = Array.isArray(globalMcp?.enabledServerIds)
    ? globalMcp.enabledServerIds
    : defaultMcpIds
  const globalToolsMode = globalMcp?.toolsMode || {}
  const globalDisabledTools = globalMcp?.disabledTools || {}

  let mode: 'global' | 'custom' = 'global'
  let enabledServerIds: string[] = []
  let toolsMode: Record<string, 'global' | 'custom'> = {}
  let disabledTools: Record<string, string[]> = {}
  let resolved = false

  if (sessionConfig?.mcp) {
    const sMcp = sessionConfig.mcp
    if (sMcp.mode === 'custom') {
      mode = 'custom'
      enabledServerIds = sMcp.enabledServerIds || []
      toolsMode = sMcp.toolsMode || {}
      disabledTools = sMcp.disabledTools || {}
      resolved = true
    } else if (sMcp.mode === 'workspace') {
      if (workspaceConfig?.mcp?.mode === 'custom') {
        const wsMcp = workspaceConfig.mcp
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

  if (!resolved && workspaceConfig?.mcp?.mode === 'custom') {
    const wsMcp = workspaceConfig.mcp
    mode = 'custom'
    enabledServerIds = wsMcp.enabledServerIds || []
    toolsMode = wsMcp.toolsMode || {}
    disabledTools = wsMcp.disabledTools || {}
    resolved = true
  }

  if (!resolved) {
    mode = 'global'
    enabledServerIds = globalEnabledIds
    toolsMode = globalToolsMode
    disabledTools = globalDisabledTools
  }

  return {
    mode,
    enabledServerIds,
    toolsMode,
    disabledTools,
  }
}

export function resolveEffectiveSkills(
  sessionConfig?: SessionSettingsConfig,
  workspaceConfig?: SessionSettingsConfig,
  globalConfig?: SessionSettingsConfig,
): SessionSkillsConfig {
  const globalSkills = globalConfig?.skills
  const globalModelSkills = globalSkills?.disabledModelSkills || []
  const globalUserSkills = globalSkills?.disabledUserSkills || []

  let mode: 'global' | 'custom' = 'global'
  let disabledModelSkills: string[] = []
  let disabledUserSkills: string[] = []
  let resolved = false

  if (sessionConfig?.skills) {
    const sSkills = sessionConfig.skills
    if (sSkills.mode === 'custom') {
      mode = 'custom'
      disabledModelSkills = sSkills.disabledModelSkills || []
      disabledUserSkills = sSkills.disabledUserSkills || []
      resolved = true
    } else if (sSkills.mode === 'workspace') {
      if (workspaceConfig?.skills?.mode === 'custom') {
        const wsSkills = workspaceConfig.skills
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

  if (!resolved && workspaceConfig?.skills?.mode === 'custom') {
    const wsSkills = workspaceConfig.skills
    mode = 'custom'
    disabledModelSkills = wsSkills.disabledModelSkills || []
    disabledUserSkills = wsSkills.disabledUserSkills || []
    resolved = true
  }

  if (!resolved) {
    mode = 'global'
    disabledModelSkills = globalModelSkills
    disabledUserSkills = globalUserSkills
  }

  return {
    mode,
    disabledModelSkills: [...disabledModelSkills],
    disabledUserSkills: [...disabledUserSkills],
  }
}

export function resolveEffectiveSessionConfig(
  sessionConfig?: SessionSettingsConfig,
  workspaceConfig?: SessionSettingsConfig,
  globalConfig?: SessionSettingsConfig,
  availableMcpServers?: GlobalMcpServerConfig[],
): SessionSettingsConfig {
  return {
    subagentModel: resolveEffectiveSubagentModel(
      sessionConfig,
      workspaceConfig,
      globalConfig,
    ),
    mcp: resolveEffectiveMcp(
      sessionConfig,
      workspaceConfig,
      globalConfig,
      availableMcpServers,
    ),
    skills: resolveEffectiveSkills(
      sessionConfig,
      workspaceConfig,
      globalConfig,
    ),
  }
}
