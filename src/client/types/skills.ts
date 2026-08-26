import type { SkillItem } from '../../types.ts'

export interface SkillsSettingsProps {
  api: any
  t: (key: string, vars?: Record<string, string | number>) => string
  close?: () => void
}

export interface SkillSourceMeta {
  sourceClass: string
  sourceLabel: string
}
