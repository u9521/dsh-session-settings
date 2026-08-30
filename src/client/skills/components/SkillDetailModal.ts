import * as React from 'react'
import { IconLoadingOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
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
  isSessionContext?: boolean
  saving?: boolean
  onSave?: (
    name: string,
    modelDisabled: boolean,
    userDisabled: boolean,
  ) => void | Promise<void>
  onClose: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function SkillDetailModal({
  skill,
  detail,
  isModelDisabled,
  isUserDisabled,
  loadingContent,
  isSessionContext = false,
  saving = false,
  onSave,
  onClose,
  t,
}: SkillDetailModalProps) {
  const [localModelDisabled, setLocalModelDisabled] =
    React.useState<boolean>(isModelDisabled)
  const [localUserDisabled, setLocalUserDisabled] =
    React.useState<boolean>(isUserDisabled)

  React.useEffect(() => {
    setLocalModelDisabled(isModelDisabled)
    setLocalUserDisabled(isUserDisabled)
  }, [skill?.name, isModelDisabled, isUserDisabled])

  if (!skill || !detail) return null

  const isRuntime = Boolean(skill.isRuntime)
  const canToggle = !isRuntime || isSessionContext
  const { sourceClass, sourceLabel } = getSkillSourceMeta(skill, t)

  const handleSave = () => {
    if (onSave) {
      onSave(skill.name, localModelDisabled, localUserDisabled)
    } else {
      onClose()
    }
  }

  const footerButtons = canToggle
    ? [
        e(
          'button',
          {
            key: 'cancel',
            type: 'button',
            className: 'dsh-sam-btn secondary',
            disabled: saving,
            onClick: onClose,
          },
          t('sessionSettings.skills.modalCancelBtn'),
        ),
        e(
          'button',
          {
            key: 'save',
            type: 'button',
            className: 'dsh-sam-btn primary',
            disabled: saving,
            onClick: handleSave,
          },
          saving
            ? e(IconLoadingOutline16, { size: 12, className: 'dsh-spin' })
            : null,
          saving
            ? t('sessionSettings.skills.modalSavingBtn')
            : t('sessionSettings.skills.modalSaveBtn'),
        ),
      ]
    : [
        e(
          'button',
          {
            key: 'close',
            type: 'button',
            className: 'dsh-sam-btn primary',
            onClick: onClose,
          },
          t('sessionSettings.skills.modalDoneBtn'),
        ),
      ]

  return e(
    ModalDialog,
    {
      open: true,
      onClose,
      title: skill.name,
      panelClassName: 'dsh-sam-modal-panel dsh-skill-modal',
      headerExtra: [
        e(Badge, {
          key: 'src',
          label: sourceLabel,
          variant: sourceClass,
        }),
        canToggle
          ? e(Badge, {
              key: 'model',
              label: !localModelDisabled
                ? t('sessionSettings.skills.modelInvocableEnabled')
                : t('sessionSettings.skills.modelInvocableDisabled'),
              variant: !localModelDisabled
                ? 'status-enabled'
                : 'status-disabled',
            })
          : null,
        canToggle
          ? e(Badge, {
              key: 'user',
              label: !localUserDisabled
                ? t('sessionSettings.skills.userInvocableEnabled')
                : t('sessionSettings.skills.userInvocableDisabled'),
              variant: !localUserDisabled
                ? 'status-enabled'
                : 'status-disabled',
            })
          : null,
      ].filter(Boolean),
      footer: [
        e(
          'div',
          { key: 'right', className: 'dsh-mcp-modal-footer-right' },
          footerButtons,
        ),
      ],
    },
    e(
      'div',
      { className: 'dsh-skill-modal-body' },

      // Description
      skill.description
        ? e('p', { className: 'dsh-skill-modal-desc' }, skill.description)
        : null,

      // Runtime Note (shown in global settings)
      isRuntime && !isSessionContext
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
        canToggle
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
                  className: `dsh-mcp-switch-card mini ${!localModelDisabled ? 'active' : ''}`,
                  onClick: () => setLocalModelDisabled((prev) => !prev),
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
                    className: `dsh-mcp-switch-btn ${!localModelDisabled ? 'active' : ''}`,
                  },
                  e('span', { className: 'dsh-mcp-switch-thumb' }),
                ),
              ),
              // Switch 2: User Invocable
              e(
                'div',
                {
                  className: `dsh-mcp-switch-card mini ${!localUserDisabled ? 'active' : ''}`,
                  onClick: () => setLocalUserDisabled((prev) => !prev),
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
                    className: `dsh-mcp-switch-btn ${!localUserDisabled ? 'active' : ''}`,
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
