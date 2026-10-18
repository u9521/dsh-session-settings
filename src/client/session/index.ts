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
  type SessionSandboxConfig,
  type SessionSandboxMode,
  type SessionSettingsConfig,
  type SessionSkillsConfig,
  API_ENDPOINTS,
} from '../types/index.ts'
import {
  useSessionCatalogs,
  useSessionSettings,
} from './settings-controller.ts'
import { resolveEffectiveSandbox } from '../utils/config.ts'
import { HeaderBar } from './sections/HeaderBar.ts'
import { NavigationSidebar } from './sections/NavigationSidebar.ts'
import type { NavSection } from '../types/index.ts'
import { SubagentModelSection } from './sections/SubagentModelSection.ts'
import { SessionMcpSection } from './sections/SessionMcpSection.ts'
import { SessionSandboxSection } from './sections/SessionSandboxSection.ts'
import { SessionSkillsSection } from './sections/SessionSkillsSection.ts'
import { SessionMcpToolsModal } from './modals/SessionMcpToolsModal.ts'
import { McpResourcePanel } from '../mcp/components/McpResourcePanel.ts'
import { McpPromptPanel } from '../mcp/components/McpPromptPanel.ts'
import type { McpPrimitiveTab } from '../mcp/components/McpPrimitivesTabs.ts'
import {
  useMcpDiscovery,
  serverPatch,
  type McpDiscovery,
} from '../mcp/discovery.ts'
import { useCopyFeedback } from '../mcp/hooks/useCopyFeedback.ts'
import { SkillDetailModal } from '../skills/components/SkillDetailModal.ts'

export * from './sections/HeaderBar.ts'
export * from './sections/NavigationSidebar.ts'
export * from './sections/SubagentModelSection.ts'
export * from './sections/SessionMcpSection.ts'
export * from './sections/SessionSandboxSection.ts'
export * from './sections/SessionSkillsSection.ts'
export * from './modals/SessionMcpToolsModal.ts'

const e = React.createElement

export function SessionSettingsViewPage(props: ClientPageProps) {
  const { t, sessionId, onClose } = props

  const settings = useSessionSettings(props)
  const catalogs = useSessionCatalogs(props, sessionId)

  const [activeNav, setActiveNav] = React.useState<NavSection>('model')
  const [sessionToolsReadonly, setSessionToolsReadonly] =
    React.useState<boolean>(false)
  const [sessionSkillReadonly, setSessionSkillReadonly] =
    React.useState<boolean>(false)
  const [primitiveTab, setPrimitiveTab] =
    React.useState<McpPrimitiveTab>('tools')

  // The draft for the active scope, per domain. `settings.draft` already
  // resolves the scope, so the page never dispatches on it again.
  const modelConfig = settings.draft('subagentModel') as SubagentModelConfig
  const mcpConfig = settings.draft('mcp') as SessionMcpConfig
  const skillsConfig = settings.draft('skills') as SessionSkillsConfig
  const sandboxConfig = settings.draft('sandbox') as SessionSandboxConfig

  const setModelConfig = (value: SubagentModelConfig) =>
    settings.update('subagentModel', value)
  const setMcpConfig = (value: SessionMcpConfig) =>
    settings.update('mcp', value)
  const setSkillsConfig = (value: SessionSkillsConfig) =>
    settings.update('skills', value)
  const setSandboxConfig = (value: SessionSandboxConfig) =>
    settings.update('sandbox', value)

  const workspaceSettings = settings.layers.workspace
  const globalConfig = settings.layers.global
  const currentWorkspaceId = settings.workspaceId

  const effectiveSandbox = settings.effective('sandbox') as SessionSandboxConfig
  const effectiveSkills = settings.effective('skills') as SessionSkillsConfig
  const effectiveMcp = settings.effective('mcp') as SessionMcpConfig

  const effectiveDisabledModelSet = new Set(
    effectiveSkills.disabledModelSkills ?? [],
  )
  const effectiveDisabledUserSet = new Set(
    effectiveSkills.disabledUserSkills ?? [],
  )
  const effectiveActiveSkillsCount = catalogs.skills.filter(
    (s) => !effectiveDisabledModelSet.has(s.name),
  ).length
  const effectiveActiveMcpCount = (effectiveMcp.enabledServerIds ?? []).length

  /** The layer the sandbox panel's rules come from. */
  const sandboxSourceMode =
    settings.scope === 'global'
      ? 'custom'
      : settings.scope === 'workspace'
        ? sandboxConfig?.mode === 'custom'
          ? 'custom'
          : 'global'
        : sandboxConfig?.mode === 'custom'
          ? 'custom'
          : (sandboxConfig?.mode ??
            (currentWorkspaceId ? 'workspace' : 'global'))

  const notice = settings.notice ?? catalogs.notice

  // Runtime status of the official MCP clients does not change on its own —
  // re-read it whenever the MCP section becomes active, and after a save
  // (saving MCP settings mounts or unmounts servers).
  React.useEffect(() => {
    if (activeNav === 'mcp') void catalogs.reloadServers()
  }, [activeNav, catalogs.reloadServers])

  const handleSave = async () => {
    await settings.save()
    void catalogs.reloadServers()
  }

  const handleReset = async () => {
    await settings.reset()
    void catalogs.reloadServers()
  }

  // ---- Model handlers -----------------------------------------------------

  const handleModelModeChange = (mode: SubagentModelMode) => {
    const extraFlags = {
      allowAgentSelectModel: modelConfig.allowAgentSelectModel,
      overrideForkModel: modelConfig.overrideForkModel,
    }
    if (mode === 'workspace') {
      setModelConfig({ mode: 'workspace', ...extraFlags })
    } else if (mode === 'global') {
      setModelConfig({ mode: 'global', ...extraFlags })
    } else if (mode === 'inherit') {
      setModelConfig({ mode: 'custom', inherit: true, ...extraFlags })
    } else if (mode === 'custom') {
      const model =
        modelConfig.model?.provider && modelConfig.model?.model
          ? modelConfig.model
          : { provider: '', model: '', reasoningEffort: undefined }
      setModelConfig({ mode: 'custom', inherit: false, model, ...extraFlags })
    }
  }

  const handleProviderChange = (providerId: string) => {
    const group = catalogs.providers.find((g) => g.id === providerId)
    setModelConfig({
      mode: 'custom',
      inherit: false,
      model: {
        provider: providerId,
        model: group?.models?.[0]?.id || '',
        reasoningEffort: undefined,
      },
      allowAgentSelectModel: modelConfig.allowAgentSelectModel,
      overrideForkModel: modelConfig.overrideForkModel,
    })
  }

  const handleModelSelectChange = (modelId: string) => {
    const currentProvider = modelConfig.model?.provider || ''
    const group = catalogs.providers.find((g) => g.id === currentProvider)
    const selected = group?.models?.find((m) => m.id === modelId)
    const efforts = selected?.reasoning?.efforts || []
    const effort = modelConfig.model?.reasoningEffort
    setModelConfig({
      mode: 'custom',
      inherit: false,
      model: {
        provider: currentProvider,
        model: modelId,
        reasoningEffort:
          effort && efforts.some((eff) => eff.id === effort)
            ? effort
            : undefined,
      },
      allowAgentSelectModel: modelConfig.allowAgentSelectModel,
      overrideForkModel: modelConfig.overrideForkModel,
    })
  }

  const handleReasoningEffortChange = (effortId: string) => {
    if (!modelConfig.model) return
    setModelConfig({
      mode: 'custom',
      inherit: false,
      model: {
        ...modelConfig.model,
        reasoningEffort: effortId || undefined,
      },
      allowAgentSelectModel: modelConfig.allowAgentSelectModel,
      overrideForkModel: modelConfig.overrideForkModel,
    })
  }

  const handleAllowAgentSelectModelChange = (allow: boolean) =>
    setModelConfig({ ...modelConfig, allowAgentSelectModel: allow })

  const handleOverrideForkModelChange = (override: boolean) =>
    setModelConfig({ ...modelConfig, overrideForkModel: override })

  // ---- MCP handlers -------------------------------------------------------

  /** Ids enabled by the layer this scope inherits from. */
  const inheritedServerIds = (): string[] => {
    if (settings.scope === 'global') return mcpConfig.enabledServerIds ?? []
    if (mcpConfig.mode === 'custom') return mcpConfig.enabledServerIds ?? []
    if (
      mcpConfig.mode === 'workspace' &&
      workspaceSettings?.mcp?.mode === 'custom'
    ) {
      return workspaceSettings.mcp.enabledServerIds ?? []
    }
    return globalConfig?.mcp?.enabledServerIds ?? []
  }

  const handleMcpModeChange = (mode: SessionMcpMode) => {
    if (
      mode === 'custom' &&
      (!mcpConfig.enabledServerIds || mcpConfig.enabledServerIds.length === 0)
    ) {
      const inherited = inheritedServerIds()
      setMcpConfig({
        ...mcpConfig,
        mode: 'custom',
        enabledServerIds:
          inherited.length > 0 ? inherited : catalogs.servers.map((s) => s.id),
      })
      return
    }
    setMcpConfig({ ...mcpConfig, mode })
  }

  const handleToggleMcpServer = (serverId: string) => {
    const current = inheritedServerIds()
    const next = current.includes(serverId)
      ? current.filter((id) => id !== serverId)
      : [...current, serverId]
    setMcpConfig({
      ...mcpConfig,
      mode: settings.scope === 'global' ? undefined : 'custom',
      enabledServerIds: next,
    })
  }

  const handleToggleSelectAllMcp = () => {
    const current = inheritedServerIds()
    const all =
      catalogs.servers.length > 0 &&
      catalogs.servers.every((s) => current.includes(s.id))
    setMcpConfig({
      ...mcpConfig,
      mode: settings.scope === 'global' ? undefined : 'custom',
      enabledServerIds: all ? [] : catalogs.servers.map((s) => s.id),
    })
  }

  // ---- Sandbox handlers ---------------------------------------------------

  const handleSandboxChange = (cfg: SessionSandboxConfig) =>
    setSandboxConfig(cfg)

  const handleSandboxSourceModeChange = (mode: SessionSandboxMode) => {
    if (mode === 'custom') {
      const effective = resolveEffectiveSandbox(
        settings.scope === 'session'
          ? ({ sandbox: sandboxConfig } as SessionSettingsConfig)
          : undefined,
        settings.scope === 'global'
          ? undefined
          : (workspaceSettings ??
              ({ sandbox: sandboxConfig } as SessionSettingsConfig)),
        settings.scope === 'global'
          ? ({ sandbox: globalConfig.sandbox } as SessionSettingsConfig)
          : globalConfig,
      )
      setSandboxConfig({ mode: 'custom', allow: effective.allow ?? [] })
      return
    }
    setSandboxConfig({ mode })
  }

  // ---- Skills handlers ----------------------------------------------------

  const handleSkillsModeChange = (mode: SessionSkillsMode) => {
    const inheritedModel =
      workspaceSettings?.skills?.mode === 'custom'
        ? (workspaceSettings.skills.disabledModelSkills ?? [])
        : []
    const inheritedUser =
      workspaceSettings?.skills?.mode === 'custom'
        ? (workspaceSettings.skills.disabledUserSkills ?? [])
        : []
    setSkillsConfig({
      ...skillsConfig,
      mode,
      disabledModelSkills:
        mode === 'custom'
          ? (skillsConfig.disabledModelSkills ?? [])
          : mode === 'workspace'
            ? inheritedModel
            : [],
      disabledUserSkills:
        mode === 'custom'
          ? (skillsConfig.disabledUserSkills ?? [])
          : mode === 'workspace'
            ? inheritedUser
            : [],
    })
  }

  // ---- Session tools modal ------------------------------------------------

  const [sessionToolsModalServer, setSessionToolsModalServer] =
    React.useState<GlobalMcpServerConfig | null>(null)
  const [sessionToolsMode, setSessionToolsMode] = React.useState<
    'global' | 'custom'
  >('global')
  const [sessionDisabledToolsSet, setSessionDisabledToolsSet] = React.useState<
    Set<string>
  >(new Set())

  const applySessionDiscovery = React.useCallback(
    (discovery: McpDiscovery, serverId?: string) => {
      const id = serverId ?? sessionToolsModalServer?.id
      if (!id) return
      const patch = serverPatch(discovery)
      setSessionToolsModalServer((prev) =>
        prev && prev.id === id ? { ...prev, ...patch } : prev,
      )
    },
    [sessionToolsModalServer?.id],
  )

  const handleOpenSessionToolsModal = async (
    server: GlobalMcpServerConfig,
    isReadonly?: boolean,
  ) => {
    setSessionToolsReadonly(Boolean(isReadonly))
    setPrimitiveTab('tools')
    setSessionToolsMode(mcpConfig.toolsMode?.[server.id] || 'global')
    setSessionDisabledToolsSet(
      new Set(
        mcpConfig.disabledTools?.[server.id] ||
          (Array.isArray(server.disabledTools) ? server.disabledTools : []),
      ),
    )
    setSessionToolsModalServer(server)
  }

  const mcp = useMcpDiscovery({ server: sessionToolsModalServer, t })
  const discovery = mcp.discovery
  const discoveryStatus = mcp.state.status
  const discoveryError =
    mcp.state.status === 'error' ? mcp.state.message : undefined
  const refreshDiscovery = async () => {
    const result = await mcp.refresh()
    if (result) applySessionDiscovery(result)
  }
  const { copiedKey, copy } = useCopyFeedback()

  const handleToggleSessionTool = (toolName: string) => {
    setSessionDisabledToolsSet((prev) => {
      const next = new Set(prev)
      if (next.has(toolName)) next.delete(toolName)
      else next.add(toolName)
      return next
    })
  }

  const handleToggleAllSessionTools = (enableAll: boolean) => {
    if (enableAll) {
      setSessionDisabledToolsSet(new Set())
      return
    }
    setSessionDisabledToolsSet(
      new Set(
        discovery.tools
          .map((tool) => tool.name)
          .filter((name): name is string => Boolean(name)),
      ),
    )
  }

  const handleResetSessionToolsToDefault = () => {
    setSessionDisabledToolsSet(
      new Set(
        Array.isArray(sessionToolsModalServer?.disabledTools)
          ? sessionToolsModalServer.disabledTools
          : [],
      ),
    )
  }

  const handleCloseSessionToolsModal = () => {
    setSessionToolsModalServer(null)
    setPrimitiveTab('tools')
  }

  const handleApplySessionTools = () => {
    if (!sessionToolsModalServer) return
    const serverId = sessionToolsModalServer.id
    const nextToolsMode = { ...(mcpConfig.toolsMode || {}) }
    const nextDisabledTools = { ...(mcpConfig.disabledTools || {}) }
    nextToolsMode[serverId] = sessionToolsMode
    if (sessionToolsMode === 'custom') {
      nextDisabledTools[serverId] = Array.from(sessionDisabledToolsSet)
    } else {
      delete nextDisabledTools[serverId]
    }
    const enabled = mcpConfig.enabledServerIds || []
    setMcpConfig({
      ...mcpConfig,
      enabledServerIds: enabled.includes(serverId)
        ? enabled
        : [...enabled, serverId],
      toolsMode: nextToolsMode,
      disabledTools: nextDisabledTools,
    })
    handleCloseSessionToolsModal()
  }

  // ---- Skill detail modal -------------------------------------------------

  const [sessionSkillModalTarget, setSessionSkillModalTarget] =
    React.useState<SkillItem | null>(null)
  const [skillsContentMap, setSkillsContentMap] = React.useState<
    Record<string, SkillItem>
  >({})
  const [skillsLoadingMap, setSkillsLoadingMap] = React.useState<
    Record<string, boolean>
  >({})
  const [skillsSearch, setSkillsSearch] = React.useState<string>('')

  const handleSaveSessionSkillModal = (
    skillName: string,
    modelDisabled: boolean,
    userDisabled: boolean,
  ) => {
    const curModel = effectiveSkills.disabledModelSkills ?? []
    const curUser = effectiveSkills.disabledUserSkills ?? []
    setSkillsConfig({
      ...skillsConfig,
      mode: settings.scope === 'global' ? undefined : 'custom',
      disabledModelSkills: modelDisabled
        ? Array.from(new Set([...curModel, skillName]))
        : curModel.filter((name) => name !== skillName),
      disabledUserSkills: userDisabled
        ? Array.from(new Set([...curUser, skillName]))
        : curUser.filter((name) => name !== skillName),
    })
    setSessionSkillModalTarget(null)
  }

  const handleOpenSessionSkillModal = async (
    skill: SkillItem,
    isReadonly?: boolean,
  ) => {
    setSessionSkillReadonly(Boolean(isReadonly))
    setSessionSkillModalTarget(skill)
    const skillName = skill.name
    if (skillsContentMap[skillName] || skill.content) return

    setSkillsLoadingMap((prev) => ({ ...prev, [skillName]: true }))
    try {
      const url = sessionId
        ? `${API_ENDPOINTS.skillsContent}?name=${encodeURIComponent(skillName)}&sessionId=${encodeURIComponent(sessionId)}`
        : `${API_ENDPOINTS.skillsContent}?name=${encodeURIComponent(skillName)}`
      const res = await fetch(url)
      const body = res.ok ? await res.json() : undefined
      const content =
        body?.ok && body.skill
          ? body.skill.content
          : res.ok
            ? t('sessionSettings.skills.noContent')
            : t('sessionSettings.skills.loadError')
      setSkillsContentMap((prev) => ({
        ...prev,
        [skillName]: { ...skill, content },
      }))
    } catch (err: unknown) {
      setSkillsContentMap((prev) => ({
        ...prev,
        [skillName]: {
          ...skill,
          content: t('sessionSettings.skills.loadErrorWithReason', {
            reason: err instanceof Error ? err.message : String(err),
          }),
        },
      }))
    } finally {
      setSkillsLoadingMap((prev) => ({ ...prev, [skillName]: false }))
    }
  }

  // ---- Footer labels ------------------------------------------------------

  const showResetButton =
    settings.scope === 'global'
      ? true
      : settings.scope === 'workspace'
        ? Boolean(workspaceSettings)
        : Boolean(sessionId && settings.hasSessionOverride)

  const resetLabel =
    settings.scope === 'global'
      ? t('sessionSettings.action.resetGlobal')
      : settings.scope === 'workspace'
        ? t('sessionSettings.action.resetWorkspace')
        : t('sessionSettings.action.resetSession')

  const saveLabel = settings.saving
    ? t('sessionSettings.action.saving')
    : settings.scope === 'global'
      ? t('sessionSettings.action.saveGlobal')
      : settings.scope === 'workspace'
        ? t('sessionSettings.action.saveWorkspace')
        : t('sessionSettings.action.saveSession')

  const canEditSessionScope = settings.sessionScopeAvailable
  const canEditWorkspaceScope = settings.workspaceScopeAvailable

  return e(
    'div',
    {
      className: 'dsh-session-view-root',
      'data-session-settings-view': '',
      'data-conversation-composer-overlay': '',
    },
    e(HeaderBar, {
      activeScope: settings.scope,
      sessionId,
      copiedId: settings.copiedId,
      currentWorkspaceTitle: settings.workspaceTitle,
      currentWorkspace: undefined,
      onCopySessionId: () => void settings.copySessionId(),
      onClose,
      t,
    }),

    notice
      ? e(
          'div',
          {
            className: `dsh-sam-notice ${notice.kind === 'success' ? 'success' : 'error'} dsh-view-notice`,
          },
          notice.message,
        )
      : null,

    e(
      'div',
      { className: 'dsh-session-view-body' },
      e(NavigationSidebar, {
        activeNav,
        onNavChange: setActiveNav,
        modelConfig,
        effectiveActiveMcpCount,
        effectiveActiveSkillsCount,
        availableSkills: catalogs.skills,
        sandboxAllowCount: (effectiveSandbox?.allow ?? []).length,
        t,
      }),

      e(
        'div',
        { className: 'dsh-session-view-content' },
        activeNav === 'model'
          ? e(SubagentModelSection, {
              scope: settings.scope,
              modelConfig,
              providers: catalogs.providers,
              loadingModels: catalogs.loadingModels,
              currentWorkspaceId,
              workspaceSettings,
              globalConfig,
              onModelModeChange: handleModelModeChange,
              onProviderChange: handleProviderChange,
              onModelSelectChange: handleModelSelectChange,
              onReasoningEffortChange: handleReasoningEffortChange,
              onAllowAgentSelectModelChange: handleAllowAgentSelectModelChange,
              onOverrideForkModelChange: handleOverrideForkModelChange,
              t,
            })
          : null,

        activeNav === 'mcp'
          ? e(SessionMcpSection, {
              scope: settings.scope,
              sessionId,
              mcpConfig,
              availableMcpServers: catalogs.servers,
              currentWorkspaceId,
              workspaceSettings,
              globalConfig,
              refreshingClientId: catalogs.refreshingClientId,
              clientRefreshResults: catalogs.clientRefreshResults,
              onMcpModeChange: handleMcpModeChange,
              onToggleMcpServer: handleToggleMcpServer,
              onToggleSelectAllMcp: handleToggleSelectAllMcp,
              onOpenSessionToolsModal: handleOpenSessionToolsModal,
              onRefreshClient: catalogs.refreshClient,
              t,
            })
          : null,

        activeNav === 'skills'
          ? e(SessionSkillsSection, {
              scope: settings.scope,
              skillsConfig,
              availableSkills: catalogs.skills,
              currentWorkspaceId,
              workspaceSettings,
              globalConfig,
              skillsSearch,
              refreshingSkills: catalogs.refreshingSkills,
              effectiveDisabledModelSet,
              effectiveDisabledUserSet,
              onSkillsModeChange: handleSkillsModeChange,
              onSkillsSearchChange: setSkillsSearch,
              onRefreshSkills: catalogs.reloadSkills,
              onOpenSessionSkillModal: handleOpenSessionSkillModal,
              t,
            })
          : null,

        activeNav === 'sandbox'
          ? e(SessionSandboxSection, {
              scope: settings.scope,
              sandboxConfig,
              currentWorkspaceId,
              workspaceSettings,
              globalConfig,
              capability: catalogs.sandboxCapability,
              skipped: catalogs.sandboxSkipped,
              effectiveMode: catalogs.sandboxCapability?.effectiveMode,
              activeSourceMode: sandboxSourceMode,
              onChange: handleSandboxChange,
              onSourceModeChange: handleSandboxSourceModeChange,
              t,
            })
          : null,
      ),
    ),

    e(
      'div',
      { className: 'dsh-session-view-footer' },
      e(
        'div',
        { className: 'dsh-view-footer-left' },
        e(
          'div',
          { className: 'dsh-scope-tabs-nav', role: 'tablist' },
          ...(
            [
              ['session', canEditSessionScope, 'sessionDisabledHint'],
              ['workspace', canEditWorkspaceScope, 'workspaceDisabledHint'],
              ['global', true, undefined],
            ] as const
          ).map(([scope, enabled, hint]) =>
            e(
              'button',
              {
                key: scope,
                type: 'button',
                role: 'tab',
                'aria-selected': settings.scope === scope,
                className: `dsh-scope-tab-btn ${settings.scope === scope ? 'active' : ''} ${!enabled ? 'disabled' : ''}`,
                disabled: !enabled,
                title: enabled
                  ? undefined
                  : t(`sessionSettings.scopeTabs.${hint}`),
                onClick: () => {
                  if (enabled) settings.select(scope)
                },
              },
              t(`sessionSettings.scopeTabs.${scope}`),
            ),
          ),
        ),
        // A disabled button cannot explain itself: its title is unreachable,
        // so the reason is rendered as text next to the tabs.
        !canEditSessionScope || !canEditWorkspaceScope
          ? e(
              'span',
              { className: 'dsh-scope-hint', role: 'note' },
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
                disabled: settings.saving,
                onClick: () => void handleReset(),
              },
              resetLabel,
            )
          : null,
        e(
          'button',
          {
            type: 'button',
            className: 'dsh-sam-btn primary',
            disabled: settings.saving,
            onClick: () => void handleSave(),
          },
          saveLabel,
        ),
      ),
    ),

    e(SessionMcpToolsModal, {
      server: sessionToolsModalServer,
      toolsMode: sessionToolsMode,
      disabledToolsSet: sessionDisabledToolsSet,
      fetching: discoveryStatus === 'loading',
      error: discoveryError,
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
        loading: discoveryStatus === 'loading',
        error: discoveryError,
        loaded: discoveryStatus === 'ready',
        readState: mcp.readState,
        onRefresh: refreshDiscovery,
        onRead: mcp.readResource,
        onCopy: copy,
        copiedKey,
        t,
      }),
      promptPanel: e(McpPromptPanel, {
        prompts: discovery.lists.prompts,
        capabilities: discovery.lists.capabilities,
        loading: discoveryStatus === 'loading',
        error: discoveryError,
        loaded: discoveryStatus === 'ready',
        result: mcp.promptGet,
        onRefresh: refreshDiscovery,
        onGet: mcp.getPrompt,
        onCopy: copy,
        copiedKey,
        t,
      }),
      onToolsModeChange: (value) => {
        setSessionToolsMode(value)
        if (value === 'global') {
          setSessionDisabledToolsSet(
            new Set(
              Array.isArray(sessionToolsModalServer?.disabledTools)
                ? sessionToolsModalServer.disabledTools
                : [],
            ),
          )
        }
      },
      onToggleTool: handleToggleSessionTool,
      onToggleAllTools: handleToggleAllSessionTools,
      onResetToDefault: handleResetSessionToolsToDefault,
      onFetchTools: refreshDiscovery,
      onClose: handleCloseSessionToolsModal,
      onApply: handleApplySessionTools,
      t,
    }),

    e(SkillDetailModal, {
      skill: sessionSkillModalTarget,
      detail: sessionSkillModalTarget
        ? skillsContentMap[sessionSkillModalTarget.name] ||
          sessionSkillModalTarget
        : null,
      isModelDisabled: sessionSkillModalTarget
        ? effectiveDisabledModelSet.has(sessionSkillModalTarget.name)
        : false,
      isUserDisabled: sessionSkillModalTarget
        ? effectiveDisabledUserSet.has(sessionSkillModalTarget.name)
        : false,
      loadingContent: sessionSkillModalTarget
        ? Boolean(skillsLoadingMap[sessionSkillModalTarget.name])
        : false,
      isSessionContext: settings.scope === 'session',
      isReadonly: sessionSkillReadonly,
      onSave: sessionSkillReadonly ? undefined : handleSaveSessionSkillModal,
      onClose: () => setSessionSkillModalTarget(null),
      t,
    }),
  )
}

export default SessionSettingsViewPage
