import * as React from 'react'
import { IconSkillOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SkillItem } from '../../types/index.ts'
import { ItemToggleCard } from '../../components/index.ts'
import { getSkillSourceMeta } from '../../utils/index.ts'

const e = React.createElement

export interface SkillCardProps {
  skill: SkillItem
  isModelDisabled: boolean
  isUserDisabled: boolean
  onClick: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function SkillCard({
  skill,
  isModelDisabled,
  isUserDisabled,
  onClick,
  t,
}: SkillCardProps) {
  const isRuntime = Boolean(skill.isRuntime)
  const { sourceClass, sourceLabel } = getSkillSourceMeta(skill, t)

  const badges: any[] = [
    { label: sourceLabel, variant: sourceClass },
    !isRuntime
      ? {
          label: !isModelDisabled
            ? t('sessionSettings.skills.modelInvocableEnabled')
            : t('sessionSettings.skills.modelInvocableDisabled'),
          variant: !isModelDisabled ? 'status-enabled' : 'status-disabled',
        }
      : null,
    !isRuntime
      ? {
          label: !isUserDisabled
            ? t('sessionSettings.skills.userInvocableEnabled')
            : t('sessionSettings.skills.userInvocableDisabled'),
          variant: !isUserDisabled ? 'status-enabled' : 'status-disabled',
        }
      : null,
  ].filter(Boolean)

  return e(ItemToggleCard, {
    key: skill.name,
    id: skill.name,
    icon: e(IconSkillOutline16, { size: 14 }),
    title: skill.name,
    badges,
    description: skill.description,
    onClick,
  })
}
