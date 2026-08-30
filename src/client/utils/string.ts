import type { McpServerInfo } from '../../types.ts'

function capitalize(s: string): string {
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
  t?: (key: string, vars?: Record<string, string | number>) => string,
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
      const vers = info.supportedVersions.join(', ')
      protoStr += t
        ? t('mcpServers.supportedVersions', { versions: vers })
        : ` (Supported: ${vers})`
    }
    parts.push(protoStr)
  }
  return parts.join(' | ') || undefined
}
