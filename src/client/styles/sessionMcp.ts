export const SESSION_MCP_CSS = `
/* MCP session checklist */
.dsh-session-mcp-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dsh-mcp-quick-bar {
  align-items: center;
  display: flex;
  gap: 10px;
  margin-bottom: 2px;
}
.dsh-mcp-select-btn {
  align-items: center;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  display: inline-flex;
  font-size: 12px;
  font-weight: 500;
  gap: 6px;
  line-height: 16px;
  padding: 6px 12px;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}
.dsh-mcp-select-btn:hover {
  background: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-1));
  border-color: var(--dsw-alias-border-l1);
}
.dsh-mcp-select-btn.active {
  background: rgba(88, 166, 255, 0.1);
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-brand-primary);
}
.dsh-mcp-text-btn {
  align-items: center;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  display: inline-flex;
  font-size: 12px;
  font-weight: 500;
  gap: 6px;
  line-height: 16px;
  padding: 6px 12px;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}
.dsh-mcp-text-btn:hover {
  background: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-1));
  border-color: var(--dsw-alias-border-l1);
}
.dsh-session-mcp-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dsh-session-mcp-card {
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  transition: background-color 0.15s, border-color 0.15s, opacity 0.15s;
}
.dsh-session-mcp-card:hover {
  border-color: var(--dsw-alias-border-l1);
}
.dsh-session-mcp-card.active {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-border-l1);
}
.dsh-session-mcp-card.disabled {
  background: var(--dsw-alias-bg-layer-1);
  border-style: dashed;
  opacity: 0.85;
}
.dsh-session-mcp-card.readonly {
  opacity: 0.8;
}
.dsh-session-mcp-header {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  width: 100%;
}
.dsh-session-mcp-identity {
  align-items: center;
  display: flex;
  flex: 1 1 0%;
  gap: 10px;
  min-width: 0;
}
.dsh-session-mcp-icon {
  align-items: center;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  color: var(--dsw-alias-brand-primary);
  display: flex;
  flex: none;
  height: 32px;
  justify-content: center;
  width: 32px;
}
.dsh-session-mcp-title-wrap {
  align-items: center;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.dsh-session-mcp-name {
  color: var(--dsw-alias-label-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
}
.dsh-session-mcp-id {
  color: var(--dsw-alias-label-secondary);
  font-family: monospace;
  font-size: 12px;
  line-height: 16px;
}
.dsh-session-mcp-switch-wrap {
  align-items: center;
  display: flex;
  flex-shrink: 0;
}
.dsh-session-mcp-switch-wrap .dsh-mcp-switch-btn {
  cursor: pointer;
  pointer-events: auto;
}
.dsh-session-mcp-badges-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 2px 0;
}
.dsh-session-mcp-item {
  align-items: center;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  gap: 12px;
  outline: none;
  padding: 12px 16px;
  transition: background-color 0.15s, border-color 0.15s;
  user-select: none;
}
.dsh-session-mcp-item:hover:not(.readonly) {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-border-l1);
}
.dsh-session-mcp-item:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -1px;
}
.dsh-session-mcp-item.active {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-brand-primary);
}
.dsh-session-mcp-item.readonly {
  cursor: default;
  opacity: 0.8;
}
.dsh-session-mcp-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.dsh-session-mcp-row1 {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-start;
}
.dsh-session-mcp-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 18px;
  margin: 0;
}
.dsh-session-mcp-target-box {
  display: flex;
  width: 100%;
}
.dsh-session-mcp-target {
  background: var(--dsw-alias-bg-layer-1);
  border-radius: 4px;
  color: var(--dsw-alias-label-secondary);
  display: inline-block;
  font-family: monospace;
  font-size: 11px;
  line-height: 16px;
  overflow: hidden;
  padding: 4px 8px;
  text-overflow: ellipsis;
  user-select: text;
  white-space: nowrap;
  width: 100%;
}
.dsh-session-mcp-check {
  color: var(--dsw-alias-brand-primary);
  display: flex;
  flex: none;
}
.dsh-session-mcp-footer {
  align-items: center;
  display: flex;
  justify-content: flex-end;
  margin-top: 2px;
  width: 100%;
}
.dsh-session-mcp-tools-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.dsh-session-tools-btn {
  align-items: center;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  gap: 6px;
  height: 28px;
  line-height: 16px;
  padding: 0 10px;
  transition: background-color 0.15s, border-color 0.15s;
}
.dsh-session-tools-btn:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  border-color: var(--dsw-alias-border-l1);
}
.dsh-session-tools-mode-badge {
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 14px;
  padding: 2px 6px;
}
.dsh-session-tools-mode-badge.default {
  background: rgba(147, 51, 234, 0.1);
  color: #a855f7;
}
.dsh-session-tools-mode-badge.custom {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}
.dsh-session-tools-mode-badge.all-active {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}
.dsh-session-tools-modes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 6px;
}
`
