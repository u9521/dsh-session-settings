import * as React from 'react'

/**
 * Clipboard copy with a short-lived "copied" marker.
 *
 * Both the resource and prompt tabs offer copy buttons, and both need the same
 * feedback, so the marker and its timer live here rather than being reimplemented
 * per panel. The timer is cleared on unmount so a panel closed mid-feedback
 * cannot set state on a dead component.
 */
export function useCopyFeedback() {
  const [copiedKey, setCopiedKey] = React.useState<string | undefined>()
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  React.useEffect(
    () => () => {
      if (timer.current !== undefined) clearTimeout(timer.current)
    },
    [],
  )

  const copy = React.useCallback((text: string, key: string) => {
    const write = navigator?.clipboard?.writeText
      ? navigator.clipboard.writeText(text)
      : Promise.reject(new Error('clipboard unavailable'))
    void write
      .then(() => {
        setCopiedKey(key)
        if (timer.current !== undefined) clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopiedKey(undefined), 2000)
      })
      .catch(() => {
        // A denied clipboard is not worth an error banner; the user can select
        // the URI from the read-only field instead.
      })
  }, [])

  return { copiedKey, copy }
}
