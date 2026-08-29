import * as React from 'react'
import type {
  ClientPageProps,
  ModelProviderGroup,
  GlobalMcpServerConfig,
  SkillItem,
  SubagentModelConfig,
  SessionMcpConfig,
  SessionSkillsConfig,
  SessionSettingsConfig,
  NavSection,
} from '../../types/index.ts'

export function useSessionData({
  api,
  t: _t,
  sessionId,
  sessionTitle: _sessionTitle,
  workspaceId: propWorkspaceId,
  workspaceTitle: propWorkspaceTitle,
  useSessions,
  useWorkspaces,
}: ClientPageProps) {
  const sessionsState = React.useMemo(() => {
    if (!useSessions) return null
    try {
      if (typeof useSessions === 'function') {
        return useSessions((s: any) => s) || useSessions()
      }
      return useSessions
    } catch {
      return null
    }
  }, [useSessions])

  const currentSession = Array.isArray(sessionsState?.items)
    ? sessionsState.items.find((s: any) => s?.id === sessionId)
    : sessionsState?.byId && sessionId
      ? sessionsState.byId[sessionId]
      : null

  const workspacesState = React.useMemo(() => {
    if (!useWorkspaces) return null
    try {
      if (typeof useWorkspaces === 'function') {
        return useWorkspaces((w: any) => w) || useWorkspaces()
      }
      return useWorkspaces
    } catch {
      return null
    }
  }, [useWorkspaces])

  const currentWorkspace = Array.isArray(workspacesState?.items)
    ? workspacesState.items.find(
        (w: any) =>
          (sessionId &&
            w?.sessionIds &&
            Array.isArray(w.sessionIds) &&
            w.sessionIds.includes(sessionId)) ||
          (currentSession?.workspaceId &&
            (w?.workspaceId === currentSession.workspaceId ||
              w?.id === currentSession.workspaceId)) ||
          (propWorkspaceId &&
            (w?.workspaceId === propWorkspaceId ||
              w?.id === propWorkspaceId)) ||
          w?.isCurrent ||
          w?.active,
      ) || workspacesState.items[0]
    : null

  const currentWorkspaceId =
    propWorkspaceId ||
    currentSession?.workspaceId ||
    currentSession?.header?.workspaceId ||
    currentWorkspace?.workspaceId ||
    currentWorkspace?.id
  const currentWorkspaceTitle =
    propWorkspaceTitle ||
    currentWorkspace?.title ||
    currentWorkspace?.name ||
    currentWorkspace?.path

  const [activeNav, setActiveNav] = React.useState<NavSection>('model')
  const [copiedId, setCopiedId] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string>('')
  const [saveSuccessMsg, setSaveSuccessMsg] = React.useState<string>('')

  // Clone Preset toolbar state
  const [cloneSourceId, setCloneSourceId] = React.useState<string>('')
  const [cloning, setCloning] = React.useState<boolean>(false)
  const [cloneError, setCloneError] = React.useState<string>('')

  const [providers, setProviders] = React.useState<ModelProviderGroup[]>([])
  const [loadingModels, setLoadingModels] = React.useState<boolean>(false)
  const [availableMcpServers, setAvailableMcpServers] = React.useState<
    GlobalMcpServerConfig[]
  >([])
  const [availableSkills, setAvailableSkills] = React.useState<SkillItem[]>([])

  const defaultMode = currentWorkspaceId ? 'workspace' : 'default'

  // Form state
  const [modelConfig, setModelConfig] = React.useState<SubagentModelConfig>({
    mode: defaultMode,
  })
  const [mcpConfig, setMcpConfig] = React.useState<SessionMcpConfig>({
    mode: defaultMode,
    enabledServerIds: [],
  })
  const [skillsConfig, setSkillsConfig] = React.useState<SessionSkillsConfig>({
    mode: defaultMode,
    disabledSkills: [],
  })

  // Skills UI state
  const [skillsSearch, setSkillsSearch] = React.useState<string>('')
  const [sessionSkillModalTarget, setSessionSkillModalTarget] =
    React.useState<SkillItem | null>(null)
  const [skillsContentMap, setSkillsContentMap] = React.useState<
    Record<string, SkillItem>
  >({})
  const [skillsLoadingMap, setSkillsLoadingMap] = React.useState<
    Record<string, boolean>
  >({})
  const [refreshingSkills, setRefreshingSkills] = React.useState<boolean>(false)

  // Session Tools Modal State
  const [sessionToolsModalServer, setSessionToolsModalServer] =
    React.useState<GlobalMcpServerConfig | null>(null)
  const [sessionToolsMode, setSessionToolsMode] = React.useState<
    'default' | 'custom'
  >('default')
  const [sessionDisabledToolsSet, setSessionDisabledToolsSet] = React.useState<
    Set<string>
  >(new Set())
  const [sessionToolsFetching, setSessionToolsFetching] =
    React.useState<boolean>(false)
  const [sessionToolsList, setSessionToolsList] = React.useState<any[]>([])

  const [defaultSettings, setDefaultSettings] =
    React.useState<SessionSettingsConfig>({
      subagentModel: { mode: 'inherit' },
      mcp: { mode: 'default', enabledServerIds: [] },
      skills: { mode: 'default', disabledSkills: [] },
    })
  const [workspaceSettings, setWorkspaceSettings] = React.useState<
    SessionSettingsConfig | undefined
  >(undefined)
  const [hasSessionOverride, setHasSessionOverride] =
    React.useState<boolean>(false)

  // Set as default modal states
  const [setDefaultModalOpen, setSetDefaultModalOpen] =
    React.useState<boolean>(false)
  const [setDefaultTargetScope, setSetDefaultTargetScope] = React.useState<
    'workspace' | 'global'
  >(currentWorkspaceId ? 'workspace' : 'global')
  const [isRestoringDefault, setIsRestoringDefault] =
    React.useState<boolean>(false)

  const apiRef = React.useRef(api)
  apiRef.current = api

  const sessionsMap =
    typeof useSessions === 'function'
      ? useSessions((s: any) => s?.byId || {})
      : {}

  // Fetch models, mcp servers, and server-side config on mount or sessionId/workspaceId change
  React.useEffect(() => {
    let mounted = true

    async function loadModels() {
      if (typeof apiRef.current?.llm?.models !== 'function') return
      setLoadingModels(true)
      try {
        const modelsRes = await apiRef.current.llm.models({})
        if (
          mounted &&
          modelsRes?.result?.ok &&
          Array.isArray(modelsRes.result.value?.groups)
        ) {
          const groups = modelsRes.result.value.groups
          setProviders(groups)
          if (groups.length > 0) {
            setModelConfig((prev) => {
              if (prev.mode === 'custom' && !prev.provider) {
                const firstGroup = groups[0]
                return {
                  ...prev,
                  provider: firstGroup.id,
                  model: firstGroup.models?.[0]?.id || '',
                }
              }
              return prev
            })
          }
        }
      } catch {
        // ignore fetch failure
      } finally {
        if (mounted) {
          setLoadingModels(false)
        }
      }
    }

    async function loadData() {
      try {
        await loadModels()

        const params = new URLSearchParams()
        if (sessionId) params.set('sessionId', sessionId)
        if (currentWorkspaceId) params.set('workspaceId', currentWorkspaceId)
        const qs = params.toString()
        const url = qs ? `/api/session-settings?${qs}` : '/api/session-settings'
        const res = await fetch(url)
        if (res.ok && mounted) {
          const data = await res.json()
          if (data && data.ok) {
            if (data.defaultConfig) {
              setDefaultSettings(data.defaultConfig)
            }
            if (data.workspaceConfig && currentWorkspaceId) {
              setWorkspaceSettings(data.workspaceConfig)
            } else {
              setWorkspaceSettings(undefined)
            }

            if (data.hasSessionOverride !== undefined) {
              setHasSessionOverride(Boolean(data.hasSessionOverride))
            }
            if (data.config && sessionId) {
              setModelConfig(data.config.subagentModel)
              setMcpConfig(data.config.mcp)
              setSkillsConfig(data.config.skills)
            } else if (!sessionId && data.effectiveConfig) {
              setModelConfig(data.effectiveConfig.subagentModel)
              setMcpConfig(data.effectiveConfig.mcp)
              setSkillsConfig(data.effectiveConfig.skills)
            }

            if (Array.isArray(data.availableMcpServers)) {
              setAvailableMcpServers(data.availableMcpServers)
            }
            if (Array.isArray(data.availableSkills)) {
              setAvailableSkills(data.availableSkills)
            }
          }
        }
      } catch {
        // ignore load errors
      }
    }

    loadData()

    return () => {
      mounted = false
    }
  }, [sessionId, currentWorkspaceId])

  return {
    sessionsState,
    currentSession,
    workspacesState,
    currentWorkspace,
    currentWorkspaceId,
    currentWorkspaceTitle,
    activeNav,
    setActiveNav,
    copiedId,
    setCopiedId,
    error,
    setError,
    saveSuccessMsg,
    setSaveSuccessMsg,
    cloneSourceId,
    setCloneSourceId,
    cloning,
    setCloning,
    cloneError,
    setCloneError,
    providers,
    setProviders,
    loadingModels,
    availableMcpServers,
    setAvailableMcpServers,
    availableSkills,
    setAvailableSkills,
    modelConfig,
    setModelConfig,
    mcpConfig,
    setMcpConfig,
    skillsConfig,
    setSkillsConfig,
    skillsSearch,
    setSkillsSearch,
    sessionSkillModalTarget,
    setSessionSkillModalTarget,
    skillsContentMap,
    setSkillsContentMap,
    skillsLoadingMap,
    setSkillsLoadingMap,
    refreshingSkills,
    setRefreshingSkills,
    sessionToolsModalServer,
    setSessionToolsModalServer,
    sessionToolsMode,
    setSessionToolsMode,
    sessionDisabledToolsSet,
    setSessionDisabledToolsSet,
    sessionToolsFetching,
    setSessionToolsFetching,
    sessionToolsList,
    setSessionToolsList,
    defaultSettings,
    setDefaultSettings,
    workspaceSettings,
    setWorkspaceSettings,
    hasSessionOverride,
    setHasSessionOverride,
    setDefaultModalOpen,
    setSetDefaultModalOpen,
    setDefaultTargetScope,
    setSetDefaultTargetScope,
    isRestoringDefault,
    setIsRestoringDefault,
    sessionsMap,
    apiRef,
  }
}
