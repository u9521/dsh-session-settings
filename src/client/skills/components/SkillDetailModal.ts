import * as React from 'react'
import { IconSkillOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SkillItem } from '../../types/index.ts'
import { ModalDialog, Badge } from '../../components/index.ts'
import { getSkillSourceMeta } from '../../utils/index.ts'

const e = React.createElement

export interface SkillDetailModalProps {
  skill: SkillItem | null
  detail: SkillItem | null
  isModelDisabled: boolean
  isUserDisabled: boolean
  loadingContent: boolean
  onToggleModelInvocable: (name: string) => void
  onToggleUserInvocable: (name: string) => void
  onClose: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function SkillDetailModal({
  skill,
  detail,
  isModelDisabled,
  isUserDisabled,
  loadingContent,
  onToggleModelInvocable,
  onToggleUserInvocable,
  onClose,
  t,
}: SkillDetailModalProps) {
  if (!skill || !detail) return null

  const isRuntime = Boolean(skill.isRuntime)
  const { sourceClass, sourceLabel } = getSkillSourceMeta(skill, t)

  return e(
    ModalDialog,
    {
      open: Boolean(skill && detail),
      onClose,
      title: skill.name,
      icon: e(IconSkillOutline16, { size: 18 }),
      panelClassName: 'dsh-sam-modal-panel dsh-skill-modal',
      headerExtra: [
        e(Badge, {
          key: 'src',
          label: sourceLabel,
          variant: sourceClass,
        }),
        !isRuntime
          ? e(Badge, {
              key: 'model',
              label: !isModelDisabled
                ? t('sessionSettings.skills.modelInvocableEnabled')
                : t('sessionSettings.skills.modelInvocableDisabled'),
              variant: !isModelDisabled ? 'status-enabled' : 'status-disabled',
            })
          : null,
        !isRuntime
          ? e(Badge, {
              key: 'user',
              label: !isUserDisabled
                ? t('sessionSettings.skills.userInvocableEnabled')
                : t('sessionSettings.skills.userInvocableDisabled'),
              variant: !isUserDisabled ? 'status-enabled' : 'status-disabled',
            })
          : null,
      ].filter(Boolean),
      footer: e(
        'div',
        { className: 'dsh-mcp-modal-footer-right' },
        e(
          'button',
          {
            type: 'button',
            className: 'dsh-sam-btn primary',
            onClick: onClose,
          },
          t('sessionSettings.skills.modalDoneBtn'),
        ),
      ),
    },
    e(
      'div',
      { className: 'dsh-skill-modal-body' },

      // Description
      skill.description
        ? e('p', { className: 'dsh-skill-modal-desc' }, skill.description)
        : null,

      // Runtime Note
      isRuntime
        ? e(
            'div',
            { className: 'dsh-skill-runtime-note' },
            t('sessionSettings.skills.runtimeNotice'),
          )
        : null,

      // Path & When to use
      detail.path
        ? e(
            'div',
            { className: 'dsh-skill-detail-meta' },
            e(
              'span',
              null,
              t('sessionSettings.skills.pathLabel'),
              e('code', { className: 'dsh-skill-detail-path' }, detail.path),
            ),
          )
        : null,
      detail.whenToUse
        ? e(
            'div',
            { className: 'dsh-skill-detail-meta' },
            e(
              'span',
              null,
              t('sessionSettings.skills.whenToUseLabel'),
              detail.whenToUse,
            ),
          )
        : null,

      // Section 1: Invocation Permissions
      e(
        'div',
        { className: 'dsh-skill-modal-section' },
        e(
          'h4',
          { className: 'dsh-skill-modal-section-title' },
          t('sessionSettings.skills.rulesSectionTitle'),
        ),
        !isRuntime
          ? e(
              'div',
              {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                },
              },
              // Switch 1: Model Invocable
              e(
                'div',
                {
                  className: `dsh-mcp-switch-card mini ${!isModelDisabled ? 'active' : ''}`,
                  onClick: () => onToggleModelInvocable(skill.name),
                  style: { cursor: 'pointer' },
                },
                e(
                  'div',
                  { className: 'dsh-mcp-switch-text' },
                  e(
                    'span',
                    { className: 'dsh-mcp-switch-title' },
                    t('sessionSettings.skills.modelInvocableTitle'),
                  ),
                  e(
                    'span',
                    { className: 'dsh-mcp-switch-desc' },
                    t('sessionSettings.skills.modelInvocableDesc'),
                  ),
                ),
                e(
                  'div',
                  {
                    className: `dsh-mcp-switch-btn ${!isModelDisabled ? 'active' : ''}`,
                  },
                  e('span', { className: 'dsh-mcp-switch-thumb' }),
                ),
              ),
              // Switch 2: User Invocable
              e(
                'div',
                {
                  className: `dsh-mcp-switch-card mini ${!isUserDisabled ? 'active' : ''}`,
                  onClick: () => onToggleUserInvocable(skill.name),
                  style: { cursor: 'pointer' },
                },
                e(
                  'div',
                  { className: 'dsh-mcp-switch-text' },
                  e(
                    'span',
                    { className: 'dsh-mcp-switch-title' },
                    t('sessionSettings.skills.userInvocableTitle'),
                  ),
                  e(
                    'span',
                    { className: 'dsh-mcp-switch-desc' },
                    t('sessionSettings.skills.userInvocableDesc'),
                  ),
                ),
                e(
                  'div',
                  {
                    className: `dsh-mcp-switch-btn ${!isUserDisabled ? 'active' : ''}`,
                  },
                  e('span', { className: 'dsh-mcp-switch-thumb' }),
                ),
              ),
            )
          : null,
      ),

      // Section 2: Instructions & Rules
      e(
        'div',
        { className: 'dsh-skill-modal-section' },
        e(
          'h4',
          { className: 'dsh-skill-modal-section-title' },
          t('sessionSettings.skills.instructionsSectionTitle'),
        ),
        loadingContent
          ? e(
              'div',
              { className: 'dsh-sam-notice info' },
              t('sessionSettings.skills.loadingContent'),
            )
          : e(
              'pre',
              { className: 'dsh-skill-content-block' },
              detail.content || t('sessionSettings.skills.noInstructions'),
            ),
      ),
    ),
  )
}
