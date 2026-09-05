import * as React from 'react'
import type {
  SubagentModelConfig,
  SessionMcpConfig,
  SessionSkillsConfig,
  SessionSettingsConfig,
  WorkspaceInfo,
  SkillItem,
} from '../../types/index.ts'
import { ModalDialog } from '../../components/index.ts'

const e = React.createElement

export interface SetDefaultModalProps {
  open: boolean
  setDefaultTargetScope: 'workspace' | 'global'
  setSetDefaultTargetScope: (scope: 'workspace' | 'global') => void
  isRestoringDefault: boolean
  setIsRestoringDefault: (restoring: boolean) => void
  currentWorkspaceId?: string
  currentWorkspaceTitle?: string
  currentWorkspace?: WorkspaceInfo
  workspaceSettings?: SessionSettingsConfig
  globalConfig: SessionSettingsConfig
  modelConfig: SubagentModelConfig
  mcpConfig: SessionMcpConfig
  skillsConfig: SessionSkillsConfig
  availableSkills?: SkillItem[]
  savingDefault: boolean
  onClose: () => void
  onApply: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function SetDefaultModal({
  open,
  setDefaultTargetScope,
  setSetDefaultTargetScope,
  isRestoringDefault,
  setIsRestoringDefault,
  currentWorkspaceId,
  currentWorkspaceTitle,
  currentWorkspace,
  workspaceSettings,
  globalConfig,
  modelConfig,
  mcpConfig,
  skillsConfig,
  availableSkills,
  savingDefault,
  onClose,
  onApply,
  t,
}: SetDefaultModalProps) {
  if (!open) return null

  const isTargetWorkspace = setDefaultTargetScope === 'workspace'

  const runtimeSkillsSet = React.useMemo(() => {
    return new Set(
      (availableSkills || []).filter((s) => s.isRuntime).map((s) => s.name),
    )
  }, [availableSkills])

  const filterNonRuntimeSkills = React.useCallback(
    (skillNames?: string[]) => {
      if (!skillNames || !Array.isArray(skillNames)) return []
      return skillNames.filter((name) => !runtimeSkillsSet.has(name))
    },
    [runtimeSkillsSet],
  )

  const formatSubagentModelSummary = (cfg?: SubagentModelConfig) => {
    if (!cfg) return t('sessionSettings.status.default')
    let base = t('sessionSettings.status.default')
    if (cfg.mode === 'custom') {
      if (cfg.inherit) base = t('sessionSettings.status.inherit')
      else if (cfg.model?.provider && cfg.model?.model) {
        base = `${cfg.model.provider} / ${cfg.model.model}`
      } else {
        base = t('sessionSettings.badge.custom')
      }
    } else if (cfg.mode === 'workspace') {
      base = t('sessionSettings.status.workspace')
    }

    const agentSelect =
      cfg.allowAgentSelectModel === false
        ? t('sessionSettings.switch.allowAgentSelectModel.summaryForced')
        : t('sessionSettings.switch.allowAgentSelectModel.summaryAuto')

    const forkOverride =
      cfg.overrideForkModel === true
        ? t('sessionSettings.switch.overrideForkModel.summaryEnabled')
        : ''

    return [base, agentSelect, forkOverride].filter(Boolean).join(' · ')
  }

  const beforeModelText =
    isTargetWorkspace && workspaceSettings?.subagentModel?.mode === 'custom'
      ? formatSubagentModelSummary(workspaceSettings.subagentModel)
      : formatSubagentModelSummary(globalConfig.subagentModel)

  const afterModelText = isRestoringDefault
    ? isTargetWorkspace
      ? formatSubagentModelSummary(globalConfig.subagentModel)
      : t('sessionSettings.status.inherit')
    : formatSubagentModelSummary(modelConfig)

  const beforeMcpCount = (
    isTargetWorkspace && workspaceSettings?.mcp?.mode === 'custom'
      ? (workspaceSettings.mcp.enabledServerIds ?? [])
      : (globalConfig?.mcp?.enabledServerIds ?? [])
  ).length

  const beforeMcpText =
    isTargetWorkspace && workspaceSettings?.mcp?.mode !== 'custom'
      ? t('sessionSettings.status.default')
      : t('sessionSettings.setDefaultModal.mcpCustom', {
          count: beforeMcpCount,
        })

  const afterMcpCount = (mcpConfig?.enabledServerIds ?? []).length
  const afterMcpText = isRestoringDefault
    ? isTargetWorkspace
      ? t('sessionSettings.setDefaultModal.mcpCustom', {
          count: (globalConfig?.mcp?.enabledServerIds ?? []).length,
        })
      : t('sessionSettings.status.default')
    : mcpConfig?.mode === 'custom'
      ? t('sessionSettings.setDefaultModal.mcpCustom', {
          count: afterMcpCount,
        })
      : mcpConfig?.mode === 'workspace'
        ? t('sessionSettings.status.workspace')
        : t('sessionSettings.status.default')

  const beforeSkillsDisabledCount = (
    isTargetWorkspace && workspaceSettings?.skills?.mode === 'custom'
      ? (workspaceSettings.skills.disabledModelSkills ?? [])
      : (globalConfig?.skills?.disabledModelSkills ?? [])
  ).length

  const beforeSkillsText =
    isTargetWorkspace && workspaceSettings?.skills?.mode !== 'custom'
      ? t('sessionSettings.status.default')
      : t('sessionSettings.setDefaultModal.skillsCustom', {
          count: beforeSkillsDisabledCount,
        })

  const afterSkillsDisabledCount = (
    skillsConfig?.mode === 'custom'
      ? filterNonRuntimeSkills(skillsConfig?.disabledModelSkills)
      : (globalConfig?.skills?.disabledModelSkills ?? [])
  ).length
  const afterSkillsText = isRestoringDefault
    ? isTargetWorkspace
      ? t('sessionSettings.setDefaultModal.skillsCustom', {
          count: (globalConfig?.skills?.disabledModelSkills || []).length,
        })
      : t('sessionSettings.setDefaultModal.skillsAll')
    : skillsConfig?.mode === 'custom'
      ? t('sessionSettings.setDefaultModal.skillsCustom', {
          count: afterSkillsDisabledCount,
        })
      : skillsConfig?.mode === 'workspace'
        ? t('sessionSettings.status.workspace')
        : t('sessionSettings.status.default')

  const modelChanged = beforeModelText !== afterModelText
  const mcpChanged = beforeMcpText !== afterMcpText
  const skillsChanged = beforeSkillsText !== afterSkillsText

  return e(
    ModalDialog,
    {
      open,
      onClose,
      title: e(
        'div',
        { className: 'dsh-set-default-title-row' },
        e('span', null, t('sessionSettings.setDefaultModal.title')),
        currentWorkspaceTitle
          ? e(
              'span',
              {
                className: 'dsh-session-id-chip dsh-modal-workspace-chip',
                title: currentWorkspace?.path || currentWorkspaceTitle,
              },
              `${t('sessionSettings.scope.workspaceLabel')}: ${currentWorkspaceTitle}`,
            )
          : null,
      ),
      subtitle: t('sessionSettings.setDefaultModal.desc'),
      panelClassName: 'dsh-sam-modal-panel dsh-set-default-modal',
      footer: [
        e(
          'div',
          { key: 'left', className: 'dsh-mcp-modal-footer-left' },
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn tertiary',
              onClick: () => setIsRestoringDefault(!isRestoringDefault),
            },
            isRestoringDefault
              ? t('sessionSettings.action.undo')
              : setDefaultTargetScope === 'workspace'
                ? t('sessionSettings.action.restoreWorkspaceToGlobal')
                : t('sessionSettings.action.restoreDefault'),
          ),
        ),
        e(
          'div',
          { key: 'right', className: 'dsh-mcp-modal-footer-right' },
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn secondary',
              onClick: onClose,
            },
            t('sessionSettings.action.cancel'),
          ),
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn primary',
              disabled: savingDefault,
              onClick: onApply,
            },
            savingDefault
              ? t('sessionSettings.action.savingDefault')
              : setDefaultTargetScope === 'workspace'
                ? t('sessionSettings.action.applyWorkspaceDefault')
                : t('sessionSettings.action.confirmApply'),
          ),
        ),
      ],
    },
    // Target scope switch
    e(
      'div',
      { className: 'dsh-set-default-scope-row' },
      e(
        'span',
        { className: 'dsh-set-default-scope-label' },
        t('sessionSettings.setDefaultModal.targetScope'),
      ),
      e(
        'div',
        { className: 'dsh-set-default-scope-tabs' },
        currentWorkspaceId
          ? e(
              'button',
              {
                type: 'button',
                className: `dsh-set-default-scope-btn ${setDefaultTargetScope === 'workspace' ? 'active' : ''}`,
                onClick: () => setSetDefaultTargetScope('workspace'),
              },
              t('sessionSettings.setDefaultModal.scopeWorkspace'),
            )
          : null,
        e(
          'button',
          {
            type: 'button',
            className: `dsh-set-default-scope-btn ${setDefaultTargetScope === 'global' ? 'active' : ''}`,
            onClick: () => setSetDefaultTargetScope('global'),
          },
          t('sessionSettings.setDefaultModal.scopeGlobal'),
        ),
      ),
    ),

    // Modal Body (Diff)
    e(
      'div',
      { className: 'dsh-set-default-modal-body' },
      isRestoringDefault
        ? e(
            'div',
            {
              className: 'dsh-sam-notice info',
              style: { marginBottom: 10 },
            },
            t('sessionSettings.setDefaultModal.restoreDefaultNotice'),
          )
        : null,
      e(
        'div',
        { className: 'dsh-diff-grid' },
        // Row 1: Subagent Model
        e(
          'div',
          { className: 'dsh-diff-row' },
          e(
            'div',
            { className: 'dsh-diff-row-header' },
            e(
              'span',
              { className: 'dsh-diff-row-title' },
              t('sessionSettings.setDefaultModal.modelSection'),
            ),
            modelChanged
              ? e(
                  'span',
                  { className: 'dsh-diff-changed-tag' },
                  t('sessionSettings.setDefaultModal.changed'),
                )
              : e(
                  'span',
                  { className: 'dsh-diff-col-title' },
                  t('sessionSettings.setDefaultModal.unchanged'),
                ),
          ),
          e(
            'div',
            { className: 'dsh-diff-cols' },
            e(
              'div',
              { className: 'dsh-diff-col before' },
              e(
                'span',
                { className: 'dsh-diff-col-title' },
                setDefaultTargetScope === 'workspace'
                  ? t('sessionSettings.setDefaultModal.diffBeforeWorkspace')
                  : t('sessionSettings.setDefaultModal.diffBeforeGlobal'),
              ),
              e('span', { className: 'dsh-diff-col-value' }, beforeModelText),
            ),
            e(
              'div',
              { className: 'dsh-diff-col after' },
              e(
                'span',
                { className: 'dsh-diff-col-title' },
                setDefaultTargetScope === 'workspace'
                  ? t('sessionSettings.setDefaultModal.diffAfterWorkspace')
                  : t('sessionSettings.setDefaultModal.diffAfterGlobal'),
              ),
              e(
                'span',
                {
                  className: `dsh-diff-col-value ${modelChanged ? 'changed' : ''}`,
                },
                afterModelText,
              ),
            ),
          ),
        ),

        // Row 2: MCP Servers
        e(
          'div',
          { className: 'dsh-diff-row' },
          e(
            'div',
            { className: 'dsh-diff-row-header' },
            e(
              'span',
              { className: 'dsh-diff-row-title' },
              t('sessionSettings.setDefaultModal.mcpSection'),
            ),
            mcpChanged
              ? e(
                  'span',
                  { className: 'dsh-diff-changed-tag' },
                  t('sessionSettings.setDefaultModal.changed'),
                )
              : e(
                  'span',
                  { className: 'dsh-diff-col-title' },
                  t('sessionSettings.setDefaultModal.unchanged'),
                ),
          ),
          e(
            'div',
            { className: 'dsh-diff-cols' },
            e(
              'div',
              { className: 'dsh-diff-col before' },
              e(
                'span',
                { className: 'dsh-diff-col-title' },
                setDefaultTargetScope === 'workspace'
                  ? t('sessionSettings.setDefaultModal.diffBeforeWorkspace')
                  : t('sessionSettings.setDefaultModal.diffBeforeGlobal'),
              ),
              e('span', { className: 'dsh-diff-col-value' }, beforeMcpText),
            ),
            e(
              'div',
              { className: 'dsh-diff-col after' },
              e(
                'span',
                { className: 'dsh-diff-col-title' },
                setDefaultTargetScope === 'workspace'
                  ? t('sessionSettings.setDefaultModal.diffAfterWorkspace')
                  : t('sessionSettings.setDefaultModal.diffAfterGlobal'),
              ),
              e(
                'span',
                {
                  className: `dsh-diff-col-value ${mcpChanged ? 'changed' : ''}`,
                },
                afterMcpText,
              ),
            ),
          ),
        ),

        // Row 3: Skills
        e(
          'div',
          { className: 'dsh-diff-row' },
          e(
            'div',
            { className: 'dsh-diff-row-header' },
            e(
              'span',
              { className: 'dsh-diff-row-title' },
              t('sessionSettings.setDefaultModal.skillsSection'),
            ),
            skillsChanged
              ? e(
                  'span',
                  { className: 'dsh-diff-changed-tag' },
                  t('sessionSettings.setDefaultModal.changed'),
                )
              : e(
                  'span',
                  { className: 'dsh-diff-col-title' },
                  t('sessionSettings.setDefaultModal.unchanged'),
                ),
          ),
          e(
            'div',
            { className: 'dsh-diff-cols' },
            e(
              'div',
              { className: 'dsh-diff-col before' },
              e(
                'span',
                { className: 'dsh-diff-col-title' },
                setDefaultTargetScope === 'workspace'
                  ? t('sessionSettings.setDefaultModal.diffBeforeWorkspace')
                  : t('sessionSettings.setDefaultModal.diffBeforeGlobal'),
              ),
              e('span', { className: 'dsh-diff-col-value' }, beforeSkillsText),
            ),
            e(
              'div',
              { className: 'dsh-diff-col after' },
              e(
                'span',
                { className: 'dsh-diff-col-title' },
                setDefaultTargetScope === 'workspace'
                  ? t('sessionSettings.setDefaultModal.diffAfterWorkspace')
                  : t('sessionSettings.setDefaultModal.diffAfterGlobal'),
              ),
              e(
                'span',
                {
                  className: `dsh-diff-col-value ${skillsChanged ? 'changed' : ''}`,
                },
                afterSkillsText,
              ),
            ),
          ),
        ),
      ),
    ),
  )
}
