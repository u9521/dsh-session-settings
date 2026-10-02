import * as React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { createRoot, type Root } from 'react-dom/client'
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

  // 5. Decorate Settings sidebar nav icons for MCP Servers using official icons
  ctx.effect(() => {
    let frame = 0
    const updateNavIcons = () => {
      // Only execute when a dialog is open (e.g. Settings dialog)
      if (document.querySelector('[role="dialog"]') === null) return

      const navButtons = document.querySelectorAll('button[class*="navCell"]')
      for (const btn of Array.from(navButtons)) {
        const label = btn.querySelector('span[class*="navLabel"]')
        if (!label) continue

        // MCP Servers icon: IconCodeOutlineMedium
        if (
          label.textContent === 'MCP 服务器' ||
          label.textContent === 'MCP Servers'
        ) {
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

  // 6. Mount Hero Session Settings Chip (in New Conversation Hero right after agent preset selector)
  ctx.effect(() => {
    let unmounted = false
    let currentRoot: Root | null = null
    let currentContainer: HTMLElement | null = null
    let frame = 0

    const checkMount = () => {
      if (unmounted) return
      const heroRow = document.querySelector(
        'div[class*="heroWorkspaceRow"], div[class*="workspaceRow"]',
      )
      if (!heroRow) {
        if (currentRoot) {
          currentRoot.unmount()
          currentRoot = null
          currentContainer = null
        }
        return
      }

      // If container already mounted in this row and still in DOM
      if (currentContainer && heroRow.contains(currentContainer)) {
        // Ensure it stays after the agent preset selector button if agent preset loaded later
        const seatBtn = heroRow.querySelector(
          'button[class*="seat"], div[class*="seat"], [class*="agentPreset"]',
        )
        if (
          seatBtn &&
          seatBtn.parentNode === heroRow &&
          currentContainer.previousElementSibling !== seatBtn
        ) {
          seatBtn.after(currentContainer)
        }
        return
      }

      if (currentRoot) {
        currentRoot.unmount()
        currentRoot = null
        currentContainer = null
      }

      const container = document.createElement('div')
      container.setAttribute('data-dsh-hero-session-settings', '')
      container.className = 'dsh-hero-session-settings-seat'

      // Insert directly after Agent Preset selector (button[class*="seat"]) if present, else append
      const seatBtn = heroRow.querySelector(
        'button[class*="seat"], div[class*="seat"], [class*="agentPreset"]',
      )
      if (seatBtn && seatBtn.parentNode === heroRow) {
        seatBtn.after(container)
      } else {
        heroRow.appendChild(container)
      }

      currentContainer = container
      currentRoot = createRoot(container)

      currentRoot.render(
        e(SessionSettingsHeroChip, {
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
        }),
      )
    }

    const scheduleCheck = () => {
      if (frame !== 0) return
      frame = requestAnimationFrame(() => {
        frame = 0
        checkMount()
      })
    }

    const observer = new MutationObserver(scheduleCheck)
    observer.observe(document.body, { childList: true, subtree: true })
    scheduleCheck()

    return () => {
      unmounted = true
      if (frame !== 0) cancelAnimationFrame(frame)
      observer.disconnect()
      if (currentRoot) {
        currentRoot.unmount()
        currentRoot = null
        currentContainer = null
      }
    }
  }, 'session-settings: hero chip')
}
