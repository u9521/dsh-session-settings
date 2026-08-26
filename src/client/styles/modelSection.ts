export const MODEL_SECTION_CSS = `
/* Forms & Selectors */
.dsh-sam-mode-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dsh-sam-mode-item {
  align-items: flex-start;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  transition: border-color 0.15s, background-color 0.15s;
}
.dsh-sam-mode-item:hover {
  background: var(--dsw-alias-bg-layer-2);
}
.dsh-sam-mode-item.selected {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-brand-primary);
}
.dsh-sam-mode-item input[type="radio"] {
  accent-color: var(--dsw-alias-brand-primary);
  cursor: pointer;
  margin-top: 3px;
}
.dsh-sam-mode-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.dsh-sam-mode-title-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.dsh-sam-mode-title {
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 600;
}
.dsh-sam-title-badge {
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 14px;
  padding: 1px 6px;
}
.dsh-sam-title-badge.inherit {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
  color: var(--dsw-alias-label-secondary);
}
.dsh-sam-title-badge.custom {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #1383fe) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary, #1383fe) 30%, transparent);
  color: var(--dsw-alias-brand-primary, #1383fe);
}
.dsh-sam-title-badge.default {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
  color: var(--dsw-alias-label-tertiary);
}
.dsh-sam-title-badge.workspace {
  background: color-mix(in srgb, #10b981 15%, transparent);
  border: 1px solid color-mix(in srgb, #10b981 30%, transparent);
  color: #10b981;
}
.dsh-sam-mode-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
.dsh-sam-fields-panel {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
}
.dsh-sam-field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dsh-sam-field-label {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  font-weight: 500;
}
.dsh-sam-select {
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  height: 36px;
  line-height: 20px;
  max-width: 100%;
  min-width: 0;
  padding: 0 10px;
  width: 100%;
}
.dsh-sam-select:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dsh-sam-select:disabled {
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-tertiary);
  cursor: not-allowed;
  opacity: 0.7;
}

/* Effective Model Preview Card */
.dsh-sam-effective-model-card {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px dashed var(--dsw-alias-border-l1);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
  padding: 14px 16px;
}
.dsh-sam-effective-model-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
}
.dsh-sam-effective-model-title {
  align-items: center;
  color: var(--dsw-alias-label-secondary);
  display: flex;
  font-size: 12px;
  font-weight: 600;
  gap: 6px;
  text-transform: uppercase;
}
.dsh-sam-effective-model-source {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
  border-radius: 4px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  padding: 2px 6px;
}
.dsh-sam-effective-model-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.dsh-sam-effective-model-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dsh-sam-effective-model-label {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
}
.dsh-sam-effective-model-value {
  color: var(--dsw-alias-label-primary);
  font-family: monospace;
  font-size: 13px;
  font-weight: 500;
}
`
