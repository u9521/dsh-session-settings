import * as React from 'react'
import {
  IconPlusOutline16,
  IconRefreshOutline16,
  IconLoadingOutline16,
  IconDownloadOutline16,
  IconCodeOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  McpSettingsProps,
  GlobalMcpServerConfig,
  McpDiscoveredTool,
  McpServerInfo,
  EnvEntry,
} from '../types/index.ts'
import { saveLocalMcpServers } from '../storage/index.ts'
import { EmptyState } from '../components/index.ts'
import { useMcpServers } from './hooks/useMcpServers.ts'
import { McpServerCard } from './components/McpServerCard.ts'
import { McpServerFormModal } from './components/McpServerFormModal.ts'
import { McpToolsModal } from './components/McpToolsModal.ts'
import { McpImportExportModal } from './components/McpImportExportModal.ts'
import { McpSaveConfirmModal } from './components/McpSaveConfirmModal.ts'

const e = React.createElement

export function McpServersSettingsTab({
  api: _api,
  t,
  close: _close,
}: McpSettingsProps) {
  const {
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
  } = useMcpServers(t)

  // Form modal state
  const [formOpen, setFormOpen] = React.useState<boolean>(false)
  const [isEditing, setIsEditing] = React.useState<boolean>(false)
  const [formServer, setFormServer] = React.useState<
    Partial<GlobalMcpServerConfig>
  >({
    transport: 'stdio',
    enabledByDefault: false,
  })
  const [envEntries, setEnvEntries] = React.useState<EnvEntry[]>([])
  const [headerEntries, setHeaderEntries] = React.useState<EnvEntry[]>([])
  const [formSaving, setFormSaving] = React.useState<boolean>(false)
  const [formTesting, setFormTesting] = React.useState<boolean>(false)
  const [formError, setFormError] = React.useState<string>('')
  const [showAdvanced, setShowAdvanced] = React.useState<boolean>(false)
  const [formTestResult, setFormTestResult] = React.useState<{
    ok: boolean
    message: string
  } | null>(null)

  // Save confirmation modal state (for pre-save test failures)
  const [saveConfirm, setSaveConfirm] = React.useState<{
    open: boolean
    message: string
    payload: GlobalMcpServerConfig
  } | null>(null)

  // Import modal state
  const [importOpen, setImportOpen] = React.useState<boolean>(false)
  const [importText, setImportText] = React.useState<string>('')
  const [importing, setImporting] = React.useState<boolean>(false)
  const [importError, setImportError] = React.useState<string>('')

  // Tools modal state
  const [toolsModalOpen, setToolsModalOpen] = React.useState<boolean>(false)
  const [toolsTargetServer, setToolsTargetServer] =
    React.useState<Partial<GlobalMcpServerConfig> | null>(null)
  const [toolsSource, setToolsSource] = React.useState<'card' | 'form'>('card')
  const [toolsLoading, setToolsLoading] = React.useState<boolean>(false)
  const [toolsError, setToolsError] = React.useState<string>('')
  const [toolsList, setToolsList] = React.useState<McpDiscoveredTool[]>([])
  const [toolsDisabledSet, setToolsDisabledSet] = React.useState<Set<string>>(
    new Set(),
  )
  const [toolsServerInfo, setToolsServerInfo] =
    React.useState<McpServerInfo | null>(null)
  const [toolsDetectedTransport, setToolsDetectedTransport] = React.useState<
    string | null
  >(null)
  const [toolsSaving, setToolsSaving] = React.useState<boolean>(false)

  // Open add form
  const handleOpenAdd = () => {
    setIsEditing(false)
    setShowAdvanced(false)
    setFormServer({
      id: '',
      name: '',
      description: '',
      transport: 'stdio',
      command: '',
      args: [],
      cwd: '',
      url: '',
      enabledByDefault: false,
      toolCallTimeoutMs: undefined,
      failOnStartupError: false,
      reconnect: {
        enabled: true,
        initialDelayMs: undefined,
        maxDelayMs: undefined,
        maxAttempts: undefined,
      },
      disabledTools: [],
    })
    setEnvEntries([])
    setHeaderEntries([])
    setFormError('')
    setFormTestResult(null)
    setFormOpen(true)
  }

  // Open edit form
  const handleOpenEdit = (server: GlobalMcpServerConfig) => {
    setIsEditing(true)
    setShowAdvanced(
      Boolean(
        server.toolCallTimeoutMs ||
        server.failOnStartupError ||
        (server.reconnect &&
          (server.reconnect.enabled === false ||
            server.reconnect.initialDelayMs !== undefined ||
            server.reconnect.maxDelayMs !== undefined ||
            server.reconnect.maxAttempts !== undefined)),
      ),
    )
    setFormServer({
      ...server,
      reconnect: {
        enabled: server.reconnect?.enabled !== false,
        initialDelayMs: server.reconnect?.initialDelayMs,
        maxDelayMs: server.reconnect?.maxDelayMs,
        maxAttempts: server.reconnect?.maxAttempts,
      },
      disabledTools: server.disabledTools ? [...server.disabledTools] : [],
    })
    setEnvEntries(
      server.env
        ? Object.entries(server.env).map(([key, value]) => ({ key, value }))
        : [],
    )
    setHeaderEntries(
      server.headers
        ? Object.entries(server.headers).map(([key, value]) => ({ key, value }))
        : [],
    )
    setFormError('')
    setFormTestResult(null)
    setFormOpen(true)
  }

  // Test connection from inside add/edit modal
  const handleFormTest = async () => {
    setFormError('')
    setFormTestResult(null)
    if (formServer.transport === 'stdio' && !formServer.command?.trim()) {
      setFormError(t('form.command') + ' is required for stdio')
      return
    }
    if (formServer.transport !== 'stdio' && !formServer.url?.trim()) {
      setFormError(t('form.url') + ' is required for HTTP/SSE')
      return
    }

    const envMap: Record<string, string> = {}
    for (const item of envEntries) {
      if (item.key.trim()) envMap[item.key.trim()] = item.value
    }
    const headerMap: Record<string, string> = {}
    for (const item of headerEntries) {
      if (item.key.trim()) headerMap[item.key.trim()] = item.value
    }

    const serverObj: Partial<GlobalMcpServerConfig> = {
      id: formServer.id?.trim() || 'modal_test',
      transport: formServer.transport,
      command: formServer.command?.trim(),
      args: formServer.args || [],
      cwd: formServer.cwd?.trim() || undefined,
      env: Object.keys(envMap).length > 0 ? envMap : undefined,
      url: formServer.url?.trim(),
      headers: Object.keys(headerMap).length > 0 ? headerMap : undefined,
      toolCallTimeoutMs:
        formServer.toolCallTimeoutMs && formServer.toolCallTimeoutMs > 0
          ? Number(formServer.toolCallTimeoutMs)
          : undefined,
      failOnStartupError: Boolean(formServer.failOnStartupError),
      reconnect: formServer.reconnect,
    }

    setFormTesting(true)
    try {
      const res = await fetch('/api/mcp-servers?action=test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', server: serverObj }),
      })
      const data = await res.json()
      setFormTestResult({
        ok: Boolean(data.ok),
        message: data.message || (data.ok ? 'Connection OK' : 'Failed'),
      })
      if (data.ok) {
        setFormServer((prev) => ({
          ...prev,
          detectedTransport: data.detectedTransport || prev.detectedTransport,
          serverInfo: data.serverInfo || prev.serverInfo,
          compatibility: data.compatibility || prev.compatibility,
          lastTestedAt: Date.now(),
        }))
      }
    } catch (err: any) {
      setFormTestResult({
        ok: false,
        message: err?.message || String(err),
      })
    } finally {
      setFormTesting(false)
    }
  }

  // Fetch tools from MCP server for tools modal
  const fetchToolsForServer = async (
    server: Partial<GlobalMcpServerConfig>,
  ) => {
    setToolsLoading(true)
    setToolsError('')
    try {
      const res = await fetch('/api/mcp-servers?action=tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tools', server }),
      })
      const data = await res.json()
      if (data.ok) {
        if (data.serverInfo) {
          setToolsServerInfo(data.serverInfo)
        }
        if (data.detectedTransport) {
          setToolsDetectedTransport(data.detectedTransport)
        }
        if (data.servers) {
          setServers(data.servers)
          saveLocalMcpServers(data.servers)
        } else if (server.id) {
          setServers((prev) => {
            const next = prev.map((s) =>
              s.id === server.id
                ? {
                    ...s,
                    detectedTransport:
                      data.detectedTransport || s.detectedTransport,
                    serverInfo: data.serverInfo || s.serverInfo,
                    lastTestedAt: Date.now(),
                  }
                : s,
            )
            saveLocalMcpServers(next)
            return next
          })
        }
        if (Array.isArray(data.toolDetails)) {
          setToolsList(data.toolDetails)
        } else if (Array.isArray(data.tools)) {
          setToolsList(
            data.tools.map((t: any) =>
              typeof t === 'string' ? { name: t } : t,
            ),
          )
        }
      } else {
        setToolsError(data.message || 'Failed to fetch tools from MCP server')
      }
    } catch (err: any) {
      setToolsError(err?.message || String(err))
    } finally {
      setToolsLoading(false)
    }
  }

  // Open Tools modal from card or form
  const handleOpenTools = (
    server: Partial<GlobalMcpServerConfig>,
    source: 'card' | 'form' = 'card',
  ) => {
    setToolsTargetServer(server)
    setToolsSource(source)
    setToolsDisabledSet(new Set(server.disabledTools || []))
    setToolsList([])
    setToolsServerInfo(null)
    setToolsDetectedTransport(null)
    setToolsModalOpen(true)
    fetchToolsForServer(server)
  }

  const handleFormOpenTools = () => {
    if (formServer.transport === 'stdio' && !formServer.command?.trim()) {
      setFormError(t('form.command') + ' is required for stdio')
      return
    }
    if (formServer.transport !== 'stdio' && !formServer.url?.trim()) {
      setFormError(t('form.url') + ' is required for HTTP/SSE')
      return
    }

    const envMap: Record<string, string> = {}
    for (const item of envEntries) {
      if (item.key.trim()) envMap[item.key.trim()] = item.value
    }
    const headerMap: Record<string, string> = {}
    for (const item of headerEntries) {
      if (item.key.trim()) headerMap[item.key.trim()] = item.value
    }

    const serverObj: Partial<GlobalMcpServerConfig> = {
      id: formServer.id?.trim() || 'modal_tools',
      name: formServer.name?.trim() || 'MCP Server',
      description: formServer.description?.trim(),
      transport: formServer.transport,
      command: formServer.command?.trim(),
      args: formServer.args || [],
      cwd: formServer.cwd?.trim() || undefined,
      env: Object.keys(envMap).length > 0 ? envMap : undefined,
      url: formServer.url?.trim(),
      headers: Object.keys(headerMap).length > 0 ? headerMap : undefined,
      toolCallTimeoutMs:
        formServer.toolCallTimeoutMs && formServer.toolCallTimeoutMs > 0
          ? Number(formServer.toolCallTimeoutMs)
          : undefined,
      failOnStartupError: Boolean(formServer.failOnStartupError),
      reconnect: formServer.reconnect,
      disabledTools: formServer.disabledTools || [],
    }

    handleOpenTools(serverObj, 'form')
  }

  const handleToggleTool = (toolName: string) => {
    setToolsDisabledSet((prev) => {
      const next = new Set(prev)
      if (next.has(toolName)) next.delete(toolName)
      else next.add(toolName)
      return next
    })
  }

  const handleToggleAllTools = (enableAll: boolean) => {
    if (enableAll) setToolsDisabledSet(new Set())
    else setToolsDisabledSet(new Set(toolsList.map((t) => t.name)))
  }

  const handleSaveToolsModal = async () => {
    const disabledArray = Array.from(toolsDisabledSet)
    if (toolsSource === 'form') {
      setFormServer((prev) => ({ ...prev, disabledTools: disabledArray }))
      setToolsModalOpen(false)
      setSuccessMsg(t('toolsModal.saveSuccess'))
      setTimeout(() => setSuccessMsg(''), 3000)
      return
    }

    if (!toolsTargetServer?.id) {
      setToolsModalOpen(false)
      return
    }

    setToolsSaving(true)
    try {
      const targetServer =
        servers.find((s) => s.id === toolsTargetServer.id) || toolsTargetServer
      const updatedServer: GlobalMcpServerConfig = {
        ...targetServer,
        disabledTools: disabledArray,
      } as GlobalMcpServerConfig

      const res = await fetch('/api/mcp-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server: updatedServer }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setServers(data.servers || [])
        saveLocalMcpServers(data.servers || [])
        setToolsModalOpen(false)
        setSuccessMsg(t('toolsModal.saveSuccess'))
        setTimeout(() => setSuccessMsg(''), 3000)
      } else {
        setToolsError(data.error || 'Failed to save tool settings')
      }
    } catch (err: any) {
      setToolsError(err?.message || String(err))
    } finally {
      setToolsSaving(false)
    }
  }

  // Submit save from add/edit modal
  const handleSaveForm = async () => {
    setFormError('')
    if (!formServer.id?.trim()) {
      setFormError(t('form.id') + ' is required')
      return
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(formServer.id.trim())) {
      setFormError(
        'ID can only contain letters, numbers, underscores, and hyphens',
      )
      return
    }
    if (
      !isEditing &&
      servers.some(
        (s) => s.id.toLowerCase() === formServer.id?.trim().toLowerCase(),
      )
    ) {
      setFormError(`Server ID "${formServer.id}" already exists`)
      return
    }
    if (formServer.transport === 'stdio' && !formServer.command?.trim()) {
      setFormError(t('form.command') + ' is required for stdio')
      return
    }
    if (formServer.transport !== 'stdio' && !formServer.url?.trim()) {
      setFormError(t('form.url') + ' is required for HTTP/SSE')
      return
    }

    const envMap: Record<string, string> = {}
    for (const item of envEntries) {
      if (item.key.trim()) envMap[item.key.trim()] = item.value
    }
    const headerMap: Record<string, string> = {}
    for (const item of headerEntries) {
      if (item.key.trim()) headerMap[item.key.trim()] = item.value
    }

    const payload: GlobalMcpServerConfig = {
      id: formServer.id.trim(),
      name: formServer.name?.trim() || formServer.id.trim(),
      description: formServer.description?.trim() || undefined,
      transport: formServer.transport || 'stdio',
      command:
        formServer.transport === 'stdio'
          ? formServer.command?.trim()
          : undefined,
      args:
        formServer.transport === 'stdio' ? formServer.args || [] : undefined,
      cwd:
        formServer.transport === 'stdio'
          ? formServer.cwd?.trim() || undefined
          : undefined,
      env:
        formServer.transport === 'stdio' && Object.keys(envMap).length > 0
          ? envMap
          : undefined,
      url:
        formServer.transport !== 'stdio' ? formServer.url?.trim() : undefined,
      headers:
        formServer.transport !== 'stdio' && Object.keys(headerMap).length > 0
          ? headerMap
          : undefined,
      enabledByDefault: Boolean(formServer.enabledByDefault),
      toolCallTimeoutMs:
        formServer.toolCallTimeoutMs && formServer.toolCallTimeoutMs > 0
          ? Number(formServer.toolCallTimeoutMs)
          : undefined,
      failOnStartupError: Boolean(formServer.failOnStartupError),
      reconnect: formServer.reconnect,
      disabledTools: formServer.disabledTools || [],
      detectedTransport: formServer.detectedTransport,
      serverInfo: formServer.serverInfo,
      compatibility: formServer.compatibility,
    }

    // Pre-save test connection check
    setFormSaving(true)
    try {
      const testRes = await fetch('/api/mcp-servers?action=test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', server: payload }),
      })
      const testData = await testRes.json()
      if (testData && testData.ok) {
        payload.detectedTransport =
          testData.detectedTransport || payload.detectedTransport
        payload.serverInfo = testData.serverInfo || payload.serverInfo
        payload.compatibility = testData.compatibility || payload.compatibility
        payload.lastTestedAt = Date.now()
        const saveRes = await executeSave(payload)
        if (saveRes.ok) setFormOpen(false)
        else setFormError(saveRes.error || 'Failed to save server')
      } else {
        setSaveConfirm({
          open: true,
          message:
            testData?.message ||
            'Failed to establish connection to the MCP server.',
          payload,
        })
      }
    } catch {
      setSaveConfirm({
        open: true,
        message: 'Network request failed while testing connection.',
        payload,
      })
    } finally {
      setFormSaving(false)
    }
  }

  const handleConfirmSave = async (payload: GlobalMcpServerConfig) => {
    setFormSaving(true)
    setSaveConfirm(null)
    const saveRes = await executeSave(payload)
    setFormSaving(false)
    if (saveRes.ok) setFormOpen(false)
    else setFormError(saveRes.error || 'Failed to save server')
  }

  // Export JSON configuration
  const handleExport = () => {
    const mcpServersMap: Record<string, any> = {}
    for (const s of servers) {
      if (s.transport === 'stdio') {
        mcpServersMap[s.id] = {
          command: s.command,
          args: s.args,
          cwd: s.cwd,
          env: s.env,
        }
      } else {
        mcpServersMap[s.id] = {
          url: s.url,
          headers: s.headers,
        }
      }
    }
    const jsonStr = JSON.stringify({ mcpServers: mcpServersMap }, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mcp-servers.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Import JSON configuration
  const handleImportSubmit = async () => {
    setImportError('')
    setImporting(true)
    try {
      const parsed = JSON.parse(importText)
      const res = await fetch('/api/mcp-servers?action=import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', data: parsed }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setServers(data.servers || [])
        saveLocalMcpServers(data.servers || [])
        setImportOpen(false)
        setSuccessMsg(t('importModal.success', { count: data.count || 0 }))
        setTimeout(() => setSuccessMsg(''), 3000)
      } else {
        setImportError(data.message || t('importModal.error'))
      }
    } catch (err: any) {
      setImportError(
        t('importModal.error') + ': ' + (err?.message || String(err)),
      )
    } finally {
      setImporting(false)
    }
  }

  return e(
    'div',
    { className: 'dsh-mcp-settings-page' },
    // Header Card
    e(
      'div',
      { className: 'dsh-mcp-header-card' },
      e(
        'div',
        { className: 'dsh-mcp-header-title-row' },
        e(
          'div',
          null,
          e('h2', { className: 'dsh-mcp-page-title' }, t('title')),
          e('p', { className: 'dsh-mcp-page-desc' }, t('desc')),
        ),
        e(
          'div',
          { className: 'dsh-mcp-header-actions' },
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn primary',
              onClick: handleOpenAdd,
            },
            e(IconPlusOutline16, { size: 14 }),
            t('actions.add'),
          ),
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn secondary',
              onClick: () => {
                setImportText('')
                setImportError('')
                setImportOpen(true)
              },
            },
            e(IconCodeOutline16, { size: 14 }),
            t('actions.import'),
          ),
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn secondary',
              disabled: servers.length === 0,
              onClick: handleExport,
            },
            e(IconDownloadOutline16, { size: 14 }),
            t('actions.export'),
          ),
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn secondary',
              onClick: loadServers,
              title: t('actions.refresh'),
            },
            e(IconRefreshOutline16, { size: 14 }),
          ),
        ),
      ),
    ),

    // Notifications
    successMsg
      ? e('div', { className: 'dsh-sam-notice success' }, successMsg)
      : null,
    error ? e('div', { className: 'dsh-sam-notice error' }, error) : null,

    // Server Cards List
    loading
      ? e(
          'div',
          {
            className: 'dsh-sam-loading',
            style: { padding: '48px 0', textAlign: 'center' },
          },
          e(IconLoadingOutline16, { size: 24, className: 'dsh-spin' }),
        )
      : servers.length === 0
        ? e(EmptyState, {
            message: t('table.empty'),
            action: e(
              'button',
              {
                type: 'button',
                className: 'dsh-sam-btn primary',
                onClick: handleOpenAdd,
              },
              t('actions.add'),
            ),
          })
        : e(
            'div',
            { className: 'dsh-mcp-server-list' },
            servers.map((server) =>
              e(McpServerCard, {
                key: server.id,
                server,
                isTesting: testingId === server.id,
                testResult: testResults[server.id],
                onTest: handleTest,
                onOpenTools: handleOpenTools,
                onOpenEdit: handleOpenEdit,
                onDelete: handleDelete,
                t,
              }),
            ),
          ),

    // Form Modal
    e(McpServerFormModal, {
      open: formOpen,
      isEditing,
      server: formServer,
      onChange: setFormServer,
      envEntries,
      onEnvChange: setEnvEntries,
      headerEntries,
      onHeaderChange: setHeaderEntries,
      saving: formSaving,
      testing: formTesting,
      error: formError,
      testResult: formTestResult,
      showAdvanced,
      onToggleAdvanced: () => setShowAdvanced((prev) => !prev),
      onTest: handleFormTest,
      onOpenTools: handleFormOpenTools,
      onClose: () => setFormOpen(false),
      onSave: handleSaveForm,
      t,
    }),

    // Tools Modal
    e(McpToolsModal, {
      open: toolsModalOpen,
      server: toolsTargetServer,
      loading: toolsLoading,
      error: toolsError,
      toolsList,
      disabledToolsSet: toolsDisabledSet,
      serverInfo: toolsServerInfo,
      detectedTransport: toolsDetectedTransport,
      saving: toolsSaving,
      onToggleTool: handleToggleTool,
      onToggleAllTools: handleToggleAllTools,
      onRefresh: () => fetchToolsForServer(toolsTargetServer!),
      onClose: () => setToolsModalOpen(false),
      onSave: handleSaveToolsModal,
      t,
    }),

    // Import Modal
    e(McpImportExportModal, {
      open: importOpen,
      text: importText,
      onChange: setImportText,
      importing,
      error: importError,
      onSubmit: handleImportSubmit,
      onClose: () => setImportOpen(false),
      t,
    }),

    // Save Confirmation Modal
    e(McpSaveConfirmModal, {
      confirmState: saveConfirm,
      onCancel: () => setSaveConfirm(null),
      onConfirm: handleConfirmSave,
      t,
    }),
  )
}

export default McpServersSettingsTab
