import * as React from 'react'
import {
  type SandboxTemplate,
  API_ENDPOINTS,
  API_METHODS,
} from '../types/index.ts'

/** What the sandbox panel needs to render and edit user-authored presets. */
export interface SandboxTemplateCatalog {
  templates: SandboxTemplate[]
  /** True until the first list response lands; the panel then shows built-ins alone. */
  loading: boolean
  /** Last write failure, cleared by the next successful write. */
  error: string
  /** Insert or replace one preset; resolves true when the store accepted it. */
  save: (template: Partial<SandboxTemplate>) => Promise<boolean>
  /** Delete one preset; resolves true when the store dropped it. */
  remove: (id: string) => Promise<boolean>
  /** Re-read the list. */
  reload: () => Promise<void>
}

/**
 * The user-authored preset catalog.
 *
 * Presets live in their own store and are written immediately rather than on
 * the page's Save button: they are a deployment-wide asset shared by every
 * session, while the page's Save writes one scope's allow list. Letting that
 * button write them would make "which scope owns this template?" unanswerable.
 *
 * A failed read leaves the previous snapshot in place, matching the catalogs
 * controller: display data that momentarily fails should not blank a panel.
 */
export function useSandboxTemplates(): SandboxTemplateCatalog {
  const [templates, setTemplates] = React.useState<SandboxTemplate[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string>('')

  const reload = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(API_ENDPOINTS.sandboxTemplatesList)
      if (!res.ok) return
      const data = (await res.json()) as {
        ok?: boolean
        templates?: SandboxTemplate[]
      }
      if (data?.ok && Array.isArray(data.templates))
        setTemplates(data.templates)
    } catch {
      // A failed read leaves the previous snapshot; the panel still works.
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void reload()
  }, [reload])

  const save = React.useCallback(
    async (template: Partial<SandboxTemplate>): Promise<boolean> => {
      try {
        const res = await fetch(API_ENDPOINTS.sandboxTemplatesSave, {
          method: API_METHODS.sandboxTemplatesSave,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template }),
        })
        const data = (await res.json()) as {
          ok?: boolean
          templates?: SandboxTemplate[]
          error?: string
        }
        if (!res.ok || !data?.ok) {
          // The server owns naming rules; its message is the one the user
          // needs (a duplicate label, an over-long name), so it is surfaced
          // verbatim rather than replaced with a generic failure.
          setError(data?.error || `HTTP ${res.status}`)
          return false
        }
        if (Array.isArray(data.templates)) setTemplates(data.templates)
        setError('')
        return true
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err))
        return false
      }
    },
    [],
  )

  const remove = React.useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(API_ENDPOINTS.sandboxTemplatesRemove, {
        method: API_METHODS.sandboxTemplatesRemove,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        templates?: SandboxTemplate[]
        error?: string
      }
      if (!res.ok || !data?.ok) {
        setError(data?.error || `HTTP ${res.status}`)
        return false
      }
      if (Array.isArray(data.templates)) setTemplates(data.templates)
      setError('')
      return true
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      return false
    }
  }, [])

  return { templates, loading, error, save, remove, reload }
}
