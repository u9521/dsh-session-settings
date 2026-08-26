export const HERO_CHIP_CSS = `
/* Hero Session Settings Chip */
.dsh-hero-session-settings-seat {
  align-items: center;
  display: inline-flex;
  flex-shrink: 0;
}
.dsh-hero-session-settings-chip {
  align-items: center;
  background: var(--dsw-alias-bg-layer-1, #1e1e20);
  border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.08));
  border-radius: 16px;
  box-sizing: border-box;
  color: var(--dsw-alias-label-secondary, #9ca3af);
  cursor: pointer;
  display: inline-flex;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  gap: 6px;
  height: 28px;
  line-height: 16px;
  max-width: 220px;
  padding: 0 10px;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
  user-select: none;
}
.dsh-hero-session-settings-chip:hover,
.dsh-hero-session-settings-chip.active {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.06));
  border-color: var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.15));
  color: var(--dsw-alias-label-primary, #ffffff);
}
.dsh-hero-session-settings-chip.customized {
  border-color: var(--dsw-color-brand, #1383fe);
  color: var(--dsw-color-brand, #1383fe);
}
.dsh-hero-session-settings-icon {
  color: var(--dsw-alias-label-tertiary);
  flex-shrink: 0;
  transition: color 0.15s;
}
.dsh-hero-session-settings-chip:hover .dsh-hero-session-settings-icon {
  color: var(--dsw-alias-label-primary);
}
.dsh-hero-session-settings-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-hero-session-settings-badge {
  align-items: center;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  color: var(--dsw-alias-label-secondary);
  display: inline-flex;
  font-size: 11px;
  font-weight: 500;
  line-height: 14px;
  margin-left: 2px;
  padding: 1px 6px;
}
.dsh-hero-session-settings-badge.highlight {
  background: var(--dsw-color-brand-transparent, rgba(19, 131, 254, 0.1));
  border-color: var(--dsw-color-brand, #1383fe);
  color: var(--dsw-color-brand, #1383fe);
}

/* Modal panel in Hero dialog */
.dsh-session-settings-modal-panel {
  background: var(--dsw-alias-bg-layer-1, #1e1e20);
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.12));
  border-radius: 16px;
  box-shadow: var(--dsw-shadow-lv3, 0 16px 36px rgba(0, 0, 0, 0.4));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: min(720px, calc(100vh - 48px));
  max-height: calc(100vh - 48px);
  max-width: calc(100vw - 48px);
  overflow: hidden;
  padding: 0;
  position: relative;
  width: 900px;
  z-index: 1;
}
.dsh-session-settings-modal-panel .dsh-session-view-root {
  border-radius: 16px;
  flex: 1 1 0%;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  overflow: hidden;
}
`
