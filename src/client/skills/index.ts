import * as React from 'react'
import {
  IconRefreshOutline16,
  IconLoadingOutline16,
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
    skillsContentMap,
    skillsLoadingMap,
    loadSkills,
    handleSaveSkillModal,
    handleOpenSkillModal,
    handleCloseSkillModal,
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
            'h2',
            { className: 'dsh-mcp-page-title' },
            t('skillsSettings.title'),
          ),
          e('p', { className: 'dsh-mcp-page-desc' }, t('skillsSettings.desc')),
          e(
            'p',
            {
              className: 'dsh-mcp-page-desc',
              style: { marginTop: '4px' },
            },
            t('skillsSettings.skillsStats', {
              total: nonRuntimeSkills.length,
              enabled: enabledCount,
            }),
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
            placeholder: t('skillsSettings.searchPlaceholder'),
            statsText: search.trim()
              ? [
                  e(
                    'span',
                    { key: 'match' },
                    t('sessionSettings.skills.matchedCount', {
                      matched: filteredSkills.length,
                      total: skills.length,
                    }),
                  ),
                ]
              : undefined,
            actions: e(
              'button',
              {
                type: 'button',
                className: 'dsh-mcp-text-btn',
                disabled: loading,
                onClick: loadSkills,
              },
              loading
                ? e(IconLoadingOutline16, { size: 12, className: 'dsh-spin' })
                : e(IconRefreshOutline16, { size: 12 }),
              t('sessionSettings.skills.refresh'),
            ),
          }),

          // Skill list cards
          filteredSkills.length === 0
            ? e(EmptyState, { message: t('skillsSettings.noMatch') })
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
      saving,
      onSave: handleSaveSkillModal,
      onClose: handleCloseSkillModal,
      t,
    }),
  )
}

export default SkillsSettingsTab
