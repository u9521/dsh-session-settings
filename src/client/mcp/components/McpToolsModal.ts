import * as React from 'react'
import {
  IconRefreshOutline16,
  IconLoadingOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  GlobalMcpServerConfig,
  McpDiscoveredTool,
  McpServerInfo,
} from '../../types/index.ts'
import { ModalDialog, SchemaViewer } from '../../components/index.ts'

const e = React.createElement

export interface McpToolsModalProps {
  open: boolean
  server: Partial<GlobalMcpServerConfig> | null
  loading: boolean
  error?: string
  toolsList: McpDiscoveredTool[]
  disabledToolsSet: Set<string>
  serverInfo?: McpServerInfo | null
  detectedTransport?: string | null
  saving: boolean
  onToggleTool: (toolName: string) => void
  onToggleAllTools: (enableAll: boolean) => void
  onRefresh: () => void
  onClose: () => void
  onSave: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function McpToolsModal({
  open,
  server,
  loading,
  error,
  toolsList,
  disabledToolsSet,
  serverInfo,
  detectedTransport,
  saving,
  onToggleTool,
  onToggleAllTools,
  onRefresh,
  onClose,
  onSave,
  t,
}: McpToolsModalProps) {
  const [search, setSearch] = React.useState<string>('')
  const [expandedSchemas, setExpandedSchemas] = React.useState<Set<string>>(
    new Set(),
  )
  const [schemaModes, setSchemaModes] = React.useState<
    Record<string, 'list' | 'raw'>
  >({})

  if (!open || !server) return null

  const handleToggleSchema = (toolName: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev)
      if (next.has(toolName)) next.delete(toolName)
      else next.add(toolName)
      return next
    })
  }

  const filteredTools = toolsList.filter((tool) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      tool.name.toLowerCase().includes(q) ||
      (tool.description && tool.description.toLowerCase().includes(q))
    )
  })

  const headerMeta = e(
    'div',
    { className: 'dsh-mcp-tools-header-meta' },
    e('span', { className: 'dsh-mcp-card-name' }, server.name || server.id),
    e('span', { className: 'dsh-mcp-card-id' }, server.id),
    e(
      'span',
      {
        className: `dsh-mcp-proto-badge ${server.transport || 'streamable-http-or-sse'}`,
      },
      server.transport === 'stdio'
        ? 'STDIO'
        : detectedTransport === 'sse'
          ? 'SSE'
          : detectedTransport === 'streamable-http'
            ? 'Streamable HTTP'
            : 'HTTP / SSE',
    ),
    serverInfo?.version
      ? e(
          'span',
          {
            className: 'dsh-mcp-proto-badge server-version',
            title: serverInfo.protocolVersion
              ? `MCP Protocol: ${serverInfo.protocolVersion}${serverInfo.name ? ` (${serverInfo.name})` : ''}`
              : serverInfo.name || undefined,
          },
          serverInfo.name &&
            serverInfo.name !== server.id &&
            serverInfo.name !== server.name
            ? `${serverInfo.name} ${serverInfo.version}`
            : serverInfo.version,
        )
      : serverInfo?.protocolVersion
        ? e(
            'span',
            {
              className: 'dsh-mcp-proto-badge server-version',
              title: serverInfo.name || undefined,
            },
            `MCP ${serverInfo.protocolVersion}`,
          )
        : null,
  )

  return e(
    ModalDialog,
    {
      open: Boolean(server),
      onClose,
      title: t('toolsModal.title'),
      headerExtra: headerMeta,
      panelClassName: 'dsh-mcp-tools-modal',
      footer: [
        e(
          'div',
          { key: 'left', className: 'dsh-mcp-modal-footer-left' },
          e(
            'span',
            {
              style: {
                fontSize: 12,
                color: 'var(--dsw-alias-label-secondary)',
              },
            },
            `已启用 ${toolsList.length - disabledToolsSet.size} / ${toolsList.length}`,
          ),
        ),
        e(
          'div',
          { key: 'right', className: 'dsh-mcp-modal-footer-right' },
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn tertiary',
              onClick: onClose,
            },
            t('actions.cancel'),
          ),
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn primary',
              disabled: saving,
              onClick: onSave,
            },
            saving ? t('toolsModal.saving') : t('toolsModal.save'),
          ),
        ),
      ],
    },
    // Toolbar
    e(
      'div',
      { className: 'dsh-mcp-tools-toolbar' },
      e(
        'div',
        { className: 'dsh-mcp-tools-search-box' },
        e('input', {
          type: 'text',
          className: 'dsh-sam-select',
          placeholder: t('toolsModal.searchPlaceholder'),
          value: search,
          onChange: (evt: React.ChangeEvent<HTMLInputElement>) =>
            setSearch(evt.target.value),
        }),
      ),
      e(
        'div',
        { className: 'dsh-mcp-tools-toolbar-actions' },
        e(
          'button',
          {
            type: 'button',
            className: 'dsh-sam-btn secondary',
            disabled: loading || toolsList.length === 0,
            onClick: () => onToggleAllTools(true),
          },
          t('toolsModal.enableAll'),
        ),
        e(
          'button',
          {
            type: 'button',
            className: 'dsh-sam-btn secondary',
            disabled: loading || toolsList.length === 0,
            onClick: () => onToggleAllTools(false),
          },
          t('toolsModal.disableAll'),
        ),
        e(
          'button',
          {
            type: 'button',
            className: 'dsh-sam-btn secondary',
            disabled: loading,
            onClick: onRefresh,
            title: t('toolsModal.retry'),
          },
          loading
            ? e(IconLoadingOutline16, { size: 14, className: 'dsh-spin' })
            : e(IconRefreshOutline16, { size: 14 }),
          loading ? t('actions.toolsFetching') : t('toolsModal.retry'),
        ),
      ),
    ),
    // Tools list / States
    loading
      ? e(
          'div',
          {
            className: 'dsh-sam-desc',
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '32px 0',
            },
          },
          e(IconLoadingOutline16, { size: 16, className: 'dsh-spin' }),
          t('toolsModal.loading'),
        )
      : error
        ? e(
            'div',
            {
              className: 'dsh-sam-notice error',
              style: { margin: '14px 0' },
            },
            t('toolsModal.fetchFailed') + error,
          )
        : toolsList.length === 0
          ? e(
              'div',
              {
                className: 'dsh-sam-desc',
                style: { padding: '32px 0', textAlign: 'center' },
              },
              t('toolsModal.serverNoTools'),
            )
          : filteredTools.length === 0
            ? e(
                'div',
                {
                  className: 'dsh-sam-desc',
                  style: { padding: '32px 0', textAlign: 'center' },
                },
                t('toolsModal.empty'),
              )
            : e(
                'div',
                { className: 'dsh-mcp-tools-list' },
                filteredTools.map((tool) => {
                  const isDisabled = disabledToolsSet.has(tool.name)
                  const isSchemaExpanded = expandedSchemas.has(tool.name)
                  const hasSchema =
                    tool.inputSchema && Object.keys(tool.inputSchema).length > 0

                  return e(
                    'div',
                    {
                      key: tool.name,
                      className: `dsh-mcp-tool-card ${isDisabled ? 'disabled' : ''}`,
                    },
                    e(
                      'div',
                      { className: 'dsh-mcp-tool-card-main' },
                      e(
                        'div',
                        { className: 'dsh-mcp-tool-card-left' },
                        e(
                          'div',
                          {
                            className: `dsh-mcp-switch-btn ${!isDisabled ? 'active' : ''}`,
                            role: 'button',
                            tabIndex: 0,
                            style: { marginTop: 2, cursor: 'pointer' },
                            onClick: () => onToggleTool(tool.name),
                            onKeyDown: (evt: React.KeyboardEvent) => {
                              if (evt.key === 'Enter' || evt.key === ' ') {
                                evt.preventDefault()
                                onToggleTool(tool.name)
                              }
                            },
                            title: !isDisabled
                              ? t('toolsModal.statusEnabled')
                              : t('toolsModal.statusDisabled'),
                          },
                          e('span', { className: 'dsh-mcp-switch-thumb' }),
                        ),
                        e(
                          'div',
                          { className: 'dsh-mcp-tool-info' },
                          e(
                            'div',
                            { className: 'dsh-mcp-tool-title-row' },
                            e(
                              'span',
                              { className: 'dsh-mcp-tool-name' },
                              tool.name,
                            ),
                            e(
                              'span',
                              {
                                className: `dsh-mcp-tool-status-pill ${!isDisabled ? 'active' : 'disabled'}`,
                              },
                              !isDisabled
                                ? t('toolsModal.statusEnabled')
                                : t('toolsModal.statusDisabled'),
                            ),
                          ),
                          tool.description
                            ? e(
                                'div',
                                { className: 'dsh-mcp-tool-desc' },
                                tool.description,
                              )
                            : null,
                        ),
                      ),
                      hasSchema
                        ? e(
                            'button',
                            {
                              type: 'button',
                              className: `dsh-mcp-tool-schema-btn ${isSchemaExpanded ? 'active' : ''}`,
                              onClick: () => handleToggleSchema(tool.name),
                            },
                            isSchemaExpanded
                              ? t('toolsModal.hideParameters')
                              : t('toolsModal.parameters'),
                          )
                        : null,
                    ),
                    isSchemaExpanded && hasSchema
                      ? e(SchemaViewer, {
                          schema: tool.inputSchema,
                          mode: schemaModes[tool.name] || 'list',
                          onModeChange: (m) =>
                            setSchemaModes((prev) => ({
                              ...prev,
                              [tool.name]: m,
                            })),
                          t,
                        })
                      : null,
                  )
                }),
              ),
  )
}
