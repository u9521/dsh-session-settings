export const BASE_CSS = `
/* ----------------------------------------------------
   Session Settings View Page (conversation.view Tab after 轨迹)
   Hide bottom composer & make settings page fill bottom
   ---------------------------------------------------- */
[data-conversation-scroll]:has([data-session-settings-view]) > [data-composer-seat],
[data-conversation-scroll]:has(.dsh-session-view-root) > [data-composer-seat],
:has(> * > * > [data-session-settings-view]) > [data-composer-seat],
:has(> * > * > .dsh-session-view-root) > [data-composer-seat],
[data-conversation-scroll]:has([data-session-settings-view]) [class*="composerSeat"],
[data-conversation-scroll]:has(.dsh-session-view-root) [class*="composerSeat"] {
  display: none !important;
}

[data-conversation-scroll]:has([data-session-settings-view]),
[data-conversation-scroll]:has(.dsh-session-view-root) {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 0% !important;
  height: 100% !important;
  min-height: 0 !important;
  overflow: hidden !important;
  scrollbar-gutter: auto !important;
}

[data-conversation-scroll]:has([data-session-settings-view]) > [data-slot="conversation.session"],
[data-conversation-scroll]:has(.dsh-session-view-root) > [data-slot="conversation.session"],
[data-conversation-scroll]:has([data-session-settings-view]) [data-slot="conversation.view"],
[data-conversation-scroll]:has(.dsh-session-view-root) [data-slot="conversation.view"],
[data-conversation-scroll]:has([data-session-settings-view]) [class*="viewArea"],
[data-conversation-scroll]:has(.dsh-session-view-root) [class*="viewArea"] {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 0% !important;
  height: 100% !important;
  min-height: 0 !important;
  overflow: hidden !important;
}

.dsh-session-view-root {
  background: var(--dsw-alias-bg-layer-1);
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary);
  display: flex;
  flex-direction: column;
  flex: 1 1 0%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  position: relative;
  width: 100%;
}
.dsh-session-view-root * {
  box-sizing: border-box;
}

.dsh-sam-status-badge {
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
}
.dsh-sam-status-badge.badge-default {
  background: color-mix(in srgb, var(--dsw-alias-label-tertiary, #888) 15%, transparent);
  color: var(--dsw-alias-label-secondary);
}
.dsh-sam-status-badge.badge-workspace {
  background: color-mix(in srgb, #10b981 15%, transparent);
  color: #10b981;
}
.dsh-sam-status-badge.badge-custom {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #1383fe) 15%, transparent);
  color: var(--dsw-alias-brand-primary, #1383fe);
}

.dsh-sam-notice {
  border-radius: 6px;
  font-size: 13px;
  line-height: 20px;
  padding: 10px 14px;
}
.dsh-sam-notice.success {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
}
.dsh-sam-notice.error {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}
.dsh-sam-notice.info {
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}
.dsh-sam-notices-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0 16px;
}
.dsh-sam-notices-block .dsh-sam-notice {
  margin: 0;
}

.dsh-sam-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  margin: 0;
}
.dsh-sam-modal-subtitle {
  padding: 14px 24px 0;
}
.dsh-sam-modal-subtitle .dsh-sam-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  margin: 0;
}

.dsh-sam-btn {
  align-items: center;
  border-radius: 6px;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  gap: 6px;
  justify-content: center;
  line-height: 1;
  transition: background-color 0.15s, border-color 0.15s, opacity 0.15s;
  vertical-align: middle;
}
.dsh-sam-btn.primary {
  background: var(--dsw-alias-brand-primary);
  border: 1px solid var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-label-primary-foreground);
  height: 32px;
  padding: 0 12px;
}
.dsh-sam-btn.primary:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover, var(--dsw-alias-brand-primary));
  border-color: var(--dsw-alias-button-primary-hover, var(--dsw-alias-brand-primary));
}
.dsh-sam-btn.secondary {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-primary);
  height: 34px;
  padding: 0 13px;
}
.dsh-sam-btn.secondary:hover:not(:disabled) {
  background: var(--dsw-alias-bg-layer-2);
}
.dsh-sam-btn.default-btn {
  background: rgba(147, 51, 234, 0.12);
  border: 1px solid rgba(147, 51, 234, 0.3);
  color: var(--dsw-alias-label-primary);
  height: 34px;
  padding: 0 13px;
}
.dsh-sam-btn.default-btn:hover:not(:disabled) {
  background: rgba(147, 51, 234, 0.22);
}
.dsh-sam-btn.tertiary {
  background: 0 0;
  border: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  height: 34px;
  padding: 0 13px;
}
.dsh-sam-btn.tertiary:hover {
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
}
.dsh-sam-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* Modal and view footer action buttons symmetry */
.dsh-mcp-modal-footer .dsh-sam-btn.primary,
.dsh-sam-actions .dsh-sam-btn.primary,
.dsh-view-footer-right .dsh-sam-btn.primary {
  height: 32px;
  min-width: 68px;
  padding: 0 14px;
}
.dsh-mcp-modal-footer .dsh-sam-btn.secondary,
.dsh-mcp-modal-footer .dsh-sam-btn.tertiary,
.dsh-mcp-modal-footer .dsh-sam-btn.default-btn,
.dsh-sam-actions .dsh-sam-btn.secondary,
.dsh-sam-actions .dsh-sam-btn.tertiary,
.dsh-sam-actions .dsh-sam-btn.default-btn,
.dsh-view-footer-right .dsh-sam-btn.secondary,
.dsh-view-footer-right .dsh-sam-btn.tertiary,
.dsh-view-footer-right .dsh-sam-btn.default-btn {
  height: 34px;
  min-width: 70px;
  padding: 0 15px;
}

@keyframes dsh-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.dsh-spin {
  animation: dsh-spin 1s linear infinite;
}
`
