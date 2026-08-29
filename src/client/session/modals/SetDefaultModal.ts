import * as React from 'react'
import type {
  SubagentModelConfig,
  SessionMcpConfig,
  SessionSkillsConfig,
  SessionSettingsConfig,
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
  currentWorkspace?: any
  workspaceSettings?: SessionSettingsConfig
  defaultSettings: SessionSettingsConfig
  modelConfig: SubagentModelConfig
  mcpConfig: SessionMcpConfig
  skillsConfig: SessionSkillsConfig
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
  defaultSettings,
  modelConfig,
  mcpConfig,
  skillsConfig,
  savingDefault,
  onClose,
  onApply,
  t,
}: SetDefaultModalProps) {
  if (!open) return null

  const targetScopeSettings =
    setDefaultTargetScope === 'workspace'
      ? workspaceSettings || defaultSettings || {}
      : defaultSettings || {}

  const beforeModelText =
    targetScopeSettings?.subagentModel?.mode === 'custom'
      ? `${targetScopeSettings?.subagentModel?.provider || ''} / ${targetScopeSettings?.subagentModel?.model || ''}`
      : targetScopeSettings?.subagentModel?.mode === 'default'
        ? t('sessionSettings.status.default')
        : t('sessionSettings.status.inherit')

  const afterModelText = isRestoringDefault
    ? setDefaultTargetScope === 'workspace'
      ? defaultSettings?.subagentModel?.mode === 'custom'
        ? `${defaultSettings?.subagentModel?.provider || ''} / ${defaultSettings?.subagentModel?.model || ''}`
        : t('sessionSettings.status.inherit')
      : t('sessionSettings.status.inherit')
    : modelConfig?.mode === 'custom'
      ? `${modelConfig?.provider || ''} / ${modelConfig?.model || ''}`
      : modelConfig?.mode === 'inherit'
        ? t('sessionSettings.status.inherit')
        : modelConfig?.mode === 'workspace'
          ? t('sessionSettings.status.workspace')
          : t('sessionSettings.status.default')

  const beforeMcpCount = (targetScopeSettings?.mcp?.enabledServerIds || [])
    .length
  const beforeMcpText =
    targetScopeSettings?.mcp?.mode === 'custom'
      ? t('sessionSettings.setDefaultModal.mcpCustom', {
          count: beforeMcpCount,
        })
      : targetScopeSettings?.mcp?.mode === 'workspace'
        ? t('sessionSettings.status.workspace')
        : t('sessionSettings.status.default')

  const afterMcpCount = (mcpConfig?.enabledServerIds || []).length
  const afterMcpText = isRestoringDefault
    ? setDefaultTargetScope === 'workspace'
      ? t('sessionSettings.setDefaultModal.mcpCustom', {
          count: (defaultSettings?.mcp?.enabledServerIds || []).length,
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
    targetScopeSettings?.skills?.mode === 'custom'
      ? targetScopeSettings?.skills?.disabledModelSkills ||
        targetScopeSettings?.skills?.disabledSkills ||
        []
      : defaultSettings?.skills?.disabledModelSkills ||
        defaultSettings?.skills?.disabledSkills ||
        []
  ).length
  const beforeSkillsText =
    targetScopeSettings?.skills?.mode === 'custom'
      ? t('sessionSettings.setDefaultModal.skillsCustom', {
          count: beforeSkillsDisabledCount,
        })
      : targetScopeSettings?.skills?.mode === 'workspace'
        ? t('sessionSettings.status.workspace')
        : t('sessionSettings.status.default')

  const afterSkillsDisabledCount = (
    skillsConfig?.mode === 'custom'
      ? skillsConfig?.disabledModelSkills || skillsConfig?.disabledSkills || []
      : defaultSettings?.skills?.disabledModelSkills ||
        defaultSettings?.skills?.disabledSkills ||
        []
  ).length
  const afterSkillsText = isRestoringDefault
    ? setDefaultTargetScope === 'workspace'
      ? t('sessionSettings.setDefaultModal.skillsCustom', {
          count: (
            defaultSettings?.skills?.disabledModelSkills ||
            defaultSettings?.skills?.disabledSkills ||
            []
          ).length,
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
      title: t('sessionSettings.setDefaultModal.title'),
      subtitle: t('sessionSettings.setDefaultModal.desc'),
      panelClassName: 'dsh-sam-modal-panel dsh-set-default-modal',
      headerExtra: currentWorkspaceTitle
        ? e(
            'span',
            {
              className: 'dsh-session-id-chip dsh-modal-workspace-chip',
              title: currentWorkspace?.path || currentWorkspaceTitle,
            },
            `${t('sessionSettings.scope.workspaceLabel')}: ${currentWorkspaceTitle}`,
          )
        : null,
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
