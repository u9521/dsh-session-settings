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

const e = React.createElement

export interface SubagentModelSectionProps {
  modelConfig: SubagentModelConfig
  providers: ModelProviderGroup[]
  loadingModels?: boolean
  currentWorkspaceId?: string
  workspaceSettings?: SessionSettingsConfig
  defaultSettings: SessionSettingsConfig
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
  defaultSettings,
  onModelModeChange,
  onProviderChange,
  onModelSelectChange,
  onReasoningEffortChange,
  t,
}: SubagentModelSectionProps) {
  const currentProviderGroup = Array.isArray(providers)
    ? providers.find((g) => g.id === modelConfig.provider)
    : null
  const currentModelItem = Array.isArray(currentProviderGroup?.models)
    ? currentProviderGroup?.models?.find((m) => m.id === modelConfig.model)
    : null
  const availableEfforts = currentModelItem?.reasoning?.efforts || []

  const effectiveModelConfig: SubagentModelConfig =
    modelConfig.mode === 'workspace'
      ? workspaceSettings?.subagentModel?.mode === 'custom'
        ? workspaceSettings.subagentModel
        : defaultSettings?.subagentModel?.mode === 'custom'
          ? defaultSettings.subagentModel
          : { mode: 'inherit' }
      : modelConfig.mode === 'default'
        ? defaultSettings?.subagentModel?.mode === 'custom'
          ? defaultSettings.subagentModel
          : { mode: 'inherit' }
        : modelConfig

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
      value: modelConfig.mode,
      onChange: onModelModeChange,
      options: [
        {
          value: 'workspace',
          visible: Boolean(currentWorkspaceId),
          title: t('sessionSettings.mode.workspace.title'),
          badges: [
            workspaceSettings?.subagentModel?.mode === 'custom'
              ? {
                  label: `${t('sessionSettings.badge.custom')}: ${workspaceSettings?.subagentModel?.provider || ''} / ${workspaceSettings?.subagentModel?.model || ''}`,
                  variant: 'custom',
                }
              : workspaceSettings?.subagentModel?.mode === 'inherit'
                ? {
                    label: t('sessionSettings.badge.inherit'),
                    variant: 'inherit',
                  }
                : defaultSettings?.subagentModel?.mode === 'custom'
                  ? {
                      label: `${t('sessionSettings.badge.custom')}: ${defaultSettings?.subagentModel?.provider || ''} / ${defaultSettings?.subagentModel?.model || ''}`,
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
          value: 'default',
          title: t('sessionSettings.mode.default.title'),
          badges: [
            defaultSettings?.subagentModel?.mode === 'custom'
              ? {
                  label: `${t('sessionSettings.badge.custom')}: ${defaultSettings?.subagentModel?.provider || ''} / ${defaultSettings?.subagentModel?.model || ''}`,
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

    // Custom Mode Fields
    modelConfig.mode === 'custom'
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
                value: modelConfig.provider || '',
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
                  : !modelConfig.provider
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
              modelConfig.provider &&
                !providers.some((p) => p.id === modelConfig.provider)
                ? e(
                    'option',
                    { key: modelConfig.provider, value: modelConfig.provider },
                    modelConfig.provider,
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
                value: modelConfig.model || '',
                disabled:
                  loadingModels ||
                  !modelConfig.provider ||
                  !currentProviderGroup?.models?.length,
                onChange: (evt: React.ChangeEvent<HTMLSelectElement>) =>
                  onModelSelectChange(evt.target.value),
              },
              !modelConfig.model
                ? e(
                    'option',
                    { value: '', disabled: true },
                    t('sessionSettings.field.modelPlaceholder'),
                  )
                : null,
              (currentProviderGroup?.models || []).map((m) =>
                e('option', { key: m.id, value: m.id }, m.name || m.id),
              ),
              modelConfig.model &&
                !currentProviderGroup?.models?.some(
                  (m) => m.id === modelConfig.model,
                )
                ? e(
                    'option',
                    { key: modelConfig.model, value: modelConfig.model },
                    modelConfig.model,
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
                    value: modelConfig.reasoningEffort || '',
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

    // Effective Preview Card
    (modelConfig.mode === 'workspace' || modelConfig.mode === 'default') &&
      effectiveModelConfig.mode === 'custom'
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
              modelConfig.mode === 'workspace'
                ? workspaceSettings?.subagentModel?.mode === 'custom'
                  ? t('sessionSettings.preview.fromWorkspace')
                  : t('sessionSettings.preview.fromGlobal')
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
                effectiveModelConfig.provider || '-',
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
                effectiveModelConfig.model || '-',
              ),
            ),
            effectiveModelConfig.reasoningEffort
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
                    effortLabel(t, effectiveModelConfig.reasoningEffort),
                  ),
                )
              : null,
          ),
        )
      : null,
  )
}
