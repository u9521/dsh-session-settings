import * as React from 'react'
import type { SandboxAllowEntry, SandboxTemplate } from '../../types/index.ts'
import { ModalDialog } from '../../components/index.ts'
import { parseSandboxEntries } from '../sandboxClipboard.ts'

const e = React.createElement

/** How long an armed remove button waits for its second click. */
const DELETE_CONFIRM_MS = 3000

export interface SandboxTemplatesModalProps {
  open: boolean
  templates: SandboxTemplate[]
  /**
   * The built-in labels, for the client-side duplicate check.
   *
   * The server refuses a duplicate too; checking here only means the user sees
   * the reason before a round trip. Two places, one rule: the server is
   * authoritative and this one may not be stricter than it.
   */
  builtinNames: readonly string[]
  /** The last server refusal, surfaced verbatim. */
  error?: string
  onClose: () => void
  onCreate?: (template: Partial<SandboxTemplate>) => Promise<boolean>
  onRemove?: (id: string) => Promise<boolean>
  t: (key: string, vars?: Record<string, string | number>) => string
}

/** One editable row in the form: same shape as the panel's own draft rows. */
interface FormRow extends SandboxAllowEntry {
  readonly key: string
}

let formSeq = 0
function nextFormKey(): string {
  formSeq += 1
  return `tpl-row-${formSeq}`
}

/**
 * Manage the user-authored sandbox presets.
 *
 * Two panes in one dialog — the stored list and the form for the selected one —
 * because a preset is "a name plus its rows" and a user editing one expects to
 * see the others. Saving writes immediately: presets are shared by every
 * session, so holding them behind the page's Save (which writes a single
 * scope's allow list) would make their owner ambiguous.
 */
export function SandboxTemplatesModal({
  open,
  templates,
  builtinNames,
  error,
  onClose,
  onCreate,
  onRemove,
  t,
}: SandboxTemplatesModalProps) {
  /** The preset being edited; `null` means "a new one". */
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [name, setName] = React.useState('')
  const [rows, setRows] = React.useState<FormRow[]>([])
  const [pathDraft, setPathDraft] = React.useState('')
  const [descDraft, setDescDraft] = React.useState('')
  const [localError, setLocalError] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [importText, setImportText] = React.useState('')
  const [importNote, setImportNote] = React.useState('')

  const [armedRemoveId, setArmedRemoveId] = React.useState<string | null>(null)
  const removeTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  React.useEffect(
    () => () => {
      if (removeTimer.current !== undefined) clearTimeout(removeTimer.current)
    },
    [],
  )

  // Reset the form whenever the dialog opens: a stale half-typed preset from a
  // previous visit is not something the user asked to resume.
  React.useEffect(() => {
    if (!open) return
    setEditingId(null)
    setName('')
    setRows([])
    setPathDraft('')
    setDescDraft('')
    setLocalError('')
    setImportOpen(false)
    setImportText('')
    setImportNote('')
    setArmedRemoveId(null)
  }, [open])

  const startNew = () => {
    setEditingId(null)
    setName('')
    setRows([])
    setPathDraft('')
    setDescDraft('')
    setLocalError('')
  }

  const startEdit = (template: SandboxTemplate) => {
    setEditingId(template.id)
    setName(template.name)
    setRows(template.entries.map((entry) => ({ ...entry, key: nextFormKey() })))
    setPathDraft('')
    setDescDraft('')
    setLocalError('')
  }

  const commitRows = (next: FormRow[]) => setRows(next)

  const addRow = () => {
    const path = pathDraft.trim()
    if (!path) return
    const description = descDraft.trim()
    commitRows([
      ...rows,
      { key: nextFormKey(), path, ...(description ? { description } : {}) },
    ])
    setPathDraft('')
    setDescDraft('')
  }

  const removeRow = (key: string) =>
    commitRows(rows.filter((row) => row.key !== key))

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setLocalError(t('sessionSettings.sandbox.templatesNameRequired'))
      return
    }
    const payload: SandboxAllowEntry[] = []
    for (const row of rows) {
      const path = row.path.trim()
      if (!path) continue
      const description = (row.description ?? '').trim()
      payload.push({ path, ...(description ? { description } : {}) })
    }
    if (payload.length === 0) {
      setLocalError(t('sessionSettings.sandbox.templatesRowsRequired'))
      return
    }
    // Cheap local pre-check; the server owns the rule and its message wins.
    const taken = new Set([
      ...builtinNames,
      ...templates.filter((tt) => tt.id !== editingId).map((tt) => tt.name),
    ])
    if (taken.has(trimmed)) {
      setLocalError(
        t('sessionSettings.sandbox.templatesNameTaken', { name: trimmed }),
      )
      return
    }

    setSaving(true)
    setLocalError('')
    try {
      const ok = await onCreate?.({
        ...(editingId ? { id: editingId } : {}),
        name: trimmed,
        entries: payload,
      })
      if (ok) startNew()
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string) => {
    if (armedRemoveId !== id) {
      if (removeTimer.current !== undefined) clearTimeout(removeTimer.current)
      setArmedRemoveId(id)
      removeTimer.current = setTimeout(() => {
        removeTimer.current = undefined
        setArmedRemoveId(null)
      }, DELETE_CONFIRM_MS)
      return
    }
    if (removeTimer.current !== undefined) clearTimeout(removeTimer.current)
    removeTimer.current = undefined
    setArmedRemoveId(null)
    const ok = await onRemove?.(id)
    if (ok && editingId === id) startNew()
  }

  /**
   * Fill the form from pasted text.
   *
   * Never trusts the clipboard blindly: a rejected line is reported with its
   * number, so a paste that half-parses says which half. Rows already in the
   * form are kept and duplicates skipped, which makes re-importing the same
   * snippet a no-op rather than a pile of identical rows.
   */
  const applyImport = () => {
    const parsed = parseSandboxEntries(importText)
    if (parsed.entries.length === 0) {
      setLocalError(t('sessionSettings.sandbox.templatesImportEmpty'))
      return
    }
    if (!name.trim() && parsed.title) setName(parsed.title)

    const seen = new Set(rows.map((row) => row.path))
    const additions: FormRow[] = []
    for (const entry of parsed.entries) {
      if (seen.has(entry.path)) continue
      seen.add(entry.path)
      additions.push({ ...entry, key: nextFormKey() })
    }
    commitRows([...rows, ...additions])

    const parts: string[] = [
      t('sessionSettings.sandbox.templatesImportAdded', {
        count: additions.length,
      }),
    ]
    if (parsed.skipped.length > 0) {
      parts.push(
        t('sessionSettings.sandbox.templatesImportSkipped', {
          lines: parsed.skipped.map((s) => s.line).join(', '),
        }),
      )
    }
    setImportNote(parts.join(' '))
    setLocalError('')
    setImportOpen(false)
    setImportText('')
  }

  const readClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setImportText(text)
    } catch {
      // A refused read is normal — the permission prompt may be declined or
      // unavailable. The textarea stays, so the user can paste by hand; that
      // fallback is the point, not a degraded state we should hide.
      setImportNote(t('sessionSettings.sandbox.templatesClipboardDenied'))
    }
  }

  const dialogTitle = t('sessionSettings.sandbox.templatesModalTitle')

  return e(
    ModalDialog,
    {
      open,
      onClose,
      title: dialogTitle,
      subtitle: t('sessionSettings.sandbox.templatesModalSubtitle'),
      panelClassName: 'dsh-sandbox-templates-modal',
      footer: [
        e(
          'div',
          { key: 'left', className: 'dsh-mcp-modal-footer-left' },
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn secondary',
              disabled: saving,
              onClick: startNew,
            },
            t('sessionSettings.sandbox.templatesNew'),
          ),
        ),
        e(
          'div',
          { key: 'right', className: 'dsh-mcp-modal-footer-right' },
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn secondary',
              disabled: saving,
              onClick: onClose,
            },
            t('sessionSettings.sandbox.templatesClose'),
          ),
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn primary',
              disabled: saving,
              onClick: () => void handleSave(),
            },
            saving
              ? t('sessionSettings.sandbox.templatesSaving')
              : t('sessionSettings.sandbox.templatesSave'),
          ),
        ),
      ],
    },

    // Stored presets. The selected one is highlighted so the form on the right
    // is obviously about that row.
    e(
      'div',
      { className: 'dsh-sandbox-templates-modal-body' },
      e(
        'div',
        { className: 'dsh-sandbox-templates-list' },
        e(
          'div',
          { className: 'dsh-sandbox-templates-label' },
          t('sessionSettings.sandbox.templatesStored'),
        ),
        templates.length === 0
          ? e(
              'div',
              { className: 'dsh-sandbox-template-empty' },
              t('sessionSettings.sandbox.templatesCustomEmpty'),
            )
          : templates.map((template) =>
              e(
                'div',
                {
                  key: template.id,
                  className: `dsh-sandbox-templates-list-row ${
                    editingId === template.id ? 'active' : ''
                  }`,
                },
                e(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-sandbox-templates-list-name',
                    onClick: () => startEdit(template),
                  },
                  template.name,
                  e(
                    'span',
                    { className: 'dsh-sandbox-templates-list-count' },
                    t('sessionSettings.sandbox.templatesRowCount', {
                      count: template.entries.length,
                    }),
                  ),
                ),
                e(
                  'button',
                  {
                    type: 'button',
                    className:
                      armedRemoveId === template.id
                        ? 'dsh-mcp-text-btn dsh-sandbox-remove-armed'
                        : 'dsh-mcp-text-btn',
                    'aria-label':
                      armedRemoveId === template.id
                        ? t('sessionSettings.sandbox.removeConfirm')
                        : t('sessionSettings.sandbox.remove'),
                    onClick: () => void handleRemove(template.id),
                    onBlur: () => {
                      if (armedRemoveId === template.id) {
                        if (removeTimer.current !== undefined) {
                          clearTimeout(removeTimer.current)
                        }
                        removeTimer.current = undefined
                        setArmedRemoveId(null)
                      }
                    },
                  },
                  armedRemoveId === template.id
                    ? t('sessionSettings.sandbox.removeConfirm')
                    : t('sessionSettings.sandbox.remove'),
                ),
              ),
            ),
      ),

      // The form: a name and its rows.
      e(
        'div',
        { className: 'dsh-sandbox-templates-form' },
        e('input', {
          type: 'text',
          className: 'dsh-sandbox-input dsh-sandbox-template-name',
          value: name,
          disabled: saving,
          placeholder: t('sessionSettings.sandbox.templatesNamePlaceholder'),
          onChange: (ev: React.ChangeEvent<HTMLInputElement>) =>
            setName(ev.target.value),
        }),

        rows.length > 0
          ? e(
              'div',
              { className: 'dsh-sandbox-list' },
              rows.map((row) =>
                e(
                  'div',
                  { key: row.key, className: 'dsh-sandbox-row' },
                  e('input', {
                    type: 'text',
                    className: 'dsh-sandbox-input dsh-sandbox-input-path',
                    value: row.path,
                    disabled: saving,
                    placeholder: t('sessionSettings.sandbox.pathPlaceholder'),
                    onChange: (ev: React.ChangeEvent<HTMLInputElement>) =>
                      commitRows(
                        rows.map((r) =>
                          r.key === row.key
                            ? { ...r, path: ev.target.value }
                            : r,
                        ),
                      ),
                  }),
                  e('input', {
                    type: 'text',
                    className: 'dsh-sandbox-input dsh-sandbox-input-desc',
                    value: row.description ?? '',
                    disabled: saving,
                    placeholder: t('sessionSettings.sandbox.descPlaceholder'),
                    onChange: (ev: React.ChangeEvent<HTMLInputElement>) =>
                      commitRows(
                        rows.map((r) =>
                          r.key === row.key
                            ? { ...r, description: ev.target.value }
                            : r,
                        ),
                      ),
                  }),
                  e(
                    'button',
                    {
                      type: 'button',
                      className: 'dsh-mcp-text-btn',
                      disabled: saving,
                      onClick: () => removeRow(row.key),
                    },
                    t('sessionSettings.sandbox.remove'),
                  ),
                ),
              ),
            )
          : null,

        e(
          'div',
          { className: 'dsh-sandbox-row dsh-sandbox-add' },
          e('input', {
            type: 'text',
            className: 'dsh-sandbox-input dsh-sandbox-input-path',
            value: pathDraft,
            disabled: saving,
            placeholder: t('sessionSettings.sandbox.pathPlaceholder'),
            onChange: (ev: React.ChangeEvent<HTMLInputElement>) =>
              setPathDraft(ev.target.value),
            onKeyDown: (ev: React.KeyboardEvent<HTMLInputElement>) => {
              if (ev.key === 'Enter') addRow()
            },
          }),
          e('input', {
            type: 'text',
            className: 'dsh-sandbox-input dsh-sandbox-input-desc',
            value: descDraft,
            disabled: saving,
            placeholder: t('sessionSettings.sandbox.descPlaceholder'),
            onChange: (ev: React.ChangeEvent<HTMLInputElement>) =>
              setDescDraft(ev.target.value),
            onKeyDown: (ev: React.KeyboardEvent<HTMLInputElement>) => {
              if (ev.key === 'Enter') addRow()
            },
          }),
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-mcp-text-btn',
              disabled: saving || !pathDraft.trim(),
              onClick: addRow,
            },
            t('sessionSettings.sandbox.add'),
          ),
        ),

        // Clipboard import: the entry point for text someone sent you.
        importOpen
          ? e(
              'div',
              { className: 'dsh-sandbox-import' },
              e('textarea', {
                className: 'dsh-sandbox-import-text',
                value: importText,
                rows: 6,
                placeholder: t(
                  'sessionSettings.sandbox.templatesImportPlaceholder',
                ),
                onChange: (ev: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setImportText(ev.target.value),
              }),
              e(
                'div',
                { className: 'dsh-sandbox-row' },
                e(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-sam-btn secondary',
                    onClick: () => void readClipboard(),
                  },
                  t('sessionSettings.sandbox.templatesReadClipboard'),
                ),
                e(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-sam-btn primary',
                    disabled: saving || !importText.trim(),
                    onClick: applyImport,
                  },
                  t('sessionSettings.sandbox.templatesImportApply'),
                ),
                e(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-sam-btn secondary',
                    onClick: () => {
                      setImportOpen(false)
                      setImportText('')
                      setImportNote('')
                    },
                  },
                  t('sessionSettings.sandbox.templatesImportCancel'),
                ),
              ),
            )
          : e(
              'button',
              {
                type: 'button',
                className: 'dsh-sandbox-template-action',
                disabled: saving,
                onClick: () => {
                  setImportOpen(true)
                  setImportNote('')
                },
              },
              t('sessionSettings.sandbox.templatesImport'),
            ),

        importNote
          ? e('div', { className: 'dsh-sandbox-hint' }, importNote)
          : null,
        localError || error
          ? e(
              'div',
              { className: 'dsh-sandbox-error' },
              localError || error || '',
            )
          : null,
      ),
    ),
  )
}
