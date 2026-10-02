import * as React from 'react'
import {
  IconCopyOutlineMedium,
  IconLoadingOutlineMedium,
  IconRefreshOutlineMedium,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  McpDiscoveredResource,
  McpDiscoveredResourceTemplate,
  McpServerCapabilities,
} from '../../types/index.ts'
import { EmptyState, SearchToolbar } from '../../components/index.ts'
import {
  isTemplateReady,
  missingTemplateVariables,
  renderResourceContents,
  resourceLabel,
} from '../../utils/mcpPrimitives.ts'
import type { ResourceReadState } from '../hooks/useMcpPrimitives.ts'
import type { ResourceReadRequest } from '../hooks/useMcpPrimitives.ts'
import { resourceTargetKey } from '../hooks/useMcpPrimitives.ts'

const e = React.createElement

export interface McpResourcePanelProps {
  resources: McpDiscoveredResource[]
  resourceTemplates: McpDiscoveredResourceTemplate[]
  capabilities?: McpServerCapabilities
  loading: boolean
  error?: string
  loaded: boolean
  read: ResourceReadState
  onRefresh: () => void
  onRead: (args: ResourceReadRequest) => void
  onCopy: (text: string, key: string) => void
  copiedKey?: string
  t: (key: string, vars?: Record<string, string | number>) => string
}

/** One template row with its own variable form. */
function TemplateRow({
  template,
  read,
  onRead,
  onCopy,
  copiedKey,
  t,
}: {
  template: McpDiscoveredResourceTemplate
  read: ResourceReadState
  onRead: McpResourcePanelProps['onRead']
  onCopy: McpResourcePanelProps['onCopy']
  copiedKey?: string
  t: McpResourcePanelProps['t']
}) {
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [expanded, setExpanded] = React.useState(false)
  /**
   * Variables the user has left at least once.
   *
   * Every declared variable starts empty, so `missing` is non-empty on first
   * paint. Reporting that as an error would mark untouched fields as wrong
   * before the user has done anything, so the error style waits for a blur.
   */
  const [touched, setTouched] = React.useState<Record<string, boolean>>({})

  const missing = missingTemplateVariables(template.variableNames, values)
  const ready = isTemplateReady(template, values)
  const copyKey = `tplCopy:${template.uriTemplate}`
  // The row key MUST come from the same function the hook uses to tag the read
  // state; re-deriving the format here would drift silently if it ever changed.
  const rowKey = resourceTargetKey({ uriTemplate: template.uriTemplate })
  const isThis = read.targetKey === rowKey

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
          e('span', { className: 'dsh-mcp-tool-name' }, template.name),
          e(
            'span',
            { className: 'dsh-mcp-proto-badge streams' },
            t('mcpServers.primitives.templateBadge'),
          ),
          template.mimeType
            ? e('span', { className: 'dsh-mcp-proto-badge' }, template.mimeType)
            : null,
        ),
        template.description
          ? e('div', { className: 'dsh-mcp-tool-desc' }, template.description)
          : null,
        e('code', { className: 'dsh-mcp-primitive-uri' }, template.uriTemplate),
        // Variable form: one input per declared name. The server parses the
        // template, so these names are exactly the ones expansion will consume.
        e(
          'div',
          { className: 'dsh-mcp-primitive-vars' },
          template.variableNames.map((name) =>
            e(
              'label',
              { key: name, className: 'dsh-mcp-primitive-var' },
              e('span', { className: 'dsh-mcp-primitive-var-name' }, name),
              e('input', {
                type: 'text',
                // `dsh-sam-select` is this plugin's shared input appearance
                // (the form and key/value editor use it). The previous
                // `dsh-sam-input` never existed, so these fields rendered as
                // raw browser defaults.
                className: `dsh-sam-select ${
                  touched[name] && missing.includes(name) ? 'invalid' : ''
                }`,
                value: values[name] ?? '',
                // No placeholder: the wrapping <label> above already states the
                // name, so repeating it would read as a second, redundant field.
                // The label also supplies the accessible name.
                'aria-invalid':
                  touched[name] && missing.includes(name) ? true : undefined,
                onChange: (evt: React.ChangeEvent<HTMLInputElement>) => {
                  const next = evt.target.value
                  setValues((prev) => ({ ...prev, [name]: next }))
                },
                onBlur: () =>
                  setTouched((prev) =>
                    prev[name] ? prev : { ...prev, [name]: true },
                  ),
              }),
            ),
          ),
        ),
        expanded
          ? e(
              'div',
              { className: 'dsh-mcp-primitive-read-box' },
              isThis && read.loading
                ? e(
                    'div',
                    { className: 'dsh-sam-desc' },
                    t('mcpServers.primitives.reading'),
                  )
                : isThis && read.error
                  ? e('div', { className: 'dsh-sam-notice error' }, read.error)
                  : isThis && read.result
                    ? e(
                        'pre',
                        { className: 'dsh-mcp-primitive-content' },
                        renderResourceContents(read.result.contents ?? []),
                      )
                    : null,
            )
          : null,
      ),
    ),
    e(
      'div',
      { className: 'dsh-mcp-primitive-actions' },
      e(
        'button',
        {
          type: 'button',
          className: 'dsh-sam-btn secondary',
          title: t('mcpServers.primitives.copyTemplate'),
          onClick: () => onCopy(template.uriTemplate, copyKey),
        },
        e(IconCopyOutlineMedium, { size: 14 }),
        copiedKey === copyKey
          ? t('mcpServers.primitives.copied')
          : t('mcpServers.primitives.copy'),
      ),
      // Read and re-read are the same call against the same row, so only one of
      // them is rendered: the first read as the primary action, and afterwards a
      // labelled repeat action in its place.
      isThis && read.result
        ? e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn secondary',
              disabled: !ready || read.loading,
              title: ready
                ? t('mcpServers.primitives.refreshRead')
                : t('mcpServers.primitives.missingVars', {
                    names: missing.join(', '),
                  }),
              onClick: () =>
                onRead({
                  uriTemplate: template.uriTemplate,
                  variables: values,
                }),
            },
            read.loading
              ? e(IconLoadingOutlineMedium, { size: 14, className: 'dsh-spin' })
              : e(IconRefreshOutlineMedium, { size: 14 }),
            t('mcpServers.primitives.refreshRead'),
          )
        : e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn primary',
              disabled: !ready || read.loading,
              title: ready
                ? t('mcpServers.primitives.readBtn')
                : t('mcpServers.primitives.missingVars', {
                    names: missing.join(', '),
                  }),
              onClick: () => {
                setExpanded(true)
                onRead({ uriTemplate: template.uriTemplate, variables: values })
              },
            },
            isThis && read.loading
              ? e(IconLoadingOutlineMedium, { size: 14, className: 'dsh-spin' })
              : null,
            t('mcpServers.primitives.readBtn'),
          ),
    ),
  )
}

/** One concrete resource row. */
function ResourceRow({
  resource,
  read,
  onRead,
  onCopy,
  copiedKey,
  t,
}: {
  resource: McpDiscoveredResource
  read: ResourceReadState
  onRead: McpResourcePanelProps['onRead']
  onCopy: McpResourcePanelProps['onCopy']
  copiedKey?: string
  t: McpResourcePanelProps['t']
}) {
  const [expanded, setExpanded] = React.useState(false)
  const copyKey = `uriCopy:${resource.uri}`
  const rowKey = resourceTargetKey({ uri: resource.uri })
  const isThis = read.targetKey === rowKey

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
            resourceLabel(resource),
          ),
          resource.mimeType
            ? e('span', { className: 'dsh-mcp-proto-badge' }, resource.mimeType)
            : null,
          typeof resource.size === 'number'
            ? e(
                'span',
                { className: 'dsh-mcp-proto-badge' },
                `${resource.size} B`,
              )
            : null,
        ),
        resource.description
          ? e('div', { className: 'dsh-mcp-tool-desc' }, resource.description)
          : null,
        e('code', { className: 'dsh-mcp-primitive-uri' }, resource.uri),
        expanded
          ? e(
              'div',
              { className: 'dsh-mcp-primitive-read-box' },
              isThis && read.loading
                ? e(
                    'div',
                    { className: 'dsh-sam-desc' },
                    t('mcpServers.primitives.reading'),
                  )
                : isThis && read.error
                  ? e('div', { className: 'dsh-sam-notice error' }, read.error)
                  : isThis && read.result
                    ? e(
                        'pre',
                        { className: 'dsh-mcp-primitive-content' },
                        renderResourceContents(read.result.contents ?? []),
                      )
                    : null,
            )
          : null,
      ),
    ),
    e(
      'div',
      { className: 'dsh-mcp-primitive-actions' },
      e(
        'button',
        {
          type: 'button',
          className: 'dsh-sam-btn secondary',
          title: t('mcpServers.primitives.copyUri'),
          onClick: () => onCopy(resource.uri, copyKey),
        },
        e(IconCopyOutlineMedium, { size: 14 }),
        copiedKey === copyKey
          ? t('mcpServers.primitives.copied')
          : t('mcpServers.primitives.copy'),
      ),
      // Same single-slot rule as the template row: read first, then the repeat
      // action replaces it rather than sitting beside a duplicate.
      isThis && read.result
        ? e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn secondary',
              disabled: read.loading,
              onClick: () => onRead({ uri: resource.uri }),
            },
            read.loading
              ? e(IconLoadingOutlineMedium, { size: 14, className: 'dsh-spin' })
              : e(IconRefreshOutlineMedium, { size: 14 }),
            t('mcpServers.primitives.refreshRead'),
          )
        : e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn primary',
              disabled: read.loading,
              onClick: () => {
                setExpanded(true)
                onRead({ uri: resource.uri })
              },
            },
            isThis && read.loading
              ? e(IconLoadingOutlineMedium, { size: 14, className: 'dsh-spin' })
              : null,
            t('mcpServers.primitives.readBtn'),
          ),
    ),
  )
}

/**
 * The 资源 tab: literal resources and parameterized templates.
 *
 * Read-only by design. The three shared resource tools the model sees are owned
 * by `@deepseek-ai/dsh-mcp-resources` and gated per session by the scope policy;
 * this panel only inspects what a server exposes, and its reads never enter a
 * session or a model prompt.
 */
export function McpResourcePanel({
  resources,
  resourceTemplates,
  capabilities,
  loading,
  error,
  loaded,
  read,
  onRefresh,
  onRead,
  onCopy,
  copiedKey,
  t,
}: McpResourcePanelProps) {
  const [search, setSearch] = React.useState('')

  const term = search.trim().toLowerCase()
  const match = (haystack: Array<string | undefined>) =>
    !term ||
    haystack.some((value) => (value ?? '').toLowerCase().includes(term))

  const filteredResources = resources.filter((resource) =>
    match([resource.name, resource.title, resource.uri, resource.description]),
  )
  const filteredTemplates = resourceTemplates.filter((template) =>
    match([
      template.name,
      template.title,
      template.uriTemplate,
      template.description,
    ]),
  )

  const declared = capabilities?.resources === true
  const total = resources.length + resourceTemplates.length

  const toolbar = e(SearchToolbar, {
    value: search,
    onChange: setSearch,
    placeholder: t('mcpServers.primitives.searchPlaceholder'),
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

  // An unadvertised capability and an empty one are different facts; the SDK
  // reports both as an empty list, so the capability flag is what separates them.
  if (!declared) {
    return e(
      React.Fragment,
      null,
      toolbar,
      e(
        'div',
        null,
        e(EmptyState, {
          style: { padding: '24px 16px' },
          message: t('mcpServers.primitives.resourcesUnsupported'),
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
      ),
    )
  }

  if (total === 0) {
    return e(
      React.Fragment,
      null,
      toolbar,
      e(EmptyState, {
        style: { padding: '24px 16px' },
        message: loaded
          ? t('mcpServers.primitives.resourcesEmpty')
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

  const body: React.ReactNode[] = [toolbar]

  if (filteredResources.length > 0) {
    body.push(
      e(
        'div',
        { key: 'resources', className: 'dsh-mcp-primitive-group' },
        e(
          'div',
          { className: 'dsh-mcp-primitive-group-title' },
          t('mcpServers.primitives.resourcesTitle', {
            count: filteredResources.length,
          }),
        ),
        e(
          'div',
          { className: 'dsh-mcp-tools-list' },
          filteredResources.map((resource) =>
            e(ResourceRow, {
              key: resource.uri,
              resource,
              read,
              onRead,
              onCopy,
              copiedKey,
              t,
            }),
          ),
        ),
      ),
    )
  }

  if (filteredTemplates.length > 0) {
    body.push(
      e(
        'div',
        { key: 'templates', className: 'dsh-mcp-primitive-group' },
        e(
          'div',
          { className: 'dsh-mcp-primitive-group-title' },
          t('mcpServers.primitives.templatesTitle', {
            count: filteredTemplates.length,
          }),
        ),
        e(
          'div',
          { className: 'dsh-mcp-tools-list' },
          filteredTemplates.map((template) =>
            e(TemplateRow, {
              key: template.uriTemplate,
              template,
              read,
              onRead,
              onCopy,
              copiedKey,
              t,
            }),
          ),
        ),
      ),
    )
  }

  if (body.length === 1) {
    body.push(
      e(
        'div',
        {
          key: 'nomatch',
          className: 'dsh-sam-desc',
          style: { padding: '32px 0', textAlign: 'center' },
        },
        t('sessionSettings.skills.noMatch'),
      ),
    )
  }

  return e(React.Fragment, null, ...body)
}
