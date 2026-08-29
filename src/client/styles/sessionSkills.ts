export const SESSION_SKILLS_CSS = `
/* Skills Session Management */
.dsh-session-skills-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dsh-skills-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: space-between;
  margin-bottom: 4px;
}
.dsh-skills-search-input {
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  line-height: 18px;
  outline: none;
  padding: 6px 10px 6px 30px;
  transition: border-color 0.15s;
  width: 100%;
}
.dsh-skills-search-input:focus {
  border-color: var(--dsw-alias-brand-primary);
}
.dsh-session-skills-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Skill Badges */
.dsh-skill-badge {
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 14px;
  padding: 2px 6px;
}
.dsh-skill-badge.source-project {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}
.dsh-skill-badge.source-user {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}
.dsh-skill-badge.source-bundled {
  background: rgba(147, 51, 234, 0.12);
  color: #a855f7;
}
.dsh-skill-badge.source-runtime {
  background: rgba(107, 114, 128, 0.15);
  color: var(--dsw-alias-label-secondary);
}
.dsh-skill-badge.status-disabled {
  background: rgba(218, 54, 51, 0.12);
  color: var(--dsw-alias-state-error-primary, #da3633);
}
.dsh-skill-badge.status-enabled {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}

/* Standalone Skill Modal */
.dsh-skill-modal {
  display: flex;
  flex-direction: column;
  height: auto;
  max-height: 88vh;
  max-width: 720px;
  width: 90vw;
}
.dsh-skill-modal-header-meta {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.dsh-skill-modal-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: 16px;
  max-height: calc(88vh - 140px);
  overflow-y: auto;
  padding: 8px 2px;
}
.dsh-skill-modal-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dsh-skill-modal-section-title {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  margin: 0;
}
.dsh-skill-modal-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  margin: 0;
}
.dsh-skill-runtime-note {
  background: rgba(245, 158, 11, 0.08);
  border: 1px dashed rgba(245, 158, 11, 0.3);
  border-radius: 6px;
  color: var(--dsw-alias-state-warning-primary, #f59e0b);
  font-size: 12px;
  line-height: 16px;
  padding: 8px 12px;
}
.dsh-skill-detail-meta {
  color: var(--dsw-alias-label-secondary);
  display: flex;
  flex-direction: column;
  font-size: 12px;
  gap: 4px;
}
.dsh-skill-detail-path {
  color: var(--dsw-alias-label-primary);
  font-family: monospace;
  word-break: break-all;
}
.dsh-skill-content-block {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-primary);
  font-family: monospace;
  font-size: 12px;
  line-height: 18px;
  margin: 0;
  max-height: 320px;
  overflow-y: auto;
  padding: 12px 14px;
  white-space: pre-wrap;
  word-break: break-word;
}
`
