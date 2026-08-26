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
  McpDiscoveredTool,
  NavSection,
} from '../../types/index.ts'
import {
  getLocalSessionSettingsStore,
  getLocalMcpServers,
  getSessionRawSettings,
  getSessionEffectiveSettings,
  saveLocalSessionSettingsStore,
  saveLocalMcpServers,
} from '../../storage/index.ts'

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

  const localStore = getLocalSessionSettingsStore()
  const localServers = getLocalMcpServers()
  const initialRaw = getSessionRawSettings(
    localStore,
    sessionId,
    currentWorkspaceId,
  )
  const initialEffective = getSessionEffectiveSettings(
    localStore,
    localServers,
    sessionId,
    currentWorkspaceId,
  )

  const [activeNav, setActiveNav] = React.useState<NavSection>('model')
  const [copiedId, setCopiedId] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string>('')
  const [saveSuccessMsg, setSaveSuccessMsg] = React.useState<string>('')

  // Clone Preset toolbar state
  const [cloneSourceId, setCloneSourceId] = React.useState<string>('')
  const [cloning, setCloning] = React.useState<boolean>(false)
  const [cloneError, setCloneError] = React.useState<string>('')

  const [providers, setProviders] = React.useState<ModelProviderGroup[]>([])
  const [availableMcpServers, setAvailableMcpServers] =
    React.useState<GlobalMcpServerConfig[]>(localServers)
  const [availableSkills, setAvailableSkills] = React.useState<SkillItem[]>([])

  // Form state
  const [modelConfig, setModelConfig] = React.useState<SubagentModelConfig>(
    sessionId
      ? initialRaw.config.subagentModel
      : initialEffective.subagentModel,
  )
  const [mcpConfig, setMcpConfig] = React.useState<SessionMcpConfig>(
    sessionId ? initialRaw.config.mcp : initialEffective.mcp,
  )
  const [skillsConfig, setSkillsConfig] = React.useState<SessionSkillsConfig>(
    sessionId ? initialRaw.config.skills : initialEffective.skills,
  )

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
  const [sessionToolsSearch, setSessionToolsSearch] = React.useState<string>('')
  const [sessionToolsExpandedSchemas, setSessionToolsExpandedSchemas] =
    React.useState<Set<string>>(new Set())
  const [sessionToolSchemaModes, setSessionToolSchemaModes] = React.useState<
    Record<string, 'list' | 'raw'>
  >({})
  const [sessionToolsFetching, setSessionToolsFetching] =
    React.useState<boolean>(false)
  const [sessionToolsList, setSessionToolsList] = React.useState<
    McpDiscoveredTool[]
  >([])

  const [defaultSettings, setDefaultSettings] =
    React.useState<SessionSettingsConfig>(
      localStore.default || {
        subagentModel: { mode: 'inherit' },
        mcp: { mode: 'default', enabledServerIds: [] },
        skills: { mode: 'default', disabledSkills: [] },
      },
    )
  const [workspaceSettings, setWorkspaceSettings] = React.useState<
    SessionSettingsConfig | undefined
  >(
    currentWorkspaceId && localStore.workspaces
      ? localStore.workspaces[currentWorkspaceId]
      : undefined,
  )
  const [hasSessionOverride, setHasSessionOverride] = React.useState<boolean>(
    initialRaw.hasOverride,
  )

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

    const curStore = getLocalSessionSettingsStore()
    const curServers = getLocalMcpServers()
    const curRaw = getSessionRawSettings(
      curStore,
      sessionId,
      currentWorkspaceId,
    )
    const curEffective = getSessionEffectiveSettings(
      curStore,
      curServers,
      sessionId,
      currentWorkspaceId,
    )

    if (sessionId) {
      setModelConfig(curRaw.config.subagentModel)
      setMcpConfig(curRaw.config.mcp)
      setSkillsConfig(curRaw.config.skills)
      setHasSessionOverride(curRaw.hasOverride)
    } else {
      setModelConfig(curEffective.subagentModel)
      setMcpConfig(curEffective.mcp)
      setSkillsConfig(curEffective.skills)
      setHasSessionOverride(false)
    }

    if (curStore.default) {
      setDefaultSettings(curStore.default)
    }
    if (currentWorkspaceId && curStore.workspaces?.[currentWorkspaceId]) {
      setWorkspaceSettings(curStore.workspaces[currentWorkspaceId])
    } else {
      setWorkspaceSettings(undefined)
    }

    async function loadData() {
      try {
        if (apiRef.current?.llm?.models) {
          try {
            const clientApi = apiRef.current
            if (typeof clientApi.llm.models === 'function') {
              const modelsRes = await clientApi.llm.models({})
              if (mounted && Array.isArray(modelsRes?.groups)) {
                setProviders(modelsRes.groups)
              }
            }
          } catch {
            // ignore catalog fetch failure
          }
        }

        const params = new URLSearchParams()
        if (sessionId) params.set('sessionId', sessionId)
        if (currentWorkspaceId) params.set('workspaceId', currentWorkspaceId)
        const qs = params.toString()
        const url = qs ? `/api/session-settings?${qs}` : '/api/session-settings'
        const res = await fetch(url)
        if (res.ok && mounted) {
          const data = await res.json()
          if (data && data.ok) {
            const freshStore = getLocalSessionSettingsStore()
            if (data.defaultConfig) {
              freshStore.default = data.defaultConfig
              setDefaultSettings(data.defaultConfig)
            }
            if (data.workspaceConfig && currentWorkspaceId) {
              if (!freshStore.workspaces) freshStore.workspaces = {}
              freshStore.workspaces[currentWorkspaceId] = data.workspaceConfig
              setWorkspaceSettings(data.workspaceConfig)
            } else if (
              currentWorkspaceId &&
              freshStore.workspaces?.[currentWorkspaceId]
            ) {
              setWorkspaceSettings(freshStore.workspaces[currentWorkspaceId])
            }
            if (data.config && sessionId) {
              freshStore.sessions[sessionId] = data.config
            }
            saveLocalSessionSettingsStore(freshStore)

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
              saveLocalMcpServers(data.availableMcpServers)
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
    localStore,
    localServers,
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
    sessionToolsSearch,
    setSessionToolsSearch,
    sessionToolsExpandedSchemas,
    setSessionToolsExpandedSchemas,
    sessionToolSchemaModes,
    setSessionToolSchemaModes,
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
