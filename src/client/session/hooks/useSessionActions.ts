import * as React from 'react'
import {
  type SessionSettingsConfig,
  type SubagentModelConfig,
  type SessionMcpConfig,
  type SessionSandboxConfig,
  type SessionSkillsConfig,
  type SessionInfo,
  API_ENDPOINTS,
  API_METHODS,
} from '../../types/index.ts'
import type { SettingsScope } from '../sections/HeaderBar.ts'
import { isSessionCustomized } from '../../utils/config.ts'

export interface UseSessionActionsProps {
  sessionId?: string
  currentWorkspaceId?: string
  currentWorkspaceTitle?: string
  modelConfig: SubagentModelConfig
  mcpConfig: SessionMcpConfig
  skillsConfig: SessionSkillsConfig
  sandboxConfig: SessionSandboxConfig
  workspaceModelConfig: SubagentModelConfig
  workspaceMcpConfig: SessionMcpConfig
  workspaceSkillsConfig: SessionSkillsConfig
  workspaceSandboxConfig: SessionSandboxConfig
  globalModelConfig: SubagentModelConfig
  globalMcpConfig: SessionMcpConfig
  globalSkillsConfig: SessionSkillsConfig
  globalSandboxConfig: SessionSandboxConfig
  setModelConfig: (config: SubagentModelConfig) => void
  setMcpConfig: (config: SessionMcpConfig) => void
  setSkillsConfig: (config: SessionSkillsConfig) => void
  setSandboxConfig: (config: SessionSandboxConfig) => void
  setWorkspaceModelConfig: (config: SubagentModelConfig) => void
  setWorkspaceMcpConfig: (config: SessionMcpConfig) => void
  setWorkspaceSkillsConfig: (config: SessionSkillsConfig) => void
  setWorkspaceSandboxConfig: (config: SessionSandboxConfig) => void
  setGlobalModelConfig: (config: SubagentModelConfig) => void
  setGlobalMcpConfig: (config: SessionMcpConfig) => void
  setGlobalSkillsConfig: (config: SessionSkillsConfig) => void
  setGlobalSandboxConfig: (config: SessionSandboxConfig) => void
  setGlobalConfig: (config: SessionSettingsConfig) => void
  setWorkspaceSettings: (config: SessionSettingsConfig | undefined) => void
  setHasSessionOverride: (override: boolean) => void
  setSaveSuccessMsg: (msg: string) => void
  setError: (err: string) => void
  setCopiedId: (copied: boolean) => void
  sessionsMap: Record<string, SessionInfo>
  reloadMcpServers?: () => void | Promise<void>
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
  sandboxConfig,
  workspaceModelConfig,
  workspaceMcpConfig,
  workspaceSkillsConfig,
  workspaceSandboxConfig,
  globalModelConfig,
  globalMcpConfig,
  globalSkillsConfig,
  globalSandboxConfig,
  setModelConfig,
  setMcpConfig,
  setSkillsConfig,
  setSandboxConfig,
  setWorkspaceModelConfig,
  setWorkspaceMcpConfig,
  setWorkspaceSkillsConfig,
  setWorkspaceSandboxConfig,
  setGlobalModelConfig,
  setGlobalMcpConfig,
  setGlobalSkillsConfig,
  setGlobalSandboxConfig,
  setGlobalConfig,
  setWorkspaceSettings,
  setHasSessionOverride,
  setSaveSuccessMsg,
  setError,
  setCopiedId,
  reloadMcpServers,
  onSave,
  t,
}: UseSessionActionsProps) {
  const [saving, setSaving] = React.useState<boolean>(false)

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

  const handleSaveScope = async (activeScope: SettingsScope) => {
    setSaving(true)
    setSaveSuccessMsg('')
    setError('')

    try {
      if (activeScope === 'global') {
        const payloadGlobalConfig: SessionSettingsConfig = {
          subagentModel: globalModelConfig,
          mcp: globalMcpConfig,
          skills: globalSkillsConfig,
          sandbox: globalSandboxConfig,
        }

        const res = await fetch(API_ENDPOINTS.saveSettings, {
          method: API_METHODS.saveSettings,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope: 'global',
            globalConfig: payloadGlobalConfig,
          }),
        })

        const data = (await res.json()) as { ok?: boolean; error?: string }
        if (res.ok && data?.ok) {
          setGlobalConfig(payloadGlobalConfig)
          setSaveSuccessMsg(t('sessionSettings.notice.savedDefault'))
          if (reloadMcpServers) {
            void Promise.resolve()
              .then(() => reloadMcpServers())
              .catch(() => {})
          }
          setTimeout(() => setSaveSuccessMsg(''), 3000)
        } else {
          setError(
            t('sessionSettings.notice.error') +
              (data?.error || 'Unknown error'),
          )
        }
      } else if (activeScope === 'workspace') {
        if (!currentWorkspaceId) {
          setError(t('sessionSettings.scopeTabs.noWorkspace'))
          return
        }

        const payloadWorkspaceConfig: SessionSettingsConfig = {
          subagentModel: workspaceModelConfig,
          mcp: workspaceMcpConfig,
          skills: workspaceSkillsConfig,
          sandbox: workspaceSandboxConfig,
        }

        const res = await fetch(API_ENDPOINTS.saveSettings, {
          method: API_METHODS.saveSettings,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope: 'workspace',
            config: payloadWorkspaceConfig,
            workspaceId: currentWorkspaceId,
          }),
        })

        const data = (await res.json()) as { ok?: boolean; error?: string }
        if (res.ok && data?.ok) {
          setWorkspaceSettings(payloadWorkspaceConfig)
          setSaveSuccessMsg(
            t('sessionSettings.notice.savedWorkspace', {
              name: currentWorkspaceTitle || currentWorkspaceId || '',
            }),
          )
          if (reloadMcpServers) {
            void Promise.resolve()
              .then(() => reloadMcpServers())
              .catch(() => {})
          }
          setTimeout(() => setSaveSuccessMsg(''), 3000)
        } else {
          setError(
            t('sessionSettings.notice.error') +
              (data?.error || 'Unknown error'),
          )
        }
      } else {
        // Session scope. There is no fallback target: a save without a live
        // session would have to guess one, which is exactly the failure this
        // scope discriminator exists to prevent. The tab is disabled without a
        // session, so this is a guard, not a user-facing path.
        if (!sessionId) {
          setError(t('sessionSettings.scopeTabs.sessionDisabledHint'))
          return
        }

        const payloadConfig: SessionSettingsConfig = {
          subagentModel: modelConfig,
          mcp: mcpConfig,
          skills: skillsConfig,
          sandbox: sandboxConfig,
        }

        const res = await fetch(API_ENDPOINTS.saveSettings, {
          method: API_METHODS.saveSettings,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope: 'session',
            config: payloadConfig,
            sessionId,
          }),
        })

        const data = (await res.json()) as {
          ok?: boolean
          error?: string
        }
        if (res.ok && data?.ok) {
          // Write the accepted config back into page state. Without this the
          // panel keeps rendering the pre-save draft until a reload, so a
          // successful save looks like it did nothing — the same write-back the
          // global and workspace branches already perform.
          setSandboxConfig(payloadConfig.sandbox)
          setHasSessionOverride(isSessionCustomized(payloadConfig))
          setSaveSuccessMsg(t('sessionSettings.notice.saved'))

          if (onSave) {
            onSave(payloadConfig)
          }

          if (reloadMcpServers) {
            void Promise.resolve()
              .then(() => reloadMcpServers())
              .catch(() => {})
          }

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
      setSaving(false)
    }
  }

  const handleResetScope = async (activeScope: SettingsScope) => {
    setSaving(true)
    setSaveSuccessMsg('')
    setError('')

    try {
      if (activeScope === 'global') {
        const res = await fetch(API_ENDPOINTS.saveSettings, {
          method: API_METHODS.saveSettings,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope: 'global',
            isRestoringDefault: true,
          }),
        })

        const data = (await res.json()) as { ok?: boolean; error?: string }
        if (res.ok && data?.ok) {
          const defaultGlobal: SessionSettingsConfig = {
            subagentModel: {
              inherit: true,
              allowAgentSelectModel: true,
              overrideForkModel: false,
            },
            mcp: { enabledServerIds: [] },
            skills: { disabledModelSkills: [], disabledUserSkills: [] },
            sandbox: { allow: [] },
          }
          setGlobalConfig(defaultGlobal)
          setGlobalModelConfig(defaultGlobal.subagentModel)
          setGlobalMcpConfig(defaultGlobal.mcp)
          setGlobalSkillsConfig(defaultGlobal.skills)
          setGlobalSandboxConfig(defaultGlobal.sandbox)
          setSaveSuccessMsg(t('sessionSettings.notice.resetSuccess'))
          setTimeout(() => setSaveSuccessMsg(''), 3000)
        } else {
          setError(
            t('sessionSettings.notice.error') +
              (data?.error || 'Unknown error'),
          )
        }
      } else if (activeScope === 'workspace') {
        if (!currentWorkspaceId) return
        const res = await fetch(API_ENDPOINTS.saveSettings, {
          method: API_METHODS.saveSettings,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope: 'workspace',
            workspaceId: currentWorkspaceId,
            isRestoringDefault: true,
          }),
        })

        const data = (await res.json()) as { ok?: boolean; error?: string }
        if (res.ok && data?.ok) {
          setWorkspaceSettings(undefined)
          setWorkspaceModelConfig({ mode: 'global' })
          setWorkspaceMcpConfig({ mode: 'global' })
          setWorkspaceSkillsConfig({ mode: 'global' })
          setWorkspaceSandboxConfig({ mode: 'global' })
          setSaveSuccessMsg(t('sessionSettings.notice.resetSuccess'))
          setTimeout(() => setSaveSuccessMsg(''), 3000)
        } else {
          setError(
            t('sessionSettings.notice.error') +
              (data?.error || 'Unknown error'),
          )
        }
      } else {
        // Session scope: resetting writes the inherited default back onto the
        // session. Without one there is nothing to reset.
        if (!sessionId) {
          setError(t('sessionSettings.scopeTabs.sessionDisabledHint'))
          return
        }

        // Reset is a write, not a delete: one endpoint, discriminated by scope.
        const res = await fetch(API_ENDPOINTS.saveSettings, {
          method: API_METHODS.saveSettings,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope: 'session',
            sessionId,
            isRestoringDefault: true,
          }),
        })
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
          setSkillsConfig({ mode: defaultMode })
          setSandboxConfig({ mode: defaultMode })
          setHasSessionOverride(false)
          setSaveSuccessMsg(t('sessionSettings.notice.resetSuccess'))
          setTimeout(() => setSaveSuccessMsg(''), 3000)
        } else {
          setError(t('sessionSettings.notice.error'))
        }
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

  return {
    saving,
    handleCopySessionId,
    handleSaveScope,
    handleResetScope,
  }
}
