import js from '@eslint/js'
import globals from 'globals'
import ts from 'typescript-eslint'
import { defineConfig } from 'eslint/config'

/**
 * Flat ESLint config for the two halves plus the build scripts.
 *
 * The halves run in different worlds: `src/client/**` is a browser closure
 * handed to `window.__ModuleLoader__`, while `src/server/**` is an ordinary
 * Node cordis plugin. Declaring the globals per directory is what lets a
 * stray `process.env` in the client, or a stray `document` in the server,
 * fail here instead of at runtime.
 *
 * Rules follow the sibling plugins (`dsh-advanced-model-editor`,
 * `dsh-cust-search`) with three local relaxations this repository needs:
 * empty catches are deliberate best-effort cleanups, `any` is warned rather
 * than failed so a first introduction does not block on existing code, and
 * `console` is product behaviour (plugin diagnostics), not debris.
 */
export default defineConfig(
  {
    ignores: ['lib/**', 'node_modules/**', '*.d.ts'],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['src/client/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ['src/server/**/*.ts', 'src/index.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.mjs', '*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['src/**/*.ts', 'scripts/**/*.mjs', '*.mjs', '*.js'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'off',
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
