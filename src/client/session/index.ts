import * as React from 'react'
import type {
  ClientPageProps,
  GlobalMcpServerConfig,
  SkillItem,
  McpDiscoveredTool,
  SubagentModelMode,
  SessionMcpMode,
  SessionSkillsMode,
} from '../types/index.ts'
import { useSessionData } from './hooks/useSessionData.ts'
import { useSessionActions } from './hooks/useSessionActions.ts'
import { HeaderBar } from './sections/HeaderBar.ts'
import { NavigationSidebar } from './sections/NavigationSidebar.ts'
import { SubagentModelSection } from './sections/SubagentModelSection.ts'
import { SessionMcpSection } from './sections/SessionMcpSection.ts'
import { SessionSkillsSection } from './sections/SessionSkillsSection.ts'
import { SetDefaultModal } from './modals/SetDefaultModal.ts'
import { SessionMcpToolsModal } from './modals/SessionMcpToolsModal.ts'
import { SessionSkillDetailModal } from './modals/SessionSkillDetailModal.ts'

export * from './sections/HeaderBar.ts'
export * from './sections/NavigationSidebar.ts'
export * from './sections/SubagentModelSection.ts'
export * from './sections/SessionMcpSection.ts'
export * from './sections/SessionSkillsSection.ts'
export * from './modals/SetDefaultModal.ts'
export * from './modals/SessionMcpToolsModal.ts'
export * from './modals/SessionSkillDetailModal.ts'

const e = React.createElement

export function SessionSettingsViewPage(props: ClientPageProps) {
  const { api, t, sessionId, onClose, onSave } = props

  const data = useSessionData(props)
  const actions = useSessionActions({
    sessionId,
    currentWorkspaceId: data.currentWorkspaceId,
    currentWorkspaceTitle: data.currentWorkspaceTitle,
    modelConfig: data.modelConfig,
    mcpConfig: data.mcpConfig,
    skillsConfig: data.skillsConfig,
    defaultSettings: data.defaultSettings,
    workspaceSettings: data.workspaceSettings,
    setModelConfig: data.setModelConfig,
    setMcpConfig: data.setMcpConfig,
    setSkillsConfig: data.setSkillsConfig,
    setDefaultSettings: data.setDefaultSettings,
    setWorkspaceSettings: data.setWorkspaceSettings,
    setHasSessionOverride: data.setHasSessionOverride,
    setSaveSuccessMsg: data.setSaveSuccessMsg,
    setError: data.setError,
    setSetDefaultModalOpen: data.setSetDefaultModalOpen,
    setIsRestoringDefault: data.setIsRestoringDefault,
    cloneSourceId: data.cloneSourceId,
    setCloneSourceId: data.setCloneSourceId,
    setCloning: data.setCloning,
    setCloneError: data.setCloneError,
    setCopiedId: data.setCopiedId,
    sessionsMap: data.sessionsMap,
    onSave,
    t,
  })

  // Model change handlers
  const handleModelModeChange = (mode: SubagentModelMode) => {
    data.setSaveSuccessMsg('')
    data.setError('')
    if (
      mode === 'custom' &&
      !data.modelConfig.provider &&
      data.providers.length > 0
    ) {
      const firstGroup = data.providers[0]
      const firstModel = firstGroup.models?.[0]?.id || ''
      data.setModelConfig({
        mode: 'custom',
        provider: firstGroup.id,
        model: firstModel,
        reasoningEffort: undefined,
      })
    } else {
      data.setModelConfig({
        ...data.modelConfig,
        mode,
      })
    }
  }

  const handleProviderChange = (providerId: string) => {
    const group = data.providers.find((g) => g.id === providerId)
    const firstModel = group?.models?.[0]?.id || ''
    data.setModelConfig({
      ...data.modelConfig,
      provider: providerId,
      model: firstModel,
      reasoningEffort: undefined,
    })
  }

  const handleModelSelectChange = (modelId: string) => {
    const currentGroup = data.providers.find(
      (g) => g.id === data.modelConfig.provider,
    )
    const selectedModel = currentGroup?.models?.find((m) => m.id === modelId)
    const supportedEfforts = selectedModel?.reasoning?.efforts || []
    const isEffortValid =
      !data.modelConfig.reasoningEffort ||
      supportedEfforts.some(
        (eff) => eff.id === data.modelConfig.reasoningEffort,
      )

    data.setModelConfig({
      ...data.modelConfig,
      model: modelId,
      reasoningEffort: isEffortValid
        ? data.modelConfig.reasoningEffort
        : undefined,
    })
  }

  const handleReasoningEffortChange = (effortId: string) => {
    data.setModelConfig({
      ...data.modelConfig,
      reasoningEffort: effortId || undefined,
    })
  }

  // MCP change handlers
  const handleMcpModeChange = (mode: SessionMcpMode) => {
    data.setSaveSuccessMsg('')
    data.setError('')
    if (
      mode === 'custom' &&
      (!data.mcpConfig.enabledServerIds ||
        data.mcpConfig.enabledServerIds.length === 0)
    ) {
      const initialIds = data.availableMcpServers
        .filter((s) => s.enabledByDefault)
        .map((s) => s.id)
      data.setMcpConfig({
        ...data.mcpConfig,
        mode: 'custom',
        enabledServerIds:
          initialIds.length > 0
            ? initialIds
            : data.availableMcpServers.map((s) => s.id),
      })
    } else {
      data.setMcpConfig({
        ...data.mcpConfig,
        mode,
      })
    }
  }

  const handleToggleMcpServer = (serverId: string) => {
    data.setSaveSuccessMsg('')
    data.setError('')
    const currentIds = data.mcpConfig.enabledServerIds || []
    const nextIds = currentIds.includes(serverId)
      ? currentIds.filter((id) => id !== serverId)
      : [...currentIds, serverId]
    data.setMcpConfig({
      ...data.mcpConfig,
      enabledServerIds: nextIds,
    })
  }

  const handleToggleSelectAllMcp = () => {
    const isAll =
      data.availableMcpServers.length > 0 &&
      data.availableMcpServers.every((s) =>
        (data.mcpConfig.enabledServerIds || []).includes(s.id),
      )
    data.setMcpConfig({
      ...data.mcpConfig,
      enabledServerIds: isAll ? [] : data.availableMcpServers.map((s) => s.id),
    })
  }

  // Session tools modal handlers
  const handleOpenSessionToolsModal = async (server: GlobalMcpServerConfig) => {
    data.setSessionToolsModalServer(server)
    const currentToolsMode = data.mcpConfig.toolsMode?.[server.id] || 'default'
    data.setSessionToolsMode(currentToolsMode)
    data.setSessionDisabledToolsSet(
      new Set(
        data.mcpConfig.disabledTools?.[server.id] || server.disabledTools || [],
      ),
    )
    data.setSessionToolsSearch('')
    data.setSessionToolsExpandedSchemas(new Set())
    data.setSessionToolSchemaModes({})

    if (Array.isArray(server.toolDetails) && server.toolDetails.length > 0) {
      data.setSessionToolsList(server.toolDetails)
      return
    }

    data.setSessionToolsFetching(true)
    try {
      const res = await fetch('/api/mcp-servers?action=tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tools', server }),
      })
      const resData = await res.json()
      if (resData.ok) {
        const fetchedTools: McpDiscoveredTool[] = Array.isArray(
          resData.toolDetails,
        )
          ? resData.toolDetails
          : Array.isArray(resData.tools)
            ? resData.tools.map((t: any) =>
                typeof t === 'string' ? { name: t } : t,
              )
            : []
        data.setSessionToolsList(fetchedTools)
      }
    } catch {
      data.setSessionToolsList([])
    } finally {
      data.setSessionToolsFetching(false)
    }
  }

  const handleFetchSessionTools = async () => {
    if (!data.sessionToolsModalServer) return
    data.setSessionToolsFetching(true)
    try {
      const res = await fetch('/api/mcp-servers?action=tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'tools',
          server: data.sessionToolsModalServer,
        }),
      })
      const resData = await res.json()
      if (resData.ok) {
        const fetchedTools: McpDiscoveredTool[] = Array.isArray(
          resData.toolDetails,
        )
          ? resData.toolDetails
          : Array.isArray(resData.tools)
            ? resData.tools.map((t: any) =>
                typeof t === 'string' ? { name: t } : t,
              )
            : []
        data.setSessionToolsList(fetchedTools)
      }
    } catch {
      data.setSessionToolsList([])
    } finally {
      data.setSessionToolsFetching(false)
    }
  }

  const handleToggleSessionTool = (toolName: string) => {
    data.setSessionDisabledToolsSet((prev) => {
      const next = new Set(prev)
      if (next.has(toolName)) next.delete(toolName)
      else next.add(toolName)
      return next
    })
  }

  const handleToggleAllSessionTools = (enableAll: boolean) => {
    if (enableAll) {
      data.setSessionDisabledToolsSet(new Set())
    } else {
      data.setSessionDisabledToolsSet(
        new Set(data.sessionToolsList.map((t) => t.name)),
      )
    }
  }

  const handleResetSessionToolsToDefault = () => {
    data.setSessionDisabledToolsSet(
      new Set(data.sessionToolsModalServer?.disabledTools || []),
    )
  }

  const handleToggleSessionSchema = (toolName: string) => {
    data.setSessionToolsExpandedSchemas((prev) => {
      const next = new Set(prev)
      if (next.has(toolName)) next.delete(toolName)
      else next.add(toolName)
      return next
    })
  }

  const handleApplySessionTools = () => {
    if (!data.sessionToolsModalServer) return
    const serverId = data.sessionToolsModalServer.id
    const nextToolsMode = { ...(data.mcpConfig.toolsMode || {}) }
    const nextDisabledTools = { ...(data.mcpConfig.disabledTools || {}) }

    nextToolsMode[serverId] = data.sessionToolsMode
    if (data.sessionToolsMode === 'custom') {
      nextDisabledTools[serverId] = Array.from(data.sessionDisabledToolsSet)
    } else {
      delete nextDisabledTools[serverId]
    }

    const currentEnabled = data.mcpConfig.enabledServerIds || []
    const nextEnabled = currentEnabled.includes(serverId)
      ? currentEnabled
      : [...currentEnabled, serverId]

    data.setMcpConfig({
      ...data.mcpConfig,
      enabledServerIds: nextEnabled,
      toolsMode: nextToolsMode,
      disabledTools: nextDisabledTools,
    })
    data.setSessionToolsModalServer(null)
  }

  // Skills change handlers
  const defaultDisabledModelSkills =
    data.defaultSettings?.skills?.disabledModelSkills ||
    data.defaultSettings?.skills?.disabledSkills ||
    []
  const defaultDisabledUserSkills =
    data.defaultSettings?.skills?.disabledUserSkills || []

  const workspaceDisabledModelSkills =
    data.workspaceSettings?.skills?.mode === 'custom'
      ? data.workspaceSettings.skills.disabledModelSkills ||
        data.workspaceSettings.skills.disabledSkills ||
        []
      : defaultDisabledModelSkills
  const workspaceDisabledUserSkills =
    data.workspaceSettings?.skills?.mode === 'custom'
      ? data.workspaceSettings.skills.disabledUserSkills || []
      : defaultDisabledUserSkills

  const effectiveDisabledModelList =
    data.skillsConfig.mode === 'custom'
      ? data.skillsConfig.disabledModelSkills ||
        data.skillsConfig.disabledSkills ||
        []
      : data.skillsConfig.mode === 'workspace'
        ? workspaceDisabledModelSkills
        : defaultDisabledModelSkills

  const effectiveDisabledUserList =
    data.skillsConfig.mode === 'custom'
      ? data.skillsConfig.disabledUserSkills || []
      : data.skillsConfig.mode === 'workspace'
        ? workspaceDisabledUserSkills
        : defaultDisabledUserSkills

  const effectiveDisabledModelSet = new Set(effectiveDisabledModelList)
  const effectiveDisabledUserSet = new Set(effectiveDisabledUserList)

  const effectiveActiveSkillsCount = data.availableSkills.filter(
    (s) => !effectiveDisabledModelSet.has(s.name),
  ).length

  const handleSkillsModeChange = (mode: SessionSkillsMode) => {
    data.setSaveSuccessMsg('')
    data.setError('')
    data.setSkillsConfig({
      ...data.skillsConfig,
      mode,
      disabledSkills:
        mode === 'custom'
          ? data.skillsConfig.disabledSkills || []
          : mode === 'workspace'
            ? data.workspaceSettings?.skills?.mode === 'custom'
              ? data.workspaceSettings.skills.disabledSkills || []
              : []
            : [],
      disabledModelSkills:
        mode === 'custom'
          ? data.skillsConfig.disabledModelSkills ||
            data.skillsConfig.disabledSkills ||
            []
          : mode === 'workspace'
            ? data.workspaceSettings?.skills?.mode === 'custom'
              ? data.workspaceSettings.skills.disabledModelSkills ||
                data.workspaceSettings.skills.disabledSkills ||
                []
              : []
            : [],
      disabledUserSkills:
        mode === 'custom'
          ? data.skillsConfig.disabledUserSkills || []
          : mode === 'workspace'
            ? data.workspaceSettings?.skills?.mode === 'custom'
              ? data.workspaceSettings.skills.disabledUserSkills || []
              : []
            : [],
    })
  }

  const handleToggleModelInvocable = (skillName: string) => {
    data.setSaveSuccessMsg('')
    data.setError('')
    const curModel =
      data.skillsConfig.mode === 'custom'
        ? data.skillsConfig.disabledModelSkills ||
          data.skillsConfig.disabledSkills ||
          []
        : effectiveDisabledModelList
    const curUser =
      data.skillsConfig.mode === 'custom'
        ? data.skillsConfig.disabledUserSkills || []
        : effectiveDisabledUserList
    const nextModel = curModel.includes(skillName)
      ? curModel.filter((n) => n !== skillName)
      : [...curModel, skillName]
    data.setSkillsConfig({
      ...data.skillsConfig,
      mode: 'custom',
      disabledSkills: nextModel,
      disabledModelSkills: nextModel,
      disabledUserSkills: curUser,
    })
  }

  const handleToggleUserInvocable = (skillName: string) => {
    data.setSaveSuccessMsg('')
    data.setError('')
    const curModel =
      data.skillsConfig.mode === 'custom'
        ? data.skillsConfig.disabledModelSkills ||
          data.skillsConfig.disabledSkills ||
          []
        : effectiveDisabledModelList
    const curUser =
      data.skillsConfig.mode === 'custom'
        ? data.skillsConfig.disabledUserSkills || []
        : effectiveDisabledUserList
    const nextUser = curUser.includes(skillName)
      ? curUser.filter((n) => n !== skillName)
      : [...curUser, skillName]
    data.setSkillsConfig({
      ...data.skillsConfig,
      mode: 'custom',
      disabledSkills: curModel,
      disabledModelSkills: curModel,
      disabledUserSkills: nextUser,
    })
  }

  const handleOpenSessionSkillModal = async (skill: SkillItem) => {
    data.setSessionSkillModalTarget(skill)
    const skillName = skill.name
    if (!data.skillsContentMap[skillName] && !skill.content) {
      data.setSkillsLoadingMap((prev) => ({ ...prev, [skillName]: true }))
      try {
        const url = sessionId
          ? `/api/session-settings/skills/content?name=${encodeURIComponent(skillName)}&sessionId=${encodeURIComponent(sessionId)}`
          : `/api/session-settings/skills/content?name=${encodeURIComponent(skillName)}`
        const res = await fetch(url)
        if (res.ok) {
          const resData = await res.json()
          if (resData?.ok && resData.skill) {
            data.setSkillsContentMap((prev) => ({
              ...prev,
              [skillName]: resData.skill,
            }))
          } else {
            data.setSkillsContentMap((prev) => ({
              ...prev,
              [skillName]: {
                ...skill,
                content: '（暂未获取到该技能的详细指令内容）',
              },
            }))
          }
        } else {
          data.setSkillsContentMap((prev) => ({
            ...prev,
            [skillName]: {
              ...skill,
              content: '（加载技能详细指令失败）',
            },
          }))
        }
      } catch (err: any) {
        data.setSkillsContentMap((prev) => ({
          ...prev,
          [skillName]: {
            ...skill,
            content: `（加载出错: ${err?.message || String(err)}）`,
          },
        }))
      } finally {
        data.setSkillsLoadingMap((prev) => ({ ...prev, [skillName]: false }))
      }
    }
  }

  const handleRefreshSkills = async () => {
    data.setRefreshingSkills(true)
    try {
      const url = sessionId
        ? `/api/session-settings?sessionId=${encodeURIComponent(sessionId)}`
        : '/api/session-settings'
      const res = await fetch(url)
      if (res.ok) {
        const resData = await res.json()
        if (resData?.ok && Array.isArray(resData.availableSkills)) {
          data.setAvailableSkills(resData.availableSkills)
        }
      }
    } catch {
      // ignore
    } finally {
      data.setRefreshingSkills(false)
    }
  }

  const effectiveActiveMcpCount =
    data.mcpConfig.mode === 'custom' || !sessionId
      ? (data.mcpConfig.enabledServerIds || []).length
      : data.mcpConfig.mode === 'workspace'
        ? data.workspaceSettings?.mcp?.mode === 'custom'
          ? (data.workspaceSettings.mcp.enabledServerIds || []).length
          : data.defaultSettings?.mcp?.mode === 'custom'
            ? (data.defaultSettings.mcp.enabledServerIds || []).length
            : data.availableMcpServers.filter((s) => s.enabledByDefault).length
        : data.defaultSettings?.mcp?.mode === 'custom'
          ? (data.defaultSettings.mcp.enabledServerIds || []).length
          : data.availableMcpServers.filter((s) => s.enabledByDefault).length

  return e(
    'div',
    {
      className: 'dsh-session-view-root',
      'data-session-settings-view': '',
      'data-conversation-composer-overlay': '',
    },
    // Top Header
    e(HeaderBar, {
      sessionId,
      copiedId: data.copiedId,
      currentWorkspaceId: data.currentWorkspaceId,
      currentWorkspaceTitle: data.currentWorkspaceTitle,
      currentWorkspace: data.currentWorkspace,
      hasSessionOverride: data.hasSessionOverride,
      cloneSourceId: data.cloneSourceId,
      cloning: data.cloning,
      onCloneSourceIdChange: data.setCloneSourceId,
      onCopySessionId: actions.handleCopySessionId,
      onClonePreset: actions.handleClonePreset,
      onClose,
      t,
    }),

    // Notifications
    data.saveSuccessMsg
      ? e(
          'div',
          { className: 'dsh-sam-notice success dsh-view-notice' },
          data.saveSuccessMsg,
        )
      : null,
    data.error || data.cloneError
      ? e(
          'div',
          { className: 'dsh-sam-notice error dsh-view-notice' },
          data.error || data.cloneError,
        )
      : null,

    // Main Split Body: Sub-sidebar + Content
    e(
      'div',
      { className: 'dsh-session-view-body' },
      // Left Sub-sidebar
      e(NavigationSidebar, {
        activeNav: data.activeNav,
        onNavChange: data.setActiveNav,
        modelConfig: data.modelConfig,
        effectiveActiveMcpCount,
        effectiveActiveSkillsCount,
        availableSkills: data.availableSkills,
        t,
      }),

      // Right Main Content Panel
      e(
        'div',
        { className: 'dsh-session-view-content' },
        data.activeNav === 'model'
          ? e(SubagentModelSection, {
              modelConfig: data.modelConfig,
              providers: data.providers,
              currentWorkspaceId: data.currentWorkspaceId,
              workspaceSettings: data.workspaceSettings,
              defaultSettings: data.defaultSettings,
              onModelModeChange: handleModelModeChange,
              onProviderChange: handleProviderChange,
              onModelSelectChange: handleModelSelectChange,
              onReasoningEffortChange: handleReasoningEffortChange,
              t,
            })
          : null,

        data.activeNav === 'mcp'
          ? e(SessionMcpSection, {
              sessionId,
              mcpConfig: data.mcpConfig,
              availableMcpServers: data.availableMcpServers,
              currentWorkspaceId: data.currentWorkspaceId,
              workspaceSettings: data.workspaceSettings,
              defaultSettings: data.defaultSettings,
              onMcpModeChange: handleMcpModeChange,
              onToggleMcpServer: handleToggleMcpServer,
              onToggleSelectAllMcp: handleToggleSelectAllMcp,
              onOpenSessionToolsModal: handleOpenSessionToolsModal,
              t,
            })
          : null,

        data.activeNav === 'skills'
          ? e(SessionSkillsSection, {
              skillsConfig: data.skillsConfig,
              availableSkills: data.availableSkills,
              currentWorkspaceId: data.currentWorkspaceId,
              workspaceSettings: data.workspaceSettings,
              defaultSettings: data.defaultSettings,
              skillsSearch: data.skillsSearch,
              refreshingSkills: data.refreshingSkills,
              effectiveDisabledModelSet,
              effectiveDisabledUserSet,
              onSkillsModeChange: handleSkillsModeChange,
              onSkillsSearchChange: data.setSkillsSearch,
              onRefreshSkills: handleRefreshSkills,
              onOpenSessionSkillModal: handleOpenSessionSkillModal,
              t,
            })
          : null,
      ),
    ),

    // Footer Actions
    e(
      'div',
      { className: 'dsh-session-view-footer' },
      e(
        'div',
        { className: 'dsh-view-footer-left' },
        sessionId && data.hasSessionOverride
          ? e(
              'button',
              {
                type: 'button',
                className: 'dsh-sam-btn tertiary',
                disabled: actions.saving || actions.savingDefault,
                onClick: actions.handleResetSession,
              },
              t('sessionSettings.action.reset'),
            )
          : null,
      ),
      e(
        'div',
        { className: 'dsh-view-footer-right' },
        e(
          'button',
          {
            type: 'button',
            className: 'dsh-sam-btn default-btn',
            disabled: actions.saving || actions.savingDefault,
            onClick: () => {
              data.setSetDefaultTargetScope(
                data.currentWorkspaceId ? 'workspace' : 'global',
              )
              data.setIsRestoringDefault(false)
              data.setSetDefaultModalOpen(true)
            },
          },
          t('sessionSettings.action.setDefault'),
        ),
        e(
          'button',
          {
            type: 'button',
            className: 'dsh-sam-btn primary',
            disabled: actions.saving || actions.savingDefault,
            onClick: () => actions.handleSave(false),
          },
          actions.saving
            ? t('sessionSettings.action.saving')
            : sessionId
              ? t('sessionSettings.action.saveSession')
              : t('sessionSettings.action.save'),
        ),
      ),
    ),

    // Set as Default Modal
    e(SetDefaultModal, {
      open: data.setDefaultModalOpen,
      setDefaultTargetScope: data.setDefaultTargetScope,
      setSetDefaultTargetScope: data.setSetDefaultTargetScope,
      isRestoringDefault: data.isRestoringDefault,
      setIsRestoringDefault: data.setIsRestoringDefault,
      currentWorkspaceId: data.currentWorkspaceId,
      currentWorkspaceTitle: data.currentWorkspaceTitle,
      currentWorkspace: data.currentWorkspace,
      workspaceSettings: data.workspaceSettings,
      defaultSettings: data.defaultSettings,
      modelConfig: data.modelConfig,
      mcpConfig: data.mcpConfig,
      skillsConfig: data.skillsConfig,
      savingDefault: actions.savingDefault,
      onClose: () => data.setSetDefaultModalOpen(false),
      onApply: () =>
        actions.handleApplySetDefault(
          data.setDefaultTargetScope,
          data.isRestoringDefault,
        ),
      t,
    }),

    // Session Tools Modal
    e(SessionMcpToolsModal, {
      server: data.sessionToolsModalServer,
      toolsMode: data.sessionToolsMode,
      disabledToolsSet: data.sessionDisabledToolsSet,
      search: data.sessionToolsSearch,
      expandedSchemas: data.sessionToolsExpandedSchemas,
      schemaModes: data.sessionToolSchemaModes,
      fetching: data.sessionToolsFetching,
      toolsList: data.sessionToolsList,
      onToolsModeChange: (val) => {
        data.setSessionToolsMode(val)
        if (val === 'default') {
          data.setSessionDisabledToolsSet(
            new Set(data.sessionToolsModalServer?.disabledTools || []),
          )
        }
      },
      onSearchChange: data.setSessionToolsSearch,
      onToggleTool: handleToggleSessionTool,
      onToggleAllTools: handleToggleAllSessionTools,
      onResetToDefault: handleResetSessionToolsToDefault,
      onToggleSchema: handleToggleSessionSchema,
      onSchemaModeChange: (toolName, mode) =>
        data.setSessionToolSchemaModes((prev) => ({
          ...prev,
          [toolName]: mode,
        })),
      onFetchTools: handleFetchSessionTools,
      onClose: () => data.setSessionToolsModalServer(null),
      onApply: handleApplySessionTools,
      t,
    }),

    // Session Skill Detail Modal
    e(SessionSkillDetailModal, {
      skill: data.sessionSkillModalTarget,
      detail: data.sessionSkillModalTarget
        ? data.skillsContentMap[data.sessionSkillModalTarget.name] ||
          data.sessionSkillModalTarget
        : null,
      skillsConfig: data.skillsConfig,
      isModelDisabled: data.sessionSkillModalTarget
        ? effectiveDisabledModelSet.has(data.sessionSkillModalTarget.name)
        : false,
      isUserDisabled: data.sessionSkillModalTarget
        ? effectiveDisabledUserSet.has(data.sessionSkillModalTarget.name)
        : false,
      loadingContent: data.sessionSkillModalTarget
        ? Boolean(data.skillsLoadingMap[data.sessionSkillModalTarget.name])
        : false,
      onToggleModelInvocable: handleToggleModelInvocable,
      onToggleUserInvocable: handleToggleUserInvocable,
      onSkillsModeChange: (mode) => handleSkillsModeChange(mode),
      onClose: () => data.setSessionSkillModalTarget(null),
      t,
    }),
  )
}

export default SessionSettingsViewPage
