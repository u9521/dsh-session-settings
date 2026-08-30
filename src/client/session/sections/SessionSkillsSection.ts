import * as React from 'react'
import {
  IconRefreshOutline16,
  IconLoadingOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  SessionSkillsConfig,
  SessionSkillsMode,
  SettingsMode,
  SkillItem,
  SessionSettingsConfig,
} from '../../types/index.ts'
import {
  ModeSelector,
  EmptyState,
  SearchToolbar,
} from '../../components/index.ts'
import { SkillCard } from '../../skills/components/SkillCard.ts'

const e = React.createElement

export interface SessionSkillsSectionProps {
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
  onOpenSessionSkillModal: (skill: SkillItem) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function SessionSkillsSection({
  skillsConfig,
  availableSkills,
  currentWorkspaceId,
  workspaceSettings,
  globalConfig,
  skillsSearch,
  refreshingSkills,
  effectiveDisabledModelSet,
  effectiveDisabledUserSet,
  onSkillsModeChange,
  onSkillsSearchChange,
  onRefreshSkills,
  onOpenSessionSkillModal,
  t,
}: SessionSkillsSectionProps) {
  const filteredSkills = availableSkills.filter((s) => {
    if (!skillsSearch.trim()) return true
    const q = skillsSearch.trim().toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q)
    )
  })

  const defaultMode = currentWorkspaceId ? 'workspace' : 'global'

  return e(
    'div',
    { className: 'dsh-view-content-inner' },
    // Section Header: Title + Description
    e(
      'div',
      { className: 'dsh-section-header' },
      e(
        'h3',
        { className: 'dsh-section-title' },
        t('sessionSettings.section.skillsTitle'),
      ),
      e(
        'p',
        { className: 'dsh-section-desc' },
        t('sessionSettings.section.skillsDesc'),
      ),
    ),

    e(ModeSelector, {
      name: 'sessionSkillsMode',
      value: skillsConfig.mode ?? defaultMode,
      onChange: (val) => onSkillsModeChange(val as SettingsMode),
      options: [
        {
          value: 'workspace',
          visible: Boolean(currentWorkspaceId),
          title: t('sessionSettings.skillsMode.workspace.title'),
          badges: [
            workspaceSettings?.skills?.mode === 'custom'
              ? {
                  label: t('sessionSettings.skillsMode.workspace.badgeCustom', {
                    count: (
                      workspaceSettings?.skills?.disabledModelSkills ?? []
                    ).length,
                  }),
                  variant: 'custom',
                }
              : {
                  label: t('sessionSettings.skillsMode.workspace.badgeInherit'),
                  variant: 'inherit',
                },
          ],
          desc: t('sessionSettings.skillsMode.workspace.desc'),
        },
        {
          value: 'global',
          title: t('sessionSettings.skillsMode.default.title'),
          badges: [
            {
              label: t('sessionSettings.skillsMode.default.badge', {
                count: (globalConfig?.skills?.disabledModelSkills ?? []).length,
              }),
              variant: 'custom',
            },
          ],
          desc: t('sessionSettings.skillsMode.default.desc'),
        },
        {
          value: 'custom',
          title: t('sessionSettings.skillsMode.custom.title'),
          desc: t('sessionSettings.skillsMode.custom.desc'),
        },
      ],
    }),

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
                ? e(IconLoadingOutline16, {
                    size: 12,
                    className: 'dsh-spin',
                  })
                : e(IconRefreshOutline16, { size: 12 }),
              t('sessionSettings.skills.refresh'),
            ),
          }),

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
                    onClick: () => onOpenSessionSkillModal(skill),
                    t,
                  }),
                ),
              ),
        ),
  )
}
