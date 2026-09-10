import * as React from 'react'
import { IconChecklistOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  SessionMcpConfig,
  SessionMcpMode,
  SettingsMode,
  GlobalMcpServerConfig,
  SessionSettingsConfig,
} from '../../types/index.ts'
import {
  ModeSelector,
  EmptyState,
  Badge,
  ServerIcon,
} from '../../components/index.ts'
import { formatProtocolTitle } from '../../utils/string.ts'

const e = React.createElement

export interface SessionMcpSectionProps {
  sessionId?: string
  mcpConfig: SessionMcpConfig
  availableMcpServers: GlobalMcpServerConfig[]
  currentWorkspaceId?: string
  workspaceSettings?: SessionSettingsConfig
  globalConfig: SessionSettingsConfig
  onMcpModeChange: (mode: SessionMcpMode) => void
  onToggleMcpServer: (serverId: string) => void
  onToggleSelectAllMcp: () => void
  onOpenSessionToolsModal: (server: GlobalMcpServerConfig) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function SessionMcpSection({
  sessionId,
  mcpConfig,
  availableMcpServers,
  currentWorkspaceId,
  workspaceSettings,
  globalConfig,
  onMcpModeChange,
  onToggleMcpServer,
  onToggleSelectAllMcp,
  onOpenSessionToolsModal,
  t,
}: SessionMcpSectionProps) {
  const isAllMcpSelected =
    availableMcpServers.length > 0 &&
    availableMcpServers.every((s) =>
      (mcpConfig.enabledServerIds ?? []).includes(s.id),
    )

  const defaultMode = currentWorkspaceId ? 'workspace' : 'global'

  return e(
    'div',
    { className: 'dsh-view-content-inner' },
    // Section Header
    e(
      'div',
      { className: 'dsh-section-header' },
      e(
        'h3',
        { className: 'dsh-section-title' },
        t('sessionSettings.section.mcpTitle'),
      ),
      e(
        'p',
        { className: 'dsh-section-desc' },
        t('sessionSettings.section.mcpDesc'),
      ),
    ),

    // Mode Selector
    e(ModeSelector, {
      name: 'sessionMcpMode',
      value: mcpConfig.mode ?? defaultMode,
      onChange: (val) => onMcpModeChange(val as SettingsMode),
      options: [
        {
          value: 'workspace',
          visible: Boolean(currentWorkspaceId),
          title: t('sessionSettings.mcpMode.workspace.title'),
          badges: [
            workspaceSettings?.mcp?.mode === 'custom'
              ? {
                  label: t('sessionSettings.mcpMode.workspace.badgeCustom', {
                    count: (workspaceSettings?.mcp?.enabledServerIds || [])
                      .length,
                  }),
                  variant: 'custom',
                }
              : {
                  label: t('sessionSettings.mcpMode.workspace.badgeInherit'),
                  variant: 'inherit',
                },
          ],
          desc: t('sessionSettings.mcpMode.workspace.desc'),
        },
        {
          value: 'global',
          title: t('sessionSettings.mcpMode.default.title'),
          badges: [
            {
              label: t('sessionSettings.mcpMode.default.badge', {
                count: (globalConfig?.mcp?.enabledServerIds || []).length,
              }),
              variant: 'custom',
            },
          ],
          desc: t('sessionSettings.mcpMode.default.desc'),
        },
        {
          value: 'custom',
          title: t('sessionSettings.mcpMode.custom.title'),
          desc: t('sessionSettings.mcpMode.custom.desc'),
        },
      ],
    }),

    availableMcpServers.length === 0
      ? e(EmptyState, { message: t('sessionSettings.mcp.empty') })
      : e(
          'div',
          { className: 'dsh-session-mcp-box' },
          mcpConfig.mode === 'custom' || !sessionId
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
              const isGlobalCustom = Array.isArray(
                globalConfig?.mcp?.enabledServerIds,
              )
              const globalActive = isGlobalCustom
                ? (globalConfig.mcp.enabledServerIds ?? []).includes(server.id)
                : Boolean(server.enabledByDefault)

              const isChecked =
                mcpConfig.mode === 'custom' || !sessionId
                  ? (mcpConfig.enabledServerIds ?? []).includes(server.id)
                  : mcpConfig.mode === 'workspace' &&
                      workspaceSettings?.mcp?.mode === 'custom'
                    ? (workspaceSettings.mcp.enabledServerIds ?? []).includes(
                        server.id,
                      )
                    : globalActive

              const isReadonly = Boolean(
                sessionId && mcpConfig.mode !== 'custom',
              )
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
                mcpConfig.toolsMode?.[server.id] === 'custom'
              const customDisabledCount = (
                mcpConfig.disabledTools?.[server.id] || []
              ).length

              const badges: React.ReactNode[] = [
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
                            onOpenSessionToolsModal(server)
                          },
                        },
                        e(IconChecklistOutline14, { size: 14 }),
                        t('sessionSettings.mcp.toolsBtn'),
                      ),
                    )
                  : null,
              )
            }),
          ),
        ),
  )
}
