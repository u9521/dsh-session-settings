import * as React from 'react'
import {
  IconCopyOutlineMedium,
  IconLoadingOutlineMedium,
  IconRefreshOutlineMedium,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  McpDiscoveredPrompt,
  McpServerCapabilities,
} from '../../types/index.ts'
import { EmptyState, SearchToolbar } from '../../components/index.ts'
import {
  describePromptBlock,
  renderPromptMessages,
} from '../../utils/mcpPrimitives.ts'
import type { PromptGetState } from '../hooks/useMcpPrimitives.ts'

const e = React.createElement

export interface McpPromptPanelProps {
  prompts: McpDiscoveredPrompt[]
  capabilities?: McpServerCapabilities
  loading: boolean
  error?: string
  loaded: boolean
  result: PromptGetState
  onRefresh: () => void
  onGet: (name: string, args?: Record<string, string>) => void
  onCopy: (text: string, key: string) => void
  copiedKey?: string
  t: (key: string, vars?: Record<string, string | number>) => string
}

/** One prompt row: argument inputs, a fetch action, and the rendered result. */
function PromptRow({
  prompt,
  result,
  onGet,
  onCopy,
  copiedKey,
  t,
}: {
  prompt: McpDiscoveredPrompt
  result: PromptGetState
  onGet: McpPromptPanelProps['onGet']
  onCopy: McpPromptPanelProps['onCopy']
  copiedKey?: string
  t: McpPromptPanelProps['t']
}) {
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [expanded, setExpanded] = React.useState(false)
  // The dual view mirrors the tools modal's 列表 / Raw JSON switch rather than
  // inventing a second idiom for the same "structured vs verbatim" choice.
  const [view, setView] = React.useState<'blocks' | 'raw'>('blocks')

  const args = prompt.arguments ?? []
  const copyKey = `prompt:${prompt.name}`
  // One shared result slot serves every row, so a row only renders state that
  // names it. Without this, fetching one prompt would show its text under all.
  const isThis = result.targetName === prompt.name
  const rowResult = isThis ? result : undefined
  const transcript = rowResult?.result?.messages
    ? renderPromptMessages(rowResult.result.messages)
    : ''

  return e(
    'div',
    { className: 'dsh-mcp-tool-card dsh-mcp-primitive-card' },
    e(
      'div',
      { className: 'dsh-mcp-tool-card-main' },
      e(
        'div',
        { className: 'dsh-mcp-tool-info' },
        e(
          'div',
          { className: 'dsh-mcp-tool-title-row' },
          e(
            'span',
            { className: 'dsh-mcp-tool-name' },
            prompt.title || prompt.name,
          ),
          prompt.title && prompt.title !== prompt.name
            ? e('span', { className: 'dsh-mcp-card-id' }, prompt.name)
            : null,
          args.length > 0
            ? e(
                'span',
                { className: 'dsh-mcp-proto-badge' },
                t('mcpServers.primitives.argCount', { count: args.length }),
              )
            : null,
        ),
        prompt.description
          ? e('div', { className: 'dsh-mcp-tool-desc' }, prompt.description)
          : null,
        args.length > 0
          ? e(
              'div',
              { className: 'dsh-mcp-primitive-vars' },
              args.map((arg) =>
                e(
                  'label',
                  { key: arg.name, className: 'dsh-mcp-primitive-var' },
                  e(
                    'span',
                    { className: 'dsh-mcp-primitive-var-name' },
                    arg.required ? `${arg.name} *` : arg.name,
                  ),
                  e('input', {
                    type: 'text',
                    // Same shared input appearance as the resource tab; the
                    // former `dsh-sam-input` class had no rules at all.
                    className: 'dsh-sam-select',
                    value: values[arg.name] ?? '',
                    // A prompt argument carries a real description from the
                    // server, so unlike a template variable it adds information
                    // the label does not already show.
                    placeholder: arg.description || arg.name,
                    title: arg.description,
                    onChange: (evt: React.ChangeEvent<HTMLInputElement>) => {
                      const next = evt.target.value
                      setValues((prev) => ({ ...prev, [arg.name]: next }))
                    },
                  }),
                ),
              ),
            )
          : null,
        expanded
          ? e(
              'div',
              { className: 'dsh-mcp-primitive-read-box' },
              rowResult?.loading
                ? e(
                    'div',
                    { className: 'dsh-sam-desc' },
                    t('mcpServers.primitives.gettingPrompt'),
                  )
                : rowResult?.error
                  ? e(
                      'div',
                      { className: 'dsh-sam-notice error' },
                      rowResult.error,
                    )
                  : rowResult?.result
                    ? e(
                        React.Fragment,
                        null,
                        e(
                          'div',
                          { className: 'dsh-mcp-tool-view-switch' },
                          e(
                            'button',
                            {
                              type: 'button',
                              className: `dsh-mcp-seg-btn ${view === 'blocks' ? 'active' : ''}`,
                              onClick: () => setView('blocks'),
                            },
                            t('mcpServers.primitives.viewBlocks'),
                          ),
                          e(
                            'button',
                            {
                              type: 'button',
                              className: `dsh-mcp-seg-btn ${view === 'raw' ? 'active' : ''}`,
                              onClick: () => setView('raw'),
                            },
                            t('mcpServers.toolsModal.viewRaw'),
                          ),
                        ),
                        rowResult.result.description
                          ? e(
                              'div',
                              { className: 'dsh-mcp-param-desc' },
                              rowResult.result.description,
                            )
                          : null,
                        view === 'raw'
                          ? e(
                              'pre',
                              { className: 'dsh-mcp-primitive-content' },
                              JSON.stringify(
                                rowResult.result.messages ?? [],
                                null,
                                2,
                              ),
                            )
                          : e(
                              'div',
                              { className: 'dsh-mcp-primitive-messages' },
                              (rowResult.result.messages ?? []).map(
                                (message, index) =>
                                  e(
                                    'div',
                                    {
                                      key: `${message.role}-${index}`,
                                      className: `dsh-mcp-primitive-message ${message.role}`,
                                    },
                                    e(
                                      'div',
                                      { className: 'dsh-mcp-primitive-role' },
                                      message.role,
                                    ),
                                    message.blocks.map((block, blockIndex) =>
                                      e(
                                        'div',
                                        {
                                          key: blockIndex,
                                          className: `dsh-mcp-primitive-block ${block.type}`,
                                        },
                                        block.type === 'text'
                                          ? e(
                                              'pre',
                                              {
                                                className:
                                                  'dsh-mcp-primitive-block-text',
                                              },
                                              describePromptBlock(block),
                                            )
                                          : e(
                                              'div',
                                              {
                                                className: 'dsh-mcp-param-desc',
                                              },
                                              describePromptBlock(block),
                                            ),
                                      ),
                                    ),
                                  ),
                              ),
                            ),
                      )
                    : null,
            )
          : null,
      ),
    ),
    e(
      'div',
      { className: 'dsh-mcp-primitive-actions' },
      rowResult?.result
        ? e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn secondary',
              title: t('mcpServers.primitives.copyFullText'),
              onClick: () => onCopy(transcript, copyKey),
            },
            e(IconCopyOutlineMedium, { size: 14 }),
            copiedKey === copyKey
              ? t('mcpServers.primitives.copied')
              : t('mcpServers.primitives.copyFullText'),
          )
        : null,
      // Once a result is on screen, the fetch action becomes a REPEAT action:
      // rendering both a "get" and a refresh button would be two controls doing
      // the identical call. So the slot holds exactly one of the two, and the
      // repeat one states what it does instead of being an icon alone.
      rowResult?.result
        ? e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn secondary',
              disabled: rowResult?.loading === true,
              onClick: () => {
                setExpanded(true)
                onGet(prompt.name, values)
              },
            },
            rowResult?.loading
              ? e(IconLoadingOutlineMedium, { size: 14, className: 'dsh-spin' })
              : e(IconRefreshOutlineMedium, { size: 14 }),
            t('mcpServers.primitives.refreshPrompt'),
          )
        : e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn primary',
              disabled: rowResult?.loading === true,
              onClick: () => {
                setExpanded(true)
                onGet(prompt.name, values)
              },
            },
            rowResult?.loading
              ? e(IconLoadingOutlineMedium, { size: 14, className: 'dsh-spin' })
              : null,
            t('mcpServers.primitives.getPromptBtn'),
          ),
    ),
  )
}

/**
 * The 提示词 tab: read-only prompt templates.
 *
 * The host ships no MCP prompt invocation mechanism — the official
 * `dsh-mcp-client` never calls `listPrompts`/`getPrompt` — so this panel
 * deliberately stops at rendering a template on demand. It cannot inject the
 * result into a session, and it does not try: that would be a new host-facing
 * capability, not a viewer.
 */
export function McpPromptPanel({
  prompts,
  capabilities,
  loading,
  error,
  loaded,
  result,
  onRefresh,
  onGet,
  onCopy,
  copiedKey,
  t,
}: McpPromptPanelProps) {
  const [search, setSearch] = React.useState('')

  const term = search.trim().toLowerCase()
  const filtered = prompts.filter(
    (prompt) =>
      !term ||
      prompt.name.toLowerCase().includes(term) ||
      (prompt.title ?? '').toLowerCase().includes(term) ||
      (prompt.description ?? '').toLowerCase().includes(term),
  )

  const declared = capabilities?.prompts === true

  const toolbar = e(SearchToolbar, {
    value: search,
    onChange: setSearch,
    placeholder: t('mcpServers.primitives.searchPromptPlaceholder'),
    className: 'dsh-mcp-tools-toolbar',
    actions: [
      e(
        'button',
        {
          key: 'refresh',
          type: 'button',
          className: 'dsh-sam-btn secondary',
          disabled: loading,
          onClick: onRefresh,
          title: t('mcpServers.actions.refresh'),
        },
        loading
          ? e(IconLoadingOutlineMedium, { size: 14, className: 'dsh-spin' })
          : e(IconRefreshOutlineMedium, { size: 14 }),
        loading
          ? t('mcpServers.actions.toolsFetching')
          : t('mcpServers.actions.refresh'),
      ),
    ],
  })

  if (loading) {
    return e(
      React.Fragment,
      null,
      toolbar,
      e(
        'div',
        {
          className: 'dsh-sam-desc',
          style: { padding: '32px 0', textAlign: 'center' },
        },
        t('mcpServers.actions.toolsFetching'),
      ),
    )
  }

  if (error) {
    return e(
      React.Fragment,
      null,
      toolbar,
      e('div', { className: 'dsh-sam-notice error' }, error),
    )
  }

  // Same distinction as resources: the SDK returns an empty list for an
  // unadvertised capability, so without the flag this would read as "none".
  if (!declared) {
    return e(
      React.Fragment,
      null,
      toolbar,
      e(EmptyState, {
        style: { padding: '24px 16px' },
        message: t('mcpServers.primitives.promptsUnsupported'),
        action: e(
          'button',
          {
            type: 'button',
            className: 'dsh-sam-btn secondary',
            onClick: onRefresh,
          },
          e(IconRefreshOutlineMedium, { size: 14 }),
          t('mcpServers.primitives.fetchBtn'),
        ),
      }),
    )
  }

  if (prompts.length === 0) {
    return e(
      React.Fragment,
      null,
      toolbar,
      e(EmptyState, {
        style: { padding: '24px 16px' },
        message: loaded
          ? t('mcpServers.primitives.promptsEmpty')
          : t('mcpServers.primitives.notFetched'),
        action: e(
          'button',
          {
            type: 'button',
            className: 'dsh-sam-btn secondary',
            onClick: onRefresh,
          },
          e(IconRefreshOutlineMedium, { size: 14 }),
          t('mcpServers.primitives.fetchBtn'),
        ),
      }),
    )
  }

  return e(
    React.Fragment,
    null,
    toolbar,
    filtered.length === 0
      ? e(
          'div',
          {
            className: 'dsh-sam-desc',
            style: { padding: '32px 0', textAlign: 'center' },
          },
          t('sessionSettings.skills.noMatch'),
        )
      : e(
          'div',
          { className: 'dsh-mcp-tools-list' },
          filtered.map((prompt) =>
            e(PromptRow, {
              key: prompt.name,
              prompt,
              result,
              onGet,
              onCopy,
              copiedKey,
              t,
            }),
          ),
        ),
  )
}
