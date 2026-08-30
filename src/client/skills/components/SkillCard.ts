import * as React from 'react'
import type { SkillItem } from '../../types/index.ts'
import { ItemToggleCard, type BadgeProps } from '../../components/index.ts'
import { getSkillSourceMeta } from '../../utils/index.ts'

const e = React.createElement

export interface SkillCardProps {
  skill: SkillItem
  isModelDisabled: boolean
  isUserDisabled: boolean
  showStatusBadges?: boolean
  onClick: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function SkillCard({
  skill,
  isModelDisabled,
  isUserDisabled,
  showStatusBadges = false,
  onClick,
  t,
}: SkillCardProps) {
  const isRuntime = Boolean(skill.isRuntime)
  const { sourceClass, sourceLabel } = getSkillSourceMeta(skill, t)

  const badges: BadgeProps[] = []
  badges.push({ label: sourceLabel, variant: sourceClass })
  if (showStatusBadges || !isRuntime) {
    badges.push({
      label: !isModelDisabled
        ? t('sessionSettings.skills.modelInvocableEnabled')
        : t('sessionSettings.skills.modelInvocableDisabled'),
      variant: !isModelDisabled ? 'status-enabled' : 'status-disabled',
    })
    badges.push({
      label: !isUserDisabled
        ? t('sessionSettings.skills.userInvocableEnabled')
        : t('sessionSettings.skills.userInvocableDisabled'),
      variant: !isUserDisabled ? 'status-enabled' : 'status-disabled',
    })
  }

  return e(ItemToggleCard, {
    key: skill.name,
    id: skill.name,
    title: skill.name,
    badges,
    description: skill.description,
    onClick,
  })
}
