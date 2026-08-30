import * as React from 'react'
import {
  type SessionSettingsConfig,
  type SubagentModelConfig,
  type SessionMcpConfig,
  type SessionSkillsConfig,
  type SessionInfo,
  API_ENDPOINTS,
} from '../../types/index.ts'
import {
  isSessionCustomized,
  resolveEffectiveSessionConfig,
} from '../../utils/config.ts'

export interface UseSessionActionsProps {
  sessionId?: string
  currentWorkspaceId?: string
  currentWorkspaceTitle?: string
  modelConfig: SubagentModelConfig
  mcpConfig: SessionMcpConfig
  skillsConfig: SessionSkillsConfig
  globalConfig: SessionSettingsConfig
  setModelConfig: (config: SubagentModelConfig) => void
  setMcpConfig: (config: SessionMcpConfig) => void
  setSkillsConfig: (config: SessionSkillsConfig) => void
  setGlobalConfig: (config: SessionSettingsConfig) => void
  setWorkspaceSettings: (config: SessionSettingsConfig | undefined) => void
  setHasSessionOverride: (override: boolean) => void
  setSaveSuccessMsg: (msg: string) => void
  setError: (err: string) => void
  setSetDefaultModalOpen: (open: boolean) => void
  setIsRestoringDefault: (restoring: boolean) => void
  cloneSourceId: string
  setCloneSourceId: (id: string) => void
  setCloning: (cloning: boolean) => void
  setCloneError: (err: string) => void
  setCopiedId: (copied: boolean) => void
  sessionsMap: Record<string, SessionInfo>
  onSave?: (config: SessionSettingsConfig) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function useSessionActions({
  sessionId,
  currentWorkspaceId,
  currentWorkspaceTitle,
  modelConfig,
  mcpConfig,
  skillsConfig,
  globalConfig,
  setModelConfig,
  setMcpConfig,
  setSkillsConfig,
  setGlobalConfig,
  setWorkspaceSettings,
  setHasSessionOverride,
  setSaveSuccessMsg,
  setError,
  setSetDefaultModalOpen,
  setIsRestoringDefault,
  cloneSourceId,
  setCloneSourceId,
  setCloning,
  setCloneError,
  setCopiedId,
  sessionsMap,
  onSave,
  t,
}: UseSessionActionsProps) {
  const [saving, setSaving] = React.useState<boolean>(false)
  const [savingDefault, setSavingDefault] = React.useState<boolean>(false)

  const handleCopySessionId = async () => {
    if (!sessionId) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(sessionId)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = sessionId
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        textarea.remove()
      }
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    } catch {}
  }

  const handleClonePreset = async () => {
    const targetSourceId = cloneSourceId.trim()
    if (!targetSourceId) return

    if (sessionId && targetSourceId === sessionId) {
      setCloneError(t('sessionSettings.clone.cannotCloneSelf'))
      return
    }

    setCloning(true)
    setCloneError('')
    setSaveSuccessMsg('')
    try {
      const res = await fetch(
        `${API_ENDPOINTS.getSettings}?sessionId=${encodeURIComponent(targetSourceId)}`,
      )
      if (!res.ok) {
        setCloneError(t('sessionSettings.clone.error'))
        return
      }
      const data = (await res.json()) as {
        ok?: boolean
        sessionConfig?: SessionSettingsConfig
        workspaceConfig?: SessionSettingsConfig
        globalConfig?: SessionSettingsConfig
      }
      if (data && data.ok) {
        const sourceConfig: SessionSettingsConfig =
          resolveEffectiveSessionConfig(
            data.sessionConfig,
            data.workspaceConfig,
            data.globalConfig,
          )

        if (sourceConfig.subagentModel) {
          setModelConfig(sourceConfig.subagentModel)
        }
        if (sourceConfig.mcp) {
          setMcpConfig(sourceConfig.mcp)
        }
        if (sourceConfig.skills) {
          setSkillsConfig(sourceConfig.skills)
        }

        const sourceTitle =
          sessionsMap[targetSourceId]?.title || targetSourceId.slice(0, 8)

        setCloneSourceId('')
        setSaveSuccessMsg(
          t('sessionSettings.clone.success', { name: sourceTitle }),
        )
      } else {
        setCloneError(t('sessionSettings.clone.error'))
      }
    } catch (err: unknown) {
      setCloneError(
        t('sessionSettings.clone.error') +
          ': ' +
          (err instanceof Error ? err.message : String(err)),
      )
    } finally {
      setCloning(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveSuccessMsg('')
    setError('')

    const payloadConfig: SessionSettingsConfig = {
      subagentModel: modelConfig,
      mcp: mcpConfig,
      skills: skillsConfig,
    }

    try {
      const res = await fetch(API_ENDPOINTS.saveSettings, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          config: payloadConfig,
        }),
      })

      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (res.ok && data?.ok) {
        if (sessionId) {
          setHasSessionOverride(isSessionCustomized(payloadConfig))
          setSaveSuccessMsg(t('sessionSettings.notice.saved'))
        }

        if (onSave) {
          onSave(payloadConfig)
        }
        setTimeout(() => setSaveSuccessMsg(''), 3000)
      } else {
        setError(
          t('sessionSettings.notice.error') + (data?.error || 'Unknown error'),
        )
      }
    } catch (err: unknown) {
      setError(
        t('sessionSettings.notice.error') +
          (err instanceof Error ? err.message : String(err)),
      )
    } finally {
      setSaving(false)
    }
  }

  const handleApplySetDefault = async (
    setDefaultTargetScope: 'workspace' | 'global',
    isRestoringDefault: boolean,
  ) => {
    setSavingDefault(true)
    setSaveSuccessMsg('')
    setError('')

    try {
      if (setDefaultTargetScope === 'global') {
        const payloadGlobalConfig: SessionSettingsConfig = isRestoringDefault
          ? {
              subagentModel: {},
              mcp: { enabledServerIds: [] },
              skills: { disabledModelSkills: [], disabledUserSkills: [] },
            }
          : {
              subagentModel:
                modelConfig.mode === 'custom' &&
                !modelConfig.inherit &&
                modelConfig.model?.provider &&
                modelConfig.model?.model
                  ? {
                      inherit: false,
                      model: modelConfig.model,
                    }
                  : modelConfig.mode === 'custom'
                    ? { inherit: true }
                    : (globalConfig.subagentModel ?? { inherit: true }),
              mcp:
                mcpConfig.mode === 'custom'
                  ? {
                      enabledServerIds: mcpConfig.enabledServerIds ?? [],
                      toolsMode: mcpConfig.toolsMode,
                      disabledTools: mcpConfig.disabledTools,
                    }
                  : (globalConfig.mcp ?? { enabledServerIds: [] }),
              skills:
                skillsConfig.mode === 'custom'
                  ? {
                      disabledModelSkills:
                        skillsConfig.disabledModelSkills ?? [],
                      disabledUserSkills: skillsConfig.disabledUserSkills ?? [],
                    }
                  : (globalConfig.skills ?? {
                      disabledModelSkills: [],
                      disabledUserSkills: [],
                    }),
            }

        const res = await fetch(API_ENDPOINTS.saveSettings, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isDefault: true,
            globalConfig: payloadGlobalConfig,
            isRestoringDefault,
          }),
        })

        const data = (await res.json()) as { ok?: boolean; error?: string }
        if (res.ok && data?.ok) {
          setGlobalConfig(payloadGlobalConfig)
          setSaveSuccessMsg(t('sessionSettings.notice.savedDefault'))
          setSetDefaultModalOpen(false)
          setIsRestoringDefault(false)
          setTimeout(() => setSaveSuccessMsg(''), 3000)
        } else {
          setError(
            t('sessionSettings.notice.error') +
              (data?.error || 'Unknown error'),
          )
        }
      } else {
        // Workspace default
        const payloadConfig: SessionSettingsConfig = isRestoringDefault
          ? {
              subagentModel: { mode: 'global' },
              mcp: { mode: 'global' },
              skills: { mode: 'global' },
            }
          : {
              subagentModel: modelConfig,
              mcp: mcpConfig,
              skills: skillsConfig,
            }

        const res = await fetch(API_ENDPOINTS.saveSettings, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            config: payloadConfig,
            isWorkspaceDefault: true,
            isRestoringDefault,
          }),
        })

        const data = (await res.json()) as { ok?: boolean; error?: string }
        if (res.ok && data?.ok) {
          if (isRestoringDefault) {
            setWorkspaceSettings(undefined)
          } else {
            setWorkspaceSettings(payloadConfig)
          }
          setSaveSuccessMsg(
            t('sessionSettings.notice.savedWorkspace', {
              name: currentWorkspaceTitle || currentWorkspaceId || '',
            }),
          )
          setSetDefaultModalOpen(false)
          setIsRestoringDefault(false)
          if (onSave) onSave(payloadConfig)
          setTimeout(() => setSaveSuccessMsg(''), 3000)
        } else {
          setError(
            t('sessionSettings.notice.error') +
              (data?.error || 'Unknown error'),
          )
        }
      }
    } catch (err: unknown) {
      setError(
        t('sessionSettings.notice.error') +
          (err instanceof Error ? err.message : String(err)),
      )
    } finally {
      setSavingDefault(false)
    }
  }

  const handleResetSession = async () => {
    if (!sessionId) return
    setSaving(true)
    setSaveSuccessMsg('')
    setError('')

    try {
      const res = await fetch(
        `${API_ENDPOINTS.deleteSettings}?sessionId=${encodeURIComponent(sessionId)}`,
        { method: 'DELETE' },
      )
      const data = (await res.json()) as {
        ok?: boolean
        sessionConfig?: SessionSettingsConfig
        workspaceConfig?: SessionSettingsConfig
        globalConfig?: SessionSettingsConfig
      }
      if (res.ok && data?.ok) {
        const defaultMode = currentWorkspaceId ? 'workspace' : 'global'
        setModelConfig({ mode: defaultMode })
        setMcpConfig({ mode: defaultMode })
        setSkillsConfig({
          mode: defaultMode,
        })
        setHasSessionOverride(false)
        setSaveSuccessMsg(t('sessionSettings.notice.saved'))
        if (onSave) {
          const effective = resolveEffectiveSessionConfig(
            data.sessionConfig,
            data.workspaceConfig,
            data.globalConfig,
          )
          onSave(effective)
        }
        setTimeout(() => setSaveSuccessMsg(''), 3000)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return {
    saving,
    savingDefault,
    handleCopySessionId,
    handleClonePreset,
    handleSave,
    handleApplySetDefault,
    handleResetSession,
  }
}
