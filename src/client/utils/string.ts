import type { McpServerInfo } from '../../types.ts'

export function capitalize(s: string): string {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

export function effortLabel(
  t: (key: string, vars?: Record<string, string | number>) => string,
  effortId: string,
): string {
  const key = `sessionSettings.field.reasoning${capitalize(effortId)}`
  const translated = t(key)
  return translated && !translated.startsWith('sessionSettings.field.')
    ? translated
    : effortId
}

export function formatProtocolTitle(
  info?: McpServerInfo | null,
): string | undefined {
  if (!info) return undefined
  const parts: string[] = []
  if (info.name) {
    parts.push(info.name)
  }
  if (info.version) {
    parts.push(info.version)
  }
  if (info.protocolVersion) {
    let protoStr = `MCP Protocol: ${info.protocolVersion}`
    if (info.supportedVersions && info.supportedVersions.length > 0) {
      protoStr += ` (支持版本: ${info.supportedVersions.join(', ')})`
    }
    parts.push(protoStr)
  }
  return parts.join(' | ') || undefined
}
