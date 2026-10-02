/**
 * Pure presentation helpers for the resource and prompt panels.
 *
 * Kept free of React and of any non-platform import so the decisions here are
 * unit-checkable by a probe, mirroring `mcpRuntime.ts`. Nothing in this module
 * talks to the network or to a session: it turns already-fetched payloads into
 * the strings the panel shows and decides when a control must be disabled.
 */

import type {
  McpDiscoveredPrompt,
  McpDiscoveredResource,
  McpDiscoveredResourceTemplate,
  McpPromptBlock,
  McpPromptMessage,
  McpResourceContent,
  McpServerCapabilities,
} from '../../types.ts'

/**
 * Label for an entry whose text was truncated at the server's size cap.
 *
 * The server is authoritative about the cap; the client only reports it, so the
 * wording lives here and both panels share one phrasing.
 */
export const TRUNCATED_LABEL = '已截断'

/**
 * The primitive lists a discovery response carries.
 *
 * Read-only tabs need a normalized shape: every field of the wire contract is
 * optional, so a missing list must become an empty array rather than
 * `undefined` reaching component state.
 */
export interface McpPrimitiveLists {
  resources: McpDiscoveredResource[]
  resourceTemplates: McpDiscoveredResourceTemplate[]
  prompts: McpDiscoveredPrompt[]
  capabilities?: McpServerCapabilities
}

/**
 * Normalize one discovery response into the lists the panels render.
 *
 * The probe collects tools, resources, templates, and prompts over a SINGLE
 * connection, so any caller holding that response already has all four. Both
 * plugin halves fold through here so the two cannot disagree about the shape.
 *
 * @param data - a raw probe, `toolview`, or list response.
 * @returns the normalized lists, with absent fields as empty arrays.
 */
export function listsFromResponse(data: {
  resourceDetails?: McpDiscoveredResource[]
  resourceTemplateDetails?: McpDiscoveredResourceTemplate[]
  promptDetails?: McpDiscoveredPrompt[]
  capabilities?: McpServerCapabilities
}): McpPrimitiveLists {
  return {
    resources: Array.isArray(data.resourceDetails) ? data.resourceDetails : [],
    resourceTemplates: Array.isArray(data.resourceTemplateDetails)
      ? data.resourceTemplateDetails
      : [],
    prompts: Array.isArray(data.promptDetails) ? data.promptDetails : [],
    capabilities: data.capabilities,
  }
}

/**
 * Template variable names that still need a value.
 *
 * Mirrors the server's own validation so the read button is disabled before a
 * request that would be refused anyway. The server re-checks independently: this
 * is affordance, not enforcement, and the two must agree on `trim()` semantics
 * or the button would enable a read the server then rejects.
 *
 * @param variableNames - names the template declares (server-parsed).
 * @param values - current form values.
 * @returns names that are absent or whitespace-only, in template order.
 */
export function missingTemplateVariables(
  variableNames: readonly string[],
  values: Record<string, string>,
): string[] {
  return variableNames.filter((name) => {
    const value = values[name]
    return typeof value !== 'string' || value.trim().length === 0
  })
}

/** Human label for one resource, preferring the server's friendly name. */
export function resourceLabel(resource: {
  uri: string
  name?: string
  title?: string
}): string {
  return resource.title || resource.name || resource.uri
}

/**
 * Render a resource's contents as display text.
 *
 * Binary payloads arrive as a byte count rather than base64 (the server strips
 * them), so this reports the size instead of pretending to show content.
 *
 * @param contents - entries from a resource read.
 * @returns one labelled block per entry, joined by blank lines.
 */
export function renderResourceContents(
  contents: readonly McpResourceContent[],
): string {
  if (contents.length === 0) return ''
  return contents
    .map((entry) => {
      const header = [entry.uri, entry.mimeType].filter(Boolean).join('  ')
      const body =
        typeof entry.text === 'string'
          ? entry.text
          : typeof entry.blobBytes === 'number'
            ? `[二进制资源: ${entry.blobBytes} 字节 (base64)] 二进制内容不会传输到前端。`
            : '[无内容]'
      const suffix = entry.truncated ? `\n… (${TRUNCATED_LABEL})` : ''
      return `${header}\n${body}${suffix}`
    })
    .join('\n\n')
}

/**
 * Describe one prompt content block for display.
 *
 * Text passes through. Image, audio, and embedded-resource blocks were already
 * reduced to descriptions server-side, so this only supplies a fallback for a
 * block the server could not classify.
 */
export function describePromptBlock(block: McpPromptBlock): string {
  if (block.type === 'text') {
    const text = block.text ?? ''
    return block.truncated ? `${text}\n… (${TRUNCATED_LABEL})` : text
  }
  const base = block.description || `不支持的内容类型: ${block.type}`
  return block.mimeType ? `${base} (${block.mimeType})` : base
}

/**
 * Flatten prompt messages into one plain-text transcript.
 *
 * Role boundaries are preserved as labels because a prompt's meaning often
 * depends on which turn a block belongs to, and the copy button should not
 * silently merge an assistant instruction into user text.
 *
 * @param messages - role-tagged messages from a prompt fetch.
 * @returns the transcript, or an empty string when there is nothing to show.
 */
export function renderPromptMessages(
  messages: readonly McpPromptMessage[],
): string {
  if (messages.length === 0) return ''
  return messages
    .map((message) => {
      const label = message.role === 'assistant' ? 'assistant' : 'user'
      const body = message.blocks.map(describePromptBlock).join('\n')
      return `## ${label}\n${body}`
    })
    .join('\n\n')
}

/**
 * Whether a template can be acted on right now.
 *
 * @param template - the template row.
 * @param values - current form values for its variables.
 * @returns true when no variable is missing.
 */
export function isTemplateReady(
  template: McpDiscoveredResourceTemplate,
  values: Record<string, string>,
): boolean {
  return missingTemplateVariables(template.variableNames, values).length === 0
}
