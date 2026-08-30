import * as React from 'react'
import { IconAgentPresetOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  SubagentModelConfig,
  SubagentModelMode,
  ModelProviderGroup,
  SessionSettingsConfig,
} from '../../types/index.ts'
import { ModeSelector } from '../../components/index.ts'
import { effortLabel } from '../../utils/index.ts'
import { resolveEffectiveSubagentModel } from '../../utils/config.ts'

const e = React.createElement

export interface SubagentModelSectionProps {
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
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function SubagentModelSection({
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
  t,
}: SubagentModelSectionProps) {
  const currentProvider = modelConfig.model?.provider || ''
  const currentModel = modelConfig.model?.model || ''
  const currentEffort = modelConfig.model?.reasoningEffort || ''

  const currentProviderGroup = Array.isArray(providers)
    ? providers.find((g) => g.id === currentProvider)
    : null
  const currentModelItem = Array.isArray(currentProviderGroup?.models)
    ? currentProviderGroup.models.find((m) => m.id === currentModel)
    : null
  const availableEfforts = currentModelItem?.reasoning?.efforts ?? []

  const hasGlobalCustomModel = Boolean(
    globalConfig?.subagentModel?.inherit === false &&
    globalConfig?.subagentModel?.model?.provider &&
    globalConfig?.subagentModel?.model?.model,
  )

  const effectiveModelConfig = resolveEffectiveSubagentModel(
    { subagentModel: modelConfig, mcp: {}, skills: {} },
    workspaceSettings,
    globalConfig,
  )

  const defaultMode = currentWorkspaceId ? 'workspace' : 'global'
  const selectedModeValue: SubagentModelMode =
    modelConfig.mode === 'custom'
      ? modelConfig.inherit
        ? 'inherit'
        : 'custom'
      : (modelConfig.mode ?? defaultMode)

  return e(
    'div',
    { className: 'dsh-view-content-inner' },
    // Section Header
    e(
      'div',
      { className: 'dsh-section-header' },
      e(
        'h3',
        { className: 'dsh-section-title' },
        t('sessionSettings.section.modelTitle'),
      ),
      e(
        'p',
        { className: 'dsh-section-desc' },
        t('sessionSettings.section.modelDesc'),
      ),
    ),

    // Mode Selector
    e(ModeSelector, {
      name: 'subagentModelMode',
      value: selectedModeValue,
      onChange: (val) => onModelModeChange(val as SubagentModelMode),
      options: [
        {
          value: 'workspace',
          visible: Boolean(currentWorkspaceId),
          title: t('sessionSettings.mode.workspace.title'),
          badges: [
            workspaceSettings?.subagentModel?.mode === 'custom'
              ? workspaceSettings.subagentModel.inherit
                ? {
                    label: t('sessionSettings.badge.inherit'),
                    variant: 'inherit',
                  }
                : {
                    label: `${t('sessionSettings.badge.custom')}: ${workspaceSettings.subagentModel.model?.provider || ''} / ${workspaceSettings.subagentModel.model?.model || ''}`,
                    variant: 'custom',
                  }
              : hasGlobalCustomModel
                ? {
                    label: `${t('sessionSettings.badge.custom')}: ${globalConfig?.subagentModel?.model?.provider || ''} / ${globalConfig?.subagentModel?.model?.model || ''}`,
                    variant: 'custom',
                  }
                : {
                    label: t('sessionSettings.badge.inherit'),
                    variant: 'inherit',
                  },
          ],
          desc: t('sessionSettings.mode.workspace.desc'),
        },
        {
          value: 'global',
          title: t('sessionSettings.mode.default.title'),
          badges: [
            hasGlobalCustomModel
              ? {
                  label: `${t('sessionSettings.badge.custom')}: ${globalConfig?.subagentModel?.model?.provider || ''} / ${globalConfig?.subagentModel?.model?.model || ''}`,
                  variant: 'custom',
                }
              : {
                  label: t('sessionSettings.badge.inherit'),
                  variant: 'inherit',
                },
          ],
          desc: t('sessionSettings.mode.default.desc'),
        },
        {
          value: 'inherit',
          title: t('sessionSettings.mode.inherit.title'),
          desc: t('sessionSettings.mode.inherit.desc'),
        },
        {
          value: 'custom',
          title: t('sessionSettings.mode.custom.title'),
          desc: t('sessionSettings.mode.custom.desc'),
        },
      ],
    }),

    // Custom Mode Fields (Only when mode === 'custom' and inherit !== true)
    modelConfig.mode === 'custom' && !modelConfig.inherit
      ? e(
          'div',
          { className: 'dsh-sam-fields-panel' },
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
                disabled: loadingModels || providers.length === 0,
                onChange: (evt: React.ChangeEvent<HTMLSelectElement>) =>
                  onProviderChange(evt.target.value),
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
                  loadingModels ||
                  !currentProvider ||
                  !currentProviderGroup?.models?.length,
                onChange: (evt: React.ChangeEvent<HTMLSelectElement>) =>
                  onModelSelectChange(evt.target.value),
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
                    onChange: (evt: React.ChangeEvent<HTMLSelectElement>) =>
                      onReasoningEffortChange(evt.target.value),
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

    // Effective Preview Card (when inheriting workspace/global and effective model is custom)
    (modelConfig.mode === 'workspace' || modelConfig.mode === 'global') &&
      !effectiveModelConfig.inherit &&
      effectiveModelConfig.model
      ? e(
          'div',
          { className: 'dsh-sam-effective-model-card' },
          e(
            'div',
            { className: 'dsh-sam-effective-model-header' },
            e(
              'span',
              { className: 'dsh-sam-effective-model-title' },
              e(IconAgentPresetOutline16, { size: 14 }),
              t('sessionSettings.preview.effectiveModelTitle'),
            ),
            e(
              'span',
              { className: 'dsh-sam-effective-model-source' },
              modelConfig.mode === 'workspace' &&
                workspaceSettings?.subagentModel?.mode === 'custom'
                ? t('sessionSettings.preview.fromWorkspace')
                : t('sessionSettings.preview.fromGlobal'),
            ),
          ),
          e(
            'div',
            { className: 'dsh-sam-effective-model-grid' },
            e(
              'div',
              { className: 'dsh-sam-effective-model-item' },
              e(
                'span',
                { className: 'dsh-sam-effective-model-label' },
                t('sessionSettings.field.provider'),
              ),
              e(
                'span',
                { className: 'dsh-sam-effective-model-value' },
                effectiveModelConfig.model.provider || '-',
              ),
            ),
            e(
              'div',
              { className: 'dsh-sam-effective-model-item' },
              e(
                'span',
                { className: 'dsh-sam-effective-model-label' },
                t('sessionSettings.field.model'),
              ),
              e(
                'span',
                { className: 'dsh-sam-effective-model-value' },
                effectiveModelConfig.model.model || '-',
              ),
            ),
            effectiveModelConfig.model.reasoningEffort
              ? e(
                  'div',
                  { className: 'dsh-sam-effective-model-item' },
                  e(
                    'span',
                    { className: 'dsh-sam-effective-model-label' },
                    t('sessionSettings.field.reasoningEffort'),
                  ),
                  e(
                    'span',
                    { className: 'dsh-sam-effective-model-value' },
                    effortLabel(t, effectiveModelConfig.model.reasoningEffort),
                  ),
                )
              : null,
          ),
        )
      : null,
  )
}
