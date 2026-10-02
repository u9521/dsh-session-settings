import * as React from 'react'
import type {
  SubagentModelConfig,
  SubagentModelMode,
  ModelProviderGroup,
  SessionSettingsConfig,
} from '../../types/index.ts'
import { effortLabel } from '../../utils/index.ts'
import { resolveEffectiveSubagentModel } from '../../utils/config.ts'

const e = React.createElement

export interface SubagentModelSectionProps {
  scope?: 'session' | 'workspace' | 'global'
  modelConfig: SubagentModelConfig
  providers: ModelProviderGroup[]
  loadingModels?: boolean
  currentWorkspaceId?: string
  workspaceSettings?: SessionSettingsConfig
  globalConfig: SessionSettingsConfig
  onModelModeChange: (mode: SubagentModelMode) => void
  onProviderChange: (providerId: string) => void
  onModelSelectChange: (modelId: string) => void
  onReasoningEffortChange: (effortId: string) => void
  onAllowAgentSelectModelChange?: (allow: boolean) => void
  onOverrideForkModelChange?: (override: boolean) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function SubagentModelSection({
  scope = 'session',
  modelConfig,
  providers,
  loadingModels = false,
  currentWorkspaceId,
  workspaceSettings,
  globalConfig,
  onModelModeChange,
  onProviderChange,
  onModelSelectChange,
  onReasoningEffortChange,
  onAllowAgentSelectModelChange,
  onOverrideForkModelChange,
  t,
}: SubagentModelSectionProps) {
  const defaultMode = currentWorkspaceId ? 'workspace' : 'global'

  // Determine active source mode: 'workspace' | 'global' | 'custom'
  const activeSourceMode: 'workspace' | 'global' | 'custom' =
    scope === 'global'
      ? 'custom'
      : scope === 'workspace'
        ? modelConfig?.mode === 'custom'
          ? 'custom'
          : 'global'
        : modelConfig?.mode === 'custom'
          ? 'custom'
          : (modelConfig?.mode ?? defaultMode)

  const isReadonly =
    scope === 'session'
      ? activeSourceMode !== 'custom'
      : scope === 'workspace'
        ? activeSourceMode !== 'custom'
        : false

  const effectiveModelConfig = resolveEffectiveSubagentModel(
    { subagentModel: modelConfig, mcp: {}, skills: {} },
    workspaceSettings,
    globalConfig,
  )

  const isInheritParent = isReadonly
    ? effectiveModelConfig.inherit !== false
    : modelConfig?.mode === 'custom'
      ? Boolean(modelConfig.inherit)
      : true

  const isSpecifyModel = !isInheritParent

  const currentProvider = isReadonly
    ? effectiveModelConfig.model?.provider || ''
    : modelConfig?.model?.provider || ''
  const currentModel = isReadonly
    ? effectiveModelConfig.model?.model || ''
    : modelConfig?.model?.model || ''
  const currentEffort = isReadonly
    ? effectiveModelConfig.model?.reasoningEffort || ''
    : modelConfig?.model?.reasoningEffort || ''

  const currentProviderGroup = Array.isArray(providers)
    ? providers.find((g) => g.id === currentProvider)
    : null
  const currentModelItem = Array.isArray(currentProviderGroup?.models)
    ? currentProviderGroup.models.find((m) => m.id === currentModel)
    : null
  const availableEfforts = currentModelItem?.reasoning?.efforts ?? []

  const isAllowAgentSelect = isReadonly
    ? effectiveModelConfig.allowAgentSelectModel !== false
    : modelConfig?.allowAgentSelectModel !== undefined
      ? modelConfig.allowAgentSelectModel !== false
      : effectiveModelConfig.allowAgentSelectModel !== false

  const isOverrideFork = isReadonly
    ? effectiveModelConfig.overrideForkModel === true
    : modelConfig?.overrideForkModel !== undefined
      ? modelConfig.overrideForkModel === true
      : effectiveModelConfig.overrideForkModel === true

  const handleToggleSpecifyModel = () => {
    if (isReadonly) return
    if (isSpecifyModel) {
      onModelModeChange('inherit')
    } else {
      onModelModeChange('custom')
    }
  }

  const sourceTabs =
    scope === 'session'
      ? [
          ...(currentWorkspaceId
            ? [
                {
                  key: 'workspace',
                  label: t('sessionSettings.sourceTabs.workspace'),
                  active: activeSourceMode === 'workspace',
                  onClick: () => onModelModeChange('workspace'),
                },
              ]
            : []),
          {
            key: 'global',
            label: t('sessionSettings.sourceTabs.global'),
            active: activeSourceMode === 'global',
            onClick: () => onModelModeChange('global'),
          },
          {
            key: 'custom',
            label: t('sessionSettings.sourceTabs.custom'),
            active: activeSourceMode === 'custom',
            onClick: () => onModelModeChange('custom'),
          },
        ]
      : scope === 'workspace'
        ? [
            {
              key: 'global',
              label: t('sessionSettings.sourceTabs.global'),
              active: activeSourceMode === 'global',
              onClick: () => onModelModeChange('global'),
            },
            {
              key: 'custom',
              label: t('sessionSettings.sourceTabs.workspaceCustom'),
              active: activeSourceMode === 'custom',
              onClick: () => onModelModeChange('custom'),
            },
          ]
        : []

  return e(
    'div',
    { className: 'dsh-view-content-inner' },
    // Source Tabs (Segmented control for workspace / global / custom)
    sourceTabs.length > 0
      ? e(
          'div',
          { className: 'dsh-source-tabs-wrap' },
          e(
            'div',
            { className: 'dsh-source-tabs-label' },
            t('sessionSettings.sourceTabs.label'),
          ),
          e(
            'div',
            { className: 'dsh-source-tabs-nav', role: 'tablist' },
            sourceTabs.map((tab) =>
              e(
                'button',
                {
                  key: tab.key,
                  type: 'button',
                  role: 'tab',
                  'aria-selected': tab.active,
                  className: `dsh-source-tab-btn ${tab.active ? 'active' : ''}`,
                  onClick: tab.onClick,
                },
                tab.label,
              ),
            ),
          ),
        )
      : null,

    // Switch 1: 允许 Agent 选择子代理模型
    e(
      'div',
      {
        className: `dsh-mcp-switch-card ${isAllowAgentSelect ? 'active' : ''} ${isReadonly ? 'readonly' : ''}`,
        style: { marginBottom: 12 },
        tabIndex: isReadonly ? -1 : 0,
        role: 'switch',
        'aria-checked': isAllowAgentSelect,
        onClick: () => {
          if (!isReadonly && onAllowAgentSelectModelChange) {
            onAllowAgentSelectModelChange(!isAllowAgentSelect)
          }
        },
        onKeyDown: (evt: React.KeyboardEvent) => {
          if (!isReadonly && (evt.key === ' ' || evt.key === 'Enter')) {
            evt.preventDefault()
            if (onAllowAgentSelectModelChange) {
              onAllowAgentSelectModelChange(!isAllowAgentSelect)
            }
          }
        },
      },
      e(
        'div',
        { className: 'dsh-mcp-switch-text' },
        e(
          'div',
          { className: 'dsh-mcp-switch-title' },
          t('sessionSettings.switch.allowAgentSelectModel.title'),
        ),
        e(
          'div',
          { className: 'dsh-mcp-switch-desc' },
          t('sessionSettings.switch.allowAgentSelectModel.desc'),
        ),
      ),
      e(
        'button',
        {
          type: 'button',
          className: `dsh-mcp-switch-btn ${isAllowAgentSelect ? 'active' : ''}`,
          tabIndex: -1,
          disabled: isReadonly,
          'aria-hidden': 'true',
        },
        e('span', { className: 'dsh-mcp-switch-thumb' }),
      ),
    ),

    // Switch 2: 替换 subagent fork 的模型
    e(
      'div',
      {
        className: `dsh-mcp-switch-card ${isOverrideFork ? 'active' : ''} ${isReadonly ? 'readonly' : ''}`,
        style: { marginBottom: 12 },
        tabIndex: isReadonly ? -1 : 0,
        role: 'switch',
        'aria-checked': isOverrideFork,
        onClick: () => {
          if (!isReadonly && onOverrideForkModelChange) {
            onOverrideForkModelChange(!isOverrideFork)
          }
        },
        onKeyDown: (evt: React.KeyboardEvent) => {
          if (!isReadonly && (evt.key === ' ' || evt.key === 'Enter')) {
            evt.preventDefault()
            if (onOverrideForkModelChange) {
              onOverrideForkModelChange(!isOverrideFork)
            }
          }
        },
      },
      e(
        'div',
        { className: 'dsh-mcp-switch-text' },
        e(
          'div',
          { className: 'dsh-mcp-switch-title' },
          t('sessionSettings.switch.overrideForkModel.title'),
        ),
        e(
          'div',
          { className: 'dsh-mcp-switch-desc' },
          t('sessionSettings.switch.overrideForkModel.desc'),
        ),
      ),
      e(
        'button',
        {
          type: 'button',
          className: `dsh-mcp-switch-btn ${isOverrideFork ? 'active' : ''}`,
          tabIndex: -1,
          disabled: isReadonly,
          'aria-hidden': 'true',
        },
        e('span', { className: 'dsh-mcp-switch-thumb' }),
      ),
    ),

    // Switch 3: 指定子代理模型 (Placed at the very bottom)
    e(
      'div',
      {
        className: `dsh-mcp-switch-card ${isSpecifyModel ? 'active' : ''} ${isReadonly ? 'readonly' : ''}`,
        style: { marginBottom: isSpecifyModel ? 10 : 16 },
        tabIndex: isReadonly ? -1 : 0,
        role: 'switch',
        'aria-checked': isSpecifyModel,
        onClick: handleToggleSpecifyModel,
        onKeyDown: (evt: React.KeyboardEvent) => {
          if (!isReadonly && (evt.key === ' ' || evt.key === 'Enter')) {
            evt.preventDefault()
            handleToggleSpecifyModel()
          }
        },
      },
      e(
        'div',
        { className: 'dsh-mcp-switch-text' },
        e(
          'div',
          { className: 'dsh-mcp-switch-title' },
          t('sessionSettings.switch.specifySubagentModel.title'),
        ),
        e(
          'div',
          { className: 'dsh-mcp-switch-desc' },
          t('sessionSettings.switch.specifySubagentModel.desc'),
        ),
      ),
      e(
        'button',
        {
          type: 'button',
          className: `dsh-mcp-switch-btn ${isSpecifyModel ? 'active' : ''}`,
          tabIndex: -1,
          disabled: isReadonly,
          'aria-hidden': 'true',
        },
        e('span', { className: 'dsh-mcp-switch-thumb' }),
      ),
    ),

    // Model Parameter Dropdowns (Expanded directly under Switch 3 when it is ON)
    isSpecifyModel
      ? e(
          'div',
          { className: 'dsh-sam-fields-panel', style: { marginBottom: 16 } },
          e(
            'div',
            { className: 'dsh-sam-field-group' },
            e(
              'label',
              { className: 'dsh-sam-field-label' },
              t('sessionSettings.field.provider'),
            ),
            e(
              'select',
              {
                className: 'dsh-sam-select',
                value: currentProvider,
                disabled: isReadonly || loadingModels || providers.length === 0,
                onChange: (evt: React.ChangeEvent<HTMLSelectElement>) => {
                  if (!isReadonly) onProviderChange(evt.target.value)
                },
              },
              loadingModels
                ? e(
                    'option',
                    { value: '', disabled: true },
                    t('sessionSettings.field.loadingModels'),
                  )
                : providers.length === 0
                  ? e(
                      'option',
                      { value: '', disabled: true },
                      t('sessionSettings.field.noModelsFound'),
                    )
                  : !currentProvider
                    ? e(
                        'option',
                        { value: '', disabled: true },
                        t('sessionSettings.field.providerPlaceholder'),
                      )
                    : null,
              providers.map((p) =>
                e(
                  'option',
                  { key: p.id, value: p.id },
                  p.name && p.name !== p.id
                    ? `${p.name} (${p.id})`
                    : p.name || p.id,
                ),
              ),
              currentProvider &&
                !providers.some((p) => p.id === currentProvider)
                ? e(
                    'option',
                    { key: currentProvider, value: currentProvider },
                    currentProvider,
                  )
                : null,
            ),
          ),

          e(
            'div',
            { className: 'dsh-sam-field-group' },
            e(
              'label',
              { className: 'dsh-sam-field-label' },
              t('sessionSettings.field.model'),
            ),
            e(
              'select',
              {
                className: 'dsh-sam-select',
                value: currentModel,
                disabled:
                  isReadonly ||
                  loadingModels ||
                  !currentProvider ||
                  !currentProviderGroup?.models?.length,
                onChange: (evt: React.ChangeEvent<HTMLSelectElement>) => {
                  if (!isReadonly) onModelSelectChange(evt.target.value)
                },
              },
              !currentModel
                ? e(
                    'option',
                    { value: '', disabled: true },
                    t('sessionSettings.field.modelPlaceholder'),
                  )
                : null,
              (currentProviderGroup?.models || []).map((m) =>
                e('option', { key: m.id, value: m.id }, m.name || m.id),
              ),
              currentModel &&
                !currentProviderGroup?.models?.some(
                  (m) => m.id === currentModel,
                )
                ? e(
                    'option',
                    { key: currentModel, value: currentModel },
                    currentModel,
                  )
                : null,
            ),
          ),

          availableEfforts.length > 0
            ? e(
                'div',
                { className: 'dsh-sam-field-group' },
                e(
                  'label',
                  { className: 'dsh-sam-field-label' },
                  t('sessionSettings.field.reasoningEffort'),
                ),
                e(
                  'select',
                  {
                    className: 'dsh-sam-select',
                    value: currentEffort,
                    disabled: isReadonly,
                    onChange: (evt: React.ChangeEvent<HTMLSelectElement>) => {
                      if (!isReadonly) onReasoningEffortChange(evt.target.value)
                    },
                  },
                  e(
                    'option',
                    { value: '' },
                    t('sessionSettings.field.reasoningEffortDefault'),
                  ),
                  availableEfforts.map((eff) =>
                    e(
                      'option',
                      { key: eff.id, value: eff.id },
                      effortLabel(t, eff.id),
                    ),
                  ),
                ),
              )
            : null,
        )
      : null,
  )
}
