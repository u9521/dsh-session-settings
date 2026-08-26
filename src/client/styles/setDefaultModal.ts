export const SET_DEFAULT_MODAL_CSS = `
/* Set Default Modal & Diff Layout */
.dsh-set-default-modal-overlay {
  align-items: center;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  bottom: 0;
  display: flex;
  justify-content: center;
  left: 0;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 10000;
}
.dsh-set-default-modal-panel {
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  box-shadow: var(--dsw-shadow-lv3);
  display: flex;
  flex-direction: column;
  height: min(600px, calc(100vh - 80px));
  max-height: calc(100vh - 80px);
  max-width: calc(100vw - 48px);
  overflow: hidden;
  position: relative;
  width: min(720px, calc(100vw - 48px));
}
.dsh-set-default-modal-header {
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 20px;
  position: relative;
}
.dsh-set-default-modal-title-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-right: 36px;
}
.dsh-set-default-modal-title {
  color: var(--dsw-alias-label-primary);
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}
.dsh-modal-workspace-chip {
  cursor: default;
  max-width: 340px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-set-default-modal-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  margin: 0;
}
.dsh-set-default-scope-row {
  align-items: center;
  display: flex;
  gap: 10px;
  margin-top: 4px;
}
.dsh-set-default-scope-label {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 500;
}
.dsh-set-default-scope-tabs {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  display: flex;
  padding: 2px;
}
.dsh-set-default-scope-btn {
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  font-size: 12px;
  padding: 4px 12px;
  transition: background-color 0.15s, color 0.15s;
}
.dsh-set-default-scope-btn:hover {
  color: var(--dsw-alias-label-primary);
}
.dsh-set-default-scope-btn.active {
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  color: var(--dsw-alias-brand-primary, #1383fe);
  font-weight: 600;
}
.dsh-set-default-modal-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  padding: 16px 20px;
}
.dsh-diff-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dsh-diff-row {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.dsh-diff-row-header {
  align-items: center;
  background: var(--dsw-alias-bg-layer-2);
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  display: flex;
  justify-content: space-between;
  padding: 8px 14px;
}
.dsh-diff-row-title {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 600;
}
.dsh-diff-changed-tag {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #1383fe) 15%, transparent);
  border-radius: 4px;
  color: var(--dsw-alias-brand-primary, #1383fe);
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
}
.dsh-diff-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.dsh-diff-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
}
.dsh-diff-col.before {
  border-right: 1px solid var(--dsw-alias-border-l2);
}
.dsh-diff-col.after {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #1383fe) 5%, transparent);
}
.dsh-diff-col-title {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  font-weight: 500;
}
.dsh-diff-col-value {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 18px;
}
.dsh-diff-col-value.changed {
  color: var(--dsw-alias-brand-primary, #1383fe);
  font-weight: 500;
}
.dsh-set-default-modal-footer {
  align-items: center;
  border-top: 1px solid var(--dsw-alias-border-l2);
  display: flex;
  justify-content: space-between;
  padding: 12px 20px;
}
.dsh-set-default-footer-right {
  align-items: center;
  display: flex;
  gap: 10px;
}
`
