/**
 * On-demand resource reads and prompt fetches for the management panel.
 *
 * Both operations open their own short-lived connection, run one call, and
 * close. They are GUI actions, not model-visible capabilities: nothing here is
 * registered on `ctx.tools` or `ctx.mcpResources`, and nothing enters a session.
 * The model-facing resource tools belong to `@deepseek-ai/dsh-mcp-resources` and
 * are governed separately by the scope policy.
 */

import { UriTemplate } from '@modelcontextprotocol/client'
import type {
  GlobalMcpServerConfig,
  McpPromptBlock,
  McpPromptGetRequest,
  McpPromptGetResult,
  McpPromptMessage,
  McpResourceContent,
  McpResourceReadRequest,
  McpResourceReadResult,
} from '../../../types.ts'
import { connectMcpServer } from './connect.ts'
import type { McpSession } from './connect.ts'

/**
 * Per-entry text ceiling, in characters.
 *
 * A resource is arbitrary server-authored content; a large one would otherwise
 * be serialized into an HTTP response and held in browser state. 256 KiB is far
 * beyond any read a human does in a preview pane while still bounding the
 * response. Truncation is reported per entry AND on the result, so the UI can
 * say so instead of silently showing a prefix.
 */
const MAX_TEXT_CHARS = 256 * 1024

/** Truncate one string to the cap, reporting whether it was cut. */
function capText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_TEXT_CHARS) return { text, truncated: false }
  return { text: text.slice(0, MAX_TEXT_CHARS), truncated: true }
}

/** Resolved connection, or a failure result carrying the reason. */
type SessionOrError =
  { ok: true; session: McpSession } | { ok: false; message: string }

/** Open a short-lived connection for one read, with read-flavoured diagnostics. */
async function openForRead(
  server: Partial<GlobalMcpServerConfig>,
): Promise<SessionOrError> {
  const connected = await connectMcpServer(server, { failureLabel: '连接失败' })
  if (!connected.ok) return { ok: false, message: connected.message }
  return { ok: true, session: connected.session }
}

/**
 * Resolve the addressing mode of one read into a concrete URI.
 *
 * Template form is expanded HERE rather than in the client for two reasons: the
 * client half may not value-import `@modelcontextprotocol/client`, and
 * `UriTemplate.expand` silently drops variables it has no value for —
 * `db://{table}/{id}` with nothing filled yields the well-formed but wrong
 * `"db:///"`. So every variable the template names is required to be present
 * and non-blank BEFORE expanding, and a missing one fails the read with the
 * exact names listed.
 */
function resolveUri(
  request: McpResourceReadRequest,
): { ok: true; uri: string } | { ok: false; message: string } {
  const literal = request.uri?.trim()
  if (literal) return { ok: true, uri: literal }

  const template = request.uriTemplate?.trim()
  if (!template) {
    return {
      ok: false,
      message: '需要提供资源 URI 或资源模板 (uri / uriTemplate)',
    }
  }

  let parsed: UriTemplate
  try {
    parsed = new UriTemplate(template)
  } catch (err: unknown) {
    return {
      ok: false,
      message: `资源模板格式不正确: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const provided = request.variables ?? {}
  const missing = parsed.variableNames.filter((name) => {
    const value = provided[name]
    return typeof value !== 'string' || value.trim().length === 0
  })
  if (missing.length > 0) {
    return {
      ok: false,
      message: `资源模板缺少变量值: ${missing.join(', ')}`,
    }
  }

  // Only the template's own variables are forwarded, so an extra form field
  // cannot smuggle a value the template never declared.
  const scoped: Record<string, string> = {}
  for (const name of parsed.variableNames)
    scoped[name] = provided[name] as string
  return { ok: true, uri: parsed.expand(scoped) }
}

/**
 * Read one resource by literal URI or by expanded template.
 *
 * @param request - addressing form plus the server to reach.
 * @returns the resource contents, or a failure with a human-readable reason.
 */
export async function readResource(
  request: McpResourceReadRequest,
): Promise<McpResourceReadResult> {
  const resolved = resolveUri(request)
  if (!resolved.ok) return { ok: false, message: resolved.message }

  const opened = await openForRead(request.server)
  if (!opened.ok) return { ok: false, message: opened.message }

  try {
    const timeoutMs =
      typeof request.server.toolCallTimeoutMs === 'number' &&
      request.server.toolCallTimeoutMs > 0
        ? Math.max(request.server.toolCallTimeoutMs, 3000)
        : 30000

    const result = await opened.session.client.readResource(
      { uri: resolved.uri },
      { timeout: timeoutMs, signal: AbortSignal.timeout(timeoutMs) },
    )

    const rawContents = Array.isArray(result?.contents) ? result.contents : []
    const contents: McpResourceContent[] = rawContents.map((entry) => {
      const item = (entry ?? {}) as Record<string, unknown>
      const uri = typeof item.uri === 'string' ? item.uri : resolved.uri
      const mimeType =
        typeof item.mimeType === 'string' ? item.mimeType : undefined

      // Binary payloads report their size only. The base64 never crosses the
      // wire: the panel cannot render it and storing it would be pure cost.
      if (typeof item.blob === 'string') {
        return { uri, mimeType, blobBytes: item.blob.length }
      }
      if (typeof item.text === 'string') {
        const capped = capText(item.text)
        return {
          uri,
          mimeType,
          text: capped.text,
          truncated: capped.truncated || undefined,
        }
      }
      return { uri, mimeType }
    })

    const truncated = contents.some((entry) => entry.truncated === true)
    return {
      ok: true,
      uri: resolved.uri,
      contents,
      message: truncated
        ? `已读取资源（内容超过 ${Math.round(MAX_TEXT_CHARS / 1024)} KiB，已截断）`
        : '已读取资源',
    }
  } catch (err: unknown) {
    return {
      ok: false,
      message: `读取资源失败: ${err instanceof Error ? err.message : String(err)}${opened.session.diagnostics()}`,
    }
  } finally {
    await opened.session.close()
  }
}

/**
 * Reduce one prompt content block to what the panel can show.
 *
 * Text is preserved verbatim. Images and audio become a MIME-typed description,
 * and embedded resources become their URI: this panel never feeds a session, so
 * forwarding payload bytes to the browser would buy nothing.
 */
function mapPromptBlock(block: unknown): McpPromptBlock {
  const item = (block ?? {}) as Record<string, unknown>
  const type = typeof item.type === 'string' ? item.type : 'unknown'
  const mimeType = typeof item.mimeType === 'string' ? item.mimeType : undefined

  if (type === 'text') {
    const capped = capText(typeof item.text === 'string' ? item.text : '')
    return {
      type: 'text',
      text: capped.text,
      mimeType,
      truncated: capped.truncated || undefined,
    }
  }
  if (type === 'image') {
    return {
      type: 'image',
      mimeType,
      description: '图片内容（未传输二进制数据）',
    }
  }
  if (type === 'audio') {
    return {
      type: 'audio',
      mimeType,
      description: '音频内容（未传输二进制数据）',
    }
  }
  if (type === 'resource' || type === 'resource_link') {
    const resource = (item.resource ?? item) as Record<string, unknown>
    const uri = typeof resource.uri === 'string' ? resource.uri : undefined
    return {
      type: 'resource',
      mimeType,
      description: uri ? `嵌入资源: ${uri}` : '嵌入资源',
    }
  }
  return { type: 'unknown', mimeType, description: `不支持的内容类型: ${type}` }
}

/**
 * Project one prompt message, preserving its role and content block.
 *
 * `PromptMessage.content` is a SINGLE content block in the spec, not a list: a
 * prompt that wants several blocks emits several messages. The SDK validates
 * this, so a non-conformant server is rejected before reaching here and an
 * array branch would be unreachable.
 */
function mapPromptMessage(message: unknown): McpPromptMessage {
  const item = (message ?? {}) as Record<string, unknown>
  const role = item.role === 'assistant' ? 'assistant' : 'user'
  return { role, blocks: [mapPromptBlock(item.content)] }
}

/**
 * Render one prompt template by name with the caller's argument values.
 *
 * @param request - prompt name, argument values, and the server to reach.
 * @returns role-tagged messages, or a failure with a human-readable reason.
 */
export async function getPrompt(
  request: McpPromptGetRequest,
): Promise<McpPromptGetResult> {
  const name = request.name?.trim()
  if (!name) return { ok: false, message: '需要提供提示词名称 (name)' }

  const opened = await openForRead(request.server)
  if (!opened.ok) return { ok: false, message: opened.message }

  try {
    const timeoutMs =
      typeof request.server.toolCallTimeoutMs === 'number' &&
      request.server.toolCallTimeoutMs > 0
        ? Math.max(request.server.toolCallTimeoutMs, 3000)
        : 30000

    const args = request.arguments ?? {}
    const result = await opened.session.client.getPrompt(
      { name, ...(Object.keys(args).length > 0 ? { arguments: args } : {}) },
      { timeout: timeoutMs, signal: AbortSignal.timeout(timeoutMs) },
    )

    const rawMessages = Array.isArray(result?.messages) ? result.messages : []
    const messages = rawMessages.map(mapPromptMessage)
    const truncated = messages.some((message) =>
      message.blocks.some((block) => block.truncated === true),
    )

    return {
      ok: true,
      description:
        typeof result?.description === 'string'
          ? result.description
          : undefined,
      messages,
      message: truncated
        ? `已获取提示词（内容超过 ${Math.round(MAX_TEXT_CHARS / 1024)} KiB，已截断）`
        : '已获取提示词',
    }
  } catch (err: unknown) {
    return {
      ok: false,
      message: `获取提示词失败: ${err instanceof Error ? err.message : String(err)}${opened.session.diagnostics()}`,
    }
  } finally {
    await opened.session.close()
  }
}
