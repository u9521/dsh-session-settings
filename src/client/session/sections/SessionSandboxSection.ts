import * as React from 'react'
import type {
  SandboxAllowEntry,
  SandboxCapabilityInfo,
  SandboxSkippedEntry,
  SandboxTemplate,
  SessionSandboxConfig,
  SessionSandboxMode,
  SessionSettingsConfig,
} from '../../types/index.ts'
import { Badge, EmptyState } from '../../components/index.ts'
import {
  isSourceReadonly,
  resolveEffectiveSandbox,
  sourceModeFor,
} from '../../utils/config.ts'
import { missingEntries, sandboxPathTemplates } from '../sandboxTemplates.ts'
import { formatSandboxEntries } from '../sandboxClipboard.ts'
import { useCopyFeedback } from '../../mcp/hooks/useCopyFeedback.ts'
import { SandboxTemplatesModal } from '../modals/SandboxTemplatesModal.ts'

const e = React.createElement

/**
 * How long an armed remove button waits for its second click.
 *
 * Long enough to read the confirmation and press again, short enough that a
 * button left armed does not silently delete on a much later click.
 */
const DELETE_CONFIRM_MS = 3000

export interface SessionSandboxSectionProps {
  scope?: 'session' | 'workspace' | 'global'
  sandboxConfig: SessionSandboxConfig
  currentWorkspaceId?: string
  /** The workspace row, so an inherited source can render its actual rules. */
  workspaceSettings?: SessionSettingsConfig
  globalConfig?: SessionSettingsConfig
  /** What the mounted backend can do; absent until the settings response lands. */
  capability?: SandboxCapabilityInfo
  /** Configured entries the host skipped at its last resolution. */
  skipped?: SandboxSkippedEntry[]
  /** The session's sandbox mode, when the panel can read it. */
  effectiveMode?: string
  /**
   * Which layer the displayed rules come from.
   *
   * Derived by the caller with the SAME ladder the model, MCP, and skills panels
   * use, so the four panels cannot disagree about the current source.
   */
  activeSourceMode?: 'workspace' | 'global' | 'custom'
  onChange: (config: SessionSandboxConfig) => void
  /** Switch the source layer; `custom` starts from the currently effective rules. */
  onSourceModeChange?: (mode: SessionSandboxMode) => void
  /**
   * User-authored presets, shared by every session.
   *
   * Absent until the first list response lands; the panel then renders the
   * built-in presets alone, which is exactly what a plugin with no stored
   * presets looks like.
   */
  templates?: SandboxTemplate[]
  onCreateTemplate?: (template: Partial<SandboxTemplate>) => Promise<boolean>
  onRemoveTemplate?: (id: string) => Promise<boolean>
  /** The last template write failure, from the catalog hook. */
  templatesError?: string
  t: (key: string, vars?: Record<string, string | number>) => string
}

/**
 * One draft row: a path and the sentence the model reads about it.
 *
 * Rows are edited locally and only lifted into the config on change, so a
 * half-typed path never becomes a saved grant.
 */
interface DraftRow extends SandboxAllowEntry {
  /** Stable key for React; entry order is user-visible and must not re-key on edit. */
  readonly key: string
}

let rowSeq = 0
function nextKey(): string {
  rowSeq += 1
  return `allow-${rowSeq}`
}

/**
 * One preset as the button row renders it, from either family.
 *
 * The built-in and user families differ in where they come from — a bundle
 * table versus a stored record — and in nothing else the renderer cares about:
 * both fill rows, both can be exhausted, both show a count. Collapsing them
 * here is what keeps the button markup from growing a second copy per family.
 */
interface RenderGroup {
  readonly id: string
  readonly label: string
  readonly entries: readonly SandboxAllowEntry[]
  /** Present for a user preset, which can also be deleted. */
  readonly template?: SandboxTemplate
}

function toDrafts(
  entries: readonly SandboxAllowEntry[] | undefined,
): DraftRow[] {
  return (entries ?? []).map((entry) => ({ ...entry, key: nextKey() }))
}

function fromDrafts(rows: readonly DraftRow[]): SandboxAllowEntry[] {
  const out: SandboxAllowEntry[] = []
  for (const row of rows) {
    const path = row.path.trim()
    if (!path) continue
    const description = (row.description ?? '').trim()
    out.push({ path, ...(description ? { description } : {}) })
  }
  return out
}

/**
 * The session sandbox panel: extra writable directories, with their purpose.
 *
 * The description column is not decoration. The model decides where a toolchain
 * writes, so a bare path with no stated purpose invites it to treat the grant as
 * general licence — the sentence is what keeps an allow-list entry scoped to the
 * thing it was granted for, and it is injected into the runtime context beside
 * the path for exactly that reason.
 *
 * The panel disables itself from the host's capability report rather than from
 * a platform check: whether appended roots work is a runtime fact of the backend
 * the provider selected, so a guess here would offer a control that silently
 * does nothing.
 */
export function SessionSandboxSection({
  scope = 'session',
  sandboxConfig,
  currentWorkspaceId,
  workspaceSettings,
  globalConfig,
  capability,
  skipped = [],
  effectiveMode,
  activeSourceMode,
  onChange,
  onSourceModeChange,
  templates: userTemplates = [],
  onCreateTemplate,
  onRemoveTemplate,
  templatesError,
  t,
}: SessionSandboxSectionProps) {
  /** The source ladder, shared with the model / MCP / skills panels. */
  const sourceMode =
    activeSourceMode ??
    sourceModeFor(scope, sandboxConfig, Boolean(currentWorkspaceId))

  /** A non-custom source is view-only; `global` always edits its own layer. */
  const isReadonly = isSourceReadonly(scope, sourceMode)

  /**
   * The rules actually in force, which in a view-only state are the INHERITED
   * ones rather than this layer's (usually empty) list.
   *
   * Rendering the inherited set is the whole point of the read-only state: a
   * panel that showed nothing while a parent layer granted three directories
   * would be actively misleading.
   *
   * The three layers are assembled from whichever of them this scope edits:
   * editing `session` contributes the session row and the scope's own
   * workspace/global props; editing `workspace` contributes the workspace row;
   * editing `global` contributes only the global row.
   */
  const effectiveAllow = React.useMemo(() => {
    const own = { sandbox: sandboxConfig } as SessionSettingsConfig
    const session = scope === 'session' ? own : undefined
    const workspace =
      scope === 'global' ? undefined : (workspaceSettings ?? own)
    const global =
      scope === 'global'
        ? own
        : scope === 'workspace'
          ? undefined
          : globalConfig
    const resolved = resolveEffectiveSandbox(session, workspace, global)
    return resolved.allow ?? []
  }, [scope, sandboxConfig, workspaceSettings, globalConfig])

  // In a view-only state the list shows what the effective source grants; when
  // editable it shows this layer's own draft, which is what edits mutate.
  const displayEntries = isReadonly ? effectiveAllow : sandboxConfig?.allow

  const [rows, setRows] = React.useState<DraftRow[]>(() =>
    toDrafts(displayEntries),
  )
  const [pathDraft, setPathDraft] = React.useState('')
  const [descDraft, setDescDraft] = React.useState('')

  /**
   * The signature this panel last rendered from, and the one it last pushed.
   *
   * The two refs are what keep typing usable. A row-level edit commits upward,
   * the controller stores the config, and React hands the new `allow` array
   * straight back as a prop — so any "props changed, re-seed the draft" rule
   * rebuilds every row on every keystroke, which drops the caret to the body and
   * renormalizes the value under the user (a trailing space disappears the
   * instant it is typed, which makes a sentence impossible to finish).
   *
   * The local draft therefore OWNS the rows while editing, and the props are
   * only a seed: a change is adopted only when it did not come from this panel.
   */
  const signature = JSON.stringify(displayEntries ?? [])
  const lastSignature = React.useRef(signature)
  const lastPushedSignature = React.useRef(signature)

  React.useEffect(() => {
    if (lastSignature.current === signature) return
    lastSignature.current = signature
    // Our own echo: the parent is showing what this panel already shows.
    // Adopting it would replace hand-typed rows with their normalized form on
    // every commit, so the draft is left alone.
    if (lastPushedSignature.current === signature) return
    setRows(toDrafts(isReadonly ? displayEntries : sandboxConfig?.allow))
  }, [signature, isReadonly, displayEntries, sandboxConfig?.allow])

  const supported = capability?.canAllowExtraRoots !== false

  /**
   * Commit an edit.
   *
   * Selecting `custom` is implicit for the session and workspace scopes: adding
   * the first rule IS the act of overriding, and making the user flip a mode
   * switch first would let them save rules nothing reads.
   */
  const commit = (next: DraftRow[]) => {
    setRows(next)
    const allow = fromDrafts(next)
    // Record what this commit will look like when it arrives back as a prop.
    lastPushedSignature.current = JSON.stringify(allow)
    onChange(scope === 'global' ? { allow } : { mode: 'custom', allow })
  }

  /**
   * Switch the source layer.
   *
   * Entering `custom` seeds the draft from the rules that were in force, so the
   * transition reads as "take over what I was already getting" rather than
   * silently emptying the list.
   */
  const switchSource = (mode: SessionSandboxMode) => {
    if (onSourceModeChange) {
      onSourceModeChange(mode)
      return
    }
    if (mode === 'custom') {
      const allow = fromDrafts(toDrafts(effectiveAllow))
      lastPushedSignature.current = JSON.stringify(allow)
      onChange({ mode: 'custom', allow })
    } else {
      onChange({ mode })
    }
  }

  const addRow = () => {
    const path = pathDraft.trim()
    if (!path) return
    const description = descDraft.trim()
    commit([
      ...rows,
      { key: nextKey(), path, ...(description ? { description } : {}) },
    ])
    setPathDraft('')
    setDescDraft('')
  }

  const removeRow = (key: string) => {
    commit(rows.filter((row) => row.key !== key))
  }

  /**
   * Fill a preset's rows into the draft.
   *
   * Goes through {@link commit}, so a preset is subject to exactly the same
   * normalization as a hand-typed row — trimming, the empty-path drop, the
   * description length cap — and lands on the same save path. There is no
   * separate "from template" provenance: once filled, a row is a row, which is
   * what lets the user edit or delete it like any other.
   *
   * Paths already present are skipped rather than duplicated, so clicking a
   * preset twice, or one whose paths overlap another (Android and Java share
   * `~/.m2/repository` and `~/.gradle`), converges instead of piling up.
   */
  const applyTemplate = (group: {
    readonly entries: readonly SandboxAllowEntry[]
  }) => {
    const additions = missingEntries(rows, group.entries)
    if (additions.length === 0) return
    disarmRow()
    commit([
      ...rows,
      ...additions.map((entry) => ({ ...entry, key: nextKey() })),
    ])
  }

  /**
   * The presets, in the active language.
   *
   * The locale service exposes `bind` but no current-locale getter, so the
   * language is read off a key whose two renderings are known to differ. Probing
   * the translator rather than reaching for the service keeps this a pure
   * function of the props and re-evaluates on a locale switch, which a captured
   * value would not.
   */
  const isEnglish = t('sessionSettings.sandbox.add') === 'Add'
  const locale = isEnglish ? 'en' : 'zh'
  const templates = sandboxPathTemplates(locale)

  // One row model for both families, so the button renderer does not branch.
  const builtinGroups: RenderGroup[] = templates.map((template) => ({
    id: template.id,
    label: t(template.labelKey),
    entries: template.entries,
  }))
  const userGroups: RenderGroup[] = userTemplates.map((template) => ({
    id: template.id,
    label: template.name,
    entries: template.entries,
    template,
  }))

  const updateRow = (key: string, patch: Partial<SandboxAllowEntry>) => {
    commit(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const disabled = !supported || isReadonly

  // ---- Two-step delete -----------------------------------------------------

  /**
   * The row whose remove button is armed, if any.
   *
   * A row's draft deletion is not destructive (it needs an explicit Save), so
   * this guards a mis-click, not data loss: one click disarms to nothing, and
   * the second within {@link DELETE_CONFIRM_MS} deletes. Rows are keyed rather
   * than indexed so a commit that renumbers nothing can disarm the wrong row.
   */
  const [armedRowKey, setArmedRowKey] = React.useState<string | null>(null)
  const armedTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  /**
   * Clear the arm.
   *
   * Depends on nothing but a ref and the state setter, so the same callback can
   * be handed to every row's `onFocus`/`onBlur` without capturing a stale key.
   */
  const disarmRow = React.useCallback(() => {
    if (armedTimer.current !== undefined) clearTimeout(armedTimer.current)
    armedTimer.current = undefined
    setArmedRowKey(null)
  }, [])

  React.useEffect(
    () => () => {
      if (armedTimer.current !== undefined) clearTimeout(armedTimer.current)
    },
    [],
  )

  const handleRemoveClick = (key: string) => {
    if (armedRowKey !== key) {
      if (armedTimer.current !== undefined) clearTimeout(armedTimer.current)
      setArmedRowKey(key)
      armedTimer.current = setTimeout(() => {
        armedTimer.current = undefined
        setArmedRowKey(null)
      }, DELETE_CONFIRM_MS)
      return
    }
    disarmRow()
    removeRow(key)
  }

  // ---- Clipboard export ----------------------------------------------------

  const { copiedKey, copy } = useCopyFeedback()
  const copiedDraft = copiedKey === 'sandbox-draft'
  const templateTitle = t('sessionSettings.sandbox.templatesExportTitle')

  /** The stored presets' manager; closed until asked for. */
  const [templatesModalOpen, setTemplatesModalOpen] = React.useState(false)

  /**
   * One headed button row.
   *
   * A preset button is disabled once every path it carries is already in the
   * draft, and says so in its title: the count is what keeps a preset that adds
   * two of five paths from looking like it did nothing.
   */
  const presetGroup = (
    key: string,
    label: string,
    groups: readonly RenderGroup[],
  ) =>
    e(
      'div',
      { key, className: 'dsh-sandbox-template-group' },
      e('div', { className: 'dsh-sandbox-templates-label' }, label),
      e(
        'div',
        { className: 'dsh-sandbox-templates-groups' },
        groups.length === 0
          ? e(
              'span',
              { className: 'dsh-sandbox-template-empty' },
              key === 'custom'
                ? t('sessionSettings.sandbox.templatesCustomEmpty')
                : t('sessionSettings.sandbox.templatesBuiltinEmpty'),
            )
          : groups.map((group) => {
              const additions = missingEntries(rows, group.entries)
              const exhausted = additions.length === 0
              return e(
                'button',
                {
                  key: group.id,
                  type: 'button',
                  className: `dsh-sandbox-template-btn ${exhausted ? 'added' : ''}`,
                  disabled: disabled || exhausted,
                  title: exhausted
                    ? t('sessionSettings.sandbox.templatesApplied')
                    : `+${additions.length}`,
                  onClick: () => applyTemplate(group),
                },
                group.label,
                exhausted
                  ? e(
                      'span',
                      { className: 'dsh-sandbox-template-mark' },
                      t('sessionSettings.sandbox.templatesApplied'),
                    )
                  : null,
              )
            }),
      ),
    )

  /**
   * The source picker, matching the model / MCP / skills panels.
   *
   * `global` has no picker because there is no layer beneath it. The session
   * scope omits the workspace entry when the page knows of no workspace, rather
   * than offering a tab that could never resolve.
   */
  const sourceTabs =
    scope === 'session'
      ? [
          ...(currentWorkspaceId
            ? [
                {
                  key: 'workspace',
                  label: t('sessionSettings.sourceTabs.workspace'),
                  active: sourceMode === 'workspace',
                  onClick: () => switchSource('workspace'),
                },
              ]
            : []),
          {
            key: 'global',
            label: t('sessionSettings.sourceTabs.global'),
            active: sourceMode === 'global',
            onClick: () => switchSource('global'),
          },
          {
            key: 'custom',
            label: t('sessionSettings.sourceTabs.custom'),
            active: sourceMode === 'custom',
            onClick: () => switchSource('custom'),
          },
        ]
      : scope === 'workspace'
        ? [
            {
              key: 'global',
              label: t('sessionSettings.sourceTabs.global'),
              active: sourceMode === 'global',
              onClick: () => switchSource('global'),
            },
            {
              key: 'custom',
              label: t('sessionSettings.sourceTabs.workspaceCustom'),
              active: sourceMode === 'custom',
              onClick: () => switchSource('custom'),
            },
          ]
        : []

  return e(
    'div',
    { className: 'dsh-view-content-inner' },
    // Source picker first, so the read-only state below is explained before the
    // controls it governs.
    sourceTabs.length > 0
      ? e(
          'div',
          { className: 'dsh-source-tabs-wrap' },
          e(
            'div',
            { className: 'dsh-source-tabs-label' },
            t('sessionSettings.sourceTabs.label'),
          ),
          e(
            'div',
            { className: 'dsh-source-tabs-nav', role: 'tablist' },
            sourceTabs.map((tab) =>
              e(
                'button',
                {
                  key: tab.key,
                  type: 'button',
                  role: 'tab',
                  'aria-selected': tab.active,
                  className: `dsh-source-tab-btn ${tab.active ? 'active' : ''}`,
                  onClick: tab.onClick,
                },
                tab.label,
              ),
            ),
          ),
        )
      : null,

    // Capability notice: stated before the controls so a disabled panel is
    // explained rather than merely inert.
    !supported
      ? e(
          'div',
          { className: 'dsh-sandbox-notice' },
          e(Badge, {
            label: t('sessionSettings.sandbox.unsupportedBadge'),
            variant: 'timeout',
          }),
          e(
            'span',
            { className: 'dsh-sandbox-notice-text' },
            capability?.reason || t('sessionSettings.sandbox.unsupportedHint'),
          ),
        )
      : null,

    // Mode notice: an allow list does nothing outside workspace-write, and
    // saying so is what stops "saved" from reading as "in effect".
    effectiveMode && effectiveMode !== 'workspace-write'
      ? e(
          'div',
          { className: 'dsh-sandbox-notice' },
          e(Badge, {
            label: effectiveMode,
            variant: 'workspace',
          }),
          e(
            'span',
            { className: 'dsh-sandbox-notice-text' },
            t('sessionSettings.sandbox.modeHint'),
          ),
        )
      : null,

    e(
      'div',
      { className: 'dsh-session-skills-box' },
      e(
        'div',
        { className: 'dsh-sandbox-head' },
        e(
          'div',
          { className: 'dsh-sandbox-title' },
          t('sessionSettings.sandbox.title'),
        ),
        e(
          'div',
          { className: 'dsh-sandbox-subtitle' },
          t('sessionSettings.sandbox.subtitle'),
        ),
      ),

      // Rules. In a view-only state these are the INHERITED ones (see
      // `effectiveAllow`), so the empty message says which case this is.
      rows.length === 0
        ? e(EmptyState, {
            message: t(
              isReadonly
                ? 'sessionSettings.sandbox.emptyInherited'
                : 'sessionSettings.sandbox.empty',
            ),
          })
        : e(
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
                  disabled,
                  placeholder: t('sessionSettings.sandbox.pathPlaceholder'),
                  onFocus: disarmRow,
                  onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
                    // Editing a row changes the subject of any standing
                    // confirmation, so the arm does not survive it.
                    disarmRow()
                    updateRow(row.key, { path: ev.target.value })
                  },
                }),
                e('input', {
                  type: 'text',
                  className: 'dsh-sandbox-input dsh-sandbox-input-desc',
                  value: row.description ?? '',
                  disabled,
                  placeholder: t('sessionSettings.sandbox.descPlaceholder'),
                  onFocus: disarmRow,
                  onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
                    disarmRow()
                    updateRow(row.key, { description: ev.target.value })
                  },
                }),
                // The remove control is an editing affordance; a view-only row
                // renders without it. Two clicks: the first arms, the second
                // deletes, and leaving the button (or editing anything)
                // disarms. A draft deletion is reversible by not saving, but a
                // single mis-click on a row of typed paths is still a bad
                // trade for one click saved.
                !isReadonly
                  ? e(
                      'button',
                      {
                        type: 'button',
                        className:
                          armedRowKey === row.key
                            ? 'dsh-mcp-text-btn dsh-sandbox-remove-armed'
                            : 'dsh-mcp-text-btn',
                        disabled,
                        'aria-label':
                          armedRowKey === row.key
                            ? t('sessionSettings.sandbox.removeConfirm')
                            : t('sessionSettings.sandbox.remove'),
                        onClick: () => handleRemoveClick(row.key),
                        // Leaving a button disarms it. Blur only fires on the
                        // button that actually had focus, so another row's
                        // blur cannot cancel the confirmation in progress.
                        onBlur: disarmRow,
                      },
                      armedRowKey === row.key
                        ? t('sessionSettings.sandbox.removeConfirm')
                        : t('sessionSettings.sandbox.remove'),
                    )
                  : null,
              ),
            ),
          ),

      // Presets: an editing affordance, so the whole block disappears in a
      // view-only state along with the add row below it.
      //
      // Placed above the add row because it is the faster path to the same
      // outcome: someone adding three cache directories should see the shortcut
      // before the manual controls, not after.
      //
      // Two families in one block. The built-ins ship with the bundle and are
      // read-only; the user's own are stored deployment-wide. They are headed
      // separately because "can I delete this?" is otherwise a per-button
      // question, and because a user edit to a built-in would be undone by the
      // next plugin upgrade.
      !isReadonly
        ? e(
            'div',
            { className: 'dsh-sandbox-templates' },
            presetGroup(
              'builtin',
              t('sessionSettings.sandbox.templatesBuiltin'),
              builtinGroups,
            ),
            presetGroup(
              'custom',
              t('sessionSettings.sandbox.templatesCustom'),
              userGroups,
            ),

            // Actions: manage the stored presets, or hand this draft to another
            // machine by way of the clipboard.
            e(
              'div',
              { className: 'dsh-sandbox-template-actions' },
              onCreateTemplate
                ? e(
                    'button',
                    {
                      type: 'button',
                      className: 'dsh-sandbox-template-action',
                      disabled,
                      onClick: () => setTemplatesModalOpen(true),
                    },
                    t('sessionSettings.sandbox.templatesManage'),
                  )
                : null,
              e(
                'button',
                {
                  type: 'button',
                  className: 'dsh-sandbox-template-action',
                  disabled: rows.length === 0 || copiedDraft,
                  onClick: () => {
                    // Export the DRAFT, not the stored rules: the point is to
                    // take the rows the user is looking at, including the ones
                    // a template just filled in and the ones not saved yet.
                    copy(
                      formatSandboxEntries(fromDrafts(rows), templateTitle),
                      'sandbox-draft',
                    )
                  },
                },
                copiedDraft
                  ? t('sessionSettings.sandbox.templatesCopied')
                  : t('sessionSettings.sandbox.templatesExport'),
              ),
            ),
            e(
              'div',
              { className: 'dsh-sandbox-hint' },
              t('sessionSettings.sandbox.templatesHint'),
            ),
            e(
              'div',
              { className: 'dsh-sandbox-hint' },
              t('sessionSettings.sandbox.templatesExportHint'),
            ),
          )
        : null,

      // Add row: an editing affordance, so it disappears entirely in a
      // view-only state rather than sitting there disabled inviting a click.
      !isReadonly
        ? e(
            'div',
            { className: 'dsh-sandbox-row dsh-sandbox-add' },
            e('input', {
              type: 'text',
              className: 'dsh-sandbox-input dsh-sandbox-input-path',
              value: pathDraft,
              disabled,
              placeholder: t('sessionSettings.sandbox.pathPlaceholder'),
              onFocus: disarmRow,
              onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
                disarmRow()
                setPathDraft(ev.target.value)
              },
              onKeyDown: (ev: React.KeyboardEvent<HTMLInputElement>) => {
                if (ev.key === 'Enter') addRow()
              },
            }),
            e('input', {
              type: 'text',
              className: 'dsh-sandbox-input dsh-sandbox-input-desc',
              value: descDraft,
              disabled,
              placeholder: t('sessionSettings.sandbox.descPlaceholder'),
              onFocus: disarmRow,
              onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
                disarmRow()
                setDescDraft(ev.target.value)
              },
              onKeyDown: (ev: React.KeyboardEvent<HTMLInputElement>) => {
                if (ev.key === 'Enter') addRow()
              },
            }),
            e(
              'button',
              {
                type: 'button',
                className: 'dsh-mcp-text-btn',
                disabled: disabled || !pathDraft.trim(),
                onClick: addRow,
              },
              t('sessionSettings.sandbox.add'),
            ),
          )
        : null,

      e(
        'div',
        { className: 'dsh-sandbox-hint' },
        t('sessionSettings.sandbox.pathHint'),
      ),
    ),

    // Entries the host dropped. Reported rather than hidden: a rule that is
    // saved but skipped is exactly the case where silence misleads.
    skipped.length > 0
      ? e(
          'div',
          { className: 'dsh-sandbox-skipped' },
          e(
            'div',
            { className: 'dsh-sandbox-skipped-title' },
            t('sessionSettings.sandbox.skippedTitle'),
          ),
          skipped.map((entry) =>
            e(
              'div',
              {
                key: `${entry.path}:${entry.reason}`,
                className: 'dsh-sandbox-skipped-row',
              },
              e(Badge, { label: entry.path, variant: 'status-disabled' }),
              e(
                'span',
                { className: 'dsh-sandbox-skipped-reason' },
                entry.reason,
              ),
            ),
          ),
        )
      : null,

    // The preset manager. Rendered outside the view-only gate because it is
    // already closed there: its trigger lives in the editing block, so the
    // modal cannot be open in a state that has no trigger.
    e(SandboxTemplatesModal, {
      open: templatesModalOpen && !isReadonly,
      templates: userTemplates,
      builtinNames: builtinGroups.map((group) => group.label),
      error: templatesError,
      onClose: () => setTemplatesModalOpen(false),
      onCreate: onCreateTemplate,
      onRemove: onRemoveTemplate,
      t,
    }),

    // Scope note: a relative path needs a workspace to resolve against, and a
    // page that cannot establish one must say so rather than silently
    // interpreting "." against something else.
    !isReadonly && scope !== 'session' && currentWorkspaceId === undefined
      ? e(
          'div',
          { className: 'dsh-sandbox-hint' },
          t('sessionSettings.sandbox.noWorkspaceHint'),
        )
      : null,
  )
}
