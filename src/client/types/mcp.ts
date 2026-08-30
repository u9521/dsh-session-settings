import type { ClientRemoteApi } from './session.ts'

export interface McpSettingsProps {
  api: ClientRemoteApi
  t: (key: string, vars?: Record<string, string | number>) => string
  close?: () => void
}

export interface ToolParamItem {
  name: string
  type: string
  required: boolean
  description?: string
  default?: unknown
  enum?: string[]
}

export interface EnvEntry {
  key: string
  value: string
}
