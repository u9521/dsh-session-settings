import * as React from 'react'
import { IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  GlobalMcpServerConfig,
  McpDiscoveredTool,
} from '../../types/index.ts'
import {
  ModalDialog,
  ModeSelector,
  SearchToolbar,
  EmptyState,
  Badge,
  SchemaViewer,
  ServerIcon,
} from '../../components/index.ts'

const e = React.createElement

export interface SessionMcpToolsModalProps {
  server: GlobalMcpServerConfig | null
  toolsMode: 'default' | 'custom'
  disabledToolsSet: Set<string>
  fetching: boolean
  toolsList: McpDiscoveredTool[]
  onToolsModeChange: (mode: 'default' | 'custom') => void
  onToggleTool: (toolName: string) => void
  onToggleAllTools: (enableAll: boolean) => void
  onResetToDefault: () => void
  onFetchTools: () => void
  onClose: () => void
  onApply: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function SessionMcpToolsModal({
  server,
  toolsMode,
  disabledToolsSet,
  fetching,
  toolsList,
  onToolsModeChange,
  onToggleTool,
  onToggleAllTools,
  onResetToDefault,
  onFetchTools,
  onClose,
  onApply,
  t,
}: SessionMcpToolsModalProps) {
  const [search, setSearch] = React.useState<string>('')
  const [expandedSchemas, setExpandedSchemas] = React.useState<Set<string>>(
    new Set(),
  )
  const [schemaModes, setSchemaModes] = React.useState<
    Record<string, 'list' | 'raw'>
  >({})

  if (!server) return null

  const protoLabel =
    server.transport === 'stdio'
      ? 'STDIO'
      : server.detectedTransport === 'sse'
        ? 'SSE'
        : server.detectedTransport === 'streamable-http'
          ? 'Streamable HTTP'
          : 'HTTP / SSE'

  const protoVariant =
    server.transport === 'stdio'
      ? 'stdio'
      : server.detectedTransport === 'sse'
        ? 'sse'
        : 'streamable-http'

  const filteredTools = toolsList.filter((tool) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return (
      tool.name.toLowerCase().includes(term) ||
      (tool.description || '').toLowerCase().includes(term)
    )
  })

  const handleToggleSchema = (toolName: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev)
      if (next.has(toolName)) next.delete(toolName)
      else next.add(toolName)
      return next
    })
  }

  const handleSchemaModeChange = (toolName: string, mode: 'list' | 'raw') => {
    setSchemaModes((prev) => ({ ...prev, [toolName]: mode }))
  }

  return e(
    ModalDialog,
    {
      open: Boolean(server),
      onClose,
      title: `${server.name} - ${t('sessionSettings.toolsModal.title')}`,
      panelClassName: 'dsh-sam-modal-panel dsh-mcp-tools-modal',
      headerExtra: [
        e(ServerIcon, {
          key: 'icon',
          server,
          transport: server.transport,
          size: 16,
        }),
        server.id && server.id !== server.name
          ? e('span', { key: 'id', className: 'dsh-mcp-card-id' }, server.id)
          : null,
        e(Badge, {
          key: 'proto',
          label: protoLabel,
          variant: protoVariant,
        }),
        toolsList.length > 0
          ? e(Badge, {
              key: 'count',
              label: `${toolsList.length} 工具`,
              variant: 'count',
            })
          : null,
      ].filter(Boolean),
      footer: [
        e(
          'div',
          { key: 'left', className: 'dsh-mcp-modal-footer-left' },
          toolsMode === 'custom'
            ? disabledToolsSet.size > 0
              ? e(Badge, {
                  label: t('sessionSettings.toolsModal.disabledCount', {
                    count: disabledToolsSet.size,
                  }),
                  variant: 'disabled-tools',
                })
              : e(Badge, {
                  label: t('sessionSettings.toolsModal.allEnabledCount', {
                    total: toolsList.length,
                  }),
                  variant: 'stdio',
                })
            : e(Badge, {
                label: t('sessionSettings.toolsModal.modeDefaultTitle'),
                variant: 'stdio',
              }),
        ),
        e(
          'div',
          { key: 'right', className: 'dsh-mcp-modal-footer-right' },
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn secondary',
              onClick: onClose,
            },
            t('sessionSettings.toolsModal.cancel'),
          ),
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn primary',
              onClick: onApply,
            },
            t('sessionSettings.toolsModal.save'),
          ),
        ),
      ],
    },
    // Mode Selector
    e(ModeSelector, {
      name: 'sessionToolsMode',
      value: toolsMode,
      className: 'dsh-session-tools-modes',
      onChange: onToolsModeChange,
      options: [
        {
          value: 'default',
          title: t('sessionSettings.toolsModal.modeDefaultTitle'),
          desc: t('sessionSettings.toolsModal.modeDefaultDesc', {
            count: (server.disabledTools || []).length,
          }),
        },
        {
          value: 'custom',
          title: t('sessionSettings.toolsModal.modeCustomTitle'),
          desc: t('sessionSettings.toolsModal.modeCustomDesc'),
        },
      ],
    }),

    // Toolbar
    e(SearchToolbar, {
      value: search,
      onChange: setSearch,
      placeholder: t('sessionSettings.toolsModal.searchPlaceholder'),
      className: 'dsh-mcp-tools-toolbar',
      actions:
        toolsMode === 'custom'
          ? [
              e(
                'button',
                {
                  key: 'enableAll',
                  type: 'button',
                  className: 'dsh-sam-btn secondary',
                  onClick: () => onToggleAllTools(true),
                },
                t('sessionSettings.toolsModal.enableAll'),
              ),
              e(
                'button',
                {
                  key: 'disableAll',
                  type: 'button',
                  className: 'dsh-sam-btn secondary',
                  onClick: () => onToggleAllTools(false),
                },
                t('sessionSettings.toolsModal.disableAll'),
              ),
              e(
                'button',
                {
                  key: 'reset',
                  type: 'button',
                  className: 'dsh-sam-btn secondary',
                  onClick: onResetToDefault,
                },
                t('sessionSettings.toolsModal.resetToDefault'),
              ),
            ]
          : null,
    }),

    // Tools list
    fetching
      ? e(
          'div',
          { className: 'dsh-sam-loading', style: { padding: 24 } },
          t('sessionSettings.toolsModal.fetchingTools'),
        )
      : toolsList.length === 0
        ? e(EmptyState, {
            style: { padding: '24px 16px' },
            message: t('sessionSettings.toolsModal.noToolsAvailable'),
            action: e(
              'button',
              {
                type: 'button',
                className: 'dsh-sam-btn secondary',
                onClick: onFetchTools,
              },
              e(IconRefreshOutline16, { size: 14 }),
              t('sessionSettings.toolsModal.fetchToolsBtn'),
            ),
          })
        : e(
            'div',
            { className: 'dsh-mcp-tools-list' },
            filteredTools.map((tool) => {
              const isGloballyDisabled = Boolean(
                server.disabledTools?.includes(tool.name),
              )
              const isCustomDisabled = disabledToolsSet.has(tool.name)
              const isDisabled =
                toolsMode === 'custom' ? isCustomDisabled : isGloballyDisabled

              const isSchemaExpanded = expandedSchemas.has(tool.name)
              const hasSchema = Boolean(
                tool.inputSchema &&
                typeof tool.inputSchema === 'object' &&
                tool.inputSchema.properties &&
                Object.keys(tool.inputSchema.properties).length > 0,
              )

              const isEnabled = !isDisabled
              const statusBadge =
                toolsMode === 'custom'
                  ? isCustomDisabled
                    ? {
                        label: t(
                          'sessionSettings.toolsModal.toolCustomDisabledBadge',
                        ),
                        variant: 'tool-disabled',
                      }
                    : {
                        label: t('sessionSettings.toolsModal.toolEnabled'),
                        variant: 'tool-active',
                      }
                  : isGloballyDisabled
                    ? {
                        label: t(
                          'sessionSettings.toolsModal.toolGlobalDisabledBadge',
                        ),
                        variant: 'tool-disabled',
                      }
                    : {
                        label: t('sessionSettings.toolsModal.toolEnabled'),
                        variant: 'tool-active',
                      }

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
                      'button',
                      {
                        type: 'button',
                        role: 'switch',
                        'aria-checked': isEnabled,
                        className: `dsh-mcp-switch-btn ${isEnabled ? 'active' : ''}`,
                        disabled: toolsMode !== 'custom',
                        style: {
                          marginTop: 2,
                          cursor:
                            toolsMode === 'custom' ? 'pointer' : 'default',
                        },
                        onClick: () => onToggleTool(tool.name),
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
                            className: `dsh-mcp-tool-status-pill ${
                              statusBadge.variant === 'tool-active'
                                ? 'active'
                                : 'disabled'
                            }`,
                          },
                          statusBadge.label,
                        ),
                      ),
                      tool.description
                        ? e(
                            'p',
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
                          ? t('sessionSettings.toolsModal.hideParameters')
                          : t('sessionSettings.toolsModal.parameters'),
                      )
                    : null,
                ),
                isSchemaExpanded && hasSchema
                  ? e(SchemaViewer, {
                      schema: tool.inputSchema,
                      mode: schemaModes[tool.name] || 'list',
                      onModeChange: (m) => handleSchemaModeChange(tool.name, m),
                      t,
                    })
                  : null,
              )
            }),
          ),
  )
}
