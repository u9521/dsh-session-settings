import * as React from 'react'
import { IconCloseOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  SubagentModelConfig,
  SessionMcpConfig,
  SessionSkillsConfig,
  SessionSettingsConfig,
} from '../../types/index.ts'

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
        ? '使用全局默认'
        : '跟随主模型 (继承)'

  const afterModelText = isRestoringDefault
    ? setDefaultTargetScope === 'workspace'
      ? defaultSettings?.subagentModel?.mode === 'custom'
        ? `${defaultSettings?.subagentModel?.provider || ''} / ${defaultSettings?.subagentModel?.model || ''}`
        : '跟随主模型 (继承)'
      : '跟随主模型 (继承)'
    : modelConfig?.mode === 'custom'
      ? `${modelConfig?.provider || ''} / ${modelConfig?.model || ''}`
      : modelConfig?.mode === 'inherit'
        ? '跟随主模型 (继承)'
        : modelConfig?.mode === 'workspace'
          ? '使用工作区默认'
          : '使用全局默认'

  const beforeMcpCount = (targetScopeSettings?.mcp?.enabledServerIds || [])
    .length
  const beforeMcpText =
    targetScopeSettings?.mcp?.mode === 'custom'
      ? `已启用 ${beforeMcpCount} 个服务器`
      : targetScopeSettings?.mcp?.mode === 'workspace'
        ? '使用工作区默认'
        : '使用全局默认'

  const afterMcpCount = (mcpConfig?.enabledServerIds || []).length
  const afterMcpText = isRestoringDefault
    ? setDefaultTargetScope === 'workspace'
      ? `已启用 ${(defaultSettings?.mcp?.enabledServerIds || []).length} 个服务器`
      : '使用系统默认'
    : mcpConfig?.mode === 'custom'
      ? `已启用 ${afterMcpCount} 个服务器`
      : mcpConfig?.mode === 'workspace'
        ? '使用工作区默认'
        : '使用全局默认'

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
      ? `已禁用 ${beforeSkillsDisabledCount} 个技能`
      : targetScopeSettings?.skills?.mode === 'workspace'
        ? '使用工作区默认'
        : '使用全局默认'

  const afterSkillsDisabledCount = (
    skillsConfig?.mode === 'custom'
      ? skillsConfig?.disabledModelSkills || skillsConfig?.disabledSkills || []
      : defaultSettings?.skills?.disabledModelSkills ||
        defaultSettings?.skills?.disabledSkills ||
        []
  ).length
  const afterSkillsText = isRestoringDefault
    ? setDefaultTargetScope === 'workspace'
      ? `已禁用 ${(defaultSettings?.skills?.disabledModelSkills || defaultSettings?.skills?.disabledSkills || []).length} 个技能`
      : '全部技能可用'
    : skillsConfig?.mode === 'custom'
      ? `已禁用 ${afterSkillsDisabledCount} 个技能`
      : skillsConfig?.mode === 'workspace'
        ? '使用工作区默认'
        : '使用全局默认'

  const modelChanged = beforeModelText !== afterModelText
  const mcpChanged = beforeMcpText !== afterMcpText
  const skillsChanged = beforeSkillsText !== afterSkillsText

  return e(
    'div',
    {
      className: 'dsh-set-default-modal-overlay',
      onClick: (evt: React.MouseEvent) => {
        if (evt.target === evt.currentTarget) onClose()
      },
    },
    e(
      'div',
      { className: 'dsh-set-default-modal-panel' },
      // Header
      e(
        'div',
        { className: 'dsh-set-default-modal-header' },
        e(
          'div',
          { className: 'dsh-set-default-modal-title-row' },
          e(
            'h3',
            { className: 'dsh-set-default-modal-title' },
            t('sessionSettings.setDefaultModal.title'),
          ),
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
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-close-btn',
              style: { position: 'absolute', right: 16, top: 16 },
              onClick: onClose,
              title: t('sessionSettings.action.close'),
            },
            e(IconCloseOutline16, { size: 16 }),
          ),
        ),
        e(
          'p',
          { className: 'dsh-set-default-modal-desc' },
          t('sessionSettings.setDefaultModal.desc'),
        ),
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
                ? e('span', { className: 'dsh-diff-changed-tag' }, '已变动')
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
                ? e('span', { className: 'dsh-diff-changed-tag' }, '已变动')
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
                ? e('span', { className: 'dsh-diff-changed-tag' }, '已变动')
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
                e(
                  'span',
                  { className: 'dsh-diff-col-value' },
                  beforeSkillsText,
                ),
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

      // Modal Footer
      e(
        'div',
        { className: 'dsh-set-default-modal-footer' },
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
              ? t('sessionSettings.action.restoreWorkspaceToGlobal') ||
                '恢复为跟随全局默认'
              : t('sessionSettings.action.restoreDefault'),
        ),
        e(
          'div',
          { className: 'dsh-set-default-footer-right' },
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
                ? t('sessionSettings.action.applyWorkspaceDefault') ||
                  '应用为工作区默认'
                : t('sessionSettings.action.confirmApply'),
          ),
        ),
      ),
    ),
  )
}
