import * as React from 'react'
import {
  type ClientPageProps,
  type GlobalMcpServerConfig,
  type SkillItem,
  type McpDiscoveredTool,
  type SubagentModelMode,
  type SessionMcpMode,
  type SessionSkillsMode,
  type SubagentModelConfig,
  type SessionMcpConfig,
  type SessionSkillsConfig,
  API_ENDPOINTS,
} from '../types/index.ts'
import { useSessionData } from './hooks/useSessionData.ts'
import { useSessionActions } from './hooks/useSessionActions.ts'
import { HeaderBar } from './sections/HeaderBar.ts'
import { NavigationSidebar } from './sections/NavigationSidebar.ts'
import { SubagentModelSection } from './sections/SubagentModelSection.ts'
import { SessionMcpSection } from './sections/SessionMcpSection.ts'
import { SessionSkillsSection } from './sections/SessionSkillsSection.ts'
import { SessionMcpToolsModal } from './modals/SessionMcpToolsModal.ts'
import { McpResourcePanel } from '../mcp/components/McpResourcePanel.ts'
import { McpPromptPanel } from '../mcp/components/McpPromptPanel.ts'
import type { McpPrimitiveTab } from '../mcp/components/McpPrimitivesTabs.ts'
import { useMcpPrimitives } from '../mcp/hooks/useMcpPrimitives.ts'
import type { McpDiscovery } from '../mcp/hooks/useMcpPrimitives.ts'
import { useCopyFeedback } from '../mcp/hooks/useCopyFeedback.ts'
import { SkillDetailModal } from '../skills/components/SkillDetailModal.ts'

export * from './sections/HeaderBar.ts'
export * from './sections/NavigationSidebar.ts'
export * from './sections/SubagentModelSection.ts'
export * from './sections/SessionMcpSection.ts'
export * from './sections/SessionSkillsSection.ts'
export * from './modals/SessionMcpToolsModal.ts'

const e = React.createElement

export function SessionSettingsViewPage(props: ClientPageProps) {
  const { t, sessionId, onClose, onSave } = props

  const data = useSessionData(props)

  // A session-scope edit needs a live session to write to. Without one the tab
  // disables itself and the page explains why, rather than retargeting the save
  // to a scope the user did not choose.
  const canEditSessionScope = Boolean(sessionId)
  const canEditWorkspaceScope = Boolean(data.currentWorkspaceId)
  const actions = useSessionActions({
    sessionId,
    currentWorkspaceId: data.currentWorkspaceId,
    currentWorkspaceTitle: data.currentWorkspaceTitle,
    modelConfig: data.modelConfig,
    mcpConfig: data.mcpConfig,
    skillsConfig: data.skillsConfig,
    workspaceModelConfig: data.workspaceModelConfig,
    workspaceMcpConfig: data.workspaceMcpConfig,
    workspaceSkillsConfig: data.workspaceSkillsConfig,
    globalModelConfig: data.globalModelConfig,
    globalMcpConfig: data.globalMcpConfig,
    globalSkillsConfig: data.globalSkillsConfig,
    setModelConfig: data.setModelConfig,
    setMcpConfig: data.setMcpConfig,
    setSkillsConfig: data.setSkillsConfig,
    setWorkspaceModelConfig: data.setWorkspaceModelConfig,
    setWorkspaceMcpConfig: data.setWorkspaceMcpConfig,
    setWorkspaceSkillsConfig: data.setWorkspaceSkillsConfig,
    setGlobalModelConfig: data.setGlobalModelConfig,
    setGlobalMcpConfig: data.setGlobalMcpConfig,
    setGlobalSkillsConfig: data.setGlobalSkillsConfig,
    setGlobalConfig: data.setGlobalConfig,
    setWorkspaceSettings: data.setWorkspaceSettings,
    setHasSessionOverride: data.setHasSessionOverride,
    setSaveSuccessMsg: data.setSaveSuccessMsg,
    setError: data.setError,
    setCopiedId: data.setCopiedId,
    sessionsMap: data.sessionsMap,
    reloadMcpServers: data.reloadMcpServers,
    onSave,
    t,
  })

  const [sessionToolsReadonly, setSessionToolsReadonly] =
    React.useState<boolean>(false)
  const [sessionSkillReadonly, setSessionSkillReadonly] =
    React.useState<boolean>(false)

  // Dynamic getters & setters according to current active scope
  const currentModelConfig: SubagentModelConfig =
    data.activeScope === 'global'
      ? data.globalModelConfig
      : data.activeScope === 'workspace'
        ? data.workspaceModelConfig
        : data.modelConfig

  const setCurrentModelConfig = (cfg: SubagentModelConfig) => {
    if (data.activeScope === 'global') {
      data.setGlobalModelConfig(cfg)
    } else if (data.activeScope === 'workspace') {
      data.setWorkspaceModelConfig(cfg)
    } else {
      data.setModelConfig(cfg)
    }
  }

  const currentMcpConfig: SessionMcpConfig =
    data.activeScope === 'global'
      ? data.globalMcpConfig
      : data.activeScope === 'workspace'
        ? data.workspaceMcpConfig
        : data.mcpConfig

  const setCurrentMcpConfig = (cfg: SessionMcpConfig) => {
    if (data.activeScope === 'global') {
      data.setGlobalMcpConfig(cfg)
    } else if (data.activeScope === 'workspace') {
      data.setWorkspaceMcpConfig(cfg)
    } else {
      data.setMcpConfig(cfg)
    }
  }

  const currentSkillsConfig: SessionSkillsConfig =
    data.activeScope === 'global'
      ? data.globalSkillsConfig
      : data.activeScope === 'workspace'
        ? data.workspaceSkillsConfig
        : data.skillsConfig

  const setCurrentSkillsConfig = (cfg: SessionSkillsConfig) => {
    if (data.activeScope === 'global') {
      data.setGlobalSkillsConfig(cfg)
    } else if (data.activeScope === 'workspace') {
      data.setWorkspaceSkillsConfig(cfg)
    } else {
      data.setSkillsConfig(cfg)
    }
  }

  // Runtime status of the official MCP clients does not change on its own —
  // re-read it whenever the MCP section becomes active.
  React.useEffect(() => {
    if (data.activeNav === 'mcp') {
      void data.reloadMcpServers()
    }
  }, [data.activeNav, data.reloadMcpServers])

  // Model change handlers
  const handleModelModeChange = (mode: SubagentModelMode) => {
    data.setSaveSuccessMsg('')
    data.setError('')
    const extraFlags = {
      allowAgentSelectModel: currentModelConfig.allowAgentSelectModel,
      overrideForkModel: currentModelConfig.overrideForkModel,
    }
    if (mode === 'workspace') {
      setCurrentModelConfig({ mode: 'workspace', ...extraFlags })
    } else if (mode === 'global') {
      setCurrentModelConfig({ mode: 'global', ...extraFlags })
    } else if (mode === 'inherit') {
      setCurrentModelConfig({ mode: 'custom', inherit: true, ...extraFlags })
    } else if (mode === 'custom') {
      if (
        currentModelConfig.model?.provider &&
        currentModelConfig.model?.model
      ) {
        setCurrentModelConfig({
          mode: 'custom',
          inherit: false,
          model: currentModelConfig.model,
          ...extraFlags,
        })
      } else {
        setCurrentModelConfig({
          mode: 'custom',
          inherit: false,
          model: {
            provider: '',
            model: '',
            reasoningEffort: undefined,
          },
          ...extraFlags,
        })
      }
    }
  }

  const handleProviderChange = (providerId: string) => {
    const group = data.providers.find((g) => g.id === providerId)
    const firstModel = group?.models?.[0]?.id || ''
    setCurrentModelConfig({
      mode: 'custom',
      inherit: false,
      model: {
        provider: providerId,
        model: firstModel,
        reasoningEffort: undefined,
      },
      allowAgentSelectModel: currentModelConfig.allowAgentSelectModel,
      overrideForkModel: currentModelConfig.overrideForkModel,
    })
  }

  const handleModelSelectChange = (modelId: string) => {
    const currentProvider = currentModelConfig.model?.provider || ''
    const currentGroup = data.providers.find((g) => g.id === currentProvider)
    const selectedModel = currentGroup?.models?.find((m) => m.id === modelId)
    const supportedEfforts = selectedModel?.reasoning?.efforts || []
    const isEffortValid =
      !currentModelConfig.model?.reasoningEffort ||
      supportedEfforts.some(
        (eff) => eff.id === currentModelConfig.model?.reasoningEffort,
      )

    setCurrentModelConfig({
      mode: 'custom',
      inherit: false,
      model: {
        provider: currentProvider,
        model: modelId,
        reasoningEffort: isEffortValid
          ? currentModelConfig.model?.reasoningEffort
          : undefined,
      },
      allowAgentSelectModel: currentModelConfig.allowAgentSelectModel,
      overrideForkModel: currentModelConfig.overrideForkModel,
    })
  }

  const handleReasoningEffortChange = (effortId: string) => {
    if (!currentModelConfig.model) return
    setCurrentModelConfig({
      mode: 'custom',
      inherit: false,
      model: {
        ...currentModelConfig.model,
        reasoningEffort: effortId || undefined,
      },
      allowAgentSelectModel: currentModelConfig.allowAgentSelectModel,
      overrideForkModel: currentModelConfig.overrideForkModel,
    })
  }

  const handleAllowAgentSelectModelChange = (allow: boolean) => {
    data.setSaveSuccessMsg('')
    data.setError('')
    setCurrentModelConfig({
      ...currentModelConfig,
      allowAgentSelectModel: allow,
    })
  }

  const handleOverrideForkModelChange = (override: boolean) => {
    data.setSaveSuccessMsg('')
    data.setError('')
    setCurrentModelConfig({
      ...currentModelConfig,
      overrideForkModel: override,
    })
  }

  // MCP change handlers
  const effectiveEnabledServerIds = (): string[] => {
    if (data.activeScope === 'global') {
      return currentMcpConfig.enabledServerIds ?? []
    }
    if (currentMcpConfig.mode === 'custom') {
      return currentMcpConfig.enabledServerIds ?? []
    }
    if (
      currentMcpConfig.mode === 'workspace' &&
      data.workspaceSettings?.mcp?.mode === 'custom'
    ) {
      return data.workspaceSettings.mcp.enabledServerIds ?? []
    }
    return data.globalConfig?.mcp?.enabledServerIds ?? []
  }

  const handleMcpModeChange = (mode: SessionMcpMode) => {
    data.setSaveSuccessMsg('')
    data.setError('')
    if (
      mode === 'custom' &&
      (!currentMcpConfig.enabledServerIds ||
        currentMcpConfig.enabledServerIds.length === 0)
    ) {
      const inherited = effectiveEnabledServerIds()
      setCurrentMcpConfig({
        ...currentMcpConfig,
        mode: 'custom',
        enabledServerIds:
          inherited.length > 0
            ? inherited
            : data.availableMcpServers.map((s) => s.id),
      })
    } else {
      setCurrentMcpConfig({
        ...currentMcpConfig,
        mode,
      })
    }
  }

  const handleToggleMcpServer = (serverId: string) => {
    data.setSaveSuccessMsg('')
    data.setError('')
    const currentIds = effectiveEnabledServerIds()
    const nextIds = currentIds.includes(serverId)
      ? currentIds.filter((id) => id !== serverId)
      : [...currentIds, serverId]

    setCurrentMcpConfig({
      ...currentMcpConfig,
      mode: data.activeScope === 'global' ? undefined : 'custom',
      enabledServerIds: nextIds,
    })
  }

  const handleToggleSelectAllMcp = () => {
    const currentIds = effectiveEnabledServerIds()
    const isAll =
      data.availableMcpServers.length > 0 &&
      data.availableMcpServers.every((s) => currentIds.includes(s.id))
    setCurrentMcpConfig({
      ...currentMcpConfig,
      mode: data.activeScope === 'global' ? undefined : 'custom',
      enabledServerIds: isAll ? [] : data.availableMcpServers.map((s) => s.id),
    })
  }

  // Publish a completed discovery to the server list and the modal's target.
  //
  // One probe (or cache read) yields tools, resources, templates, prompts,
  // serverInfo, and transport together, so a single write-back keeps every tab
  // and the card in step. Patching the modal's own object is what lets the
  // discovery hook seed from it on the next render.
  const applySessionDiscovery = React.useCallback(
    (discovery: McpDiscovery, serverId?: string) => {
      const id = serverId ?? data.sessionToolsModalServer?.id
      if (!id) return
      const { lists } = discovery
      const patch: Partial<GlobalMcpServerConfig> = {
        toolDetails: discovery.tools,
        tools: discovery.tools.length,
        resourceDetails: lists.resources,
        resourceTemplateDetails: lists.resourceTemplates,
        promptDetails: lists.prompts,
        capabilities: lists.capabilities,
        resourceCount: lists.resources.length,
        resourceTemplateCount: lists.resourceTemplates.length,
        promptCount: lists.prompts.length,
        ...(discovery.serverInfo ? { serverInfo: discovery.serverInfo } : {}),
        ...(discovery.detectedTransport
          ? { detectedTransport: discovery.detectedTransport }
          : {}),
        lastTestedAt: Date.now(),
      }
      data.setAvailableMcpServers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      )
      data.setSessionToolsModalServer((prev) =>
        prev && prev.id === id ? { ...prev, ...patch } : prev,
      )
    },
    [
      data.setAvailableMcpServers,
      data.setSessionToolsModalServer,
      data.sessionToolsModalServer?.id,
    ],
  )

  // Session tools modal handlers
  const handleOpenSessionToolsModal = async (
    server: GlobalMcpServerConfig,
    isReadonly?: boolean,
  ) => {
    setSessionToolsReadonly(Boolean(isReadonly))
    setPrimitiveTab('tools')
    const currentToolsMode = currentMcpConfig.toolsMode?.[server.id] || 'global'
    data.setSessionToolsMode(currentToolsMode)
    data.setSessionDisabledToolsSet(
      new Set(
        currentMcpConfig.disabledTools?.[server.id] ||
          (Array.isArray(server.disabledTools) ? server.disabledTools : []),
      ),
    )
    // Opening is now purely local. The discovery hook reads the cache and, only
    // if it is empty and the user asks, probes — so no request is issued here.
    data.setSessionToolsModalServer(server)
  }

  // The session tab shows the same read-only viewers as the global tab. Lists
  // are cache-first and content is never persisted; the reads are GUI actions
  // that never enter this session's context.
  const [primitiveTab, setPrimitiveTab] =
    React.useState<McpPrimitiveTab>('tools')
  const discovery = useMcpPrimitives({
    server: data.sessionToolsModalServer,
    onDiscovery: applySessionDiscovery,
    t,
  })
  const { copiedKey, copy } = useCopyFeedback()

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
          discovery.tools
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
    // The discovery hook resets itself when its server becomes null.
    data.setSessionToolsModalServer(null)
    setPrimitiveTab('tools')
  }

  const handleApplySessionTools = () => {
    if (!data.sessionToolsModalServer) return
    const serverId = data.sessionToolsModalServer.id
    const nextToolsMode = { ...(currentMcpConfig.toolsMode || {}) }
    const nextDisabledTools = { ...(currentMcpConfig.disabledTools || {}) }

    nextToolsMode[serverId] = data.sessionToolsMode
    if (data.sessionToolsMode === 'custom') {
      nextDisabledTools[serverId] = Array.from(data.sessionDisabledToolsSet)
    } else {
      delete nextDisabledTools[serverId]
    }

    const currentEnabled = currentMcpConfig.enabledServerIds || []
    const nextEnabled = currentEnabled.includes(serverId)
      ? currentEnabled
      : [...currentEnabled, serverId]

    setCurrentMcpConfig({
      ...currentMcpConfig,
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
    data.activeScope === 'global'
      ? currentSkillsConfig.disabledModelSkills || []
      : currentSkillsConfig.mode === 'custom'
        ? currentSkillsConfig.disabledModelSkills || []
        : currentSkillsConfig.mode === 'workspace'
          ? workspaceDisabledModelSkills
          : defaultDisabledModelSkills

  const effectiveDisabledUserList =
    data.activeScope === 'global'
      ? currentSkillsConfig.disabledUserSkills || []
      : currentSkillsConfig.mode === 'custom'
        ? currentSkillsConfig.disabledUserSkills || []
        : currentSkillsConfig.mode === 'workspace'
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
    setCurrentSkillsConfig({
      ...currentSkillsConfig,
      mode,
      disabledModelSkills:
        mode === 'custom'
          ? currentSkillsConfig.disabledModelSkills || []
          : mode === 'workspace'
            ? data.workspaceSettings?.skills?.mode === 'custom'
              ? data.workspaceSettings.skills.disabledModelSkills || []
              : []
            : [],
      disabledUserSkills:
        mode === 'custom'
          ? currentSkillsConfig.disabledUserSkills || []
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
      data.activeScope === 'global' || currentSkillsConfig.mode === 'custom'
        ? currentSkillsConfig.disabledModelSkills || []
        : effectiveDisabledModelList
    const curUser =
      data.activeScope === 'global' || currentSkillsConfig.mode === 'custom'
        ? currentSkillsConfig.disabledUserSkills || []
        : effectiveDisabledUserList

    const nextModel = modelDisabled
      ? Array.from(new Set([...curModel, skillName]))
      : curModel.filter((n) => n !== skillName)
    const nextUser = userDisabled
      ? Array.from(new Set([...curUser, skillName]))
      : curUser.filter((n) => n !== skillName)

    setCurrentSkillsConfig({
      ...currentSkillsConfig,
      mode: data.activeScope === 'global' ? undefined : 'custom',
      disabledModelSkills: nextModel,
      disabledUserSkills: nextUser,
    })
    data.setSessionSkillModalTarget(null)
  }

  const handleOpenSessionSkillModal = async (
    skill: SkillItem,
    isReadonly?: boolean,
  ) => {
    setSessionSkillReadonly(Boolean(isReadonly))
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
    } finally {
      data.setRefreshingSkills(false)
    }
  }

  const defaultActiveMcpCount =
    data.globalConfig?.mcp?.enabledServerIds?.length ?? 0

  const effectiveActiveMcpCount =
    data.activeScope === 'global'
      ? (currentMcpConfig.enabledServerIds || []).length
      : currentMcpConfig.mode === 'custom' || !sessionId
        ? (currentMcpConfig.enabledServerIds || []).length
        : currentMcpConfig.mode === 'workspace' &&
            data.workspaceSettings?.mcp?.mode === 'custom'
          ? (data.workspaceSettings.mcp.enabledServerIds || []).length
          : defaultActiveMcpCount

  // Determine if reset button should be shown
  const showResetButton =
    data.activeScope === 'global'
      ? true
      : data.activeScope === 'workspace'
        ? Boolean(data.workspaceSettings)
        : Boolean(sessionId && data.hasSessionOverride)

  const resetLabel =
    data.activeScope === 'global'
      ? t('sessionSettings.action.resetGlobal')
      : data.activeScope === 'workspace'
        ? t('sessionSettings.action.resetWorkspace')
        : t('sessionSettings.action.resetSession')

  const saveLabel = actions.saving
    ? t('sessionSettings.action.saving')
    : data.activeScope === 'global'
      ? t('sessionSettings.action.saveGlobal')
      : data.activeScope === 'workspace'
        ? t('sessionSettings.action.saveWorkspace')
        : t('sessionSettings.action.saveSession')

  return e(
    'div',
    {
      className: 'dsh-session-view-root',
      'data-session-settings-view': '',
      'data-conversation-composer-overlay': '',
    },
    // Top Header
    e(HeaderBar, {
      activeScope: data.activeScope,
      sessionId,
      copiedId: data.copiedId,
      currentWorkspaceTitle: data.currentWorkspaceTitle,
      currentWorkspace: data.currentWorkspace || undefined,
      onCopySessionId: actions.handleCopySessionId,
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
    data.error
      ? e(
          'div',
          { className: 'dsh-sam-notice error dsh-view-notice' },
          data.error,
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
        modelConfig: currentModelConfig,
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
              scope: data.activeScope,
              modelConfig: currentModelConfig,
              providers: data.providers,
              loadingModels: data.loadingModels,
              currentWorkspaceId: data.currentWorkspaceId,
              workspaceSettings: data.workspaceSettings,
              globalConfig: data.globalConfig,
              onModelModeChange: handleModelModeChange,
              onProviderChange: handleProviderChange,
              onModelSelectChange: handleModelSelectChange,
              onReasoningEffortChange: handleReasoningEffortChange,
              onAllowAgentSelectModelChange: handleAllowAgentSelectModelChange,
              onOverrideForkModelChange: handleOverrideForkModelChange,
              t,
            })
          : null,

        data.activeNav === 'mcp'
          ? e(SessionMcpSection, {
              scope: data.activeScope,
              sessionId,
              mcpConfig: currentMcpConfig,
              availableMcpServers: data.availableMcpServers,
              currentWorkspaceId: data.currentWorkspaceId,
              workspaceSettings: data.workspaceSettings,
              globalConfig: data.globalConfig,
              refreshingClientId: data.refreshingClientId,
              clientRefreshResults: data.clientRefreshResults,
              onMcpModeChange: handleMcpModeChange,
              onToggleMcpServer: handleToggleMcpServer,
              onToggleSelectAllMcp: handleToggleSelectAllMcp,
              onOpenSessionToolsModal: handleOpenSessionToolsModal,
              onRefreshClient: data.handleRefreshClient,
              t,
            })
          : null,

        data.activeNav === 'skills'
          ? e(SessionSkillsSection, {
              scope: data.activeScope,
              skillsConfig: currentSkillsConfig,
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
        // Scope Tabs Navigator ([ 会话 ] [ 工作区 ] [ 全局 ])
        e(
          'div',
          { className: 'dsh-scope-tabs-nav', role: 'tablist' },
          e(
            'button',
            {
              type: 'button',
              role: 'tab',
              'aria-selected': data.activeScope === 'session',
              className: `dsh-scope-tab-btn ${data.activeScope === 'session' ? 'active' : ''} ${!canEditSessionScope ? 'disabled' : ''}`,
              disabled: !canEditSessionScope,
              title: !canEditSessionScope
                ? t('sessionSettings.scopeTabs.sessionDisabledHint')
                : undefined,
              onClick: () => {
                if (canEditSessionScope) data.setActiveScope('session')
              },
            },
            t('sessionSettings.scopeTabs.session'),
          ),
          e(
            'button',
            {
              type: 'button',
              role: 'tab',
              'aria-selected': data.activeScope === 'workspace',
              className: `dsh-scope-tab-btn ${data.activeScope === 'workspace' ? 'active' : ''} ${!canEditWorkspaceScope ? 'disabled' : ''}`,
              disabled: !canEditWorkspaceScope,
              title: !canEditWorkspaceScope
                ? t('sessionSettings.scopeTabs.workspaceDisabledHint')
                : undefined,
              onClick: () => {
                if (canEditWorkspaceScope) data.setActiveScope('workspace')
              },
            },
            t('sessionSettings.scopeTabs.workspace'),
          ),
          e(
            'button',
            {
              type: 'button',
              role: 'tab',
              'aria-selected': data.activeScope === 'global',
              className: `dsh-scope-tab-btn ${data.activeScope === 'global' ? 'active' : ''}`,
              onClick: () => data.setActiveScope('global'),
            },
            t('sessionSettings.scopeTabs.global'),
          ),
        ),
        // A disabled button cannot explain itself: its `title` is unreachable
        // (no pointer events reach a disabled control in most browsers), so the
        // reason is rendered as text next to the tabs.
        !canEditSessionScope || !canEditWorkspaceScope
          ? e(
              'span',
              {
                className: 'dsh-scope-hint',
                role: 'note',
              },
              !canEditSessionScope
                ? t('sessionSettings.scopeTabs.sessionDisabledHint')
                : t('sessionSettings.scopeTabs.workspaceDisabledHint'),
            )
          : null,
      ),
      e(
        'div',
        { className: 'dsh-view-footer-right' },
        showResetButton
          ? e(
              'button',
              {
                type: 'button',
                className: 'dsh-sam-btn tertiary',
                disabled: actions.saving,
                onClick: () => actions.handleResetScope(data.activeScope),
              },
              resetLabel,
            )
          : null,
        e(
          'button',
          {
            type: 'button',
            className: 'dsh-sam-btn primary',
            disabled: actions.saving,
            onClick: () => actions.handleSaveScope(data.activeScope),
          },
          saveLabel,
        ),
      ),
    ),

    // Session Tools Modal
    e(SessionMcpToolsModal, {
      server: data.sessionToolsModalServer,
      toolsMode: data.sessionToolsMode,
      disabledToolsSet: data.sessionDisabledToolsSet,
      fetching: discovery.loading,
      error: discovery.error,
      toolsList: discovery.tools as McpDiscoveredTool[],
      isReadonly: sessionToolsReadonly,
      activeTab: primitiveTab,
      onTabChange: setPrimitiveTab,
      tabCounts: {
        tools: (discovery.tools as McpDiscoveredTool[]).length,
        resources:
          discovery.lists.resources.length +
          discovery.lists.resourceTemplates.length,
        prompts: discovery.lists.prompts.length,
      },
      resourcePanel: e(McpResourcePanel, {
        resources: discovery.lists.resources,
        resourceTemplates: discovery.lists.resourceTemplates,
        capabilities: discovery.lists.capabilities,
        loading: discovery.loading,
        error: discovery.error,
        loaded: discovery.loaded,
        read: discovery.resourceRead,
        onRefresh: discovery.refresh,
        onRead: discovery.readResource,
        onCopy: copy,
        copiedKey,
        t,
      }),
      promptPanel: e(McpPromptPanel, {
        prompts: discovery.lists.prompts,
        capabilities: discovery.lists.capabilities,
        loading: discovery.loading,
        error: discovery.error,
        loaded: discovery.loaded,
        result: discovery.promptGet,
        onRefresh: discovery.refresh,
        onGet: discovery.getPrompt,
        onCopy: copy,
        copiedKey,
        t,
      }),
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
      onFetchTools: discovery.refresh,
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
      isSessionContext: data.activeScope === 'session',
      isReadonly: sessionSkillReadonly,
      onSave: sessionSkillReadonly ? undefined : handleSaveSessionSkillModal,
      onClose: () => data.setSessionSkillModalTarget(null),
      t,
    }),
  )
}

export default SessionSettingsViewPage
