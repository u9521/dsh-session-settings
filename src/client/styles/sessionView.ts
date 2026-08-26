export const SESSION_VIEW_CSS = `
/* Header & Clone Toolbar */
.dsh-session-view-header {
  background: var(--dsw-alias-bg-layer-2);
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 10px;
  padding: 14px 24px;
  position: relative;
}
.dsh-session-view-header-top {
  align-items: center;
  display: flex;
  justify-content: space-between;
  min-height: 24px;
  width: 100%;
}
.dsh-session-view-header .dsh-sam-close-btn {
  position: absolute;
  right: 24px;
  top: 24px;
}
.dsh-session-view-title {
  color: var(--dsw-alias-label-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  margin: 0;
}
.dsh-clone-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.dsh-session-view-header-meta {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Session ID Chip */
.dsh-session-id-chip {
  align-items: center;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  display: inline-flex;
  font-family: monospace;
  font-size: 12px;
  gap: 6px;
  line-height: 16px;
  padding: 4px 10px;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}
.dsh-session-id-chip:hover {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-primary);
}
.dsh-session-id-chip.copied {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.dsh-header-workspace-chip {
  cursor: default;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Clone Toolbar */
.dsh-clone-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.dsh-clone-label {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-weight: 500;
}
.dsh-clone-input {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-primary);
  font-family: monospace;
  font-size: 12px;
  height: 30px;
  outline: none;
  padding: 0 10px;
  transition: border-color 0.15s;
  width: 250px;
}
.dsh-clone-input:focus {
  border-color: var(--dsw-alias-brand-primary);
}
.dsh-clone-btn {
  font-size: 12px;
  height: 30px;
  padding: 0 12px;
}
.dsh-btn-icon-left {
  margin-right: 6px;
}

.dsh-view-notice {
  margin: 12px 24px 0;
}

/* Split Body */
.dsh-session-view-body {
  display: flex;
  flex: 1 1 0%;
  min-height: 0;
  overflow: hidden;
}

/* Left Sub-sidebar (clean layout: icon + title + badge) */
.dsh-session-view-sidebar {
  background: var(--dsw-alias-bg-layer-2);
  border-right: 1px solid var(--dsw-alias-border-l2);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 4px;
  overflow-y: auto;
  padding: 16px 12px;
  width: 230px;
}
.dsh-view-sidebar-item {
  align-items: center;
  background: 0 0;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  text-align: left;
  transition: background-color 0.15s, border-color 0.15s;
  width: 100%;
}
.dsh-view-sidebar-item:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-view-sidebar-item.active {
  background: var(--dsw-alias-bg-layer-1);
  border-color: var(--dsw-alias-border-l2);
  box-shadow: var(--dsw-shadow-lv1);
}
.dsh-view-item-icon {
  align-items: center;
  background: var(--dsw-alias-bg-layer-1);
  border-radius: 6px;
  color: var(--dsw-alias-brand-primary);
  display: flex;
  flex-shrink: 0;
  height: 28px;
  justify-content: center;
  width: 28px;
}
.dsh-view-sidebar-item.active .dsh-view-item-icon {
  background: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-label-primary-foreground);
}
.dsh-view-item-title {
  color: var(--dsw-alias-label-primary);
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  min-width: 0;
}
.dsh-view-sidebar-item.active .dsh-view-item-title {
  font-weight: 600;
}
.dsh-view-item-badge {
  background: var(--dsw-alias-bg-layer-1);
  border-radius: 4px;
  color: var(--dsw-alias-label-secondary);
  flex-shrink: 0;
  font-size: 11px;
  max-width: 80px;
  overflow: hidden;
  padding: 2px 6px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-view-item-badge.highlight {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
  font-weight: 600;
}

/* Right Content Panel */
.dsh-session-view-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 24px 32px 60px;
}
.dsh-view-content-inner {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 760px;
}

/* Section Header inside Content Panel */
.dsh-section-header {
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 4px;
  padding-bottom: 12px;
}
.dsh-section-title {
  color: var(--dsw-alias-label-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  margin: 0;
}
.dsh-section-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 18px;
  margin: 0;
}

/* Footer Actions */
.dsh-session-view-footer {
  align-items: center;
  background: var(--dsw-alias-bg-layer-2);
  border-top: 1px solid var(--dsw-alias-border-l2);
  display: flex;
  flex-shrink: 0;
  justify-content: space-between;
  padding: 14px 28px;
}
.dsh-view-footer-left {
  align-items: center;
  display: flex;
  gap: 10px;
}
.dsh-view-footer-right {
  align-items: center;
  display: flex;
  gap: 10px;
}
`
