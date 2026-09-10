import * as React from 'react'
import {
  IconCodeOutline16,
  IconLinkOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  GlobalMcpServerConfig,
  McpServerInfo,
  McpTransportType,
} from '../../types.ts'

const e = React.createElement

export interface ServerIconProps {
  server?: Partial<GlobalMcpServerConfig> | null
  serverInfo?: McpServerInfo | null
  transport?: McpTransportType | string
  size?: number
  className?: string
  style?: React.CSSProperties
}

export function ServerIcon({
  server,
  serverInfo,
  transport,
  size = 16,
  className = '',
  style,
}: ServerIconProps): React.ReactElement {
  const [imgError, setImgError] = React.useState<boolean>(false)

  const info = serverInfo || server?.serverInfo
  const iconSrc =
    !imgError && info?.icons && info.icons.length > 0
      ? info.icons[0].src
      : undefined

  // Reset imgError if iconSrc changes
  React.useEffect(() => {
    setImgError(false)
  }, [iconSrc])

  const transportType = transport || server?.transport || 'streamable-http'
  const isStdio = transportType === 'stdio'

  if (iconSrc) {
    return e('img', {
      src: iconSrc,
      alt:
        info?.title ||
        info?.name ||
        server?.name ||
        server?.id ||
        'MCP Server Icon',
      className: `dsh-mcp-custom-icon ${className}`.trim(),
      style: {
        width: size,
        height: size,
        objectFit: 'contain',
        borderRadius: '4px',
        flexShrink: 0,
        ...style,
      },
      onError: () => setImgError(true),
    })
  }

  const fallbackIcon = isStdio
    ? e(IconCodeOutline16, { size, className })
    : e(IconLinkOutline16, { size, className })

  if (style) {
    return e(
      'span',
      {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        },
      },
      fallbackIcon,
    )
  }

  return fallbackIcon
}
