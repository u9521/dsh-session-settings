import * as React from 'react'
import {
  type ClientPageProps,
  type GlobalMcpServerConfig,
  type SkillItem,
  type McpDiscoveredTool,
  type SubagentModelMode,
  type SessionMcpMode,
  type SessionSkillsMode,
  API_ENDPOINTS,
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
import { SkillDetailModal } from '../skills/components/SkillDetailModal.ts'

export * from './sections/HeaderBar.ts'
export * from './sections/NavigationSidebar.ts'
export * from './sections/SubagentModelSection.ts'
export * from './sections/SessionMcpSection.ts'
export * from './sections/SessionSkillsSection.ts'
export * from './modals/SetDefaultModal.ts'
export * from './modals/SessionMcpToolsModal.ts'

const e = React.createElement

export function SessionSettingsViewPage(props: ClientPageProps) {
  const { t, sessionId, onClose, onSave } = props

  const data = useSessionData(props)
  const actions = useSessionActions({
    sessionId,
    currentWorkspaceId: data.currentWorkspaceId,
    currentWorkspaceTitle: data.currentWorkspaceTitle,
    modelConfig: data.modelConfig,
    mcpConfig: data.mcpConfig,
    skillsConfig: data.skillsConfig,
    globalConfig: data.globalConfig,
    setModelConfig: data.setModelConfig,
    setMcpConfig: data.setMcpConfig,
    setSkillsConfig: data.setSkillsConfig,
    setGlobalConfig: data.setGlobalConfig,
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
    if (mode === 'workspace') {
      data.setModelConfig({ mode: 'workspace' })
    } else if (mode === 'global') {
      data.setModelConfig({ mode: 'global' })
    } else if (mode === 'inherit') {
      data.setModelConfig({ mode: 'custom', inherit: true })
    } else if (mode === 'custom') {
      if (data.modelConfig.model?.provider && data.modelConfig.model?.model) {
        data.setModelConfig({
          mode: 'custom',
          inherit: false,
          model: data.modelConfig.model,
        })
      } else if (data.providers.length > 0) {
        const firstGroup = data.providers[0]
        const firstModel = firstGroup.models?.[0]?.id || ''
        data.setModelConfig({
          mode: 'custom',
          inherit: false,
          model: {
            provider: firstGroup.id,
            model: firstModel,
            reasoningEffort: undefined,
          },
        })
      } else {
        data.setModelConfig({
          mode: 'custom',
          inherit: true,
        })
      }
    }
  }

  const handleProviderChange = (providerId: string) => {
    const group = data.providers.find((g) => g.id === providerId)
    const firstModel = group?.models?.[0]?.id || ''
    data.setModelConfig({
      mode: 'custom',
      inherit: false,
      model: {
        provider: providerId,
        model: firstModel,
        reasoningEffort: undefined,
      },
    })
  }

  const handleModelSelectChange = (modelId: string) => {
    const currentProvider = data.modelConfig.model?.provider || ''
    const currentGroup = data.providers.find((g) => g.id === currentProvider)
    const selectedModel = currentGroup?.models?.find((m) => m.id === modelId)
    const supportedEfforts = selectedModel?.reasoning?.efforts || []
    const isEffortValid =
      !data.modelConfig.model?.reasoningEffort ||
      supportedEfforts.some(
        (eff) => eff.id === data.modelConfig.model?.reasoningEffort,
      )

    data.setModelConfig({
      mode: 'custom',
      inherit: false,
      model: {
        provider: currentProvider,
        model: modelId,
        reasoningEffort: isEffortValid
          ? data.modelConfig.model?.reasoningEffort
          : undefined,
      },
    })
  }

  const handleReasoningEffortChange = (effortId: string) => {
    if (!data.modelConfig.model) return
    data.setModelConfig({
      mode: 'custom',
      inherit: false,
      model: {
        ...data.modelConfig.model,
        reasoningEffort: effortId || undefined,
      },
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
    const currentToolsMode = data.mcpConfig.toolsMode?.[server.id] || 'global'
    data.setSessionToolsMode(currentToolsMode)
    data.setSessionDisabledToolsSet(
      new Set(
        data.mcpConfig.disabledTools?.[server.id] ||
          (Array.isArray(server.disabledTools) ? server.disabledTools : []),
      ),
    )

    // Reset previous server's tools and error immediately
    data.setSessionToolsList([])
    data.setSessionToolsError('')
    data.setSessionToolsFetching(true)

    // 1. Try to read cached toolview first
    try {
      const res = await fetch(
        `${API_ENDPOINTS.mcpServersToolview}?id=${encodeURIComponent(server.id)}`,
      )
      const resData = await res.json()
      if (resData.ok) {
        const cachedTools: McpDiscoveredTool[] = Array.isArray(
          resData.toolDetails,
        )
          ? (resData.toolDetails as McpDiscoveredTool[])
          : Array.isArray(resData.tools)
            ? (resData.tools as unknown[]).map((t) =>
                typeof t === 'string' ? { name: t } : (t as McpDiscoveredTool),
              )
            : []
        if (cachedTools.length > 0) {
          data.setSessionToolsList(cachedTools)
          data.setSessionToolsFetching(false)
          return
        }
      }
    } catch {
      // If toolview failed, continue to live tools discovery
    }

    // 2. If no cached tools were found, live discover tools
    try {
      const res = await fetch(API_ENDPOINTS.mcpServersTools, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server }),
      })
      const resData = await res.json()
      if (resData.ok) {
        const fetchedTools: McpDiscoveredTool[] = Array.isArray(
          resData.toolDetails,
        )
          ? (resData.toolDetails as McpDiscoveredTool[])
          : Array.isArray(resData.tools)
            ? (resData.tools as unknown[]).map((t) =>
                typeof t === 'string' ? { name: t } : (t as McpDiscoveredTool),
              )
            : []
        data.setSessionToolsList(fetchedTools)
        data.setSessionToolsError('')
        data.setAvailableMcpServers((prev) =>
          prev.map((s) =>
            s.id === server.id
              ? {
                  ...s,
                  toolDetails: fetchedTools,
                  tools: fetchedTools.length,
                  detectedTransport:
                    resData.detectedTransport || s.detectedTransport,
                  serverInfo: resData.serverInfo || s.serverInfo,
                }
              : s,
          ),
        )
      } else {
        data.setSessionToolsList([])
        data.setSessionToolsError(
          resData.message ||
            resData.error ||
            t('sessionSettings.toolsModal.fetchFailed'),
        )
      }
    } catch (err: unknown) {
      data.setSessionToolsList([])
      data.setSessionToolsError(
        err instanceof Error ? err.message : String(err),
      )
    } finally {
      data.setSessionToolsFetching(false)
    }
  }

  const handleFetchSessionTools = async () => {
    if (!data.sessionToolsModalServer) return
    const server = data.sessionToolsModalServer
    data.setSessionToolsFetching(true)
    data.setSessionToolsError('')
    try {
      const res = await fetch(API_ENDPOINTS.mcpServersTools, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server }),
      })
      const resData = await res.json()
      if (resData.ok) {
        const fetchedTools: McpDiscoveredTool[] = Array.isArray(
          resData.toolDetails,
        )
          ? (resData.toolDetails as McpDiscoveredTool[])
          : Array.isArray(resData.tools)
            ? (resData.tools as unknown[]).map((t) =>
                typeof t === 'string' ? { name: t } : (t as McpDiscoveredTool),
              )
            : []
        data.setSessionToolsList(fetchedTools)
        data.setSessionToolsError('')
        data.setAvailableMcpServers((prev) =>
          prev.map((s) =>
            s.id === server.id
              ? {
                  ...s,
                  toolDetails: fetchedTools,
                  tools: fetchedTools.length,
                  detectedTransport:
                    resData.detectedTransport || s.detectedTransport,
                  serverInfo: resData.serverInfo || s.serverInfo,
                }
              : s,
          ),
        )
      } else {
        data.setSessionToolsList([])
        data.setSessionToolsError(
          resData.message ||
            resData.error ||
            t('sessionSettings.toolsModal.fetchFailed'),
        )
      }
    } catch (err: unknown) {
      data.setSessionToolsList([])
      data.setSessionToolsError(
        err instanceof Error ? err.message : String(err),
      )
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
        new Set(
          data.sessionToolsList
            .map((t) => t.name)
            .filter((n): n is string => typeof n === 'string' && Boolean(n)),
        ),
      )
    }
  }

  const handleResetSessionToolsToDefault = () => {
    data.setSessionDisabledToolsSet(
      new Set(
        Array.isArray(data.sessionToolsModalServer?.disabledTools)
          ? data.sessionToolsModalServer.disabledTools
          : [],
      ),
    )
  }

  const handleCloseSessionToolsModal = () => {
    data.setSessionToolsModalServer(null)
    data.setSessionToolsList([])
    data.setSessionToolsError('')
    data.setSessionToolsFetching(false)
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
    handleCloseSessionToolsModal()
  }

  // Skills change handlers
  const defaultDisabledModelSkills =
    data.globalConfig?.skills?.disabledModelSkills || []
  const defaultDisabledUserSkills =
    data.globalConfig?.skills?.disabledUserSkills || []

  const workspaceDisabledModelSkills =
    data.workspaceSettings?.skills?.mode === 'custom'
      ? data.workspaceSettings.skills.disabledModelSkills || []
      : defaultDisabledModelSkills
  const workspaceDisabledUserSkills =
    data.workspaceSettings?.skills?.mode === 'custom'
      ? data.workspaceSettings.skills.disabledUserSkills || []
      : defaultDisabledUserSkills

  const effectiveDisabledModelList =
    data.skillsConfig.mode === 'custom'
      ? data.skillsConfig.disabledModelSkills || []
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
      disabledModelSkills:
        mode === 'custom'
          ? data.skillsConfig.disabledModelSkills || []
          : mode === 'workspace'
            ? data.workspaceSettings?.skills?.mode === 'custom'
              ? data.workspaceSettings.skills.disabledModelSkills || []
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

  const handleSaveSessionSkillModal = (
    skillName: string,
    modelDisabled: boolean,
    userDisabled: boolean,
  ) => {
    data.setSaveSuccessMsg('')
    data.setError('')
    const curModel =
      data.skillsConfig.mode === 'custom'
        ? data.skillsConfig.disabledModelSkills || []
        : effectiveDisabledModelList
    const curUser =
      data.skillsConfig.mode === 'custom'
        ? data.skillsConfig.disabledUserSkills || []
        : effectiveDisabledUserList

    const nextModel = modelDisabled
      ? Array.from(new Set([...curModel, skillName]))
      : curModel.filter((n) => n !== skillName)
    const nextUser = userDisabled
      ? Array.from(new Set([...curUser, skillName]))
      : curUser.filter((n) => n !== skillName)

    data.setSkillsConfig({
      ...data.skillsConfig,
      mode: 'custom',
      disabledModelSkills: nextModel,
      disabledUserSkills: nextUser,
    })
    data.setSessionSkillModalTarget(null)
  }

  const handleOpenSessionSkillModal = async (skill: SkillItem) => {
    data.setSessionSkillModalTarget(skill)
    const skillName = skill.name
    if (!data.skillsContentMap[skillName] && !skill.content) {
      data.setSkillsLoadingMap((prev) => ({ ...prev, [skillName]: true }))
      try {
        const url = sessionId
          ? `${API_ENDPOINTS.skillsContent}?name=${encodeURIComponent(skillName)}&sessionId=${encodeURIComponent(sessionId)}`
          : `${API_ENDPOINTS.skillsContent}?name=${encodeURIComponent(skillName)}`
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
                content: t('sessionSettings.skills.noContent'),
              },
            }))
          }
        } else {
          data.setSkillsContentMap((prev) => ({
            ...prev,
            [skillName]: {
              ...skill,
              content: t('sessionSettings.skills.loadError'),
            },
          }))
        }
      } catch (err: unknown) {
        data.setSkillsContentMap((prev) => ({
          ...prev,
          [skillName]: {
            ...skill,
            content: t('sessionSettings.skills.loadErrorWithReason', {
              reason: err instanceof Error ? err.message : String(err),
            }),
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
        ? `${API_ENDPOINTS.skills}?sessionId=${encodeURIComponent(sessionId)}`
        : API_ENDPOINTS.skills
      const res = await fetch(url)
      if (res.ok) {
        const resData = await res.json()
        if (resData?.ok && Array.isArray(resData.skills)) {
          data.setAvailableSkills(resData.skills)
        }
      }
    } catch {
      // ignore
    } finally {
      data.setRefreshingSkills(false)
    }
  }

  const defaultActiveMcpCount =
    data.globalConfig?.mcp?.enabledServerIds?.length ??
    data.availableMcpServers.filter((s) => s.enabledByDefault).length

  const effectiveActiveMcpCount =
    data.mcpConfig.mode === 'custom' || !sessionId
      ? (data.mcpConfig.enabledServerIds || []).length
      : data.mcpConfig.mode === 'workspace' &&
          data.workspaceSettings?.mcp?.mode === 'custom'
        ? (data.workspaceSettings.mcp.enabledServerIds || []).length
        : defaultActiveMcpCount

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
      currentWorkspace: data.currentWorkspace || undefined,
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
              loadingModels: data.loadingModels,
              currentWorkspaceId: data.currentWorkspaceId,
              workspaceSettings: data.workspaceSettings,
              globalConfig: data.globalConfig,
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
              globalConfig: data.globalConfig,
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
              globalConfig: data.globalConfig,
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
            onClick: () => actions.handleSave(),
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
      currentWorkspace: data.currentWorkspace || undefined,
      workspaceSettings: data.workspaceSettings,
      globalConfig: data.globalConfig,
      modelConfig: data.modelConfig,
      mcpConfig: data.mcpConfig,
      skillsConfig: data.skillsConfig,
      availableSkills: data.availableSkills,
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
      fetching: data.sessionToolsFetching,
      error: data.sessionToolsError,
      toolsList: data.sessionToolsList as McpDiscoveredTool[],
      onToolsModeChange: (val) => {
        data.setSessionToolsMode(val)
        if (val === 'global') {
          data.setSessionDisabledToolsSet(
            new Set(
              Array.isArray(data.sessionToolsModalServer?.disabledTools)
                ? data.sessionToolsModalServer.disabledTools
                : [],
            ),
          )
        }
      },
      onToggleTool: handleToggleSessionTool,
      onToggleAllTools: handleToggleAllSessionTools,
      onResetToDefault: handleResetSessionToolsToDefault,
      onFetchTools: handleFetchSessionTools,
      onClose: handleCloseSessionToolsModal,
      onApply: handleApplySessionTools,
      t,
    }),

    // Skill Detail Modal
    e(SkillDetailModal, {
      skill: data.sessionSkillModalTarget,
      detail: data.sessionSkillModalTarget
        ? data.skillsContentMap[data.sessionSkillModalTarget.name] ||
          data.sessionSkillModalTarget
        : null,
      isModelDisabled: data.sessionSkillModalTarget
        ? effectiveDisabledModelSet.has(data.sessionSkillModalTarget.name)
        : false,
      isUserDisabled: data.sessionSkillModalTarget
        ? effectiveDisabledUserSet.has(data.sessionSkillModalTarget.name)
        : false,
      loadingContent: data.sessionSkillModalTarget
        ? Boolean(data.skillsLoadingMap[data.sessionSkillModalTarget.name])
        : false,
      isSessionContext: true,
      onSave: handleSaveSessionSkillModal,
      onClose: () => data.setSessionSkillModalTarget(null),
      t,
    }),
  )
}

export default SessionSettingsViewPage
