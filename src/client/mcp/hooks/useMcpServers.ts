import * as React from 'react'
import { type GlobalMcpServerConfig, API_ENDPOINTS } from '../../types/index.ts'

export function useMcpServers(
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const [servers, setServers] = React.useState<GlobalMcpServerConfig[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string>('')
  const [successMsg, setSuccessMsg] = React.useState<string>('')

  // Test state
  const [testingId, setTestingId] = React.useState<string | null>(null)
  const [testResults, setTestResults] = React.useState<
    Record<string, { ok: boolean; message: string }>
  >({})

  const loadServers = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(API_ENDPOINTS.mcpServersList)
      if (res.ok) {
        const data = (await res.json()) as {
          ok?: boolean
          servers?: GlobalMcpServerConfig[]
        }
        if (data.ok && Array.isArray(data.servers)) {
          setServers(data.servers)
        }
      } else {
        setError(`Failed to load MCP servers: ${res.statusText}`)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadServers()
  }, [loadServers])

  // Delete server
  const handleDelete = async (server: GlobalMcpServerConfig) => {
    const confirmText = t('mcpServers.notices.deleteConfirm', {
      name: server.name || server.id,
    })
    if (!window.confirm(confirmText)) return

    try {
      const res = await fetch(API_ENDPOINTS.mcpServersRm, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: server.id }),
      })
      if (res.ok) {
        const data = (await res.json()) as { ok?: boolean }
        if (data.ok) {
          setServers((prev) => prev.filter((s) => s.id !== server.id))
          setSuccessMsg(t('mcpServers.notices.deleted'))
          setTimeout(() => setSuccessMsg(''), 3000)
        }
      }
    } catch (err: unknown) {
      setError(
        t('mcpServers.notices.error') +
          (err instanceof Error ? err.message : String(err)),
      )
    }
  }

  // Test connection from card
  const handleTest = async (server: Partial<GlobalMcpServerConfig>) => {
    const id = server.id || 'form_test'
    setTestingId(id)
    try {
      const res = await fetch(API_ENDPOINTS.mcpServersTest, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        message?: string
        detectedTransport?: 'stdio' | 'streamable-http' | 'sse'
        serverInfo?: GlobalMcpServerConfig['serverInfo']
        tools?: string[] | number
      }
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          ok: Boolean(data.ok),
          message: data.message || (data.ok ? 'Connection OK' : 'Failed'),
        },
      }))
      if (data.ok && server.id) {
        setServers((prev) =>
          prev.map((s) =>
            s.id === server.id
              ? {
                  ...s,
                  detectedTransport:
                    data.detectedTransport || s.detectedTransport,
                  serverInfo: data.serverInfo || s.serverInfo,
                  tools: Array.isArray(data.tools)
                    ? data.tools.length
                    : typeof data.tools === 'number'
                      ? data.tools
                      : s.tools,
                  lastTestedAt: Date.now(),
                }
              : s,
          ),
        )
      }
    } catch (err: unknown) {
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        },
      }))
    } finally {
      setTestingId(null)
    }
  }

  // Save server payload directly (supports rename via optional originalId)
  const executeSave = async (
    payload: GlobalMcpServerConfig,
    originalId?: string,
  ) => {
    try {
      const isEdit = Boolean(
        originalId || servers.some((s) => s.id === payload.id),
      )
      const endpoint = isEdit
        ? API_ENDPOINTS.mcpServersEdit
        : API_ENDPOINTS.mcpServersAdd

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server: payload, originalId }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        server?: GlobalMcpServerConfig
        error?: string
      }
      if (res.ok && data.ok && data.server) {
        const savedServer: GlobalMcpServerConfig = data.server
        const oldKey = originalId || savedServer.id
        setServers((prev) => {
          const exists = prev.some((s) => s.id === oldKey)
          if (exists) {
            return prev.map((s) => (s.id === oldKey ? savedServer : s))
          }
          return [...prev, savedServer]
        })
        setSuccessMsg(t('mcpServers.notices.saved'))
        setTimeout(() => setSuccessMsg(''), 3000)
        return { ok: true }
      } else {
        return { ok: false, error: data.error || 'Failed to save server' }
      }
    } catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  return {
    servers,
    setServers,
    loading,
    error,
    setError,
    successMsg,
    setSuccessMsg,
    loadServers,
    handleDelete,
    handleTest,
    testingId,
    testResults,
    executeSave,
  }
}
