import * as React from 'react'
import {
  IconLoadingOutline16,
  IconEditOutline16,
  IconTrashOutline16,
  IconWarningOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { GlobalMcpServerConfig } from '../../types/index.ts'
import { ServerIcon } from '../../components/index.ts'
import { formatProtocolTitle } from '../../utils/string.ts'

const e = React.createElement

export interface McpServerCardProps {
  server: GlobalMcpServerConfig
  isTesting: boolean
  testResult?: { ok: boolean; message: string }
  onTest: (server: GlobalMcpServerConfig) => void
  onOpenTools: (server: GlobalMcpServerConfig) => void
  onOpenEdit: (server: GlobalMcpServerConfig) => void
  onDelete: (server: GlobalMcpServerConfig) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function McpServerCard({
  server,
  isTesting,
  testResult,
  onTest,
  onOpenTools,
  onOpenEdit,
  onDelete,
  t,
}: McpServerCardProps) {
  const protoLabel =
    server.transport === 'stdio'
      ? 'stdio'
      : server.detectedTransport === 'sse'
        ? 'SSE'
        : server.detectedTransport === 'streamable-http'
          ? 'HTTP'
          : 'HTTP / SSE'

  const protoClass =
    server.transport === 'stdio'
      ? 'stdio'
      : server.detectedTransport === 'sse'
        ? 'sse'
        : server.detectedTransport === 'streamable-http'
          ? 'streamable-http'
          : 'streamable-http-or-sse'

  return e(
    'div',
    { className: 'dsh-mcp-server-card' },
    // Card Top Row
    e(
      'div',
      { className: 'dsh-mcp-card-top' },
      e(
        'div',
        { className: 'dsh-mcp-card-identity' },
        e(
          'div',
          { className: 'dsh-mcp-transport-icon' },
          e(ServerIcon, { server, size: 18 }),
        ),
        e(
          'div',
          { className: 'dsh-mcp-title-wrap' },
          e('span', { className: 'dsh-mcp-card-name' }, server.name),
          e('span', { className: 'dsh-mcp-card-id' }, server.id),
        ),
      ),
      e(
        'div',
        { className: 'dsh-mcp-badges' },
        e(
          'span',
          { className: `dsh-mcp-proto-badge ${protoClass}` },
          protoLabel,
        ),
        server.serverInfo?.websiteUrl
          ? e(
              'a',
              {
                key: 'website',
                href: server.serverInfo.websiteUrl,
                target: '_blank',
                rel: 'noopener noreferrer',
                className: 'dsh-mcp-proto-badge website',
                title: server.serverInfo.websiteUrl,
                onClick: (evt: React.MouseEvent) => evt.stopPropagation(),
              },
              '🔗 ' + t('table.website'),
            )
          : null,
        server.serverInfo?.version
          ? e(
              'span',
              {
                className: 'dsh-mcp-proto-badge server-version',
                title: formatProtocolTitle(server.serverInfo),
              },
              server.serverInfo.name &&
                server.serverInfo.name !== server.id &&
                server.serverInfo.name !== server.name
                ? `${server.serverInfo.name} ${server.serverInfo.version}`
                : server.serverInfo.version,
            )
          : server.serverInfo?.protocolVersion
            ? e(
                'span',
                {
                  className: 'dsh-mcp-proto-badge server-version',
                  title: formatProtocolTitle(server.serverInfo),
                },
                `MCP ${server.serverInfo.protocolVersion}`,
              )
            : null,
        server.toolCallTimeoutMs
          ? e(
              'span',
              { className: 'dsh-mcp-proto-badge timeout' },
              `${server.toolCallTimeoutMs / 1000}s 超时`,
            )
          : null,
        server.disabledTools && server.disabledTools.length > 0
          ? e(
              'span',
              { className: 'dsh-mcp-proto-badge disabled-tools' },
              t('toolsModal.disabledBadge', {
                count: server.disabledTools.length,
              }),
            )
          : null,
        server.enabledByDefault
          ? e(
              'span',
              { className: 'dsh-mcp-default-badge' },
              t('table.enabledDefault'),
            )
          : null,
      ),
    ),

    // Description
    server.description || server.serverInfo?.description
      ? e(
          'p',
          { className: 'dsh-mcp-card-desc' },
          server.description || server.serverInfo?.description,
        )
      : null,

    // Target info (Command + args or URL)
    e(
      'div',
      { className: 'dsh-mcp-target-box' },
      server.transport === 'stdio'
        ? e(
            'code',
            { className: 'dsh-mcp-code-preview' },
            `${server.command || ''} ${(server.args || []).join(' ')}`,
          )
        : e('code', { className: 'dsh-mcp-code-preview' }, server.url || ''),
    ),

    // Test result inline banner
    testResult
      ? e(
          'div',
          {
            className: `dsh-mcp-inline-test ${testResult.ok ? 'success' : 'error'}`,
          },
          !testResult.ok ? e(IconWarningOutline16, { size: 14 }) : null,
          e('span', null, testResult.message),
        )
      : null,

    // Card Footer Actions
    e(
      'div',
      { className: 'dsh-mcp-card-footer' },
      e(
        'div',
        {
          style: {
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
          },
        },
        e(
          'button',
          {
            type: 'button',
            className: 'dsh-mcp-mini-btn',
            disabled: isTesting,
            onClick: () => onTest(server),
          },
          isTesting ? e(IconLoadingOutline16, { className: 'dsh-spin' }) : null,
          isTesting ? t('actions.testing') : t('actions.test'),
        ),
        e(
          'button',
          {
            type: 'button',
            className: 'dsh-mcp-mini-btn',
            onClick: () => onOpenTools(server),
          },
          t('actions.toolsList'),
        ),
      ),
      e(
        'div',
        { className: 'dsh-mcp-footer-right' },
        e(
          'button',
          {
            type: 'button',
            className: 'dsh-mcp-icon-btn',
            title: t('actions.edit'),
            onClick: () => onOpenEdit(server),
          },
          e(IconEditOutline16),
        ),
        e(
          'button',
          {
            type: 'button',
            className: 'dsh-mcp-icon-btn danger',
            title: t('actions.delete'),
            onClick: () => onDelete(server),
          },
          e(IconTrashOutline16),
        ),
      ),
    ),
  )
}
