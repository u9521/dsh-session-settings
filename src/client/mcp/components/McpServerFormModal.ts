import * as React from 'react'
import {
  IconPlayOutline16,
  IconChecklistOutline14,
  IconLoadingOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  GlobalMcpServerConfig,
  McpTransportType,
  EnvEntry,
} from '../../types/index.ts'
import { ModalDialog, KeyValueEditor } from '../../components/index.ts'

const e = React.createElement

export interface McpServerFormModalProps {
  open: boolean
  isEditing: boolean
  server: Partial<GlobalMcpServerConfig>
  onChange: (server: Partial<GlobalMcpServerConfig>) => void
  envEntries: EnvEntry[]
  onEnvChange: (entries: EnvEntry[]) => void
  headerEntries: EnvEntry[]
  onHeaderChange: (entries: EnvEntry[]) => void
  saving: boolean
  testing: boolean
  error?: string
  testResult?: { ok: boolean; message: string } | null
  showAdvanced: boolean
  onToggleAdvanced: () => void
  onTest: () => void
  onOpenTools: () => void
  onClose: () => void
  onSave: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function McpServerFormModal({
  open,
  isEditing,
  server,
  onChange,
  envEntries,
  onEnvChange,
  headerEntries,
  onHeaderChange,
  saving,
  testing,
  error,
  testResult,
  showAdvanced,
  onToggleAdvanced,
  onTest,
  onOpenTools,
  onClose,
  onSave,
  t,
}: McpServerFormModalProps) {
  if (!open) return null

  return e(
    ModalDialog,
    {
      open,
      onClose,
      title: isEditing ? t('form.editTitle') : t('form.addTitle'),
      panelClassName: 'dsh-mcp-form-modal',
      footer: [
        e(
          'div',
          { key: 'left', className: 'dsh-mcp-modal-footer-left' },
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn secondary',
              disabled: testing || saving,
              onClick: onTest,
              title: t('actions.test'),
            },
            testing
              ? e(IconLoadingOutline16, { size: 14, className: 'dsh-spin' })
              : e(IconPlayOutline16, { size: 14 }),
            testing ? t('actions.testing') : t('actions.test'),
          ),
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn secondary',
              disabled: testing || saving,
              onClick: onOpenTools,
              title: t('actions.toolsList'),
            },
            e(IconChecklistOutline14, { size: 14 }),
            t('actions.toolsList'),
            server.disabledTools && server.disabledTools.length > 0
              ? e(
                  'span',
                  { className: 'dsh-mcp-mini-badge danger' },
                  String(server.disabledTools.length),
                )
              : null,
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
              disabled: saving,
              onClick: onClose,
            },
            t('actions.cancel'),
          ),
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn primary',
              disabled: saving || testing,
              onClick: onSave,
            },
            saving ? t('actions.saving') : t('actions.save'),
          ),
        ),
      ],
    },
    // Banner / Notices
    error ||
      testResult ||
      server.compatibility?.status === 'incompatible-2026-07-28' ||
      server.compatibility?.status === 'downgrade-supported'
      ? e(
          'div',
          { className: 'dsh-sam-notices-block' },
          error ? e('div', { className: 'dsh-sam-notice error' }, error) : null,
          testResult
            ? e(
                'div',
                {
                  className: `dsh-sam-notice ${testResult.ok ? 'success' : 'error'}`,
                },
                testResult.message,
              )
            : null,
          server.compatibility?.canEnable === false ||
            server.compatibility?.status === 'incompatible-2026-07-28'
            ? e(
                'div',
                { className: 'dsh-sam-notice error' },
                `⚠️ ${t('compatibility.incompatibleBadge')}: ${server.compatibility?.warning || t('compatibility.incompatibleDesc')}`,
              )
            : server.compatibility?.status === 'downgrade-supported'
              ? e(
                  'div',
                  { className: 'dsh-sam-notice info' },
                  `ℹ️ ${t('compatibility.downgradedBadge', { version: server.compatibility.negotiatedVersion || '2025-11-25' })}: ${server.compatibility?.warning || t('compatibility.downgradedDesc')}`,
                )
              : null,
        )
      : null,

    // Form Content
    e(
      'div',
      { className: 'dsh-mcp-form-body' },
      // Top Switch: Enabled By Default
      e(
        'div',
        {
          className: `dsh-mcp-switch-card ${server.enabledByDefault ? 'active' : ''}`,
          role: 'button',
          tabIndex: 0,
          onClick: () =>
            onChange({
              ...server,
              enabledByDefault: !server.enabledByDefault,
            }),
          onKeyDown: (evt: React.KeyboardEvent) => {
            if (evt.key === ' ' || evt.key === 'Enter') {
              evt.preventDefault()
              onChange({
                ...server,
                enabledByDefault: !server.enabledByDefault,
              })
            }
          },
        },
        e(
          'div',
          { className: 'dsh-mcp-switch-text' },
          e(
            'div',
            { className: 'dsh-mcp-switch-title' },
            t('form.enabledByDefault'),
          ),
          e(
            'div',
            { className: 'dsh-mcp-switch-desc' },
            t('form.enabledByDefaultDesc'),
          ),
        ),
        e(
          'div',
          {
            className: `dsh-mcp-switch-btn ${server.enabledByDefault ? 'active' : ''}`,
            'aria-hidden': 'true',
          },
          e('span', { className: 'dsh-mcp-switch-thumb' }),
        ),
      ),

      // ID & Name Row
      e(
        'div',
        { className: 'dsh-mcp-form-row' },
        e(
          'div',
          { className: 'dsh-sam-field-group flex-1' },
          e('label', { className: 'dsh-sam-field-label' }, t('form.id')),
          e('input', {
            type: 'text',
            className: 'dsh-sam-select',
            placeholder: t('form.idPlaceholder'),
            disabled: isEditing,
            value: server.id || '',
            onChange: (evt: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ ...server, id: evt.target.value }),
          }),
        ),
        e(
          'div',
          { className: 'dsh-sam-field-group flex-1' },
          e('label', { className: 'dsh-sam-field-label' }, t('form.name')),
          e('input', {
            type: 'text',
            className: 'dsh-sam-select',
            placeholder: t('form.namePlaceholder'),
            value: server.name || '',
            onChange: (evt: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ ...server, name: evt.target.value }),
          }),
        ),
      ),

      // Description
      e(
        'div',
        { className: 'dsh-sam-field-group' },
        e('label', { className: 'dsh-sam-field-label' }, t('form.description')),
        e('input', {
          type: 'text',
          className: 'dsh-sam-select',
          placeholder: t('form.descriptionPlaceholder'),
          value: server.description || '',
          onChange: (evt: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ ...server, description: evt.target.value }),
        }),
      ),

      // Transport Selector
      e(
        'div',
        { className: 'dsh-sam-field-group' },
        e('label', { className: 'dsh-sam-field-label' }, t('form.transport')),
        e(
          'select',
          {
            className: 'dsh-sam-select',
            value: server.transport || 'stdio',
            onChange: (evt: React.ChangeEvent<HTMLSelectElement>) =>
              onChange({
                ...server,
                transport: evt.target.value as McpTransportType,
              }),
          },
          e('option', { value: 'stdio' }, t('form.transportStdio')),
          e(
            'option',
            { value: 'streamable-http-or-sse' },
            t('form.transportHttp'),
          ),
        ),
      ),

      // Transport specific fields
      server.transport === 'stdio'
        ? e(
            React.Fragment,
            null,
            // Command
            e(
              'div',
              { className: 'dsh-sam-field-group' },
              e(
                'label',
                { className: 'dsh-sam-field-label' },
                t('form.command'),
              ),
              e('input', {
                type: 'text',
                className: 'dsh-sam-select',
                placeholder: t('form.commandPlaceholder'),
                value: server.command || '',
                onChange: (evt: React.ChangeEvent<HTMLInputElement>) =>
                  onChange({ ...server, command: evt.target.value }),
              }),
            ),
            // Arguments
            e(
              'div',
              { className: 'dsh-sam-field-group' },
              e('label', { className: 'dsh-sam-field-label' }, t('form.args')),
              e('textarea', {
                className: 'dsh-mcp-textarea',
                placeholder: t('form.argsPlaceholder'),
                rows: 3,
                value: (server.args || []).join('\n'),
                onChange: (evt: React.ChangeEvent<HTMLTextAreaElement>) =>
                  onChange({
                    ...server,
                    args: evt.target.value
                      .split('\n')
                      .map((s: string) => s.trim())
                      .filter(Boolean),
                  }),
              }),
            ),
            // CWD
            e(
              'div',
              { className: 'dsh-sam-field-group' },
              e('label', { className: 'dsh-sam-field-label' }, t('form.cwd')),
              e('input', {
                type: 'text',
                className: 'dsh-sam-select',
                placeholder: t('form.cwdPlaceholder'),
                value: server.cwd || '',
                onChange: (evt: React.ChangeEvent<HTMLInputElement>) =>
                  onChange({ ...server, cwd: evt.target.value }),
              }),
            ),
            // ENV entries
            e(
              'div',
              { className: 'dsh-sam-field-group' },
              e('label', { className: 'dsh-sam-field-label' }, t('form.env')),
              e(KeyValueEditor, {
                entries: envEntries,
                onChange: onEnvChange,
                keyPlaceholder: t('form.envKey'),
                valuePlaceholder: t('form.envValue'),
                addLabel: t('form.addEnv'),
              }),
            ),
          )
        : e(
            React.Fragment,
            null,
            // URL
            e(
              'div',
              { className: 'dsh-sam-field-group' },
              e('label', { className: 'dsh-sam-field-label' }, t('form.url')),
              e('input', {
                type: 'text',
                className: 'dsh-sam-select',
                placeholder: t('form.urlPlaceholder'),
                value: server.url || '',
                onChange: (evt: React.ChangeEvent<HTMLInputElement>) =>
                  onChange({ ...server, url: evt.target.value }),
              }),
            ),
            // Headers
            e(
              'div',
              { className: 'dsh-sam-field-group' },
              e(
                'label',
                { className: 'dsh-sam-field-label' },
                t('form.headers'),
              ),
              e(KeyValueEditor, {
                entries: headerEntries,
                onChange: onHeaderChange,
                keyPlaceholder: t('form.headerKey'),
                valuePlaceholder: t('form.headerValue'),
                addLabel: t('form.addHeader'),
              }),
            ),
          ),

      // Advanced & Runtime Settings (Collapsible Box)
      e(
        'div',
        { className: 'dsh-mcp-advanced-box' },
        e(
          'div',
          {
            className: 'dsh-mcp-advanced-header',
            role: 'button',
            tabIndex: 0,
            onClick: onToggleAdvanced,
          },
          e(
            'div',
            { className: 'dsh-mcp-advanced-title-wrap' },
            e(
              'span',
              { className: 'dsh-mcp-advanced-title' },
              t('form.advancedTitle'),
            ),
            e(
              'span',
              { className: 'dsh-mcp-advanced-badge' },
              showAdvanced ? '收起' : '展开配置',
            ),
          ),
        ),

        showAdvanced
          ? e(
              'div',
              { className: 'dsh-mcp-advanced-content' },
              // 1. Tool Call Timeout (ms)
              e(
                'div',
                { className: 'dsh-sam-field-group' },
                e(
                  'label',
                  { className: 'dsh-sam-field-label' },
                  t('form.toolCallTimeoutMs'),
                ),
                e('input', {
                  type: 'number',
                  min: 1000,
                  step: 1000,
                  className: 'dsh-sam-select',
                  placeholder: t('form.toolCallTimeoutMsPlaceholder'),
                  value:
                    server.toolCallTimeoutMs !== undefined
                      ? server.toolCallTimeoutMs
                      : '',
                  onChange: (evt: React.ChangeEvent<HTMLInputElement>) =>
                    onChange({
                      ...server,
                      toolCallTimeoutMs: evt.target.value
                        ? parseInt(evt.target.value, 10)
                        : undefined,
                    }),
                }),
                e(
                  'span',
                  { className: 'dsh-mcp-field-hint' },
                  t('form.toolCallTimeoutMsDesc'),
                ),
              ),

              // 2. Fail on startup error Switch Card
              e(
                'div',
                {
                  className: `dsh-mcp-switch-card mini ${server.failOnStartupError ? 'active' : ''}`,
                  role: 'button',
                  tabIndex: 0,
                  onClick: () =>
                    onChange({
                      ...server,
                      failOnStartupError: !server.failOnStartupError,
                    }),
                },
                e(
                  'div',
                  { className: 'dsh-mcp-switch-text' },
                  e(
                    'div',
                    { className: 'dsh-mcp-switch-title' },
                    t('form.failOnStartupError'),
                  ),
                  e(
                    'div',
                    { className: 'dsh-mcp-switch-desc' },
                    t('form.failOnStartupErrorDesc'),
                  ),
                ),
                e(
                  'div',
                  {
                    className: `dsh-mcp-switch-btn ${server.failOnStartupError ? 'active' : ''}`,
                    'aria-hidden': 'true',
                  },
                  e('span', { className: 'dsh-mcp-switch-thumb' }),
                ),
              ),

              // 3. Reconnect Policy Group
              e(
                'div',
                {
                  className: `dsh-mcp-switch-card mini ${server.reconnect?.enabled !== false ? 'active' : ''}`,
                  role: 'button',
                  tabIndex: 0,
                  onClick: () =>
                    onChange({
                      ...server,
                      reconnect: {
                        ...server.reconnect,
                        enabled: server.reconnect?.enabled === false,
                      },
                    }),
                },
                e(
                  'div',
                  { className: 'dsh-mcp-switch-text' },
                  e(
                    'div',
                    { className: 'dsh-mcp-switch-title' },
                    t('form.reconnectEnabled'),
                  ),
                  e(
                    'div',
                    { className: 'dsh-mcp-switch-desc' },
                    t('form.reconnectEnabledDesc'),
                  ),
                ),
                e(
                  'div',
                  {
                    className: `dsh-mcp-switch-btn ${server.reconnect?.enabled !== false ? 'active' : ''}`,
                    'aria-hidden': 'true',
                  },
                  e('span', { className: 'dsh-mcp-switch-thumb' }),
                ),
              ),

              // 4. Reconnect detailed numbers (3-column grid)
              server.reconnect?.enabled !== false
                ? e(
                    'div',
                    { className: 'dsh-mcp-form-row-3' },
                    e(
                      'div',
                      { className: 'dsh-sam-field-group' },
                      e(
                        'label',
                        { className: 'dsh-sam-field-label' },
                        t('form.reconnectInitialDelayMs'),
                      ),
                      e('input', {
                        type: 'number',
                        min: 0,
                        step: 100,
                        className: 'dsh-sam-select',
                        placeholder: t(
                          'form.reconnectInitialDelayMsPlaceholder',
                        ),
                        value:
                          server.reconnect?.initialDelayMs !== undefined
                            ? server.reconnect.initialDelayMs
                            : '',
                        onChange: (evt: React.ChangeEvent<HTMLInputElement>) =>
                          onChange({
                            ...server,
                            reconnect: {
                              ...server.reconnect,
                              initialDelayMs: evt.target.value
                                ? parseInt(evt.target.value, 10)
                                : undefined,
                            },
                          }),
                      }),
                    ),
                    e(
                      'div',
                      { className: 'dsh-sam-field-group' },
                      e(
                        'label',
                        { className: 'dsh-sam-field-label' },
                        t('form.reconnectMaxDelayMs'),
                      ),
                      e('input', {
                        type: 'number',
                        min: 0,
                        step: 1000,
                        className: 'dsh-sam-select',
                        placeholder: t('form.reconnectMaxDelayMsPlaceholder'),
                        value:
                          server.reconnect?.maxDelayMs !== undefined
                            ? server.reconnect.maxDelayMs
                            : '',
                        onChange: (evt: React.ChangeEvent<HTMLInputElement>) =>
                          onChange({
                            ...server,
                            reconnect: {
                              ...server.reconnect,
                              maxDelayMs: evt.target.value
                                ? parseInt(evt.target.value, 10)
                                : undefined,
                            },
                          }),
                      }),
                    ),
                    e(
                      'div',
                      { className: 'dsh-sam-field-group' },
                      e(
                        'label',
                        { className: 'dsh-sam-field-label' },
                        t('form.reconnectMaxAttempts'),
                      ),
                      e('input', {
                        type: 'number',
                        min: 0,
                        step: 1,
                        className: 'dsh-sam-select',
                        placeholder: t('form.reconnectMaxAttemptsPlaceholder'),
                        value:
                          server.reconnect?.maxAttempts !== undefined
                            ? server.reconnect.maxAttempts
                            : '',
                        onChange: (evt: React.ChangeEvent<HTMLInputElement>) =>
                          onChange({
                            ...server,
                            reconnect: {
                              ...server.reconnect,
                              maxAttempts: evt.target.value
                                ? parseInt(evt.target.value, 10)
                                : undefined,
                            },
                          }),
                      }),
                    ),
                  )
                : null,
            )
          : null,
      ),
    ),
  )
}
