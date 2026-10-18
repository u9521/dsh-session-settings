/**
 * One invalidation seam for every policy surface this plugin owns.
 *
 * A settings or server write changes what the model may see, but the running
 * agents each hold scope-layer declarations (tool restrictions, prompt-section
 * shadows, skill re-registrations) installed at creation time. Those
 * declarations must be re-derived after every write, and the write paths are
 * spread across three route modules.
 *
 * Before this module each writer fanned out by hand to the projections it
 * happened to know about, which is why a skill toggle shipped a
 * `ctx.emit('skills/change')` that nothing listened to: the write looked
 * successful while every live agent kept its old policy.
 *
 * Subscribers run in registration order, and that order is a contract:
 * the manager syncs first (mounting or unmounting servers changes the tool
 * set), then the projections re-install declarations against that new set.
 * A failing subscriber is logged and skipped so one broken projection cannot
 * strand the others on stale policy.
 */
export type PolicyInvalidator = () => void

export class PolicyBus {
  private readonly subscribers: Array<{
    name: string
    run: PolicyInvalidator
  }> = []

  /**
   * Register one invalidator.
   *
   * @param name - diagnostic label used when the subscriber throws.
   * @param run - the invalidation work.
   * @returns the disposer removing this subscriber.
   */
  public subscribe(name: string, run: PolicyInvalidator): () => void {
    const entry = { name, run }
    this.subscribers.push(entry)
    return () => {
      const index = this.subscribers.indexOf(entry)
      if (index >= 0) this.subscribers.splice(index, 1)
    }
  }

  /** Re-derive every policy surface, in registration order. */
  public invalidate(): void {
    for (const { name, run } of [...this.subscribers]) {
      try {
        run()
      } catch (err: unknown) {
        console.warn(
          `[session-settings] [POLICY] Invalidator "${name}" failed; continuing:`,
          err instanceof Error ? err.message : String(err),
        )
      }
    }
  }
}
