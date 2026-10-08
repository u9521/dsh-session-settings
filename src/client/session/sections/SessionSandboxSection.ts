import * as React from 'react'
import type {
  SandboxAllowEntry,
  SandboxCapabilityInfo,
  SandboxSkippedEntry,
  SessionSandboxConfig,
  SessionSandboxMode,
  SessionSettingsConfig,
} from '../../types/index.ts'
import { Badge, EmptyState } from '../../components/index.ts'
import { resolveEffectiveSandbox } from '../../utils/config.ts'
import {
  missingEntries,
  sandboxPathTemplates,
  type SandboxPathTemplate,
} from '../sandboxTemplates.ts'

const e = React.createElement

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
  t,
}: SessionSandboxSectionProps) {
  /**
   * The source ladder, identical to the model / MCP / skills panels.
   *
   * Duplicated rather than shared because extracting it would touch three
   * already-working panels; the duplication is recorded as a known cost in the
   * Agent Note covering this feature.
   */
  const defaultMode = currentWorkspaceId ? 'workspace' : 'global'
  const sourceMode: 'workspace' | 'global' | 'custom' =
    activeSourceMode ??
    (scope === 'global'
      ? 'custom'
      : scope === 'workspace'
        ? sandboxConfig?.mode === 'custom'
          ? 'custom'
          : 'global'
        : sandboxConfig?.mode === 'custom'
          ? 'custom'
          : (sandboxConfig?.mode ?? defaultMode))

  /**
   * A non-custom source is view-only.
   *
   * `global` is always editable — there is no layer beneath it to follow, which
   * is the same rule the other three panels apply.
   */
  const isReadonly =
    scope === 'session'
      ? sourceMode !== 'custom'
      : scope === 'workspace'
        ? sourceMode !== 'custom'
        : false

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

  // Re-seed when what the panel DISPLAYS changes identity: a source switch, a
  // scope switch, a reload, or a reset. Local edits keep their own state
  // otherwise.
  const signature = JSON.stringify(displayEntries ?? [])
  const lastSignature = React.useRef(signature)
  React.useEffect(() => {
    if (lastSignature.current === signature) return
    lastSignature.current = signature
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
      onChange({ mode: 'custom', allow: fromDrafts(toDrafts(effectiveAllow)) })
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
   * `~/.m2/repository`), converges instead of piling up.
   */
  const applyTemplate = (template: SandboxPathTemplate) => {
    const additions = missingEntries(rows, template.entries)
    if (additions.length === 0) return
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
  const templates = sandboxPathTemplates(isEnglish ? 'en' : 'zh')

  const updateRow = (key: string, patch: Partial<SandboxAllowEntry>) => {
    commit(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const disabled = !supported || isReadonly

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
                  onChange: (ev: React.ChangeEvent<HTMLInputElement>) =>
                    updateRow(row.key, { path: ev.target.value }),
                }),
                e('input', {
                  type: 'text',
                  className: 'dsh-sandbox-input dsh-sandbox-input-desc',
                  value: row.description ?? '',
                  disabled,
                  placeholder: t('sessionSettings.sandbox.descPlaceholder'),
                  onChange: (ev: React.ChangeEvent<HTMLInputElement>) =>
                    updateRow(row.key, { description: ev.target.value }),
                }),
                // The remove control is an editing affordance; a view-only row
                // renders without it.
                !isReadonly
                  ? e(
                      'button',
                      {
                        type: 'button',
                        className: 'dsh-mcp-text-btn',
                        disabled,
                        onClick: () => removeRow(row.key),
                      },
                      t('sessionSettings.sandbox.remove'),
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
      !isReadonly
        ? e(
            'div',
            { className: 'dsh-sandbox-templates' },
            e(
              'div',
              { className: 'dsh-sandbox-templates-label' },
              t('sessionSettings.sandbox.templatesLabel'),
            ),
            e(
              'div',
              { className: 'dsh-sandbox-templates-groups' },
              templates.map((template) => {
                const additions = missingEntries(rows, template.entries)
                const exhausted = additions.length === 0
                return e(
                  'button',
                  {
                    key: template.id,
                    type: 'button',
                    className: `dsh-sandbox-template-btn ${exhausted ? 'added' : ''}`,
                    disabled: disabled || exhausted,
                    // The count is the honest label: a preset that adds two of
                    // its five paths should not look like it did nothing.
                    title: exhausted
                      ? t('sessionSettings.sandbox.templatesApplied')
                      : `+${additions.length}`,
                    onClick: () => applyTemplate(template),
                  },
                  t(template.labelKey),
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
            e(
              'div',
              { className: 'dsh-sandbox-hint' },
              t('sessionSettings.sandbox.templatesHint'),
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
              disabled,
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
