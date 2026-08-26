import * as React from 'react'
import type {
  SessionSettingsConfig,
  SubagentModelConfig,
  SessionMcpConfig,
  SessionSkillsConfig,
} from '../../types/index.ts'
import {
  getLocalSessionSettingsStore,
  saveLocalSessionSettingsStore,
} from '../../storage/index.ts'

export interface UseSessionActionsProps {
  sessionId?: string
  currentWorkspaceId?: string
  currentWorkspaceTitle?: string
  modelConfig: SubagentModelConfig
  mcpConfig: SessionMcpConfig
  skillsConfig: SessionSkillsConfig
  defaultSettings: SessionSettingsConfig
  workspaceSettings?: SessionSettingsConfig
  setModelConfig: (config: SubagentModelConfig) => void
  setMcpConfig: (config: SessionMcpConfig) => void
  setSkillsConfig: (config: SessionSkillsConfig) => void
  setDefaultSettings: (config: SessionSettingsConfig) => void
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
  sessionsMap: Record<string, any>
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
  defaultSettings,
  workspaceSettings: _workspaceSettings,
  setModelConfig,
  setMcpConfig,
  setSkillsConfig,
  setDefaultSettings,
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
      setCloneError(
        t('sessionSettings.clone.cannotCloneSelf') || '不能复制自己的预设',
      )
      return
    }

    setCloning(true)
    setCloneError('')
    setSaveSuccessMsg('')
    try {
      const res = await fetch(
        `/api/session-settings?sessionId=${encodeURIComponent(targetSourceId)}`,
      )
      if (!res.ok) {
        setCloneError(t('sessionSettings.clone.error'))
        return
      }
      const data = await res.json()
      if (data && data.ok) {
        const sourceConfig: SessionSettingsConfig =
          data.config?.subagentModel?.mode !== 'default' ||
          data.config?.mcp?.mode !== 'default' ||
          data.config?.skills?.mode !== 'default'
            ? data.config
            : data.effectiveConfig

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
          sessionsMap[targetSourceId]?.title ||
          sessionsMap[targetSourceId]?.header?.title ||
          targetSourceId

        setCloneSourceId('')
        setSaveSuccessMsg(
          t('sessionSettings.clone.success', { name: sourceTitle }),
        )
      } else {
        setCloneError(t('sessionSettings.clone.error'))
      }
    } catch (err: any) {
      setCloneError(
        t('sessionSettings.clone.error') + ': ' + (err?.message || String(err)),
      )
    } finally {
      setCloning(false)
    }
  }

  const handleSave = async (isSaveDefault: boolean = false) => {
    if (isSaveDefault) {
      setSavingDefault(true)
    } else {
      setSaving(true)
    }
    setSaveSuccessMsg('')
    setError('')

    const payloadConfig: SessionSettingsConfig = {
      subagentModel: modelConfig,
      mcp: mcpConfig,
      skills: skillsConfig,
    }

    try {
      const res = await fetch('/api/session-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          workspaceId: currentWorkspaceId,
          config: payloadConfig,
          isDefault: isSaveDefault,
        }),
      })

      const data = await res.json()
      if (res.ok && data?.ok) {
        const freshStore = getLocalSessionSettingsStore()
        if (isSaveDefault) {
          freshStore.default = payloadConfig
          if (sessionId) delete freshStore.sessions[sessionId]
          setDefaultSettings(payloadConfig)
          setHasSessionOverride(false)
          setSaveSuccessMsg(t('sessionSettings.notice.savedDefault'))
        } else if (sessionId) {
          const isAllInherited =
            (payloadConfig.subagentModel.mode === 'workspace' ||
              (!currentWorkspaceId &&
                payloadConfig.subagentModel.mode === 'default')) &&
            (payloadConfig.mcp.mode === 'workspace' ||
              (!currentWorkspaceId && payloadConfig.mcp.mode === 'default')) &&
            (payloadConfig.skills.mode === 'workspace' ||
              (!currentWorkspaceId && payloadConfig.skills.mode === 'default'))

          if (isAllInherited) {
            delete freshStore.sessions[sessionId]
            setHasSessionOverride(false)
          } else {
            freshStore.sessions[sessionId] = payloadConfig
            setHasSessionOverride(true)
          }
          setSaveSuccessMsg(t('sessionSettings.notice.saved'))
        }
        saveLocalSessionSettingsStore(freshStore)

        if (onSave) {
          onSave(payloadConfig)
        }
        setTimeout(() => setSaveSuccessMsg(''), 3000)
      } else {
        setError(
          t('sessionSettings.notice.error') + (data?.error || 'Unknown error'),
        )
      }
    } catch (err: any) {
      setError(
        t('sessionSettings.notice.error') + (err?.message || String(err)),
      )
    } finally {
      setSaving(false)
      setSavingDefault(false)
    }
  }

  const handleApplySetDefault = async (
    setDefaultTargetScope: 'workspace' | 'global',
    isRestoringDefault: boolean,
  ) => {
    setSavingDefault(true)
    setSaveSuccessMsg('')
    setError('')

    const payloadConfig: SessionSettingsConfig = isRestoringDefault
      ? setDefaultTargetScope === 'workspace'
        ? defaultSettings
        : {
            subagentModel: { mode: 'inherit' },
            mcp: {
              mode: 'default',
              enabledServerIds: [],
              toolsMode: {},
              disabledTools: {},
            },
            skills: { mode: 'default', disabledSkills: [] },
          }
      : {
          subagentModel: modelConfig,
          mcp: mcpConfig,
          skills: skillsConfig,
        }

    try {
      const res = await fetch('/api/session-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          workspaceId:
            setDefaultTargetScope === 'workspace'
              ? currentWorkspaceId
              : undefined,
          config: payloadConfig,
          isDefault: setDefaultTargetScope === 'global',
          isWorkspaceDefault: setDefaultTargetScope === 'workspace',
          isRestoringDefault,
        }),
      })

      const data = await res.json()
      if (res.ok && data?.ok) {
        const freshStore = getLocalSessionSettingsStore()
        if (setDefaultTargetScope === 'workspace' && currentWorkspaceId) {
          if (!freshStore.workspaces) freshStore.workspaces = {}
          if (isRestoringDefault) {
            delete freshStore.workspaces[currentWorkspaceId]
            setWorkspaceSettings(undefined)
          } else {
            freshStore.workspaces[currentWorkspaceId] = payloadConfig
            setWorkspaceSettings(payloadConfig)
          }
          setSaveSuccessMsg(
            t('sessionSettings.notice.savedWorkspace', {
              name: currentWorkspaceTitle || currentWorkspaceId,
            }) || t('sessionSettings.notice.savedWorkspaceDefault'),
          )
        } else {
          freshStore.default = payloadConfig
          setDefaultSettings(payloadConfig)
          setSaveSuccessMsg(t('sessionSettings.notice.savedDefault'))
        }

        saveLocalSessionSettingsStore(freshStore)
        setSetDefaultModalOpen(false)
        setIsRestoringDefault(false)
        if (onSave) onSave(payloadConfig)
        setTimeout(() => setSaveSuccessMsg(''), 3000)
      } else {
        setError(
          t('sessionSettings.notice.error') + (data?.error || 'Unknown error'),
        )
      }
    } catch (err: any) {
      setError(
        t('sessionSettings.notice.error') + (err?.message || String(err)),
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
        `/api/session-settings?sessionId=${encodeURIComponent(sessionId)}`,
        { method: 'DELETE' },
      )
      const data = await res.json()
      if (res.ok && data?.ok) {
        const freshStore = getLocalSessionSettingsStore()
        delete freshStore.sessions[sessionId]
        saveLocalSessionSettingsStore(freshStore)

        const defaultMode = currentWorkspaceId ? 'workspace' : 'default'
        setModelConfig({ mode: defaultMode })
        setMcpConfig({ mode: defaultMode, enabledServerIds: [] })
        setSkillsConfig({ mode: defaultMode, disabledSkills: [] })
        setHasSessionOverride(false)
        setSaveSuccessMsg(t('sessionSettings.notice.saved'))
        if (onSave) {
          onSave(data.effectiveConfig || freshStore.default)
        }
        setTimeout(() => setSaveSuccessMsg(''), 3000)
      }
    } catch (err: any) {
      setError(err?.message || String(err))
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
