import * as React from 'react'
import type { GlobalMcpServerConfig } from '../../types/index.ts'
import { saveLocalMcpServers } from '../../storage/index.ts'

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
      const res = await fetch('/api/mcp-servers')
      if (res.ok) {
        const data = await res.json()
        if (data.ok && Array.isArray(data.servers)) {
          setServers(data.servers)
          saveLocalMcpServers(data.servers)
        }
      } else {
        setError(`Failed to load MCP servers: ${res.statusText}`)
      }
    } catch (err: any) {
      setError(err?.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadServers()
  }, [loadServers])

  // Delete server
  const handleDelete = async (server: GlobalMcpServerConfig) => {
    const confirmText = t('notices.deleteConfirm', {
      name: server.name || server.id,
    })
    if (!window.confirm(confirmText)) return

    try {
      const res = await fetch(
        `/api/mcp-servers?id=${encodeURIComponent(server.id)}`,
        {
          method: 'DELETE',
        },
      )
      if (res.ok) {
        const data = await res.json()
        if (data.ok) {
          setServers(data.servers || [])
          saveLocalMcpServers(data.servers || [])
          setSuccessMsg(t('notices.deleted'))
          setTimeout(() => setSuccessMsg(''), 3000)
        }
      }
    } catch (err: any) {
      setError(t('notices.error') + (err?.message || String(err)))
    }
  }

  // Test connection from card
  const handleTest = async (server: Partial<GlobalMcpServerConfig>) => {
    const id = server.id || 'form_test'
    setTestingId(id)
    try {
      const res = await fetch('/api/mcp-servers?action=test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', server }),
      })
      const data = await res.json()
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          ok: Boolean(data.ok),
          message: data.message || (data.ok ? 'Connection OK' : 'Failed'),
        },
      }))
      if (data.servers) {
        setServers(data.servers)
        saveLocalMcpServers(data.servers)
      } else if (data.ok && server.id) {
        setServers((prev) => {
          const next = prev.map((s) =>
            s.id === server.id
              ? {
                  ...s,
                  detectedTransport:
                    data.detectedTransport || s.detectedTransport,
                  serverInfo: data.serverInfo || s.serverInfo,
                  compatibility: data.compatibility || s.compatibility,
                  lastTestedAt: Date.now(),
                }
              : s,
          )
          saveLocalMcpServers(next)
          return next
        })
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { ok: false, message: err?.message || String(err) },
      }))
    } finally {
      setTestingId(null)
    }
  }

  // Toggle server enabled by default
  const handleToggleEnable = async (server: GlobalMcpServerConfig) => {
    const updated: GlobalMcpServerConfig = {
      ...server,
      enabledByDefault: !server.enabledByDefault,
    }
    try {
      const res = await fetch('/api/mcp-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server: updated }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setServers(data.servers || [])
        saveLocalMcpServers(data.servers || [])
      }
    } catch (err: any) {
      setError(t('notices.error') + (err?.message || String(err)))
    }
  }

  // Save server payload directly
  const executeSave = async (payload: GlobalMcpServerConfig) => {
    try {
      const res = await fetch('/api/mcp-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server: payload }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setServers(data.servers || [])
        saveLocalMcpServers(data.servers || [])
        setSuccessMsg(t('notices.saved'))
        setTimeout(() => setSuccessMsg(''), 3000)
        return { ok: true }
      } else {
        return { ok: false, error: data.error || 'Failed to save server' }
      }
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) }
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
    handleToggleEnable,
    executeSave,
  }
}
