import * as React from 'react'
import {
  IconRefreshOutline16,
  IconSkillOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SkillsSettingsProps } from '../types/index.ts'
import { SearchToolbar, EmptyState } from '../components/index.ts'
import { useGlobalSkills } from './hooks/useGlobalSkills.ts'
import { SkillCard } from './components/SkillCard.ts'
import { SkillDetailModal } from './components/SkillDetailModal.ts'

export * from './hooks/useGlobalSkills.ts'
export * from './components/SkillCard.ts'
export * from './components/SkillDetailModal.ts'

const e = React.createElement

export function SkillsSettingsTab({
  api: _api,
  t,
  close: _close,
}: SkillsSettingsProps) {
  const {
    skills,
    filteredSkills,
    nonRuntimeSkills,
    enabledCount,
    defaultDisabledModelSet,
    defaultDisabledUserSet,
    loading,
    saving,
    search,
    setSearch,
    error,
    successMsg,
    selectedSkillForModal,
    setSelectedSkillForModal,
    skillsContentMap,
    skillsLoadingMap,
    loadSkills,
    handleToggleModelInvocable,
    handleToggleUserInvocable,
    handleSaveDefault,
    handleOpenSkillModal,
  } = useGlobalSkills(t)

  const modalSkill = selectedSkillForModal
  const modalDetail = modalSkill
    ? skillsContentMap[modalSkill.name] || modalSkill
    : null
  const modalIsModelDisabled = modalSkill
    ? defaultDisabledModelSet.has(modalSkill.name)
    : false
  const modalIsUserDisabled = modalSkill
    ? defaultDisabledUserSet.has(modalSkill.name)
    : false
  const modalIsLoadingContent = modalSkill
    ? Boolean(skillsLoadingMap[modalSkill.name])
    : false

  return e(
    'div',
    { className: 'dsh-sam-page dsh-mcp-settings-page' },

    // Notice alert banners
    error ? e('div', { className: 'dsh-sam-notice error' }, error) : null,
    successMsg
      ? e('div', { className: 'dsh-sam-notice success' }, successMsg)
      : null,

    // Page Header
    e(
      'div',
      { className: 'dsh-mcp-header-card' },
      e(
        'div',
        { className: 'dsh-mcp-header-title-row' },
        e(
          'div',
          null,
          e(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            e(IconSkillOutline16, { size: 18 }),
            e(
              'h2',
              { className: 'dsh-mcp-page-title' },
              t('skillsSettings.title'),
            ),
          ),
          e('p', { className: 'dsh-mcp-page-desc' }, t('skillsSettings.desc')),
        ),
        e(
          'div',
          { className: 'dsh-mcp-header-actions' },
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn secondary',
              title: t('sessionSettings.skills.refresh'),
              onClick: loadSkills,
            },
            e(IconRefreshOutline16, { size: 14 }),
          ),
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn primary',
              disabled: saving,
              onClick: handleSaveDefault,
            },
            saving
              ? t('skillsSettings.actions.saving')
              : t('skillsSettings.actions.saveSettings'),
          ),
        ),
      ),
    ),

    // Content Body
    loading
      ? e(
          'div',
          { className: 'dsh-mcp-loading-card' },
          e('p', null, t('sessionSettings.skills.refreshing')),
        )
      : e(
          'div',
          { className: 'dsh-mcp-body-wrap' },

          // Toolbar & Stats
          e(SearchToolbar, {
            value: search,
            onChange: setSearch,
            placeholder: t('sessionSettings.skills.searchPlaceholder'),
            statsText: [
              e(
                'span',
                { key: 'stats' },
                t('sessionSettings.skills.effectiveInfoDefault', {
                  total: nonRuntimeSkills.length,
                  enabled: enabledCount,
                }),
              ),
              search.trim()
                ? e(
                    'span',
                    { key: 'match' },
                    `匹配到 ${filteredSkills.length} / ${skills.length} 个技能`,
                  )
                : null,
            ].filter(Boolean),
          }),

          // Skill list cards
          filteredSkills.length === 0
            ? e(EmptyState, { message: t('sessionSettings.skills.noMatch') })
            : e(
                'div',
                { className: 'dsh-session-skills-list' },
                filteredSkills.map((skill) =>
                  e(SkillCard, {
                    key: skill.name,
                    skill,
                    isModelDisabled: defaultDisabledModelSet.has(skill.name),
                    isUserDisabled: defaultDisabledUserSet.has(skill.name),
                    onClick: () => handleOpenSkillModal(skill),
                    t,
                  }),
                ),
              ),
        ),

    // Standalone Skill Configuration & Details Modal
    e(SkillDetailModal, {
      skill: modalSkill,
      detail: modalDetail,
      isModelDisabled: modalIsModelDisabled,
      isUserDisabled: modalIsUserDisabled,
      loadingContent: modalIsLoadingContent,
      onToggleModelInvocable: handleToggleModelInvocable,
      onToggleUserInvocable: handleToggleUserInvocable,
      onClose: () => setSelectedSkillForModal(null),
      t,
    }),
  )
}

export default SkillsSettingsTab
