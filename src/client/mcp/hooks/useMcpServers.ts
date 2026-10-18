import * as React from 'react'
import {
  type GlobalMcpServerConfig,
  API_ENDPOINTS,
  API_METHODS,
} from '../../types/index.ts'
import { probeServer, serverPatch } from '../discovery.ts'

export function useMcpServers(
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const [servers, setServers] = React.useState<GlobalMcpServerConfig[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string>('')
  const [successMsg, setSuccessMsg] = React.useState<string>('')

  // One owner for the expiring success notice: every handler just sets the text
  // and this effect arms the clear. Previously each handler carried its own
  // setTimeout, so a handler that forgot one left the banner up forever.
  React.useEffect(() => {
    if (!successMsg) return
    const timer = setTimeout(() => setSuccessMsg(''), 3000)
    return () => clearTimeout(timer)
  }, [successMsg])

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
        method: API_METHODS.mcpServersRm,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: server.id }),
      })
      if (res.ok) {
        const data = (await res.json()) as { ok?: boolean }
        if (data.ok) {
          setServers((prev) => prev.filter((s) => s.id !== server.id))
          setSuccessMsg(t('mcpServers.notices.deleted'))
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
      const probe = await probeServer(server)
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          ok: probe.ok,
          message: probe.message || (probe.ok ? 'Connection OK' : 'Failed'),
        },
      }))
      if (probe.ok && server.id && probe.discovery) {
        const patch = serverPatch(probe.discovery)
        setServers((prev) =>
          prev.map((s) => (s.id === server.id ? { ...s, ...patch } : s)),
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
        method: isEdit ? API_METHODS.mcpServersEdit : API_METHODS.mcpServersAdd,
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
