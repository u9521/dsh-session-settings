/**
 * Styles for the session sandbox panel: the extra writable directories and
 * their purpose sentences.
 *
 * The path column is monospace because these are filesystem paths a user
 * compares character by character; the description column is not, because it is
 * prose the model quotes back.
 */
export const SANDBOX_SECTION_CSS = `
.dsh-sandbox-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}
.dsh-sandbox-title {
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 600;
}
.dsh-sandbox-subtitle {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
.dsh-sandbox-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dsh-sandbox-row {
  align-items: center;
  display: flex;
  gap: 8px;
}
.dsh-sandbox-add {
  border-top: 1px dashed var(--dsw-alias-border-l2);
  margin-top: 12px;
  padding-top: 12px;
}
.dsh-sandbox-input {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  min-width: 0;
  padding: 6px 10px;
}
.dsh-sandbox-input:focus {
  border-color: var(--dsw-alias-brand-primary);
  outline: none;
}
.dsh-sandbox-input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
/* The path column is fixed-width so stacked rows align for comparison. */
.dsh-sandbox-input-path {
  flex: 0 0 42%;
  font-family: monospace;
}
.dsh-sandbox-input-desc {
  flex: 1 1 auto;
}
.dsh-sandbox-hint {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  margin-top: 10px;
}
/*
 * Presets. The buttons wrap rather than scroll: seven groups do not fit one
 * row, and a horizontally scrolling strip would hide the groups a user has not
 * thought to look for.
 */
.dsh-sandbox-templates {
  border-top: 1px dashed var(--dsw-alias-border-l2);
  margin-top: 12px;
  padding-top: 12px;
}
.dsh-sandbox-templates-label {
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
}
.dsh-sandbox-templates-groups {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dsh-sandbox-template-btn {
  align-items: center;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  display: inline-flex;
  font-size: 12px;
  gap: 6px;
  padding: 4px 10px;
}
.dsh-sandbox-template-btn:hover:not(:disabled) {
  border-color: var(--dsw-alias-brand-primary);
}
.dsh-sandbox-template-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
/* An exhausted preset stays visible but reads as done, so the row does not
   reshuffle under the pointer as presets are consumed. */
.dsh-sandbox-template-btn.added {
  border-style: dashed;
}
.dsh-sandbox-template-mark {
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
}
.dsh-sandbox-notice {
  align-items: flex-start;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 12px;
}
.dsh-sandbox-notice-text {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
.dsh-sandbox-skipped {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  margin-top: 12px;
  padding: 10px 12px;
}
.dsh-sandbox-skipped-title {
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
}
.dsh-sandbox-skipped-row {
  align-items: center;
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
.dsh-sandbox-skipped-reason {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}
`
