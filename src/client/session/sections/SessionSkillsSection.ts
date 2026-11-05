import * as React from 'react'
import {
  IconRefreshOutlineMedium,
  IconLoadingOutlineMedium,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  SessionSkillsConfig,
  SessionSkillsMode,
  SkillItem,
  SkillPolicyFailure,
  SessionSettingsConfig,
} from '../../types/index.ts'
import { EmptyState, SearchToolbar } from '../../components/index.ts'
import { SkillCard } from '../../skills/components/SkillCard.ts'
import { isSourceReadonly, sourceModeFor } from '../../utils/config.ts'

const e = React.createElement

export interface SessionSkillsSectionProps {
  scope?: 'session' | 'workspace' | 'global'
  skillsConfig: SessionSkillsConfig
  availableSkills: SkillItem[]
  currentWorkspaceId?: string
  workspaceSettings?: SessionSettingsConfig
  globalConfig?: SessionSettingsConfig
  skillsSearch: string
  refreshingSkills: boolean
  effectiveDisabledModelSet: Set<string>
  effectiveDisabledUserSet: Set<string>
  onSkillsModeChange: (mode: SessionSkillsMode) => void
  onSkillsSearchChange: (search: string) => void
  onRefreshSkills: () => void
  onOpenSessionSkillModal: (skill: SkillItem, isReadonly?: boolean) => void
  /**
   * Skills whose per-session policy the registry refused to apply.
   *
   * An empty list is the normal case. A non-empty one means the switch shown
   * here is NOT in force: the shadowing registration threw, the inherited
   * declaration survived, and the agent still sees the skill.
   */
  policyFailures?: SkillPolicyFailure[]
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function SessionSkillsSection({
  scope = 'session',
  skillsConfig,
  availableSkills,
  currentWorkspaceId,
  skillsSearch,
  refreshingSkills,
  effectiveDisabledModelSet,
  effectiveDisabledUserSet,
  onSkillsModeChange,
  onSkillsSearchChange,
  onRefreshSkills,
  onOpenSessionSkillModal,
  policyFailures = [],
  t,
}: SessionSkillsSectionProps) {
  const filteredSkills = availableSkills.filter((s) => {
    // Runtime skills cannot be configured as workspace or global defaults
    if (scope !== 'session' && s.isRuntime) return false
    if (!skillsSearch.trim()) return true
    const q = skillsSearch.trim().toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q)
    )
  })

  const activeSourceMode = sourceModeFor(
    scope,
    skillsConfig,
    Boolean(currentWorkspaceId),
  )
  const isReadonly = isSourceReadonly(scope, activeSourceMode)

  const sourceTabs =
    scope === 'session'
      ? [
          ...(currentWorkspaceId
            ? [
                {
                  key: 'workspace',
                  label: t('sessionSettings.sourceTabs.workspace'),
                  active: activeSourceMode === 'workspace',
                  onClick: () => onSkillsModeChange('workspace'),
                },
              ]
            : []),
          {
            key: 'global',
            label: t('sessionSettings.sourceTabs.global'),
            active: activeSourceMode === 'global',
            onClick: () => onSkillsModeChange('global'),
          },
          {
            key: 'custom',
            label: t('sessionSettings.sourceTabs.custom'),
            active: activeSourceMode === 'custom',
            onClick: () => onSkillsModeChange('custom'),
          },
        ]
      : scope === 'workspace'
        ? [
            {
              key: 'global',
              label: t('sessionSettings.sourceTabs.global'),
              active: activeSourceMode === 'global',
              onClick: () => onSkillsModeChange('global'),
            },
            {
              key: 'custom',
              label: t('sessionSettings.sourceTabs.workspaceCustom'),
              active: activeSourceMode === 'custom',
              onClick: () => onSkillsModeChange('custom'),
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

    availableSkills.length === 0
      ? e(EmptyState, { message: t('sessionSettings.skills.empty') })
      : e(
          'div',
          { className: 'dsh-session-skills-box' },
          // Toolbar with search and quick actions
          e(SearchToolbar, {
            value: skillsSearch,
            onChange: onSkillsSearchChange,
            placeholder: t('sessionSettings.skills.searchPlaceholder'),
            className: 'dsh-skills-toolbar',
            inputClassName: 'dsh-skills-search-input',
            actions: e(
              'button',
              {
                type: 'button',
                className: 'dsh-mcp-text-btn',
                disabled: refreshingSkills,
                onClick: onRefreshSkills,
              },
              refreshingSkills
                ? e(IconLoadingOutlineMedium, {
                    size: 12,
                    className: 'dsh-spin',
                  })
                : e(IconRefreshOutlineMedium, { size: 12 }),
              t('sessionSettings.skills.refresh'),
            ),
          }),

          // Policy entries the registry refused. Rendered above the list so a
          // user sees that a switch did not take effect before trusting it.
          policyFailures.length > 0
            ? e(
                'div',
                { className: 'dsh-skills-policy-failures', role: 'alert' },
                e(
                  'div',
                  { className: 'dsh-skills-policy-failures-title' },
                  t('sessionSettings.skills.policyFailuresTitle'),
                ),
                ...policyFailures.map((failure) =>
                  e(
                    'div',
                    {
                      key: failure.name,
                      className: 'dsh-skills-policy-failure-row',
                    },
                    e(
                      'code',
                      { className: 'dsh-skills-policy-failure-name' },
                      failure.name,
                    ),
                    e(
                      'span',
                      { className: 'dsh-skills-policy-failure-reason' },
                      failure.reason,
                    ),
                  ),
                ),
              )
            : null,

          // Skill list
          filteredSkills.length === 0
            ? e(EmptyState, {
                message: t('sessionSettings.skills.noMatch'),
              })
            : e(
                'div',
                { className: 'dsh-session-skills-list' },
                filteredSkills.map((skill) =>
                  e(SkillCard, {
                    key: skill.name,
                    skill,
                    isModelDisabled: effectiveDisabledModelSet.has(skill.name),
                    isUserDisabled: effectiveDisabledUserSet.has(skill.name),
                    showStatusBadges: true,
                    onClick: () => onOpenSessionSkillModal(skill, isReadonly),
                    t,
                  }),
                ),
              ),
        ),
  )
}
