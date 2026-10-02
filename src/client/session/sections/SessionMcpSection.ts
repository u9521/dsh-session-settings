import * as React from 'react'
import { IconChecklistOutlineMedium } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  SessionMcpConfig,
  SessionMcpMode,
  GlobalMcpServerConfig,
  SessionSettingsConfig,
} from '../../types/index.ts'
import { EmptyState, Badge, ServerIcon } from '../../components/index.ts'
import { formatProtocolTitle } from '../../utils/string.ts'
import { isMcpClientUnavailable } from '../../utils/mcpRuntime.ts'

const e = React.createElement

export interface SessionMcpSectionProps {
  scope?: 'session' | 'workspace' | 'global'
  sessionId?: string
  mcpConfig: SessionMcpConfig
  availableMcpServers: GlobalMcpServerConfig[]
  currentWorkspaceId?: string
  workspaceSettings?: SessionSettingsConfig
  globalConfig: SessionSettingsConfig
  refreshingClientId?: string
  clientRefreshResults?: Record<string, { ok: boolean; message: string }>
  onMcpModeChange: (mode: SessionMcpMode) => void
  onToggleMcpServer: (serverId: string) => void
  onToggleSelectAllMcp: () => void
  onOpenSessionToolsModal: (
    server: GlobalMcpServerConfig,
    isReadonly?: boolean,
  ) => void
  onRefreshClient?: (server: GlobalMcpServerConfig) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function SessionMcpSection({
  scope = 'session',
  sessionId,
  mcpConfig,
  availableMcpServers,
  currentWorkspaceId,
  workspaceSettings,
  globalConfig,
  refreshingClientId,
  clientRefreshResults,
  onMcpModeChange,
  onToggleMcpServer,
  onToggleSelectAllMcp,
  onOpenSessionToolsModal,
  onRefreshClient,
  t,
}: SessionMcpSectionProps) {
  const defaultMode = currentWorkspaceId ? 'workspace' : 'global'

  const activeSourceMode: 'workspace' | 'global' | 'custom' =
    scope === 'global'
      ? 'custom'
      : scope === 'workspace'
        ? mcpConfig?.mode === 'custom'
          ? 'custom'
          : 'global'
        : mcpConfig?.mode === 'custom'
          ? 'custom'
          : (mcpConfig?.mode ?? defaultMode)

  const isReadonly =
    scope === 'session'
      ? activeSourceMode !== 'custom'
      : scope === 'workspace'
        ? activeSourceMode !== 'custom'
        : false

  const isAllMcpSelected =
    availableMcpServers.length > 0 &&
    availableMcpServers.every((s) =>
      (mcpConfig?.enabledServerIds ?? []).includes(s.id),
    )

  const sourceTabs =
    scope === 'session'
      ? [
          ...(currentWorkspaceId
            ? [
                {
                  key: 'workspace',
                  label: t('sessionSettings.sourceTabs.workspace'),
                  active: activeSourceMode === 'workspace',
                  onClick: () => onMcpModeChange('workspace'),
                },
              ]
            : []),
          {
            key: 'global',
            label: t('sessionSettings.sourceTabs.global'),
            active: activeSourceMode === 'global',
            onClick: () => onMcpModeChange('global'),
          },
          {
            key: 'custom',
            label: t('sessionSettings.sourceTabs.custom'),
            active: activeSourceMode === 'custom',
            onClick: () => onMcpModeChange('custom'),
          },
        ]
      : scope === 'workspace'
        ? [
            {
              key: 'global',
              label: t('sessionSettings.sourceTabs.global'),
              active: activeSourceMode === 'global',
              onClick: () => onMcpModeChange('global'),
            },
            {
              key: 'custom',
              label: t('sessionSettings.sourceTabs.workspaceCustom'),
              active: activeSourceMode === 'custom',
              onClick: () => onMcpModeChange('custom'),
            },
          ]
        : []

  return e(
    'div',
    { className: 'dsh-view-content-inner' },
    // Source Tabs (Segmented control for workspace / global / custom)
    sourceTabs.length > 0
      ? e(
          'div',
          { className: 'dsh-source-tabs-wrap' },
          e(
            'div',
            { className: 'dsh-source-tabs-label' },
            t('sessionSettings.sourceTabs.label'),
          ),
          e(
            'div',
            { className: 'dsh-source-tabs-nav', role: 'tablist' },
            sourceTabs.map((tab) =>
              e(
                'button',
                {
                  key: tab.key,
                  type: 'button',
                  role: 'tab',
                  'aria-selected': tab.active,
                  className: `dsh-source-tab-btn ${tab.active ? 'active' : ''}`,
                  onClick: tab.onClick,
                },
                tab.label,
              ),
            ),
          ),
        )
      : null,

    availableMcpServers.length === 0
      ? e(EmptyState, { message: t('sessionSettings.mcp.empty') })
      : e(
          'div',
          { className: 'dsh-session-mcp-box' },
          !isReadonly
            ? e(
                'div',
                { className: 'dsh-mcp-quick-bar' },
                e(
                  'button',
                  {
                    type: 'button',
                    className: `dsh-mcp-select-btn ${isAllMcpSelected ? 'active' : ''}`,
                    onClick: onToggleSelectAllMcp,
                  },
                  isAllMcpSelected
                    ? t('sessionSettings.mcp.deselectAll')
                    : t('sessionSettings.mcp.selectAll'),
                ),
              )
            : null,

          e(
            'div',
            { className: 'dsh-session-mcp-list' },
            availableMcpServers.map((server) => {
              const globalActive = (
                globalConfig?.mcp?.enabledServerIds ?? []
              ).includes(server.id)

              const isChecked =
                scope === 'global'
                  ? (mcpConfig?.enabledServerIds ?? []).includes(server.id)
                  : activeSourceMode === 'custom' || !sessionId
                    ? (mcpConfig?.enabledServerIds ?? []).includes(server.id)
                    : activeSourceMode === 'workspace' &&
                        workspaceSettings?.mcp?.mode === 'custom'
                      ? (workspaceSettings.mcp.enabledServerIds ?? []).includes(
                          server.id,
                        )
                      : globalActive

              const protoLabel =
                server.transport === 'stdio'
                  ? 'STDIO'
                  : server.detectedTransport === 'sse'
                    ? 'SSE'
                    : server.detectedTransport === 'streamable-http'
                      ? 'Streamable HTTP'
                      : 'HTTP / SSE'
              const protoClass =
                server.transport === 'stdio'
                  ? 'stdio'
                  : server.detectedTransport === 'sse'
                    ? 'sse'
                    : server.detectedTransport === 'streamable-http'
                      ? 'streamable-http'
                      : 'streamable-http'

              const isCustomTools =
                mcpConfig?.toolsMode?.[server.id] === 'custom'
              const customDisabledCount = (
                mcpConfig?.disabledTools?.[server.id] || []
              ).length

              const clientUnavailable =
                isChecked && isMcpClientUnavailable(server)
              const isRefreshingClient = refreshingClientId === server.id
              const clientResult = clientRefreshResults?.[server.id]
              const clientMessage =
                clientResult?.message || server.runtime?.lastError
              const handleRefreshClientClick = (evt: React.MouseEvent) => {
                evt.stopPropagation()
                if (isRefreshingClient) return
                onRefreshClient?.(server)
              }

              const badges: React.ReactNode[] = [
                clientUnavailable
                  ? e(
                      'button',
                      {
                        key: 'client-status',
                        type: 'button',
                        className: `dsh-session-mcp-client-status ${
                          isRefreshingClient ? 'refreshing' : 'error'
                        }`,
                        disabled: isRefreshingClient,
                        title:
                          clientMessage ||
                          t('sessionSettings.mcp.clientStatus.refreshHint'),
                        onClick: handleRefreshClientClick,
                      },
                      isRefreshingClient
                        ? e('span', {
                            className:
                              'dsh-spin dsh-session-mcp-client-spinner',
                          })
                        : null,
                      isRefreshingClient
                        ? t('sessionSettings.mcp.clientStatus.refreshing')
                        : t('sessionSettings.mcp.clientStatus.failed'),
                    )
                  : null,
                e(Badge, {
                  key: 'proto',
                  label: protoLabel,
                  variant: protoClass,
                }),
                server.serverInfo?.version
                  ? e(Badge, {
                      key: 'version',
                      label:
                        server.serverInfo.name &&
                        server.serverInfo.name !== server.id &&
                        server.serverInfo.name !== server.name
                          ? `${server.serverInfo.name} ${server.serverInfo.version}`
                          : server.serverInfo.version,
                      variant: 'server-version',
                      title: formatProtocolTitle(server.serverInfo, t),
                    })
                  : server.serverInfo?.protocolVersion
                    ? e(Badge, {
                        key: 'protocol-version',
                        label: `MCP ${server.serverInfo.protocolVersion}`,
                        variant: 'server-version',
                        title: formatProtocolTitle(server.serverInfo, t),
                      })
                    : null,
                isChecked
                  ? e(Badge, {
                      key: 'tools-status',
                      label: isCustomTools
                        ? customDisabledCount > 0
                          ? t('sessionSettings.mcp.toolsModeCustomBadge', {
                              count: customDisabledCount,
                            })
                          : t('sessionSettings.mcp.toolsAllActiveBadge')
                        : t('sessionSettings.mcp.toolsModeDefaultBadge'),
                      className: `dsh-session-tools-mode-badge ${
                        isCustomTools
                          ? customDisabledCount > 0
                            ? 'custom'
                            : 'all-active'
                          : 'default'
                      }`,
                    })
                  : null,
                server.toolCallTimeoutMs
                  ? e(Badge, {
                      key: 'timeout',
                      label: t('sessionSettings.field.timeoutSeconds', {
                        seconds: server.toolCallTimeoutMs / 1000,
                      }),
                      variant: 'timeout',
                    })
                  : null,
              ].filter(Boolean)

              const handleSwitchClick = (evt: React.MouseEvent) => {
                evt.stopPropagation()
                if (!isReadonly) {
                  onToggleMcpServer(server.id)
                }
              }

              return e(
                'div',
                {
                  key: server.id,
                  className: `dsh-session-mcp-card ${isChecked ? 'active' : ''} ${
                    isReadonly ? 'readonly' : ''
                  }`,
                },
                // Top Row
                e(
                  'div',
                  { className: 'dsh-session-mcp-header' },
                  e(
                    'div',
                    { className: 'dsh-session-mcp-identity' },
                    e(
                      'div',
                      { className: 'dsh-session-mcp-icon' },
                      e(ServerIcon, { server, size: 16 }),
                    ),
                    e(
                      'div',
                      { className: 'dsh-session-mcp-title-wrap' },
                      e(
                        'span',
                        { className: 'dsh-session-mcp-name' },
                        server.name,
                      ),
                      server.id && server.id !== server.name
                        ? e(
                            'span',
                            { className: 'dsh-session-mcp-id' },
                            server.id,
                          )
                        : null,
                    ),
                  ),
                  e(
                    'div',
                    { className: 'dsh-session-mcp-switch-wrap' },
                    !isReadonly
                      ? e(
                          'button',
                          {
                            type: 'button',
                            role: 'switch',
                            'aria-checked': isChecked,
                            className: `dsh-mcp-switch-btn ${
                              isChecked ? 'active' : ''
                            }`,
                            onClick: handleSwitchClick,
                          },
                          e('span', { className: 'dsh-mcp-switch-thumb' }),
                        )
                      : e(
                          'div',
                          {
                            className: `dsh-mcp-switch-btn ${
                              isChecked ? 'active' : ''
                            }`,
                            style: { opacity: 0.6, cursor: 'default' },
                          },
                          e('span', { className: 'dsh-mcp-switch-thumb' }),
                        ),
                  ),
                ),

                // Badges Row
                badges.length > 0
                  ? e(
                      'div',
                      { className: 'dsh-session-mcp-badges-row' },
                      badges,
                    )
                  : null,

                // Client failure detail
                clientUnavailable && clientMessage
                  ? e(
                      'p',
                      {
                        className: 'dsh-session-mcp-client-error',
                        title: clientMessage,
                      },
                      clientMessage,
                    )
                  : null,

                // Description
                server.description || server.serverInfo?.description
                  ? e(
                      'p',
                      { className: 'dsh-session-mcp-desc' },
                      server.description || server.serverInfo?.description,
                    )
                  : null,

                // Target Box
                e(
                  'div',
                  { className: 'dsh-session-mcp-target-box' },
                  e(
                    'code',
                    { className: 'dsh-session-mcp-target' },
                    server.transport === 'stdio'
                      ? `${server.command || ''} ${(server.args || []).join(' ')}`
                      : server.url || '',
                  ),
                ),

                // Footer Actions (Configure Tools)
                isChecked
                  ? e(
                      'div',
                      { className: 'dsh-session-mcp-footer' },
                      e(
                        'button',
                        {
                          type: 'button',
                          className: 'dsh-mcp-mini-btn dsh-session-tools-btn',
                          onClick: (evt: React.MouseEvent) => {
                            evt.stopPropagation()
                            onOpenSessionToolsModal(server, isReadonly)
                          },
                        },
                        e(IconChecklistOutlineMedium, { size: 14 }),
                        isReadonly
                          ? `${t('sessionSettings.mcp.toolsBtn')} (${t('sessionSettings.sourceTabs.readonlyViewOnly')})`
                          : t('sessionSettings.mcp.toolsBtn'),
                      ),
                    )
                  : null,
              )
            }),
          ),
        ),
  )
}
