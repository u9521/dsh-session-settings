import * as React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import * as locales from './locales/index.ts'
import {
  LOCALE_NS,
  type ClientRemoteServiceRef,
  type SessionsState,
  type WorkspacesState,
} from './types/index.ts'
import { SessionSettingsViewPage } from './session/index.ts'
import { McpServersSettingsTab } from './mcp/index.ts'
import { SessionSettingsHeroChip } from './hero/index.ts'
import { CSS } from './styles/index.ts'

const e = React.createElement

export const inject = [
  'slots',
  'locale',
  'sessions',
  'workspaces',
  'remote',
  'remote.session',
]

interface ClientSlotsService {
  inject: (name: string, callback: () => void) => void
  register: (
    meta: {
      name: string
      id: string
      order?: number
      label?: () => string
    },
    component: React.ComponentType<Record<string, unknown>>,
  ) => void
}

interface ClientLocaleService {
  register: (
    ns: string,
    dicts: Record<string, Record<string, string>>,
  ) => (() => void) | void
  bind: (
    ns: string,
  ) => (key: string, vars?: Record<string, string | number>) => string
  subscribe: (callback: () => void) => () => void
}

class SessionSettingsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      '[@local/dsh-session-settings] Render Error:',
      error,
      errorInfo,
    )
  }

  render() {
    if (this.state.error) {
      return e(
        'div',
        {
          style: {
            padding: 32,
            color: '#f87171',
            background: 'var(--dsw-alias-bg-layer-1, #18181b)',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            height: '100%',
            overflow: 'auto',
          },
        },
        e('h3', { style: { marginTop: 0 } }, 'Session Settings Plugin Error:'),
        e('p', null, String(this.state.error.message || this.state.error)),
        e(
          'pre',
          { style: { fontSize: 12, opacity: 0.8 } },
          this.state.error.stack,
        ),
      )
    }
    return this.props.children
  }
}

export function apply(ctx: Context) {
  const slots = ctx.get('slots') as ClientSlotsService | undefined
  const locale = ctx.get('locale') as ClientLocaleService | undefined
  const remote = ctx.get('remote') as ClientRemoteServiceRef | undefined

  if (!slots || !locale) return

  // 1. Register Locale
  ctx.effect(() => {
    const dispose = locale.register(LOCALE_NS, {
      zh: locales.flattenDictionary(locales.zh),
      en: locales.flattenDictionary(locales.en),
    })
    return () => {
      if (typeof dispose === 'function') dispose()
    }
  }, 'session-settings: locale')

  let translator = locale.bind(LOCALE_NS)
  ctx.effect(() => {
    const unsub = locale.subscribe(() => {
      translator = locale.bind(LOCALE_NS)
    })
    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, 'session-settings: locale updates')

  // 2. Inject CSS
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = '@local/dsh-session-settings'
    style.textContent = CSS
    document.head.appendChild(style)
    return () => style.remove()
  }, 'session-settings: styles')

  // 3. Register Settings Section for MCP Servers (id: 'mcp-servers', order: 25)
  slots.inject('settings.section', () =>
    slots.register(
      {
        name: 'settings.section',
        id: 'mcp-servers',
        order: 25,
        label: () => translator('mcpServers.tabLabel'),
      },
      function McpSettingsSection(props: Record<string, unknown>) {
        return e(McpServersSettingsTab, {
          ...props,
          t: translator,
        })
      },
    ),
  )

  // 4. Register conversation.view tab slot (Independent tab right after 轨迹, order: 20)
  slots.inject('conversation.view', () =>
    slots.register(
      {
        name: 'conversation.view',
        id: 'session-settings',
        order: 20,
        label: () => translator('sessionSettings.title'),
      },
      // The framework injects sessionId/useSessions/useWorkspaces as standard
      // props for a session-scoped slot entry, so they stay reactive.
      function SessionSettingsTabSlot(props: Record<string, unknown>) {
        return e(
          SessionSettingsErrorBoundary,
          null,
          e(SessionSettingsViewPage, {
            ...props,
            remote,
            t: translator,
          }),
        )
      },
    ),
  )

  // 5. Register the session-settings chip in the official New Session row.
  //
  // This used to be a DOM injection: a MutationObserver scanned the body for a
  // private hero-row class and mounted a second React root inside it. The host
  // now exposes conversation.hero.options for exactly this seat, so the chip is
  // an ordinary slot entry and no root is created here.
  slots.inject('conversation.hero.options', () =>
    slots.register(
      {
        name: 'conversation.hero.options',
        id: 'session-settings',
        order: 10,
        label: () => translator('sessionSettings.title'),
      },
      function SessionSettingsHeroSeat() {
        return e(SessionSettingsHeroChip, {
          remote,
          locale: ctx.get('locale') as unknown as {
            bind?: (
              ns: string,
            ) => (key: string, vars?: Record<string, string | number>) => string
          },
          sessions: ctx.get('sessions') as unknown as {
            list?: {
              subscribe: (cb: () => void) => () => void
              getSnapshot: () => SessionsState
            }
          },
          workspaces: ctx.get('workspaces') as unknown as {
            list?: {
              subscribe: (cb: () => void) => () => void
              getSnapshot: () => WorkspacesState
            }
          },
        })
      },
    ),
  )

  // 6. Decorate the Settings sidebar nav icon for the MCP section.
  //
  // This is the one DOM operation left: the settings shell hardcodes a glyph per
  // section id and falls back to a gear for unknown ids, with no slot for an
  // icon. The anchor is this plugin's own localized label rather than a
  // hardcoded pair of strings, so a third locale keeps working.
  ctx.effect(() => {
    let frame = 0
    const mcpLabel = translator('mcpServers.tabLabel')
    const updateNavIcons = () => {
      // Only execute when a dialog is open (e.g. Settings dialog)
      if (document.querySelector('[role="dialog"]') === null) return

      const navButtons = document.querySelectorAll('button[class*="navCell"]')
      for (const btn of Array.from(navButtons)) {
        const label = btn.querySelector('span[class*="navLabel"]')
        if (!label) continue

        if (label.textContent === mcpLabel) {
          const iconSvg = btn.querySelector('svg[class*="navIcon"]')
          if (iconSvg && !iconSvg.getAttribute('data-mcp-official-icon')) {
            iconSvg.setAttribute('data-mcp-official-icon', 'true')
            iconSvg.setAttribute('viewBox', '0 0 16 16')
            iconSvg.innerHTML = `
              <path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M12.3368 1.53569L11.931 4.43172H14.8086V5.79673H11.7404L11.1962 9.67859H14.2839V11.0436H11.0056L10.4994 14.6529L9.14873 14.4643L9.62731 11.0436H5.75876L5.25252 14.6529L3.90186 14.4643L4.38043 11.0436H1.69141V9.67859H4.57104L5.11417 5.79673H2.21609V4.43172H5.30581L5.73724 1.34713L7.08995 1.53569L6.68414 4.43172H10.5527L10.9841 1.34713L12.3368 1.53569ZM5.94937 9.67859H9.81791L10.361 5.79673H6.49353L5.94937 9.67859Z" />
            `
          }
        }
      }
    }

    const scheduleUpdate = () => {
      if (frame !== 0) return
      frame = requestAnimationFrame(() => {
        frame = 0
        updateNavIcons()
      })
    }

    const observer = new MutationObserver(scheduleUpdate)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, 'session-settings: official sidebar nav icons')
}
