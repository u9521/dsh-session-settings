export interface McpSettingsProps {
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
