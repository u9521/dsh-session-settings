import type { ClientRemoteApi } from './session.ts'

export interface SkillsSettingsProps {
  api: ClientRemoteApi
  t: (key: string, vars?: Record<string, string | number>) => string
  close?: () => void
}

export interface SkillSourceMeta {
  sourceClass: string
  sourceLabel: string
}
